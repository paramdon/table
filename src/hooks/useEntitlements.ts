import { useState, useEffect, useCallback } from 'react';
import {
  FeatureKey,
  PlanId,
  PLAN_DEFINITIONS,
  FEATURE_CATALOG,
  getPlanDefinition,
  hasPlanEntitlement,
  getPlanEntitlementMap,
} from '../config/subscriptionPlans';
import { RestaurantSubscriptionRecord, SubscriptionPlanConfig } from '../types/dcc';

export interface LockedFeatureError {
  code: 'FEATURE_LOCKED';
  featureKey: FeatureKey;
  featureLabel: string;
  currentPlanId: string;
  currentPlanName: string;
  requiredPlanId: PlanId;
  requiredPlanName: string;
  requiredPlanPriceInr: number;
  error: string;
}

export function resolveOwnerAuthToken(explicitToken?: string): string {
  if (explicitToken && explicitToken.trim()) return explicitToken.trim();
  try {
    const raw = localStorage.getItem('urdearmenu_trusted_staff_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.sessionToken) return parsed.sessionToken;
    }
  } catch {
    // ignore storage read error
  }
  return '';
}

export function buildAuthHeaders(explicitToken?: string): Record<string, string> {
  const token = resolveOwnerAuthToken(explicitToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function parseFeatureLockedPayload(data: any): LockedFeatureError | null {
  if (!data || data.code !== 'FEATURE_LOCKED') return null;
  const featureKey = (data.featureKey || 'floor_map') as FeatureKey;
  const meta = FEATURE_CATALOG[featureKey];
  const reqPlan = getPlanDefinition(data.requiredPlanId || meta?.minPlanId || 'plan_essential');
  return {
    code: 'FEATURE_LOCKED',
    featureKey,
    featureLabel: data.featureLabel || meta?.label || featureKey,
    currentPlanId: data.currentPlanId || 'plan_flex',
    currentPlanName: data.currentPlanName || 'Flex',
    requiredPlanId: reqPlan.id,
    requiredPlanName: data.requiredPlanName || reqPlan.name,
    requiredPlanPriceInr: data.requiredPlanPriceInr ?? reqPlan.priceInr,
    error: data.error || `${meta?.label || featureKey} requires the ${reqPlan.name} plan.`,
  };
}

export function createClientLockedError(featureKey: FeatureKey, currentPlanId?: string): LockedFeatureError {
  const meta = FEATURE_CATALOG[featureKey];
  const currentPlan = getPlanDefinition(currentPlanId || 'plan_flex');
  const reqPlan = getPlanDefinition(meta?.minPlanId || 'plan_essential');
  return {
    code: 'FEATURE_LOCKED',
    featureKey,
    featureLabel: meta?.label || featureKey,
    currentPlanId: currentPlan.id,
    currentPlanName: currentPlan.name,
    requiredPlanId: reqPlan.id,
    requiredPlanName: reqPlan.name,
    requiredPlanPriceInr: reqPlan.priceInr,
    error: `${meta?.label || featureKey} is unlocked on the ${reqPlan.name} plan (₹${reqPlan.priceInr.toLocaleString('en-IN')}/mo).`,
  };
}

export function useEntitlements(restaurantId: string, ownerToken?: string) {
  const [subscription, setSubscription] = useState<RestaurantSubscriptionRecord | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlanConfig>(PLAN_DEFINITIONS[0]);
  const [effectivePlanId, setEffectivePlanId] = useState<PlanId>('plan_flex');
  const [entitlements, setEntitlements] = useState<Record<FeatureKey, boolean>>(() =>
    getPlanEntitlementMap('plan_flex')
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [lockedPrompt, setLockedPrompt] = useState<LockedFeatureError | null>(null);

  const refresh = useCallback(async () => {
    const token = resolveOwnerAuthToken(ownerToken);
    if (!restaurantId || !token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/billing/entitlements/${encodeURIComponent(restaurantId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription || null);
        if (data.plan) setPlan(data.plan);
        const effId = (data.effectivePlanId || data.subscription?.planId || 'plan_flex') as PlanId;
        setEffectivePlanId(effId);
        setEntitlements(data.entitlements || getPlanEntitlementMap(effId));
      }
    } catch {
      // silent fallback to current state
    } finally {
      setLoading(false);
    }
  }, [restaurantId, ownerToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasFeature = useCallback(
    (featureKey: FeatureKey): boolean => {
      if (entitlements && typeof entitlements[featureKey] === 'boolean') {
        return entitlements[featureKey];
      }
      return hasPlanEntitlement(effectivePlanId, featureKey);
    },
    [entitlements, effectivePlanId]
  );

  const triggerLockedFeature = useCallback(
    (featureKeyOrErr: FeatureKey | LockedFeatureError) => {
      if (typeof featureKeyOrErr === 'string') {
        setLockedPrompt(createClientLockedError(featureKeyOrErr, effectivePlanId));
      } else {
        setLockedPrompt(featureKeyOrErr);
      }
    },
    [effectivePlanId]
  );

  return {
    subscription,
    plan,
    effectivePlanId,
    entitlements,
    loading,
    hasFeature,
    refresh,
    lockedPrompt,
    setLockedPrompt,
    triggerLockedFeature,
  };
}

import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Sparkles,
  ArrowRight,
  X,
  Calendar,
  Percent,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { PlanId, getPlanDefinition, normalizeLegacyPlanId } from '../../config/subscriptionPlans';
import { RestaurantSubscriptionRecord, SubscriptionPlanConfig } from '../../types/dcc';

interface DashboardUpgradeBannerProps {
  restaurantId: string;
  ownerIdentifier?: string;
  effectivePlanId: PlanId | string;
  subscription: RestaurantSubscriptionRecord | null;
  livePlans?: SubscriptionPlanConfig[];
  loading?: boolean;
  onExplorePlans: (recommendedPlanId: PlanId) => void;
  onResolveBillingIssue?: () => void;
}

interface BannerConfig {
  currentBadge: string;
  headline: string;
  description: string;
  ctaLabel: string;
  targetPlanId: PlanId;
  priceText: string;
  commissionText: string;
  highlights: string;
}

export const DashboardUpgradeBanner: React.FC<DashboardUpgradeBannerProps> = ({
  restaurantId,
  ownerIdentifier = 'owner',
  effectivePlanId,
  subscription,
  livePlans = [],
  loading = false,
  onExplorePlans,
  onResolveBillingIssue,
}) => {
  const normalizedPlan = normalizeLegacyPlanId(effectivePlanId);
  const dismissKey = `dcc_upgrade_banner_dismissed:${restaurantId}:${ownerIdentifier}:${normalizedPlan}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });

  // Sync dismissal state whenever restaurant, owner, or active plan tier changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(dismissKey, '1');
      } catch {
        // ignore storage errors
      }
    }
  };

  // Critical billing alert (separate from promotional upgrade banner and non-dismissible)
  const subStatus = subscription?.status;
  const hasBillingWarning =
    subStatus === 'past_due' || subStatus === 'grace_period' || subStatus === 'suspended';

  // Wait cleanly while fetching initial subscription state to avoid flashing Flex banner for Enterprise
  if (loading && !subscription) {
    return null;
  }

  const resolvePlanMetrics = (planId: PlanId) => {
    const canonical = getPlanDefinition(planId);
    const live = livePlans.find((p) => p.id === planId);
    return {
      priceInr: typeof live?.priceInr === 'number' ? live.priceInr : canonical.priceInr,
      commissionPercent:
        typeof live?.commissionPercent === 'number'
          ? live.commissionPercent
          : canonical.commissionPercent,
    };
  };

  let config: BannerConfig | null = null;

  if (normalizedPlan === 'plan_flex') {
    const next = resolvePlanMetrics('plan_essential');
    config = {
      currentBadge: 'FLEX PLAN',
      headline: 'Ready to run your restaurant smarter?',
      description:
        'Unlock advanced table management, smart staff devices and detailed business reports.',
      ctaLabel: 'Explore Essential',
      targetPlanId: 'plan_essential',
      priceText: `₹${next.priceInr.toLocaleString('en-IN')} / month`,
      commissionText: `${next.commissionPercent}% commission`,
      highlights: 'Visual floor map · Smart staff devices · Weekly reports',
    };
  } else if (normalizedPlan === 'plan_essential') {
    const next = resolvePlanMetrics('plan_professional');
    config = {
      currentBadge: 'ESSENTIAL PLAN',
      headline: 'Ready to take control of your entire restaurant?',
      description:
        'Manage multiple floors, banquet zones and advanced customer insights.',
      ctaLabel: 'Explore Professional',
      targetPlanId: 'plan_professional',
      priceText: `₹${next.priceInr.toLocaleString('en-IN')} / month`,
      commissionText: `${next.commissionPercent}% commission`,
      highlights: 'Multi-floor zones · Banquet management · Customer CSV & API',
    };
  } else if (normalizedPlan === 'plan_professional') {
    const next = resolvePlanMetrics('plan_enterprise');
    config = {
      currentBadge: 'PROFESSIONAL PLAN',
      headline: 'Bring every restaurant branch under one roof.',
      description:
        'Unlock centralized multi-branch management, white-label capabilities and custom integrations.',
      ctaLabel: 'Explore Enterprise',
      targetPlanId: 'plan_enterprise',
      priceText: `Starting at ₹${next.priceInr.toLocaleString('en-IN')} / month`,
      commissionText: `${next.commissionPercent}% commission`,
      highlights: 'Multi-branch HQ · Custom domain · White-label & POS/ERP',
    };
  }

  // Enterprise never displays the upgrade banner
  const showUpgradeBanner = Boolean(config) && normalizedPlan !== 'plan_enterprise' && !dismissed;

  if (!hasBillingWarning && !showUpgradeBanner) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Separate Non-Dismissible Payment / Grace Alert */}
      {hasBillingWarning && (
        <div
          role="alert"
          className="rounded-2xl px-4 py-3 border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
        >
          <div className="flex items-start sm:items-center gap-2.5 text-amber-950 dark:text-amber-100">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-extrabold">
                {subStatus === 'suspended'
                  ? 'Subscription Suspended:'
                  : 'Subscription Renewal Attention Needed:'}
              </span>{' '}
              <span className="text-amber-800 dark:text-amber-200">
                Core QR ordering remains active during recovery. Please review pending billing invoices.
              </span>
            </div>
          </div>
          {onResolveBillingIssue && (
            <button
              type="button"
              onClick={onResolveBillingIssue}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors self-start sm:self-auto"
            >
              Review Billing
            </button>
          )}
        </div>
      )}

      {/* Compact Responsive Upgrade Banner (Light + Dark Premium Dual-Theme) */}
      {showUpgradeBanner && config && (
        <section
          aria-label="d.cc Subscription Upgrade Recommendation"
          className="relative overflow-hidden rounded-2xl border border-[#F5CBA7] dark:border-violet-500/30 bg-gradient-to-r from-[#FFF7EF] via-[#FFF9F4] to-[#FFEAD8] dark:from-[#121324] dark:via-[#171931] dark:to-[#111322] shadow-xs dark:shadow-lg dark:shadow-violet-950/20 px-4 py-3.5 sm:px-6 sm:py-4 transition-colors"
        >
          {/* Subtle Ambient Glows */}
          <div className="pointer-events-none absolute -right-14 -top-14 w-56 h-56 rounded-full bg-[#F76707]/10 dark:bg-violet-600/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-12 w-44 h-44 rounded-full bg-amber-300/15 dark:bg-indigo-500/15 blur-2xl" />

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss upgrade banner"
            title="Dismiss recommendation"
            className="absolute top-2.5 right-2.5 z-20 p-1.5 rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pr-6">
            {/* Left Icon + Copy */}
            <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
              <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F76707] to-[#EA580C] dark:from-violet-600 dark:to-indigo-600 text-white items-center justify-center shrink-0 shadow-sm mt-0.5">
                {config.targetPlanId === 'plan_enterprise' ? (
                  <Building2 size={20} />
                ) : config.targetPlanId === 'plan_professional' ? (
                  <Sparkles size={20} />
                ) : (
                  <Rocket size={20} />
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#F76707] dark:bg-violet-600 text-white">
                    {config.currentBadge}
                  </span>
                  <span className="text-[11px] font-semibold text-[#71717A] dark:text-slate-400 truncate">
                    {config.highlights}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-extrabold font-heading text-[#18181B] dark:text-white leading-snug">
                  {config.headline}
                </h2>

                <p className="text-xs text-[#52525B] dark:text-slate-300 leading-relaxed max-w-2xl">
                  {config.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs font-bold text-[#18181B] dark:text-slate-200 tnum">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#F76707] dark:text-violet-400 shrink-0" />
                    <span>{config.priceText}</span>
                  </span>
                  <span className="text-[#D4D4D8] dark:text-slate-600 hidden sm:inline">|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Percent size={13} className="text-[#F76707] dark:text-violet-400 shrink-0" />
                    <span>{config.commissionText}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right CTA */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 lg:pl-2">
              <button
                type="button"
                onClick={() => onExplorePlans(config!.targetPlanId)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-xs font-extrabold font-heading shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer"
              >
                <span>{config.ctaLabel}</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => onExplorePlans(config!.targetPlanId)}
                className="text-xs font-bold text-[#52525B] hover:text-[#18181B] dark:text-slate-300 dark:hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 px-1.5 py-1 cursor-pointer"
              >
                Compare plans
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

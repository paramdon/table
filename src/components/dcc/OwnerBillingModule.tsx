import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  TrendingUp,
  Receipt,
  Download,
  RefreshCw,
  Wallet,
  Lock,
  Layers,
  X,
  Check,
  History,
  Ban,
  BarChart3,
} from 'lucide-react';
import {
  RestaurantTenant,
  SubscriptionPlanConfig,
  RestaurantSubscriptionRecord,
  RestaurantPaymentMethodsConfig,
  CommissionRecord,
  CommissionLedgerEntry,
  RestaurantInvoice,
  SubscriptionEventRecord,
  CommissionReportSummary,
} from '../../types/dcc';
import {
  PLAN_DEFINITIONS,
  BillingCycle,
  PlanDefinition,
  getPlanDefinition,
  getPlanPriceForCycle,
} from '../../config/subscriptionPlans';
import { buildAuthHeaders } from '../../hooks/useEntitlements';
import { PricingSection } from './PricingSection';
import { formatINR } from '../../utils/formatters';

interface OwnerBillingModuleProps {
  restaurant: RestaurantTenant;
  ownerToken?: string;
  initialSubTab?: 'overview' | 'plans' | 'commission' | 'invoices' | 'payment_methods';
  onRefreshRestaurant?: () => void;
}

interface PendingCheckoutData {
  checkoutSessionId: string;
  transactionId: string;
  gatewayOrderId: string;
  targetPlan: SubscriptionPlanConfig;
  billingCycle: BillingCycle;
  baseSubtotal: number;
  prorationCredit: number;
  netSubtotal: number;
  tax: number;
  total: number;
}

export const OwnerBillingModule: React.FC<OwnerBillingModuleProps> = ({
  restaurant,
  ownerToken,
  initialSubTab = 'overview',
  onRefreshRestaurant,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'plans' | 'commission' | 'invoices' | 'payment_methods'
  >(initialSubTab);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<RestaurantSubscriptionRecord | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(PLAN_DEFINITIONS);
  const [paymentMethods, setPaymentMethods] = useState<RestaurantPaymentMethodsConfig | null>(null);
  const [commissionRecords, setCommissionRecords] = useState<CommissionRecord[]>([]);
  const [commissionLedger, setCommissionLedger] = useState<CommissionLedgerEntry[]>([]);
  const [commissionReport, setCommissionReport] = useState<CommissionReportSummary | null>(null);
  const [subscriptionEvents, setSubscriptionEvents] = useState<SubscriptionEventRecord[]>([]);
  const [invoices, setInvoices] = useState<RestaurantInvoice[]>([]);
  const [unbilledBalance, setUnbilledBalance] = useState<number>(0);

  // Verified Checkout / Downgrade / Cancel Modal States
  const [billingCycleSelection, setBillingCycleSelection] = useState<BillingCycle>('monthly');
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckoutData | null>(null);
  const [checkoutPayMethod, setCheckoutPayMethod] = useState<'upi' | 'card'>('upi');
  const [downgradeTargetPlan, setDowngradeTargetPlan] = useState<PlanDefinition | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Toasts
  const [upgradeSuccessToast, setUpgradeSuccessToast] = useState<string | null>(null);
  const [billingErrorToast, setBillingErrorToast] = useState<string | null>(null);

  // Invoice Printable Modal State
  const [viewingInvoice, setViewingInvoice] = useState<RestaurantInvoice | null>(null);

  // Payment Methods Form State
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [paymentMethodsSuccess, setPaymentMethodsSuccess] = useState(false);
  const [onlineGatewayEnabled, setOnlineGatewayEnabled] = useState(true);
  const [onlineProvider, setOnlineProvider] = useState<'razorpay' | 'cashfree' | 'stripe'>('razorpay');
  const [payCashEnabled, setPayCashEnabled] = useState(true);
  const [payDirectUpiEnabled, setPayDirectUpiEnabled] = useState(true);
  const [restaurantUpiId, setRestaurantUpiId] = useState('');
  const [restaurantUpiName, setRestaurantUpiName] = useState('');

  const flashSuccess = (msg: string) => {
    setBillingErrorToast(null);
    setUpgradeSuccessToast(msg);
    setTimeout(() => setUpgradeSuccessToast(null), 7000);
  };

  const flashError = (msg: string) => {
    setBillingErrorToast(msg);
  };

  // Fetch all persisted billing, subscription & commission ledger telemetry
  const fetchBillingData = useCallback(async () => {
    setLoading(true);
    const headers = buildAuthHeaders(ownerToken);
    try {
      const [plansRes, subRes, methodsRes, comRes, invRes] = await Promise.all([
        fetch('/api/billing/plans').then((r) => r.json()),
        fetch(`/api/billing/subscription/${restaurant.id}`, { headers }).then((r) => r.json()),
        fetch(`/api/billing/payment-methods/${restaurant.id}`).then((r) => r.json()),
        fetch(`/api/billing/commission/${restaurant.id}`, { headers }).then((r) => r.json()),
        fetch(`/api/billing/invoices/${restaurant.id}`, { headers }).then((r) => r.json()),
      ]);

      if (plansRes.success && Array.isArray(plansRes.plans)) setPlans(plansRes.plans);
      if (subRes.success && subRes.subscription) {
        setSubscription(subRes.subscription);
        setUnbilledBalance(subRes.unbilledCommission || 0);
        if (Array.isArray(subRes.events)) setSubscriptionEvents(subRes.events);
        if (subRes.reportSummary) setCommissionReport(subRes.reportSummary);
        if (subRes.subscription.billingCycle === 'yearly' || subRes.subscription.billingCycle === 'annual') {
          setBillingCycleSelection('yearly');
        }
      }
      if (methodsRes.success && methodsRes.paymentMethods) {
        setPaymentMethods(methodsRes.paymentMethods);
        setOnlineGatewayEnabled(methodsRes.paymentMethods.onlineGatewayEnabled ?? true);
        setOnlineProvider(methodsRes.paymentMethods.onlineGatewayProvider || 'razorpay');
        setPayCashEnabled(methodsRes.paymentMethods.payAtRestaurantCashEnabled ?? true);
        setPayDirectUpiEnabled(methodsRes.paymentMethods.payAtRestaurantUpiEnabled ?? true);
        setRestaurantUpiId(methodsRes.paymentMethods.restaurantUpiId || `${restaurant.slug || 'dine'}@upi`);
        setRestaurantUpiName(methodsRes.paymentMethods.restaurantUpiName || restaurant.name);
      }
      if (comRes.success) {
        setCommissionRecords(comRes.records || []);
        setCommissionLedger(comRes.ledger || []);
        if (comRes.reportSummary) setCommissionReport(comRes.reportSummary);
        if (comRes.unbilledBalance !== undefined) setUnbilledBalance(comRes.unbilledBalance);
      }
      if (invRes.success && invRes.invoices) {
        setInvoices(invRes.invoices);
      }
    } catch (err) {
      console.warn('Failed to load billing telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurant.id, restaurant.slug, restaurant.name, ownerToken]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const currentPlan = getPlanDefinition(subscription?.planId || restaurant.plan || 'flex');
  const isYearly = subscription?.billingCycle === 'yearly' || subscription?.billingCycle === 'annual';
  const effectiveRate = subscription?.commissionRate ?? currentPlan.commissionPercent;
  const currentPeriodPrice = subscription?.amount ?? getPlanPriceForCycle(currentPlan, isYearly ? 'yearly' : 'monthly');

  // Step 1: Select plan from PricingSection -> routes strictly to verified upgrade checkout or downgrade modal
  const handleSelectPlanFromMatrix = async (targetPlan: PlanDefinition, chosenCycle: BillingCycle) => {
    setBillingErrorToast(null);
    if (targetPlan.id === currentPlan.id && chosenCycle === (isYearly ? 'yearly' : 'monthly')) {
      return;
    }

    // Downgrade path (to lower tier or free Flex)
    if (targetPlan.tierRank < currentPlan.tierRank) {
      setDowngradeTargetPlan(targetPlan);
      return;
    }

    // Paid Upgrade or Billing Cycle Switch -> Step 1: Initiate backend checkout session (does NOT activate plan!)
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/subscription/initiate-upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          targetPlanId: targetPlan.id,
          billingCycle: chosenCycle,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        flashError(data.error || 'Could not initiate upgrade checkout.');
        return;
      }
      setPendingCheckout({
        checkoutSessionId: data.checkoutSessionId,
        transactionId: data.transactionId,
        gatewayOrderId: data.gatewayOrderId,
        targetPlan: data.targetPlan || targetPlan,
        billingCycle: data.billingCycle || chosenCycle,
        baseSubtotal: data.baseSubtotal,
        prorationCredit: data.prorationCredit || 0,
        netSubtotal: data.netSubtotal,
        tax: data.tax,
        total: data.total,
      });
      await fetchBillingData();
    } catch (err: any) {
      flashError(err.message || 'Network error initiating upgrade checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  // Step 2: Confirm Payment via Gateway Webhook Verification
  const handleAuthorizeCheckout = async (simulateOutcome: 'success' | 'failed' = 'success') => {
    if (!pendingCheckout) return;
    setActionLoading(true);
    setBillingErrorToast(null);
    try {
      const res = await fetch('/api/billing/subscription/gateway-authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          checkoutSessionId: pendingCheckout.checkoutSessionId,
          paymentMethod: checkoutPayMethod,
          simulateOutcome,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPendingCheckout(null);
        flashError(data.error || 'Payment verification failed. Your current plan remains unchanged.');
        await fetchBillingData();
        return;
      }
      setPendingCheckout(null);
      flashSuccess(
        `Payment verified via webhook! Upgraded to ${data.subscription?.planName || 'new'} plan (${data.invoice?.invoiceNumber || ''}).`
      );
      await fetchBillingData();
      if (onRefreshRestaurant) onRefreshRestaurant();
    } catch (err: any) {
      flashError(err.message || 'Gateway verification error.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Scheduled/Immediate Downgrade
  const handleConfirmDowngrade = async () => {
    if (!downgradeTargetPlan) return;
    setActionLoading(true);
    setBillingErrorToast(null);
    try {
      const res = await fetch('/api/billing/subscription/downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          targetPlanId: downgradeTargetPlan.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        flashError(data.error || 'Failed to schedule downgrade.');
        return;
      }
      setDowngradeTargetPlan(null);
      if (data.effectiveAt === 'period_end') {
        flashSuccess(
          `Downgrade to ${downgradeTargetPlan.name} scheduled for end of billing period (${new Date(data.effectiveDate).toLocaleDateString()}).`
        );
      } else {
        flashSuccess(`Plan switched to ${downgradeTargetPlan.name}.`);
      }
      await fetchBillingData();
      if (onRefreshRestaurant) onRefreshRestaurant();
    } catch (err: any) {
      flashError(err.message || 'Failed to process downgrade.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Subscription
  const handleConfirmCancelSubscription = async (immediate = false) => {
    setActionLoading(true);
    setBillingErrorToast(null);
    try {
      const res = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          immediate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        flashError(data.error || 'Failed to cancel subscription.');
        return;
      }
      setIsCancelModalOpen(false);
      flashSuccess(data.message || 'Subscription cancellation updated.');
      await fetchBillingData();
      if (onRefreshRestaurant) onRefreshRestaurant();
    } catch (err: any) {
      flashError(err.message || 'Failed to cancel subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Payment Methods Settings
  const handleSavePaymentMethods = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPaymentMethods(true);
    setPaymentMethodsSuccess(false);
    setBillingErrorToast(null);

    try {
      const res = await fetch(`/api/billing/payment-methods/${restaurant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({
          onlineGatewayEnabled,
          onlineGatewayProvider: onlineProvider,
          payAtRestaurantCashEnabled: payCashEnabled,
          payAtRestaurantUpiEnabled: payDirectUpiEnabled,
          restaurantUpiId: restaurantUpiId.trim(),
          restaurantUpiName: restaurantUpiName.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
        setPaymentMethodsSuccess(true);
        setTimeout(() => setPaymentMethodsSuccess(false), 4000);
      } else {
        flashError(data.error || 'Failed to save payment configuration.');
      }
    } catch {
      flashError('Failed to save payment configuration.');
    } finally {
      setSavingPaymentMethods(false);
    }
  };

  // Handle Pay Invoice Online
  const handlePayInvoice = async (invoiceId: string) => {
    setBillingErrorToast(null);
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(ownerToken),
        },
        body: JSON.stringify({ paymentMethod: 'online_upi' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flashSuccess('Invoice settled successfully! Commission balance reconciled.');
        fetchBillingData();
      } else {
        flashError(data.error || 'Failed to settle invoice.');
      }
    } catch {
      flashError('Failed to pay invoice.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-3xl border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black font-heading text-[#18181B]">
              Billing, Subscriptions &amp; Commission
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>Webhook-Verified Tenant Billing</span>
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Active plan: <strong>{currentPlan.name}</strong> ({effectiveRate}% commission) • Order rates are permanently snapshotted and separate from GST &amp; gateway fees.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={fetchBillingData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-[#71717A] text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Sync Billing Ledger"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className="px-4 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles size={13} />
            <span>Compare &amp; Upgrade Plans</span>
          </button>
        </div>
      </div>

      {/* Success & Error Toasts */}
      {upgradeSuccessToast && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{upgradeSuccessToast}</span>
          </div>
          <button onClick={() => setUpgradeSuccessToast(null)} className="text-emerald-700">
            ✕
          </button>
        </div>
      )}

      {billingErrorToast && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-xs font-bold text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>{billingErrorToast}</span>
          </div>
          <button onClick={() => setBillingErrorToast(null)} className="text-red-700 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-[#E4E4E7] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Subscription & Commission Report', icon: Layers },
          { id: 'plans', label: 'Plans & Comparison', icon: Sparkles },
          { id: 'commission', label: `Commission Ledger (₹${unbilledBalance})`, icon: TrendingUp },
          { id: 'invoices', label: `Invoices & Receipts (${invoices.length})`, icon: Receipt },
          { id: 'payment_methods', label: 'Customer Payment Methods', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-heading whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'bg-white border border-[#E4E4E7] text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= SECTION 1: OVERVIEW & COMMISSION REPORT ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Subscription Card */}
          <div className="bg-gradient-to-br from-[#18181B] via-[#27272A] to-[#18181B] text-white p-5 sm:p-6 rounded-3xl border border-white/10 shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-[#F76707]/15 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F76707] text-white">
                    {(subscription?.status || 'active').toUpperCase()} SUBSCRIPTION
                  </span>
                  <span className="text-xs font-medium text-[#A1A1AA]">
                    {isYearly ? 'Yearly Billing (20% Discount)' : 'Monthly Billing'}
                  </span>
                  {subscription?.scheduledDowngradePlanName && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      Scheduled switch to {subscription.scheduledDowngradePlanName} on{' '}
                      {new Date(subscription.scheduledDowngradeEffectiveAt || Date.now()).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-black font-heading text-white flex flex-wrap items-center gap-2.5">
                  <span>{currentPlan.name} Plan</span>
                  <span className="text-sm font-extrabold px-3 py-1 rounded-xl bg-white/10 text-white border border-white/10 tnum">
                    {formatINR(currentPeriodPrice)}
                    <span className="text-[10px] text-[#A1A1AA] font-normal">/{isYearly ? 'yr' : 'mo'}</span>
                  </span>
                </h3>

                <p className="text-xs text-[#A1A1AA] max-w-xl leading-relaxed">
                  {currentPlan.targetCustomer} {currentPlan.description}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#D4D4D8]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>
                      Commission Rate: <strong>{effectiveRate}%</strong> per eligible QR order
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#A1A1AA]" />
                    <span>
                      Period Ends:{' '}
                      <strong>
                        {new Date(subscription?.currentPeriodEnd || Date.now() + 30 * 86400000).toLocaleDateString()}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl w-full lg:w-auto shrink-0 space-y-2 min-w-[230px]">
                <div className="text-xs font-bold text-white">Subscription Controls</div>
                <button
                  onClick={() => setActiveTab('plans')}
                  className="w-full px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles size={13} />
                  <span>Upgrade or Switch Plan</span>
                </button>
                {currentPlan.priceInr > 0 && !subscription?.cancelAtPeriodEnd && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="w-full px-4 py-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-zinc-200 hover:text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Ban size={13} />
                    <span>Cancel Paid Plan</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4 Subscription & Monthly QR KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#71717A]">Monthly Subscription Fee</span>
              <div className="text-2xl font-black font-heading text-[#18181B] tnum">
                {formatINR(currentPlan.priceInr)}
                <span className="text-xs font-normal text-[#71717A]">/mo</span>
              </div>
              <p className="text-[11px] text-[#71717A]">{currentPlan.name} tier • 20% off yearly</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#71717A]">Current Commission Rate</span>
              <div className="text-2xl font-black font-heading text-emerald-600 tnum">
                {effectiveRate}%
              </div>
              <p className="text-[11px] text-[#71717A]">
                {effectiveRate === 0 ? 'Zero commission on Enterprise' : 'Per eligible QR order subtotal'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#71717A]">Monthly QR Order Volume (30d)</span>
              <div className="text-2xl font-black font-heading text-[#18181B] tnum">
                {formatINR(commissionReport?.monthlyQrOrderVolume || 0)}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Across {commissionReport?.monthlyQrOrderCount || 0} non-cancelled QR orders
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#71717A]">Estimated Platform Commission</span>
              <div className="text-2xl font-black font-heading text-[#F76707] tnum">
                {formatINR(commissionReport?.estimatedMonthlyCommission || 0)}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Unbilled payable balance: {formatINR(unbilledBalance)}
              </p>
            </div>
          </div>

          {/* Owner-Facing Commission Report Card */}
          <div className="bg-white p-5 rounded-3xl border border-[#E4E4E7] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-[#F76707]" />
                <div>
                  <h4 className="text-sm font-extrabold font-heading text-[#18181B]">
                    Owner Commission Summary Report
                  </h4>
                  <p className="text-[11px] text-[#71717A]">
                    Excludes cancelled orders, taxes &amp; tips. Historical rates remain locked upon plan upgrade.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-[#52525B]">
                {commissionReport?.cancelledExcludedCount || 0} cancelled order(s) excluded
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
                <span className="text-[11px] text-[#71717A] block">Eligible Order Value</span>
                <span className="text-lg font-black font-heading text-[#18181B] tnum">
                  {formatINR(commissionReport?.eligibleOrderValue || 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
                <span className="text-[11px] text-[#71717A] block">Commission Percentage</span>
                <span className="text-lg font-black font-heading text-[#18181B] tnum">
                  {commissionReport?.commissionRate ?? effectiveRate}%
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
                <span className="text-[11px] text-[#71717A] block">Commission Amount</span>
                <span className="text-lg font-black font-heading text-[#18181B] tnum">
                  {formatINR(commissionReport?.grossPlatformCommission || 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 block">Refund Adjustments</span>
                <span className="text-lg font-black font-heading text-emerald-700 tnum">
                  -{formatINR(commissionReport?.refundAdjustments || 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200">
                <span className="text-[11px] text-[#A14000] font-bold block">Total Payable Commission</span>
                <span className="text-lg font-black font-heading text-[#F76707] tnum">
                  {formatINR(commissionReport?.totalPayablePlatformCommission || 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#52525B]">
              <span>
                <strong>Clear Fee Separation:</strong> d.cc platform commission does not include third-party payment gateway charges or GST.
              </span>
              <div className="flex flex-wrap gap-4 font-bold">
                <span>
                  Est. Gateway Charges (Separate):{' '}
                  {formatINR(commissionReport?.estimatedPaymentGatewayCharges || 0)}
                </span>
                <span>
                  18% GST on Commission (Separate):{' '}
                  {formatINR(commissionReport?.estimatedGstOnCommission || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Audit & Webhook Events Timeline */}
          <div className="bg-white p-5 rounded-3xl border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#18181B]" />
                <h4 className="text-sm font-extrabold font-heading text-[#18181B]">
                  Auditable Subscription &amp; Webhook Events ({subscriptionEvents.length})
                </h4>
              </div>
            </div>

            {subscriptionEvents.length === 0 ? (
              <p className="text-xs text-[#71717A]">No subscription changes recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {subscriptionEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#18181B] text-white">
                          {ev.eventType}
                        </span>
                        <span className="font-bold text-[#18181B]">{ev.actor}</span>
                      </div>
                      <p className="text-[11px] text-[#52525B]">{ev.details}</p>
                    </div>
                    <span className="text-[10px] text-[#71717A]">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 2: PLANS & COMPARISON ================= */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <PricingSection
            plans={plans}
            currentPlanId={currentPlan.id}
            billingCycle={billingCycleSelection}
            onBillingCycleChange={setBillingCycleSelection}
            onSelectPlan={handleSelectPlanFromMatrix}
            variant="light"
            actionDisabled={actionLoading}
          />
        </div>
      )}

      {/* ================= SECTION 3: COMMISSION LEDGER ================= */}
      {activeTab === 'commission' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                Order-Level Commission Audit Ledger
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Every eligible QR order snapshots its active plan &amp; rate at order time. Cancelled orders are excluded; refunds reverse proportionally.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-right shrink-0">
              <span className="text-[10px] font-bold text-[#A14000] block uppercase tracking-wider">
                Unbilled Balance
              </span>
              <span className="text-xl font-black font-heading text-[#F76707] tnum">
                {formatINR(unbilledBalance)}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            {commissionRecords.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Receipt size={24} className="mx-auto text-[#A1A1AA]" />
                <h4 className="text-xs font-bold text-[#18181B]">No Commission Transactions Yet</h4>
                <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                  Completed QR orders will record order-time plan snapshots and commission here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] text-[#71717A] border-b border-[#E4E4E7] font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Order #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Eligible Subtotal</th>
                      <th className="py-2.5 px-4">Plan Snapshot</th>
                      <th className="py-2.5 px-4">Rate %</th>
                      <th className="py-2.5 px-4">d.cc Commission</th>
                      <th className="py-2.5 px-4">Gateway Fee (Sep.)</th>
                      <th className="py-2.5 px-4">Refund Adj.</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F4F5]">
                    {commissionRecords.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-4 font-bold text-[#18181B]">#{c.orderNumber}</td>
                        <td className="py-3 px-4 text-[#71717A]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-semibold tnum">{formatINR(c.eligibleOrderAmount)}</td>
                        <td className="py-3 px-4 font-medium text-[#52525B]">{c.planSnapshot}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 tnum">
                          {c.commissionRateSnapshot}%
                        </td>
                        <td className="py-3 px-4 font-black text-[#F76707] tnum">
                          {formatINR(c.commissionAmount)}
                        </td>
                        <td className="py-3 px-4 text-[#71717A] tnum">
                          {formatINR(c.paymentGatewayFeeSeparate || 0)}
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-semibold tnum">
                          {c.refundAdjustedAmount ? `-${formatINR(c.refundAdjustedAmount)}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              c.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : c.status === 'reversed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : c.status === 'partially_reversed'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
            <h4 className="text-xs font-bold font-heading text-[#18181B]">
              Running Commission Ledger ({commissionLedger.length})
            </h4>
            {commissionLedger.length === 0 ? (
              <p className="text-xs text-[#71717A]">No ledger entries yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {commissionLedger.map((l) => (
                  <div
                    key={l.id}
                    className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#18181B]">{l.description}</div>
                      <span className="text-[10px] text-[#71717A]">
                        {new Date(l.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-black font-heading tnum ${
                          l.amount > 0 ? 'text-[#F76707]' : 'text-emerald-600'
                        }`}
                      >
                        {l.amount > 0
                          ? `+${formatINR(l.amount)}`
                          : `-${formatINR(Math.abs(l.amount))}`}
                      </div>
                      <span className="text-[10px] text-[#71717A]">
                        Bal: {formatINR(l.runningBalance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 4: INVOICES & RECEIPTS ================= */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Receipt size={24} className="mx-auto text-[#A1A1AA]" />
              <h4 className="text-xs font-bold text-[#18181B]">No Invoices Issued Yet</h4>
              <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                Tax invoices appear here automatically upon verified plan upgrades and weekly commission cycles.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] text-[#71717A] border-b border-[#E4E4E7] font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Issued</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Total Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-3 px-4 font-bold font-mono">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 text-[#71717A]">
                        {new Date(inv.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#52525B]">
                          {inv.type === 'subscription' ? 'Subscription' : 'Weekly Commission'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black tnum">{formatINR(inv.total)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handlePayInvoice(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#F76707] text-white text-[10px] font-bold"
                            >
                              Pay Now
                            </button>
                          )}
                          <button
                            onClick={() => setViewingInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] text-xs font-bold flex items-center gap-1"
                          >
                            <Download size={11} />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 5: CUSTOMER PAYMENT METHODS ================= */}
      {activeTab === 'payment_methods' && (
        <form onSubmit={handleSavePaymentMethods} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#E4E4E7] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F76707] flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold font-heading">Online Payment Gateway</h4>
                    <span className="text-[10px] text-[#71717A]">UPI, Cards, Netbanking</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={onlineGatewayEnabled}
                  onChange={(e) => setOnlineGatewayEnabled(e.target.checked)}
                  className="accent-[#F76707] w-4 h-4"
                />
              </div>
              <select
                value={onlineProvider}
                onChange={(e) => setOnlineProvider(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-bold bg-white"
              >
                <option value="razorpay">Razorpay Route</option>
                <option value="cashfree">Cashfree Easy Split</option>
                <option value="stripe">Stripe Connect</option>
              </select>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E4E4E7] space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-heading">Pay at Restaurant (Cash / Direct UPI)</h4>
                  <span className="text-[10px] text-[#71717A]">Settled with Waiter or Counter</span>
                </div>
              </div>
              <label className="flex items-center justify-between text-xs font-bold">
                <span>Enable Cash at Counter</span>
                <input
                  type="checkbox"
                  checked={payCashEnabled}
                  onChange={(e) => setPayCashEnabled(e.target.checked)}
                  className="accent-[#F76707] w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-bold">
                <span>Enable Direct Restaurant UPI</span>
                <input
                  type="checkbox"
                  checked={payDirectUpiEnabled}
                  onChange={(e) => setPayDirectUpiEnabled(e.target.checked)}
                  className="accent-[#F76707] w-4 h-4"
                />
              </label>
              {payDirectUpiEnabled && (
                <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
                  <input
                    type="text"
                    value={restaurantUpiId}
                    onChange={(e) => setRestaurantUpiId(e.target.value)}
                    placeholder="merchant@upi"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-mono font-bold"
                  />
                  <input
                    type="text"
                    value={restaurantUpiName}
                    onChange={(e) => setRestaurantUpiName(e.target.value)}
                    placeholder="Display Name"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            {paymentMethodsSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Payment settings saved!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={savingPaymentMethods}
              className="px-6 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{savingPaymentMethods ? 'Saving...' : 'Save Payment Methods'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================= VERIFIED GATEWAY CHECKOUT MODAL ================= */}
      {pendingCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
            <div className="p-5 bg-[#18181B] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#F76707] uppercase tracking-wider flex items-center gap-1">
                  <Lock size={11} /> Verified Gateway Checkout
                </span>
                <h3 className="text-base font-extrabold font-heading">
                  Upgrade to {pendingCheckout.targetPlan.name}
                </h3>
              </div>
              <button
                onClick={() => setPendingCheckout(null)}
                className="text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Selected Plan ({pendingCheckout.billingCycle}):</span>
                  <span className="font-bold">{formatINR(pendingCheckout.baseSubtotal)}</span>
                </div>
                {pendingCheckout.prorationCredit > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Unused Period Proration Credit:</span>
                    <span className="font-bold">-{formatINR(pendingCheckout.prorationCredit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#71717A]">
                  <span>18% GST:</span>
                  <span>{formatINR(pendingCheckout.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-[#E4E4E7] pt-2">
                  <span>Payable Total:</span>
                  <span className="text-[#F76707]">{formatINR(pendingCheckout.total)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutPayMethod('upi')}
                    className={`p-2.5 rounded-xl border font-bold ${
                      checkoutPayMethod === 'upi'
                        ? 'border-[#F76707] bg-[#FFF4ED] text-[#18181B]'
                        : 'border-[#E4E4E7] text-[#71717A]'
                    }`}
                  >
                    UPI Autopay / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutPayMethod('card')}
                    className={`p-2.5 rounded-xl border font-bold ${
                      checkoutPayMethod === 'card'
                        ? 'border-[#F76707] bg-[#FFF4ED] text-[#18181B]'
                        : 'border-[#E4E4E7] text-[#71717A]'
                    }`}
                  >
                    Corporate Card
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                <strong>Webhook Enforcement:</strong> Your active plan stays on <strong>{currentPlan.name}</strong> until our server verifies a signed payment capture webhook (`{pendingCheckout.gatewayOrderId}`).
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAuthorizeCheckout('failed')}
                  className="px-3 py-2.5 rounded-xl border border-red-200 text-red-700 font-bold hover:bg-red-50"
                >
                  Simulate Fail
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAuthorizeCheckout('success')}
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-extrabold font-heading"
                >
                  {actionLoading ? 'Verifying Webhook...' : `Confirm & Pay ${formatINR(pendingCheckout.total)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DOWNGRADE MODAL ================= */}
      {downgradeTargetPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] p-6 space-y-4 text-xs">
            <h3 className="text-base font-extrabold font-heading text-[#18181B]">
              Confirm Downgrade to {downgradeTargetPlan.name}
            </h3>
            <p className="text-[#52525B] leading-relaxed">
              Your downgrade from <strong>{currentPlan.name}</strong> to{' '}
              <strong>{downgradeTargetPlan.name}</strong> ({downgradeTargetPlan.commissionPercent}% commission) will take effect cleanly at the end of your current paid billing period. Historical order rates remain untouched.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDowngradeTargetPlan(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] font-bold"
              >
                Keep {currentPlan.name}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDowngrade}
                className="flex-1 py-2.5 rounded-xl bg-[#18181B] text-white font-bold"
              >
                {actionLoading ? 'Scheduling...' : 'Schedule Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CANCEL SUBSCRIPTION MODAL ================= */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] p-6 space-y-4 text-xs">
            <h3 className="text-base font-extrabold font-heading text-[#18181B]">
              Cancel Paid Subscription?
            </h3>
            <p className="text-[#52525B] leading-relaxed">
              Cancelling returns your workspace to the free <strong>Flex (₹0/mo, 3% commission)</strong> plan while preserving all menu items, orders, and historical ledgers.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] font-bold"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmCancelSubscription(false)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {actionLoading ? 'Cancelling...' : 'Cancel at Period End'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW INVOICE PRINTABLE MODAL ================= */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#F4F4F5] bg-[#18181B] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Verified Tax Invoice
                </span>
                <h3 className="text-sm font-bold font-mono">{viewingInvoice.invoiceNumber}</h3>
              </div>
              <button onClick={() => setViewingInvoice(null)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#18181B]">
              <div className="flex justify-between items-start border-b border-[#F4F4F5] pb-3">
                <div>
                  <h4 className="font-black text-sm font-heading">d.cc / Ur.Dear.Menu SaaS</h4>
                  <p className="text-[11px] text-[#71717A]">billing@urdearmenu.com</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {viewingInvoice.status}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#52525B]">{viewingInvoice.notes || 'Platform Subscription'}</span>
                  <span className="font-bold">{formatINR(viewingInvoice.subtotal)}</span>
                </div>
                {Number(viewingInvoice.prorationCredit) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Proration Credit</span>
                    <span>-{formatINR(Number(viewingInvoice.prorationCredit))}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#71717A]">
                  <span>GST (18%)</span>
                  <span>{formatINR(viewingInvoice.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-[#E4E4E7] pt-2">
                  <span>Total</span>
                  <span className="text-[#F76707]">{formatINR(viewingInvoice.total)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#F4F4F5] bg-[#FAFAFA] flex justify-end">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  Percent,
} from 'lucide-react';
import {
  PLAN_DEFINITIONS,
  FEATURE_COMPARISON_ROWS,
  BillingCycle,
  PlanDefinition,
  getPlanPriceForCycle,
  normalizeLegacyPlanId,
} from '../../config/subscriptionPlans';
import { SubscriptionPlanConfig } from '../../types/dcc';

interface PricingSectionProps {
  plans?: SubscriptionPlanConfig[];
  currentPlanId?: string | null;
  billingCycle?: BillingCycle;
  onBillingCycleChange?: (cycle: BillingCycle) => void;
  onSelectPlan: (plan: PlanDefinition, billingCycle: BillingCycle) => void;
  variant?: 'dark' | 'light';
  showComparisonTable?: boolean;
  actionDisabled?: boolean;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  plans,
  currentPlanId,
  billingCycle: controlledCycle,
  onBillingCycleChange,
  onSelectPlan,
  variant = 'light',
  showComparisonTable = true,
  actionDisabled = false,
}) => {
  const [internalCycle, setInternalCycle] = useState<BillingCycle>('monthly');
  const activeCycle = controlledCycle || internalCycle;

  const setCycle = (next: BillingCycle) => {
    setInternalCycle(next);
    if (onBillingCycleChange) onBillingCycleChange(next);
  };

  const normalizedCurrent = currentPlanId ? normalizeLegacyPlanId(currentPlanId) : null;
  const currentTierRank = normalizedCurrent
    ? (PLAN_DEFINITIONS.find((p) => p.id === normalizedCurrent)?.tierRank ?? 0)
    : -1;

  // Merge live plan definitions from backend (if fetched) with canonical structure
  const displayPlans: PlanDefinition[] = PLAN_DEFINITIONS.map((canonical) => {
    const serverPlan = (plans || []).find((p) => p.id === canonical.id || p.slug === canonical.slug);
    if (!serverPlan) return canonical;
    return {
      ...canonical,
      priceInr: typeof serverPlan.priceInr === 'number' ? serverPlan.priceInr : canonical.priceInr,
      priceUsd: typeof serverPlan.priceUsd === 'number' ? serverPlan.priceUsd : canonical.priceUsd,
      commissionPercent:
        typeof serverPlan.commissionPercent === 'number'
          ? serverPlan.commissionPercent
          : canonical.commissionPercent,
      annualDiscountPercent:
        typeof serverPlan.annualDiscountPercent === 'number'
          ? serverPlan.annualDiscountPercent
          : canonical.annualDiscountPercent,
    };
  });

  const isDark = variant === 'dark';

  const comparisonCategories = Array.from(
    new Set(FEATURE_COMPARISON_ROWS.map((row) => row.category))
  );

  const renderCell = (val: string | boolean) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 size={15} />
        </span>
      );
    }
    if (val === false) {
      return (
        <span className={`inline-flex items-center justify-center ${isDark ? 'text-slate-600' : 'text-zinc-300'}`}>
          <XCircle size={15} />
        </span>
      );
    }
    return (
      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-[#18181B]'}`}>
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Real Monthly / Yearly Billing Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div
          className={`inline-flex items-center p-1 rounded-2xl border ${
            isDark
              ? 'bg-slate-900 border-slate-800'
              : 'bg-[#F4F4F5] border-[#E4E4E7]'
          }`}
        >
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeCycle === 'monthly'
                ? 'bg-[#F76707] text-white shadow-sm'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setCycle('yearly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCycle === 'yearly'
                ? 'bg-[#F76707] text-white shadow-sm'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <span>Yearly Billing</span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                activeCycle === 'yearly'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/15 text-emerald-600'
              }`}
            >
              Save 20%
            </span>
          </button>
        </div>
        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-[#71717A]'}`}>
          {activeCycle === 'yearly'
            ? 'Annual billing applies real 20% savings on paid tiers (billed annually).'
            : 'Cancel or adjust plans anytime. No hidden setup fees.'}
        </span>
      </div>

      {/* 4 Subscription Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
        {displayPlans.map((plan) => {
          const isCurrent = normalizedCurrent === plan.id;
          const isRecommended = Boolean(plan.recommended);
          const isUpgrade = currentTierRank >= 0 && plan.tierRank > currentTierRank;
          const isDowngrade = currentTierRank >= 0 && plan.tierRank < currentTierRank;

          const monthlyEquiv =
            activeCycle === 'yearly' && plan.priceInr > 0
              ? Math.round(getPlanPriceForCycle(plan, 'yearly', 'INR') / 12)
              : plan.priceInr;
          const annualTotal = getPlanPriceForCycle(plan, 'yearly', 'INR');

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-5 sm:p-6 border flex flex-col justify-between transition-all ${
                isRecommended
                  ? isDark
                    ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-[#F76707] ring-2 ring-[#F76707]/30 shadow-2xl shadow-orange-950/30'
                    : 'bg-white border-[#F76707] ring-2 ring-[#F76707]/20 shadow-xl'
                  : isCurrent
                  ? isDark
                    ? 'bg-slate-900 border-emerald-500'
                    : 'bg-white border-emerald-500 shadow-md'
                  : isDark
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  : 'bg-white border-[#E4E4E7] hover:border-zinc-300 shadow-xs'
              }`}
            >
              {/* Top Badges */}
              <div className="flex items-center justify-between gap-2 mb-3 min-h-[24px]">
                {isRecommended ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F76707] text-white text-[10px] font-extrabold uppercase tracking-wider">
                    <Sparkles size={11} />
                    <span>Recommended</span>
                  </span>
                ) : plan.slug === 'enterprise' ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-zinc-900 text-white'
                    }`}
                  >
                    <Building2 size={11} />
                    <span>0% Commission</span>
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-[#71717A]'
                    }`}
                  >
                    {plan.slug === 'flex' ? 'Pay As You Grow' : 'High Volume'}
                  </span>
                )}

                {isCurrent && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                    <CheckCircle2 size={11} />
                    <span>Current Plan</span>
                  </span>
                )}
              </div>

              {/* Plan Name & Target Customer */}
              <div className="space-y-2">
                <h3
                  className={`text-xl font-extrabold font-heading ${
                    isDark ? 'text-white' : 'text-[#18181B]'
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-xs leading-relaxed min-h-[36px] ${
                    isDark ? 'text-slate-400' : 'text-[#71717A]'
                  }`}
                >
                  {plan.targetCustomer}
                </p>

                {/* Price Block */}
                <div className="pt-2 pb-1">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-3xl font-black font-heading tracking-tight ${
                        isDark ? 'text-white' : 'text-[#18181B]'
                      }`}
                    >
                      ₹{monthlyEquiv.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-[#71717A]'}`}>
                      / month
                    </span>
                  </div>
                  {activeCycle === 'yearly' && plan.priceInr > 0 ? (
                    <div className="text-[11px] font-semibold text-emerald-500 mt-0.5">
                      ₹{annualTotal.toLocaleString('en-IN')} billed yearly (20% annual discount)
                    </div>
                  ) : (
                    <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-[#A1A1AA]'}`}>
                      {plan.priceInr === 0 ? 'Free forever monthly fee' : 'Plus applicable GST'}
                    </div>
                  )}
                </div>

                {/* Commission Rate Pill */}
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                    plan.commissionPercent === 0
                      ? isDark
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'bg-[#FAFAFA] border-[#E4E4E7] text-[#18181B]'
                  }`}
                >
                  <span className="text-[11px] font-semibold flex items-center gap-1.5">
                    <Percent size={12} className="text-[#F76707]" />
                    <span>Platform Commission</span>
                  </span>
                  <span className="text-xs font-extrabold">
                    {plan.commissionPercent}%{plan.commissionPercent === 0 ? ' Forever' : ' / order'}
                  </span>
                </div>
              </div>

              {/* Included Features */}
              <div className="space-y-2.5 my-5 flex-1">
                <div
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-[#71717A]'
                  }`}
                >
                  {plan.slug === 'flex'
                    ? 'Everything Included:'
                    : plan.slug === 'essential'
                    ? 'Everything in Flex, plus:'
                    : plan.slug === 'professional'
                    ? 'Everything in Essential, plus:'
                    : 'Everything in Professional, plus:'}
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className={`flex items-start gap-2 text-xs leading-snug ${
                        isDark ? 'text-slate-300' : 'text-[#3F3F46]'
                      }`}
                    >
                      <CheckCircle2 size={14} className="text-[#16A34A] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {plan.restrictions && plan.restrictions.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-[#A1A1AA]'
                      }`}
                    >
                      Not Included:
                    </div>
                    {plan.restrictions.slice(0, 4).map((rest) => (
                      <div
                        key={rest}
                        className={`flex items-start gap-2 text-[11px] ${
                          isDark ? 'text-slate-500' : 'text-[#71717A]'
                        }`}
                      >
                        <XCircle size={12} className="shrink-0 mt-0.5 opacity-60" />
                        <span>{rest}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                type="button"
                disabled={isCurrent || actionDisabled}
                onClick={() => onSelectPlan(plan, activeCycle)}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-extrabold font-heading flex items-center justify-center gap-1.5 transition-all ${
                  isCurrent
                    ? isDark
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : isDowngrade
                    ? isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B]'
                    : isRecommended
                    ? 'bg-[#F76707] hover:bg-[#D85800] text-white shadow-lg shadow-orange-500/20'
                    : isDark
                    ? 'bg-white text-slate-950 hover:bg-slate-200'
                    : 'bg-[#18181B] hover:bg-black text-white'
                }`}
              >
                {isCurrent ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Active Plan</span>
                  </>
                ) : isDowngrade ? (
                  <>
                    <ArrowDownRight size={14} />
                    <span>Downgrade to {plan.name}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {normalizedCurrent
                        ? isUpgrade
                          ? `Upgrade to ${plan.name}`
                          : `Switch to ${plan.name}`
                        : plan.priceInr === 0
                        ? 'Start Free on Flex'
                        : `Get Started with ${plan.name}`}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Complete Feature Comparison Table */}
      {showComparisonTable && (
        <div
          className={`rounded-3xl border overflow-hidden ${
            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-[#E4E4E7] shadow-xs'
          }`}
        >
          <div
            className={`p-5 sm:p-6 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'border-slate-800' : 'border-[#F4F4F5]'
            }`}
          >
            <div>
              <h3
                className={`text-base font-extrabold font-heading ${
                  isDark ? 'text-white' : 'text-[#18181B]'
                }`}
              >
                Complete Feature &amp; Entitlement Comparison
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-[#71717A]'}`}>
                Core QR ordering, KDS &amp; Waiter consoles remain unlocked on every tier — pay only as you scale.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <ShieldCheck size={15} />
              <span>Backend-Verified Entitlements</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className={isDark ? 'bg-slate-950/60' : 'bg-[#FAFAFA]'}>
                  <th
                    className={`p-4 text-xs font-extrabold w-[36%] ${
                      isDark ? 'text-slate-300' : 'text-[#18181B]'
                    }`}
                  >
                    Capability
                  </th>
                  <th className={`p-4 text-center text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-[#18181B]'}`}>
                    Flex
                    <span className="block text-[10px] font-normal text-[#71717A]">₹0/mo • 3%</span>
                  </th>
                  <th className="p-4 text-center text-xs font-extrabold text-[#F76707]">
                    Essential
                    <span className="block text-[10px] font-normal text-[#71717A]">₹1,999/mo • 2%</span>
                  </th>
                  <th className={`p-4 text-center text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-[#18181B]'}`}>
                    Professional
                    <span className="block text-[10px] font-normal text-[#71717A]">₹4,999/mo • 0.75%</span>
                  </th>
                  <th className={`p-4 text-center text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-[#18181B]'}`}>
                    Enterprise
                    <span className="block text-[10px] font-normal text-[#71717A]">₹9,999/mo • 0%</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonCategories.map((cat) => (
                  <React.Fragment key={cat}>
                    <tr className={isDark ? 'bg-slate-900' : 'bg-[#F4F4F5]/70'}>
                      <td
                        colSpan={5}
                        className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider ${
                          isDark ? 'text-slate-400' : 'text-[#52525B]'
                        }`}
                      >
                        {cat}
                      </td>
                    </tr>
                    {FEATURE_COMPARISON_ROWS.filter((r) => r.category === cat).map((row) => (
                      <tr
                        key={row.label}
                        className={`border-t ${
                          isDark ? 'border-slate-800/70' : 'border-[#F4F4F5]'
                        }`}
                      >
                        <td
                          className={`p-3.5 text-xs font-medium ${
                            isDark ? 'text-slate-300' : 'text-[#3F3F46]'
                          }`}
                        >
                          {row.label}
                        </td>
                        <td className="p-3.5 text-center">{renderCell(row.flex)}</td>
                        <td
                          className={`p-3.5 text-center ${
                            isDark ? 'bg-[#F76707]/5' : 'bg-[#FFF4ED]/40'
                          }`}
                        >
                          {renderCell(row.essential)}
                        </td>
                        <td className="p-3.5 text-center">{renderCell(row.professional)}</td>
                        <td className="p-3.5 text-center">{renderCell(row.enterprise)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

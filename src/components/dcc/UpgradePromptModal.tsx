import React from 'react';
import { Lock, Sparkles, ArrowRight, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { LockedFeatureError } from '../../hooks/useEntitlements';
import { getPlanDefinition } from '../../config/subscriptionPlans';

interface UpgradePromptModalProps {
  lockedError: LockedFeatureError | null;
  onClose: () => void;
  onViewPlans: (recommendedPlanId?: string) => void;
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  lockedError,
  onClose,
  onViewPlans,
}) => {
  if (!lockedError) return null;

  const currentPlan = getPlanDefinition(lockedError.currentPlanId);
  const reqPlan = getPlanDefinition(lockedError.requiredPlanId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
        <div className="p-5 bg-[#18181B] text-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F76707]/20 text-[#F76707] border border-[#F76707]/30 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFDBCC] block">
                Plan Feature Locked
              </span>
              <h3 className="text-base font-extrabold font-heading leading-tight">
                {lockedError.featureLabel}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            aria-label="Close upgrade prompt"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#52525B] leading-relaxed">
            Your workspace is currently on the{' '}
            <strong className="text-[#18181B]">{currentPlan.name}</strong> plan (₹
            {currentPlan.priceInr.toLocaleString('en-IN')}/mo • {currentPlan.commissionPercent}% QR
            commission). Upgrade to <strong className="text-[#F76707]">{reqPlan.name}</strong> to
            unlock <strong>{lockedError.featureLabel}</strong> and lower your commission rate to{' '}
            <strong>{reqPlan.commissionPercent}%</strong>.
          </p>

          <div className="p-3.5 rounded-2xl bg-[#FFF4ED] border border-[#FFDBCC] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#F76707]" />
                <span className="text-xs font-extrabold font-heading text-[#18181B]">
                  {reqPlan.name} Plan Unlocks This
                </span>
              </div>
              <span className="text-xs font-extrabold text-[#F76707]">
                ₹{reqPlan.priceInr.toLocaleString('en-IN')}/mo
              </span>
            </div>
            <p className="text-[11px] text-[#71717A]">{reqPlan.targetCustomer}</p>
            <ul className="space-y-1 pt-1">
              {reqPlan.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-[11px] text-[#18181B]">
                  <CheckCircle2 size={12} className="text-[#16A34A] shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] bg-[#FAFAFA] px-3 py-2 rounded-xl border border-[#E4E4E7]">
            <ShieldCheck size={14} className="text-[#16A34A] shrink-0" />
            <span>
              Core QR ordering, KDS &amp; Waiter billing always stay active with zero interruption.
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl border border-[#E4E4E7] text-[#52525B] text-xs font-bold hover:bg-[#FAFAFA] transition-all"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={() => {
                const target = reqPlan.id;
                onClose();
                onViewPlans(target);
              }}
              className="flex-[1.5] py-2.5 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-extrabold font-heading flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <span>View Plans &amp; Upgrade</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LockedFeatureBannerProps {
  title: string;
  description: string;
  requiredPlanName: string;
  requiredPlanPriceInr: number;
  currentPlanName?: string;
  onUpgradeClick: () => void;
}

export const LockedFeatureBanner: React.FC<LockedFeatureBannerProps> = ({
  title,
  description,
  requiredPlanName,
  requiredPlanPriceInr,
  currentPlanName = 'Flex',
  onUpgradeClick,
}) => (
  <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 sm:p-8 text-center space-y-4 shadow-xs">
    <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#F76707] border border-[#FFDBCC] mx-auto flex items-center justify-center">
      <Lock size={22} />
    </div>
    <div className="space-y-1 max-w-md mx-auto">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-[#52525B] text-[10px] font-bold uppercase tracking-wider">
        <span>Current Plan: {currentPlanName}</span>
        <span>•</span>
        <span className="text-[#F76707]">Requires {requiredPlanName}</span>
      </div>
      <h3 className="text-base font-extrabold font-heading text-[#18181B] pt-1">{title}</h3>
      <p className="text-xs text-[#71717A] leading-relaxed">{description}</p>
    </div>
    <button
      type="button"
      onClick={onUpgradeClick}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-extrabold font-heading shadow-sm transition-all"
    >
      <Sparkles size={14} />
      <span>
        Upgrade to {requiredPlanName} (₹{requiredPlanPriceInr.toLocaleString('en-IN')}/mo)
      </span>
      <ArrowRight size={14} />
    </button>
  </div>
);

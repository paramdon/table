import React from 'react';
import { ShoppingBag, ChevronRight, Flame } from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface BottomActionDockProps {
  totalItemsCount: number;
  subtotal: number;
  onOpenOrderReview: () => void;
  activeCookingCount?: number;
}

export const BottomActionDock: React.FC<BottomActionDockProps> = ({
  totalItemsCount,
  subtotal,
  onOpenOrderReview,
  activeCookingCount = 0,
}) => {
  if (totalItemsCount === 0 && activeCookingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-[#18181B] text-white rounded-2xl p-2.5 sm:p-3 shadow-[0_12px_32px_-4px_rgba(24,24,27,0.45)] border border-white/10 flex items-center justify-between gap-3 transition-transform animate-in slide-in-from-bottom duration-300">
          {/* Left section: Item Counter & Subtotal in INR */}
          <div
            onClick={onOpenOrderReview}
            className="flex items-center gap-3 pl-2 cursor-pointer select-none group"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                <ShoppingBag size={18} className="text-[#FFDBCC]" />
              </div>
              <span className="absolute -top-1 -right-1.5 w-5 h-5 rounded-full bg-[#F76707] text-white font-heading font-extrabold text-[11px] flex items-center justify-center ring-2 ring-[#18181B] tnum">
                {totalItemsCount}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-extrabold font-heading text-white tnum tracking-tight">
                  {formatINR(subtotal)}
                </span>
                {activeCookingCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFDBCC]/20 text-[#FFDBCC] border border-[#FFDBCC]/30">
                    <Flame size={10} className="text-[#F76707] animate-pulse" />
                    {activeCookingCount} in tandoor
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                {totalItemsCount} {totalItemsCount === 1 ? 'dish' : 'dishes'} on table slip
              </p>
            </div>
          </div>

          {/* Right section: Saffron Amber Review Button */}
          <button
            type="button"
            onClick={onOpenOrderReview}
            className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] active:scale-98 text-white font-heading font-bold text-xs sm:text-sm tracking-tight shadow-md flex items-center gap-1.5 transition-all select-none"
          >
            <span>Review Order</span>
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Plus, Clock, Sparkles } from 'lucide-react';
import { MenuItem } from '../types/dining';
import { DietaryBadge, SpiceBadge, AllergenPill, JainBadge, HalalBadge } from './DietaryBadge';
import { QuantityStepper } from './QuantityStepper';
import { formatINR } from '../utils/formatters';

interface DishCardProps {
  item: MenuItem;
  variant?: 'compact' | 'hero';
  quantityInCart: number;
  onOpenCustomization: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onIncrement: (item: MenuItem) => void;
  onDecrement: (item: MenuItem) => void;
}

export const DishCard: React.FC<DishCardProps> = ({
  item,
  variant = 'compact',
  quantityInCart,
  onOpenCustomization,
  onQuickAdd,
  onIncrement,
  onDecrement,
}) => {
  // HERO / FEATURED VARIANT
  if (variant === 'hero') {
    return (
      <div
        onClick={() => onOpenCustomization(item)}
        className="group relative bg-white rounded-2xl border border-[#F4F4F5] shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
      >
        {/* Full-bleed 16:9 image container */}
        <div className="relative aspect-16/9 w-full overflow-hidden bg-[#F4F4F5]">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/20" />

          {/* Floating Diet Badges (Top Left) */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            <div className="bg-white/95 backdrop-blur-md px-2 py-1 rounded-md shadow-xs">
              <DietaryBadge dietType={item.dietType} size="sm" />
            </div>
            {item.isJainAvailable && <JainBadge />}
            {item.isHalal && <HalalBadge />}
            {item.isChefsChoice && (
              <span className="flex items-center gap-1 text-[10px] font-bold font-heading px-2 py-1 rounded-full bg-[#18181B]/90 text-white backdrop-blur-md">
                <Sparkles size={11} className="text-[#F76707]" />
                Chef's Special
              </span>
            )}
          </div>

          {/* Floating Price Badge (Top Right in INR) */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full shadow-sm text-right">
            <span className="text-base font-extrabold font-heading text-[#18181B] tnum">
              {formatINR(item.price)}
            </span>
          </div>

          {/* Bottom Overlay Title & Prep Time */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="text-white drop-shadow-sm pr-2">
              <h3 className="text-lg font-bold font-heading leading-tight line-clamp-1">
                {item.name}
              </h3>
              {item.hindiName && (
                <p className="text-xs text-white/80 font-medium">
                  {item.hindiName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full shrink-0">
              <Clock size={11} />
              <span>{item.prepTimeMinutes}m</span>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-4 flex flex-col justify-between flex-1 gap-3">
          <p className="text-xs text-[#52525B] leading-relaxed line-clamp-2">
            {item.description}
          </p>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F4F4F5]">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                <SpiceBadge level={item.spiceLevel} />
              )}
              {item.allergens?.slice(0, 2).map((alg) => (
                <AllergenPill key={alg} label={alg} />
              ))}
            </div>

            {/* Quick Action or Stepper */}
            <div onClick={(e) => e.stopPropagation()}>
              {quantityInCart > 0 ? (
                <QuantityStepper
                  quantity={quantityInCart}
                  onIncrement={() => onIncrement(item)}
                  onDecrement={() => onDecrement(item)}
                  allowDelete
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenCustomization(item)}
                  className="px-3.5 py-1.5 rounded-full bg-[#F76707] hover:bg-[#A14000] text-white text-xs font-bold font-heading shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center gap-1"
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Customize & Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COMPACT LIST VARIANT
  return (
    <div
      onClick={() => onOpenCustomization(item)}
      className="group relative bg-white rounded-xl p-3 sm:p-4 border border-[#F4F4F5] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex gap-3.5 items-center justify-between"
    >
      {/* Left Details */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2 mb-1">
          <DietaryBadge dietType={item.dietType} size="sm" />
          {item.isJainAvailable && <JainBadge />}
          {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
            <SpiceBadge level={item.spiceLevel} />
          )}
          {item.isPopular && (
            <span className="text-[10px] font-bold text-[#F76707] bg-[#FFDBCC]/70 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
              Popular
            </span>
          )}
        </div>

        <h4 className="text-sm sm:text-base font-bold font-heading text-[#18181B] group-hover:text-[#F76707] transition-colors line-clamp-1">
          {item.name}
        </h4>

        {item.hindiName && (
          <span className="text-[11px] text-[#71717A] block -mt-0.5 mb-1 font-medium">
            {item.hindiName}
          </span>
        )}

        <p className="text-xs text-[#52525B] line-clamp-2 leading-snug">
          {item.description}
        </p>

        <div className="flex items-center gap-2.5 mt-2">
          <span className="text-sm sm:text-base font-extrabold font-heading text-[#18181B] tnum">
            {formatINR(item.price)}
          </span>
          <span className="text-[11px] text-[#A14000] font-semibold bg-[#FFDBCC]/50 px-1.5 py-0.2 rounded-sm flex items-center gap-0.5">
            <Clock size={11} /> {item.prepTimeMinutes}m
          </span>
        </div>
      </div>

      {/* Right Thumbnail & Add Pill */}
      <div className="relative shrink-0 flex flex-col items-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#F4F4F5] shadow-inner">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>

        {/* Floating Add / Quantity Adjuster */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -bottom-2.5 shadow-sm rounded-full"
        >
          {quantityInCart > 0 ? (
            <QuantityStepper
              size="sm"
              quantity={quantityInCart}
              onIncrement={() => onIncrement(item)}
              onDecrement={() => onDecrement(item)}
              allowDelete
            />
          ) : (
            <button
              type="button"
              onClick={() => onQuickAdd(item)}
              className="px-3 py-1 rounded-full bg-white hover:bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] text-xs font-bold font-heading shadow-xs active:scale-90 transition-all flex items-center gap-1 group-hover:border-[#F76707] group-hover:text-[#F76707]"
              title="Add to order"
            >
              <Plus size={12} strokeWidth={2.5} className="text-[#F76707]" />
              <span>ADD</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Flame, ShieldAlert, Sparkles, User, Leaf } from 'lucide-react';
import { MenuItem, PortionOption, AddonOption, SelectedCustomization, Diner } from '../types/dining';
import { DietaryBadge, SpiceBadge, AllergenPill, JainBadge, HalalBadge, DifficultyBadge } from './DietaryBadge';
import { QuantityStepper } from './QuantityStepper';
import { formatINR } from '../utils/formatters';

interface CustomizationModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  diners: Diner[];
  onClose: () => void;
  onAddToCart: (item: MenuItem, customization: SelectedCustomization, quantity: number) => void;
  existingCustomization?: SelectedCustomization;
  existingQuantity?: number;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  item,
  diners,
  onClose,
  onAddToCart,
  existingCustomization,
  existingQuantity = 1,
}) => {
  // Hooks MUST be unconditional at the top
  const [quantity, setQuantity] = useState<number>(existingQuantity);
  const [selectedPortion, setSelectedPortion] = useState<PortionOption | undefined>(
    existingCustomization?.portion || item?.portions?.[0]
  );
  const [selectedSpice, setSelectedSpice] = useState<string | undefined>(
    existingCustomization?.selectedSpice || item?.spiceChoices?.[0]
  );
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>(
    existingCustomization?.addons || []
  );
  const [isJain, setIsJain] = useState<boolean>(
    existingCustomization?.isJain || false
  );
  const [specialNotes, setSpecialNotes] = useState<string>(
    existingCustomization?.specialNotes || ''
  );
  const [orderedBy, setOrderedBy] = useState<string>(
    existingCustomization?.orderedBy || diners.find(d => d.isCurrentUser)?.name || diners[0]?.name || 'You'
  );

  useEffect(() => {
    if (item) {
      setSelectedPortion(existingCustomization?.portion || item.portions?.[0]);
      setSelectedSpice(existingCustomization?.selectedSpice || item.spiceChoices?.[0]);
      setSelectedAddons(existingCustomization?.addons || []);
      setIsJain(existingCustomization?.isJain || false);
      setSpecialNotes(existingCustomization?.specialNotes || '');
      setQuantity(existingQuantity || 1);
    }
  }, [item, existingCustomization, existingQuantity]);

  if (!isOpen || !item) return null;

  // Calculate unit price based on base price, portion delta, and addons
  const portionDelta = selectedPortion?.priceDelta || 0;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = item.price + portionDelta + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const toggleAddon = (addon: AddonOption) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      } else {
        return [...prev, addon];
      }
    });
  };

  const handleConfirm = () => {
    onAddToCart(
      item,
      {
        portion: selectedPortion,
        selectedSpice,
        addons: selectedAddons,
        isJain,
        specialNotes: specialNotes.trim(),
        orderedBy,
      },
      quantity
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header & Hero Image */}
        <div className="relative aspect-16/9 w-full bg-[#F4F4F5] shrink-0">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Floating Badges */}
          <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
            <div className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md shadow-xs">
              <DietaryBadge dietType={item.dietType} />
            </div>
            {item.isJainAvailable && <JainBadge />}
            {item.isHalal && <HalalBadge />}
          </div>

          {/* Bottom Title & Specs */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h3 className="text-xl sm:text-2xl font-bold font-heading leading-tight drop-shadow-sm">
              {item.name}
            </h3>
            {item.hindiName && (
              <p className="text-xs text-white/80 font-medium">
                {item.hindiName}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-white/90">
              <span className="flex items-center gap-1 font-medium bg-black/30 px-2 py-0.5 rounded-full">
                <Clock size={12} /> {item.prepTimeMinutes} mins
              </span>
              <DifficultyBadge
                level={item.difficultyLevel}
                prepTimeMinutes={item.prepTimeMinutes}
                size="sm"
              />
              {item.calories && (
                <span className="flex items-center gap-1 font-medium bg-black/30 px-2 py-0.5 rounded-full">
                  <Flame size={12} className="text-[#F76707]" /> {item.calories} kcal
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Customization Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-[#18181B]">
          {/* Item Description */}
          <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed">
            {item.description}
          </p>

          {/* Jain Dietary Toggle Option if available */}
          {item.isJainAvailable && (
            <div
              onClick={() => setIsJain(!isJain)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                isJain
                  ? 'border-[#16A34A] bg-[#F0FDF4] text-[#166534]'
                  : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#16A34A]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isJain ? 'bg-[#16A34A] border-[#16A34A] text-white' : 'border-[#D4D4D8] bg-white'
                  }`}
                >
                  {isJain && <Check size={13} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-bold font-heading flex items-center gap-1">
                    <Leaf size={12} className="text-[#16A34A]" />
                    <span>Jain Preparation (जैन भोजन)</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    Prepared strictly with NO onion, NO garlic, and NO root tubers
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#16A34A]/30 text-[#16A34A]">
                {isJain ? 'Selected' : 'Available'}
              </span>
            </div>
          )}

          {/* Diner Ordering Selector */}
          <div>
            <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A] flex items-center gap-1 mb-2">
              <User size={13} className="text-[#F76707]" />
              Who at this table is having this dish?
            </label>
            <div className="flex flex-wrap gap-2">
              {diners.map((diner) => {
                const isSelected = orderedBy === diner.name;
                return (
                  <button
                    key={diner.id}
                    type="button"
                    onClick={() => setOrderedBy(diner.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#18181B] text-white shadow-xs'
                        : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: diner.avatarColor }}
                      className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                    >
                      {diner.initials}
                    </span>
                    <span>{diner.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portion Options */}
          {item.portions && item.portions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A]">
                  Select Portion Size
                </label>
                <span className="text-[10px] text-[#A14000] font-semibold bg-[#FFDBCC] px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.portions.map((portion) => {
                  const isSelected = selectedPortion?.id === portion.id;
                  return (
                    <div
                      key={portion.id}
                      onClick={() => setSelectedPortion(portion)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 shadow-xs'
                          : 'border-[#E4E4E7] bg-white hover:border-[#D4D4D8]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold font-heading text-[#18181B]">
                          {portion.name}
                        </div>
                        {portion.description && (
                          <div className="text-[11px] text-[#71717A] mt-0.5">
                            {portion.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-heading text-[#18181B] tnum">
                          {portion.priceDelta === 0
                            ? 'Included'
                            : `+${formatINR(portion.priceDelta)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Temperature / Spice Choice */}
          {item.spiceChoices && item.spiceChoices.length > 0 && (
            <div>
              <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A] block mb-2">
                Preparation / Spiciness Level
              </label>
              <div className="flex flex-col gap-1.5">
                {item.spiceChoices.map((choice) => {
                  const isSelected = selectedSpice === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedSpice(choice)}
                      className={`w-full p-2.5 rounded-xl border text-xs font-medium text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 text-[#18181B] font-bold'
                          : 'border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <span>{choice}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-[#F76707] bg-[#F76707] text-white'
                            : 'border-[#D4D4D8]'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons & Accompaniments */}
          {item.addons && item.addons.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A]">
                  Desi Accompaniments & Extras
                </label>
                <span className="text-[10px] text-[#71717A]">Optional</span>
              </div>
              <div className="space-y-1.5">
                {item.addons.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer text-xs transition-all ${
                        isChecked
                          ? 'border-[#F76707] bg-[#FFDBCC]/20'
                          : 'border-[#E4E4E7] bg-white hover:border-[#D4D4D8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'border-[#F76707] bg-[#F76707] text-white'
                              : 'border-[#D4D4D8] bg-white'
                          }`}
                        >
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className="font-medium text-[#18181B]">{addon.name}</span>
                      </div>
                      <span className="font-bold font-heading text-[#18181B] tnum">
                        {addon.price === 0 ? 'Free' : `+${formatINR(addon.price)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kitchen Notes */}
          <div>
            <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A] block mb-1.5">
              Special Instructions to Bawarchi (Chef)
            </label>
            <input
              type="text"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="e.g. Less spicy, crispy naan, extra green chillies on side..."
              maxLength={120}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] focus:border-[#F76707] focus:bg-white focus:outline-hidden transition-all placeholder:text-[#A1A1AA]"
            />
          </div>
        </div>

        {/* Modal Bottom CTA Footer */}
        <div className="p-4 bg-white border-t border-[#F4F4F5] flex items-center justify-between gap-3 shadow-lg shrink-0">
          <QuantityStepper
            quantity={quantity}
            onIncrement={() => setQuantity((q) => q + 1)}
            onDecrement={() => setQuantity((q) => (q > 1 ? q - 1 : 1))}
          />

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] active:scale-98 text-white font-heading font-bold text-sm tracking-tight shadow-md flex items-center justify-between transition-all"
          >
            <span>{existingCustomization ? 'Update Order' : 'Add to Table Order'}</span>
            <span className="tnum font-extrabold text-base">{formatINR(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  X,
  Plus,
  Send,
  CreditCard,
  Clock,
  Flame,
  CheckCircle2,
  Trash2,
  Edit2,
  Receipt,
  Users,
  ChevronRight,
  Leaf,
} from 'lucide-react';
import { CartItem, TableSession } from '../types/dining';
import { QuantityStepper } from './QuantityStepper';
import { DietaryBadge, JainBadge } from './DietaryBadge';
import { formatINR } from '../utils/formatters';

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  session: TableSession;
  onIncrementItem: (cartItemId: string) => void;
  onDecrementItem: (cartItemId: string) => void;
  onRemoveItem: (cartItemId: string) => void;
  onEditItem: (cartItem: CartItem) => void;
  onSendRoundToKitchen: () => void;
  onOpenBillSplit: () => void;
  onAddMoreItems: () => void;
}

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  session,
  onIncrementItem,
  onDecrementItem,
  onRemoveItem,
  onEditItem,
  onSendRoundToKitchen,
  onOpenBillSplit,
  onAddMoreItems,
}) => {
  if (!isOpen) return null;

  // Split into Draft items (Round 2 / ready to fire) vs Sent to Kitchen items (Round 1)
  const draftItems = cartItems.filter((i) => i.status === 'draft');
  const kitchenItems = cartItems.filter((i) => i.status !== 'draft');

  const draftSubtotal = draftItems.reduce((acc, item) => acc + item.itemTotal, 0);
  const totalSubtotal = cartItems.reduce((acc, item) => acc + item.itemTotal, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F4F4F5] flex items-center justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-heading text-[#18181B]">
                {session.tableName} Live Order Slip
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                {cartItems.length} {cartItems.length === 1 ? 'Dish' : 'Dishes'}
              </span>
            </div>
            <p className="text-xs text-[#71717A] mt-0.5">
              {session.zone} • Floor Captain: {session.captainName}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Order Items */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 text-[#18181B]">
          {cartItems.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#F4F4F5] flex items-center justify-center mx-auto text-[#A1A1AA]">
                <Receipt size={24} />
              </div>
              <h3 className="text-base font-bold font-heading text-[#18181B]">
                Your table order is empty
              </h3>
              <p className="text-xs text-[#71717A] max-w-xs mx-auto">
                Explore our clay oven tandoor kebabs, slow-cooked royal curries, and fragrant dum biryanis to add to your order.
              </p>
              <button
                onClick={onAddMoreItems}
                className="mt-2 px-5 py-2.5 rounded-full bg-[#18181B] text-white text-xs font-bold font-heading hover:bg-[#27272A] transition-all"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              {/* DRAFT ITEMS SECTION (READY TO FIRE) */}
              {draftItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#F4F4F5]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F76707]" />
                      <h3 className="text-xs font-bold font-heading uppercase tracking-wider text-[#18181B]">
                        Ready to Fire (Round {kitchenItems.length > 0 ? '2' : '1'})
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-[#A14000] bg-[#FFDBCC] px-2 py-0.5 rounded-full">
                      Draft Slip
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {draftItems.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="p-3 rounded-xl border border-[#E4E4E7] bg-white hover:border-[#D4D4D8] transition-all flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <DietaryBadge dietType={item.item.dietType} size="sm" showLabel={false} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold font-heading text-[#18181B] truncate">
                                  {item.item.name}
                                </h4>
                                {item.customization.isJain && <JainBadge />}
                              </div>

                              {item.customization.portion && (
                                <p className="text-[11px] text-[#71717A]">
                                  Portion: {item.customization.portion.name}
                                </p>
                              )}
                              {item.customization.selectedSpice && (
                                <p className="text-[11px] text-[#A14000]">
                                  Spice: {item.customization.selectedSpice}
                                </p>
                              )}
                              {item.customization.addons.length > 0 && (
                                <p className="text-[11px] text-[#52525B]">
                                  Accompaniments: {item.customization.addons.map((a) => a.name).join(', ')}
                                </p>
                              )}
                              {item.customization.specialNotes && (
                                <p className="text-[11px] italic text-[#71717A]">
                                  "{item.customization.specialNotes}"
                                </p>
                              )}
                              {item.customization.orderedBy && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-[#52525B] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                                  For: {item.customization.orderedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs sm:text-sm font-extrabold font-heading text-[#18181B] tnum">
                              {formatINR(item.itemTotal)}
                            </div>
                            <button
                              onClick={() => onEditItem(item)}
                              className="text-[10px] text-[#71717A] hover:text-[#F76707] font-semibold flex items-center gap-0.5 ml-auto mt-1"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                          </div>
                        </div>

                        {/* Quantity and Remove */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#F4F4F5]">
                          <button
                            onClick={() => onRemoveItem(item.cartItemId)}
                            className="text-xs text-[#DC2626] hover:text-[#991B1B] font-semibold flex items-center gap-1"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>

                          <QuantityStepper
                            size="sm"
                            quantity={item.quantity}
                            onIncrement={() => onIncrementItem(item.cartItemId)}
                            onDecrement={() => onDecrementItem(item.cartItemId)}
                            allowDelete
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KITCHEN SENT ITEMS SECTION */}
              {kitchenItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#F4F4F5]">
                    <div className="flex items-center gap-1.5">
                      <Flame size={14} className="text-[#F76707] animate-pulse" />
                      <h3 className="text-xs font-bold font-heading uppercase tracking-wider text-[#18181B]">
                        Live Bawarchikhana (Kitchen) Status
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#16A34A]/20">
                      Live on Tandoor
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {kitchenItems.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="p-3 rounded-xl border border-[#E4E4E7]/70 bg-[#FAFAFA] flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <DietaryBadge dietType={item.item.dietType} size="sm" showLabel={false} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-heading text-[#18181B]">
                                  {item.quantity}x {item.item.name}
                                </span>
                                {item.customization.isJain && <JainBadge />}
                              </div>
                              {item.customization.portion && (
                                <p className="text-[11px] text-[#71717A]">
                                  {item.customization.portion.name}
                                </p>
                              )}
                              {item.customization.orderedBy && (
                                <span className="text-[10px] text-[#71717A]">
                                  Ordered by {item.customization.orderedBy}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-extrabold font-heading text-[#18181B] tnum">
                            {formatINR(item.itemTotal)}
                          </span>
                        </div>

                        {/* Kitchen timeline steps */}
                        <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-[#E4E4E7]/60">
                          <div className="flex flex-col items-center text-center">
                            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                            <span className="text-[9px] font-bold text-[#16A34A] mt-0.5">KDS Received</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="w-2 h-2 rounded-full bg-[#F76707] animate-ping" />
                            <span className="text-[9px] font-bold text-[#F76707] mt-0.5">Tandoor & Wok</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="w-2 h-2 rounded-full bg-[#D4D4D8]" />
                            <span className="text-[9px] font-medium text-[#71717A] mt-0.5">Plating</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="w-2 h-2 rounded-full bg-[#D4D4D8]" />
                            <span className="text-[9px] font-medium text-[#71717A] mt-0.5">Served</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {cartItems.length > 0 && (
          <div className="p-4 bg-white border-t border-[#F4F4F5] space-y-2.5 shadow-lg shrink-0">
            {/* Running Total Preview in INR */}
            <div className="flex items-center justify-between text-xs text-[#52525B]">
              <span>Table Total ({cartItems.length} items)</span>
              <span className="text-base font-extrabold font-heading text-[#18181B] tnum">
                {formatINR(totalSubtotal)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* If there are draft items, show Send to Kitchen */}
              {draftItems.length > 0 ? (
                <button
                  type="button"
                  onClick={onSendRoundToKitchen}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] active:scale-98 text-white font-heading font-bold text-xs sm:text-sm tracking-tight shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <Send size={15} />
                  <span>Send {draftItems.length} Dishes to Kitchen ({formatINR(draftSubtotal)})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAddMoreItems}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-heading font-bold text-xs sm:text-sm tracking-tight flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={15} />
                  <span>Add More Naans / Dishes</span>
                </button>
              )}

              {/* Split Bill & Pay CTA */}
              <button
                type="button"
                onClick={onOpenBillSplit}
                className="py-3 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] active:scale-98 text-white font-heading font-bold text-xs sm:text-sm tracking-tight shadow-md flex items-center gap-1.5 transition-all shrink-0"
              >
                <CreditCard size={15} />
                <span>UPI / Pay Bill</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

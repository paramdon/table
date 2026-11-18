import React, { useState } from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  Coffee,
  Sparkles,
  UtensilsCrossed,
  Droplets,
  CreditCard,
  MessageSquare,
  Wine,
  Flame,
} from 'lucide-react';
import { TableSession, WaiterCall, WaiterCallReason } from '../types/dining';

interface CallWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TableSession;
  waiterCall: WaiterCall;
  onRequestWaiter: (reason: WaiterCallReason) => void;
  onCancelRequest: () => void;
}

export const CallWaiterModal: React.FC<CallWaiterModalProps> = ({
  isOpen,
  onClose,
  session,
  waiterCall,
  onRequestWaiter,
  onCancelRequest,
}) => {
  const [selectedReason, setSelectedReason] = useState<WaiterCallReason>('water');

  if (!isOpen) return null;

  const options: { id: WaiterCallReason; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'water',
      label: 'Mineral / RO Filtered Water',
      icon: <Droplets className="text-[#2563EB]" size={20} />,
      desc: 'Fresh water carafe or sealed Bisleri/Himalayan mineral bottle',
    },
    {
      id: 'chutney_onions',
      label: 'Sirka Pyaz, Green Chillies & Mint Chutney',
      icon: <Flame className="text-[#16A34A]" size={20} />,
      desc: 'Fresh refill of pickled shallots, green chillies and mint-coriander dip',
    },
    {
      id: 'cutlery',
      label: 'Extra Spoons, Fork & Bowls',
      icon: <UtensilsCrossed className="text-[#A14000]" size={20} />,
      desc: 'Additional curry serving spoons, katoris or fresh quarter plates',
    },
    {
      id: 'finger_bowl',
      label: 'Warm Lemon Finger Bowl',
      icon: <Coffee className="text-[#F76707]" size={20} />,
      desc: 'Warm scented water with fresh lemon slice for hands',
    },
    {
      id: 'plates',
      label: 'Clear Used Plates & Thalis',
      icon: <Sparkles className="text-[#71717A]" size={20} />,
      desc: 'Clear empty dishes and freshen tabletop for main course / dessert',
    },
    {
      id: 'bill_upi',
      label: 'Physical Bill & Card Machine / UPI Stand',
      icon: <CreditCard className="text-[#16A34A]" size={20} />,
      desc: 'Captain will bring the table invoice folder and card swipe machine',
    },
    {
      id: 'captain',
      label: 'Speak to Floor Captain',
      icon: <MessageSquare className="text-[#DC2626]" size={20} />,
      desc: 'Special dietary requests, spice modifications, or table assistance',
    },
  ];

  const handleSend = () => {
    onRequestWaiter(selectedReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F4F4F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FFDBCC] flex items-center justify-center text-[#F76707]">
              <Bell size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-[#18181B]">
                Call Captain to {session.tableName}
              </h2>
              <p className="text-xs text-[#71717A]">
                Floor Captain: {session.captainName} ({session.zone})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-[#18181B]">
          {waiterCall.active ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FFDBCC] border-2 border-[#F76707] flex items-center justify-center mx-auto text-[#A14000] animate-bounce">
                <Bell size={28} />
              </div>

              <div>
                <h3 className="text-base font-bold font-heading text-[#18181B]">
                  Captain {session.captainName} Notified!
                </h3>
                <p className="text-xs text-[#52525B] mt-1">
                  Your request has reached the floor station. Our staff will attend to {session.tableName} immediately.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4F2FD] border border-[#E3E1EC] text-xs font-semibold text-[#A14000]">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                  <span>Estimated arrival: ~1 minute</span>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onCancelRequest}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2] transition-all"
                >
                  Cancel Request
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading hover:bg-[#27272A] transition-all"
                >
                  Understood
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[#52525B]">
                Choose the assistance you need and captain {session.captainName} will visit your table promptly:
              </p>

              <div className="space-y-2">
                {options.map((opt) => {
                  const isSelected = selectedReason === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedReason(opt.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 shadow-xs'
                          : 'border-[#E4E4E7] bg-white hover:border-[#D4D4D8]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#F4F4F5] flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold font-heading text-[#18181B]">
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[#71717A] leading-tight">
                          {opt.desc}
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#F76707] bg-[#F76707] text-white'
                            : 'border-[#D4D4D8]'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!waiterCall.active && (
          <div className="p-4 bg-white border-t border-[#F4F4F5] shrink-0">
            <button
              type="button"
              onClick={handleSend}
              className="w-full py-3 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] active:scale-98 text-white font-heading font-bold text-xs sm:text-sm tracking-tight shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Bell size={16} />
              <span>Page Captain to {session.tableName}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

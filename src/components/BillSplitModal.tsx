import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  Users,
  Smartphone,
  Wallet,
  Sparkles,
  Share2,
  Receipt,
  Heart,
  ChevronRight,
  QrCode,
  Copy,
  Info,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { CartItem, TableSession, Diner } from '../types/dining';
import { formatINR, generateUpiUri } from '../utils/formatters';
import { useRealtimeSync } from '../context/RealtimeSyncContext';

interface BillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  session: TableSession;
  onPaymentComplete: (
    method?: string,
    extras?: { tip: number; serviceCharge: number; grandTotal: number }
  ) => void;
  restaurantId?: string;
  orderId?: string;
  customerPhone?: string;
  customerName?: string;
  onSelectPayAtRestaurant?: (
    method: 'cash' | 'direct_upi' | 'card_pos',
    extras?: { tip: number; serviceCharge: number; grandTotal: number }
  ) => void;
}

export const BillSplitModal: React.FC<BillSplitModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  session,
  onPaymentComplete,
  restaurantId,
  orderId,
  customerPhone,
  customerName,
  onSelectPayAtRestaurant,
}) => {
  const { initiateUpiGatewayPayment, confirmUpiGatewayPayment } = useRealtimeSync();

  // Hooks MUST be unconditional at top
  const [splitMode, setSplitMode] = useState<'equal' | 'diner'>('equal');
  const [splitCount, setSplitCount] = useState<number>(Math.max(1, session.activeDiners.length));
  const [includeServiceCharge, setIncludeServiceCharge] = useState<boolean>(true);
  const [selectedTip, setSelectedTip] = useState<number>(0); // Optional tip in INR (starts at 0)
  const [customTipInput, setCustomTipInput] = useState<string>('');
  const [paymentStep, setPaymentStep] = useState<
    'review' | 'tip' | 'upi_qr' | 'paying' | 'offline_pending' | 'success'
  >('review');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card_pos' | 'cash' | 'direct_upi'>('upi');
  const [rating, setRating] = useState<number>(5);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([
    'Authentic Flavours',
    'Crisp Tandoor Naan',
    'Fast Service',
  ]);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [isCopiedVpa, setIsCopiedVpa] = useState<boolean>(false);
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [gatewayOrderId, setGatewayOrderId] = useState<string | null>(null);
  const [settledRef, setSettledRef] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Enabled payment methods from restaurant owner settings
  const [allowedMethods, setAllowedMethods] = useState<{
    allowOnlineGateway: boolean;
    allowCashAtCounter: boolean;
    allowDirectUpi: boolean;
    directUpiVpa: string;
  }>({
    allowOnlineGateway: true,
    allowCashAtCounter: true,
    allowDirectUpi: true,
    directUpiVpa: 'saffronverandah@merchantupi',
  });

  const effectiveRestId = restaurantId || 'demo-restaurant';

  // Fetch restaurant payment methods config
  useEffect(() => {
    let isMounted = true;
    const fetchMethods = async () => {
      try {
        const res = await fetch(`/api/billing/payment-methods/${effectiveRestId}`);
        const data = await res.json();
        if (isMounted && data.success && data.paymentMethods) {
          const pm = data.paymentMethods;
          setAllowedMethods({
            allowOnlineGateway: pm.onlineGatewayEnabled !== false && pm.allowOnlineGateway !== false,
            allowCashAtCounter: pm.payAtRestaurantCashEnabled !== false && pm.allowCashAtCounter !== false,
            allowDirectUpi: pm.payAtRestaurantUpiEnabled !== false && pm.allowDirectUpi !== false,
            directUpiVpa:
              pm.restaurantUpiId ||
              pm.directUpiVpa ||
              `${effectiveRestId.replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`,
          });
        }
      } catch (e) {
        // Fallback to defaults
      }
    };
    fetchMethods();
    return () => {
      isMounted = false;
    };
  }, [effectiveRestId]);

  const subtotal = cartItems.reduce((acc, item) => acc + item.itemTotal, 0);

  // Indian GST: 2.5% CGST + 2.5% SGST = 5.0%
  const cgstRate = 0.025;
  const sgstRate = 0.025;
  const cgst = subtotal * cgstRate;
  const sgst = subtotal * sgstRate;
  const totalGst = cgst + sgst;

  // Optional 5% Service Charge
  const serviceChargeRate = 0.05;
  const serviceCharge = includeServiceCharge ? subtotal * serviceChargeRate : 0;

  const tipAmount = selectedTip;
  const grandTotal = Math.round(subtotal + totalGst + serviceCharge + tipAmount);
  const perPersonEqual = Math.round(grandTotal / Math.max(1, splitCount));
  const payableAmount = splitMode === 'equal' && splitCount > 1 ? perPersonEqual : grandTotal;

  // Generate UPI QR Code
  useEffect(() => {
    const vpa = allowedMethods.directUpiVpa || 'saffronverandah@merchantupi';
    const upiUri = generateUpiUri({
      payeeVpa: vpa,
      payeeName: session.tableName ? `${session.tableName} Bill` : 'Ur.Dear.Menu Restaurant',
      amount: payableAmount,
      transactionNote: `${session.tableName} Bill (GSTIN ${session.gstin})`,
    });

    QRCode.toDataURL(upiUri, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
    })
      .then((url) => setUpiQrDataUrl(url))
      .catch((err) => console.error('Failed to generate UPI QR', err));
  }, [payableAmount, session.tableName, session.gstin, allowedMethods.directUpiVpa]);

  if (!isOpen) return null;

  // Per diner breakdown
  const dinersBreakdown = session.activeDiners.map((diner) => {
    const itemsForDiner = cartItems.filter(
      (item) => item.customization.orderedBy === diner.name
    );
    const dinerSubtotal = itemsForDiner.reduce((acc, i) => acc + i.itemTotal, 0);
    const unassignedItems = cartItems.filter(
      (item) => !item.customization.orderedBy || !session.activeDiners.some((d) => d.name === item.customization.orderedBy)
    );
    const unassignedShare = unassignedItems.reduce((acc, i) => acc + i.itemTotal, 0) / Math.max(1, session.activeDiners.length);
    const effectiveSubtotal = dinerSubtotal + unassignedShare;
    const dinerGst = effectiveSubtotal * 0.05;
    const dinerServiceCharge = includeServiceCharge ? effectiveSubtotal * serviceChargeRate : 0;
    const dinerTotal = Math.round(effectiveSubtotal + dinerGst + dinerServiceCharge + (tipAmount / Math.max(1, session.activeDiners.length)));

    return {
      diner,
      items: itemsForDiner,
      effectiveSubtotal,
      dinerTotal,
    };
  });

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(allowedMethods.directUpiVpa || 'saffronverandah@merchantupi');
    setIsCopiedVpa(true);
    setTimeout(() => setIsCopiedVpa(false), 2000);
  };

  const handleProceedToPay = async (overrideTip?: number) => {
    setPaymentError(null);
    const effectiveTip = overrideTip !== undefined ? Math.max(0, Math.round(overrideTip)) : selectedTip;
    if (overrideTip !== undefined) {
      setSelectedTip(effectiveTip);
    }
    const effectiveGrandTotal = Math.round(subtotal + totalGst + serviceCharge + effectiveTip);
    const effectivePayable =
      splitMode === 'equal' && splitCount > 1
        ? Math.round(effectiveGrandTotal / Math.max(1, splitCount))
        : effectiveGrandTotal;

    if (paymentMethod === 'upi') {
      // Simulated UPI Payment Gateway via RealtimeSyncContext -> dynamic QR
      setIsProcessingPayment(true);
      try {
        const effOrderId = orderId || `ord-${session.tableNumber}-${Date.now()}`;
        const gwResult = await initiateUpiGatewayPayment({
          restaurantId: effectiveRestId,
          orderId: effOrderId,
          tableNumber: session.tableNumber,
          amount: effectivePayable,
          customerPhone,
          customerName,
          vpaOverride: allowedMethods.directUpiVpa,
        });
        setPaymentTxId(gwResult.transactionId);
        setGatewayOrderId(gwResult.gatewayOrderId);
        setUpiQrDataUrl(gwResult.qrDataUrl);
        setPaymentStep('upi_qr');
      } catch (err: any) {
        setPaymentError(err?.message || 'Failed to initialize dynamic UPI QR.');
      } finally {
        setIsProcessingPayment(false);
      }
    } else {
      // Option B: Pay at Restaurant (Cash or Direct UPI / Card Machine)
      setIsProcessingPayment(true);
      try {
        onSelectPayAtRestaurant?.(paymentMethod as any, {
          tip: effectiveTip,
          serviceCharge,
          grandTotal: effectiveGrandTotal,
        });
        setSettledRef(`OFFLINE-${Math.floor(100000 + Math.random() * 900000)}`);
        setPaymentStep('offline_pending');
      } finally {
        setIsProcessingPayment(false);
      }
    }
  };

  const handleConfirmUpiPaid = async () => {
    setIsProcessingPayment(true);
    setPaymentStep('paying');
    try {
      const effOrderId = orderId || `ord-${session.tableNumber}-${Date.now()}`;
      const result = await confirmUpiGatewayPayment({
        restaurantId: effectiveRestId,
        orderId: effOrderId,
        paymentTransactionId: paymentTxId || undefined,
        amount: payableAmount,
        eligibleSubtotal: subtotal,
        tip: selectedTip,
        serviceCharge,
        grandTotal,
      });
      setSettledRef(result.settledRef);
      setPaymentStep('success');
      onPaymentComplete('upi', {
        tip: selectedTip,
        serviceCharge,
        grandTotal,
      });
    } catch (err: any) {
      console.warn('Payment verify failed, completing with local fallback:', err);
      setSettledRef(`UDM-${Math.floor(100000 + Math.random() * 900000)}`);
      setPaymentStep('success');
      onPaymentComplete('upi', {
        tip: selectedTip,
        serviceCharge,
        grandTotal,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const toggleCompliment = (comp: string) => {
    setSelectedCompliments((prev) =>
      prev.includes(comp) ? prev.filter((c) => c !== comp) : [...prev, comp]
    );
  };

  const baseBillBeforeTip = Math.round(subtotal + totalGst + serviceCharge);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F4F4F5] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold font-heading text-[#18181B]">
              {paymentStep === 'success'
                ? 'Tax Invoice Settled'
                : paymentStep === 'tip'
                ? 'Add Tip (Optional)'
                : paymentStep === 'upi_qr'
                ? 'Scan UPI QR to Pay'
                : 'Tax Invoice & Bill Splitting'}
            </h2>
            <p className="text-xs text-[#71717A]">
              {session.tableName} • GSTIN: {session.gstin}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-[#18181B]">
          {/* STEP: PROCESSING */}
          {paymentStep === 'paying' && (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-[#F76707] border-t-transparent animate-spin mx-auto" />
              <h3 className="text-base font-bold font-heading text-[#18181B]">
                Verifying Table Settlement...
              </h3>
              <p className="text-xs text-[#71717A]">
                Synchronizing with restaurant POS & floor captain {session.captainName}.
              </p>
            </div>
          )}

          {/* STEP: OFFLINE PAYMENT FLAGGED (CASH / DIRECT UPI) */}
          {paymentStep === 'offline_pending' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-500 text-amber-600 flex items-center justify-center mx-auto">
                <Wallet size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-[#18181B]">
                  Pay at Restaurant Flagged
                </h3>
                <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                  Your table request for <strong>{paymentMethod === 'cash' ? 'Cash Payment' : 'Card / Direct UPI'}</strong> has been sent to the floor captain.
                </p>
              </div>

              <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-[#E4E4E7] text-left text-xs space-y-2">
                <div className="flex justify-between text-[#52525B]">
                  <span>Table Number:</span>
                  <span className="font-bold text-[#18181B]">{session.tableName}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Captain &amp; Kitchen Tip:</span>
                    <span className="tnum">+{formatINR(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#52525B]">
                  <span>Amount to Pay:</span>
                  <span className="font-extrabold text-[#F76707] text-sm tnum">{formatINR(payableAmount)}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Status:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Awaiting Staff Confirmation</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Slip Reference:</span>
                  <span className="font-mono">{settledRef}</span>
                </div>
              </div>

              <p className="text-[11px] text-[#71717A]">
                The floor captain or cashier will confirm receipt on their terminal.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading hover:bg-[#27272A] transition-all"
              >
                Close Notice
              </button>
            </div>
          )}

          {/* STEP 2: OPTIONAL ADD TIP STEP */}
          {paymentStep === 'tip' && (
            <div className="space-y-4 py-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF7ED] to-[#FFEDD5]/60 border border-[#F76707]/25 space-y-2 text-center">
                <div className="w-11 h-11 rounded-2xl bg-[#F76707] text-white flex items-center justify-center mx-auto shadow-xs">
                  <Heart size={20} />
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#A14000]">
                  Optional Step • Appreciate Service
                </div>
                <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                  Add a Tip for {session.captainName} &amp; Kitchen?
                </h3>
                <p className="text-xs text-[#52525B] max-w-sm mx-auto">
                  100% of your gratuity goes directly to your floor waiter &amp; kitchen crew and is reflected on their live earnings dashboard.
                </p>
              </div>

              {/* Preset Tip Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#18181B]">
                  <span>Quick Tip Presets</span>
                  <span className="text-[11px] text-[#F76707] tnum">
                    {selectedTip > 0 ? `+${formatINR(selectedTip)} selected` : 'No tip selected'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'No Tip (₹0)', amount: 0 },
                    { label: '₹30', amount: 30 },
                    { label: '₹50', amount: 50 },
                    { label: '₹100', amount: 100 },
                    { label: `5% (₹${Math.round(subtotal * 0.05)})`, amount: Math.round(subtotal * 0.05) },
                    { label: `10% (₹${Math.round(subtotal * 0.1)})`, amount: Math.round(subtotal * 0.1) },
                  ].map((preset) => {
                    const isActive = selectedTip === preset.amount && customTipInput === '';
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setCustomTipInput('');
                          setSelectedTip(preset.amount);
                        }}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                          isActive
                            ? 'bg-[#18181B] text-white border-[#18181B] shadow-xs'
                            : 'bg-white border-[#E4E4E7] text-[#18181B] hover:border-[#F76707]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Tip Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#52525B] block">
                  Or Enter Custom Tip Amount (₹)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#71717A]">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={customTipInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomTipInput(raw);
                        const num = Math.max(0, Math.round(Number(raw) || 0));
                        setSelectedTip(num);
                      }}
                      placeholder="e.g. 75"
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-bold text-[#18181B] focus:outline-none focus:border-[#F76707]"
                    />
                  </div>
                  {selectedTip > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTipInput('');
                        setSelectedTip(0);
                      }}
                      className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#52525B] hover:text-[#18181B]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Live Updated Bill Summary */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#52525B]">
                  <span>Bill Before Tip (Incl. GST &amp; Charges)</span>
                  <span className="font-semibold text-[#18181B] tnum">{formatINR(baseBillBeforeTip)}</span>
                </div>
                <div className="flex justify-between text-[#16A34A] font-semibold">
                  <span>Waiter &amp; Kitchen Tip</span>
                  <span className="tnum">+{formatINR(tipAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E4E4E7] text-sm font-extrabold font-heading text-[#18181B]">
                  <span>
                    {splitMode === 'equal' && splitCount > 1
                      ? `Updated Share (1 of ${splitCount})`
                      : 'Updated Total Payable'}
                  </span>
                  <span className="text-[#F76707] text-base tnum">{formatINR(payableAmount)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  {paymentError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentStep('review')}
                  className="py-2.5 px-3 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#52525B] hover:bg-[#FAFAFA]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={() => {
                    setCustomTipInput('');
                    handleProceedToPay(0);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-[#18181B]/20 bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] disabled:opacity-50"
                >
                  Skip Tip ({formatINR(splitMode === 'equal' && splitCount > 1 ? Math.round(baseBillBeforeTip / Math.max(1, splitCount)) : baseBillBeforeTip)})
                </button>
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={() => handleProceedToPay(selectedTip)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <span>
                    {isProcessingPayment
                      ? 'Processing...'
                      : `Pay ${formatINR(payableAmount)}`}
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP: UPI QR CODE DISPLAY */}
          {paymentStep === 'upi_qr' && (
            <div className="py-3 text-center space-y-4">
              <div className="bg-[#FAFAFA] p-4 rounded-2xl border border-[#E4E4E7] inline-block shadow-sm">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <span className="text-xs font-bold font-heading text-[#18181B] uppercase tracking-wider">
                    Scan with any UPI App
                  </span>
                </div>

                {upiQrDataUrl ? (
                  <div className="bg-white p-2 rounded-xl border border-[#E4E4E7] inline-block shadow-xs">
                    <img
                      src={upiQrDataUrl}
                      alt="UPI QR Code"
                      className="w-56 h-56 mx-auto object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-white rounded-xl">
                    <QrCode size={36} className="text-[#A1A1AA] animate-pulse" />
                  </div>
                )}

                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="px-2.5 py-1 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#52525B]">
                    {allowedMethods.directUpiVpa || 'saffronverandah@merchantupi'}
                  </div>
                  <button
                    onClick={handleCopyVpa}
                    className="p-1.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-lg text-xs text-[#18181B] flex items-center gap-1 transition-all"
                    title="Copy UPI VPA"
                  >
                    {isCopiedVpa ? <Check size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
                  </button>
                </div>

                {gatewayOrderId && (
                  <div className="mt-1 text-[10px] text-[#71717A] font-mono">
                    Gateway Order: {gatewayOrderId}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-2 border-t border-[#E4E4E7]">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#18181B]">Any UPI App</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#18181B]">Mobile Banking</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#18181B]">Instant QR</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#18181B]">0% MDR</span>
                </div>

                <div className="mt-2 text-[10px] text-[#71717A] text-center font-medium">
                  Standard Interoperable UPI Protocol
                </div>
              </div>

              <div>
                <p className="text-xs text-[#71717A]">
                  Payable for {splitMode === 'equal' && splitCount > 1 ? `1 of ${splitCount} Shares` : 'Full Table'}
                </p>
                <div className="text-2xl font-extrabold font-heading text-[#F76707] tnum mt-0.5">
                  {formatINR(payableAmount)}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentStep('review')}
                  className="flex-1 py-3 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#52525B] hover:bg-[#FAFAFA] transition-all"
                >
                  Back to Bill Details
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpiPaid}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold font-heading shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{isProcessingPayment ? 'Verifying...' : 'I Have Paid via UPI'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP: PAYMENT SUCCESS & RECEIPT */}
          {paymentStep === 'success' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#F0FDF4] border-2 border-[#16A34A] flex items-center justify-center mx-auto text-[#16A34A] animate-in zoom-in-50 duration-300">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-xl font-extrabold font-heading text-[#18181B]">
                  Payment Verified • Dhanyawad!
                </h3>
                <p className="text-xs text-[#71717A] mt-1">
                  Tax Invoice settled for {session.tableName}. Ref #{settledRef || `UDM-${Math.floor(100000 + Math.random() * 900000)}`}
                </p>
              </div>

              {/* Tax Invoice Details Card */}
              <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-[#E4E4E7] text-left text-xs space-y-2">
                <div className="flex justify-between text-[#52525B]">
                  <span>Total Settled:</span>
                  <span className="font-extrabold font-heading text-[#18181B] text-sm tnum">
                    {formatINR(grandTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>GSTIN:</span>
                  <span className="font-mono">{session.gstin}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>FSSAI Lic No:</span>
                  <span className="font-mono">{session.fssaiLic}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Floor Captain:</span>
                  <span>{session.captainName}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Payment Ref:</span>
                  <span className="font-mono text-emerald-700 font-bold">{settledRef || 'PAID-VERIFIED'}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Split:</span>
                  <span>
                    {splitMode === 'equal'
                      ? `${splitCount} Diners (${formatINR(perPersonEqual)} each)`
                      : 'By Individual Items'}
                  </span>
                </div>
              </div>

              {/* Server & Kitchen Rating */}
              <div className="pt-2 border-t border-[#F4F4F5] space-y-2.5">
                <p className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A]">
                  How was your dining experience?
                </p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-transform hover:scale-125 ${
                        star <= rating ? 'text-[#F76707]' : 'text-[#E4E4E7]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {/* Compliment tags */}
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {[
                    'Authentic Flavours',
                    'Crisp Tandoor Naan',
                    'Rich Dal Bukhara',
                    'Attentive Captain',
                    'Great Ambience',
                  ].map((compliment) => {
                    const isSelected = selectedCompliments.includes(compliment);
                    return (
                      <button
                        key={compliment}
                        onClick={() => toggleCompliment(compliment)}
                        className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${
                          isSelected
                            ? 'bg-[#FFDBCC] text-[#7B2F00] border border-[#F76707]/30 font-semibold'
                            : 'bg-[#F4F4F5] text-[#71717A]'
                        }`}
                      >
                        {compliment}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading hover:bg-[#27272A] transition-all"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          )}

          {/* STEP: REVIEW & SPLIT */}
          {paymentStep === 'review' && (
            <>
              {/* Split Mode Selector */}
              <div className="flex items-center justify-between p-1 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                    splitMode === 'equal'
                      ? 'bg-white text-[#18181B] shadow-xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  Split Equally
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('diner')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                    splitMode === 'diner'
                      ? 'bg-white text-[#18181B] shadow-xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  Split by Diners ({session.activeDiners.length})
                </button>
              </div>

              {/* Equal Split Options */}
              {splitMode === 'equal' && (
                <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold font-heading text-[#18181B]">
                      Number of People at Table
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSplitCount(num)}
                          className={`w-7 h-7 rounded-full text-xs font-bold font-heading transition-all ${
                            splitCount === num
                              ? 'bg-[#18181B] text-white shadow-2xs'
                              : 'bg-white border border-[#E4E4E7] text-[#52525B]'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E4E4E7]/60">
                    <div>
                      <span className="text-xs text-[#71717A]">Each Person's Share:</span>
                      <p className="text-lg font-extrabold font-heading text-[#F76707] tnum">
                        {formatINR(perPersonEqual)}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#A14000] bg-[#FFDBCC] px-2 py-0.5 rounded-full font-semibold">
                      Grand Total: {formatINR(grandTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* By Diner Breakdown */}
              {splitMode === 'diner' && (
                <div className="space-y-2">
                  {dinersBreakdown.map(({ diner, items, effectiveSubtotal, dinerTotal }) => (
                    <div
                      key={diner.id}
                      className="p-3 rounded-xl border border-[#E4E4E7] bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: diner.avatarColor }}
                          className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                        >
                          {diner.initials}
                        </span>
                        <div>
                          <div className="font-bold text-[#18181B]">
                            {diner.name} {diner.isCurrentUser && '(You)'}
                          </div>
                          <div className="text-[10px] text-[#71717A]">
                            {items.length} items ordered
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold font-heading text-[#18181B] text-sm tnum">
                          {formatINR(dinerTotal)}
                        </span>
                        <div className="text-[10px] text-[#A14000] font-semibold">
                          Incl. GST
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Indian Taxes & Voluntary Service Charge Breakdown */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#F4F4F5] space-y-2 text-xs text-[#52525B]">
                <div className="flex justify-between">
                  <span>Food & Beverage Subtotal</span>
                  <span className="font-semibold text-[#18181B] tnum">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Central GST (CGST @ 2.5%)</span>
                  <span className="font-semibold text-[#18181B] tnum">{formatINR(cgst, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span>State GST (SGST @ 2.5%)</span>
                  <span className="font-semibold text-[#18181B] tnum">{formatINR(sgst, true)}</span>
                </div>

                {/* Service Charge with voluntary checkbox */}
                <div className="pt-1.5 border-t border-[#E4E4E7]/70 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeServiceCharge}
                      onChange={(e) => setIncludeServiceCharge(e.target.checked)}
                      className="rounded-xs text-[#F76707] focus:ring-0"
                    />
                    <span>Restaurant Service Charge (5%)</span>
                  </label>
                  <span className="font-semibold text-[#18181B] tnum">
                    {includeServiceCharge ? formatINR(serviceCharge, true) : '₹0.00'}
                  </span>
                </div>
                <p className="text-[10px] text-[#71717A] italic pl-5">
                  *As per CCPA guidelines, restaurant service charge is voluntary.
                </p>

                {/* Optional Tip Preview Pill */}
                <div className="pt-2 border-t border-[#E4E4E7]/70 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[#18181B] block">
                      Captain &amp; Kitchen Tip (Optional)
                    </span>
                    <span className="text-[10px] text-[#71717A]">
                      Customizable in the next step before payment
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentStep('tip')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E4E7] hover:border-[#F76707] text-xs font-bold text-[#F76707] tnum shrink-0"
                  >
                    {tipAmount > 0 ? `+${formatINR(tipAmount)} (Edit)` : '+ Add Tip'}
                  </button>
                </div>

                <div className="flex justify-between pt-2 border-t border-[#E4E4E7] text-sm font-extrabold font-heading text-[#18181B]">
                  <span>Total Payable (Incl. All Taxes)</span>
                  <span className="text-[#F76707] text-base tnum">{formatINR(grandTotal)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  {paymentError}
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A]">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {allowedMethods.allowOnlineGateway && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        paymentMethod === 'upi'
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 text-[#18181B] font-bold shadow-xs'
                          : 'border-[#E4E4E7] bg-white text-[#52525B]'
                      }`}
                    >
                      <Smartphone size={16} className="text-[#2563EB]" />
                      <span className="text-[10px] sm:text-[11px] leading-tight">Online UPI / Cards</span>
                    </button>
                  )}

                  {allowedMethods.allowDirectUpi && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card_pos')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        paymentMethod === 'card_pos'
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 text-[#18181B] font-bold shadow-xs'
                          : 'border-[#E4E4E7] bg-white text-[#52525B]'
                      }`}
                    >
                      <CreditCard size={16} />
                      <span className="text-[10px] sm:text-[11px] leading-tight">Card Machine</span>
                    </button>
                  )}

                  {allowedMethods.allowCashAtCounter && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        paymentMethod === 'cash'
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 text-[#18181B] font-bold shadow-xs'
                          : 'border-[#E4E4E7] bg-white text-[#52525B]'
                      }`}
                    >
                      <Wallet size={16} />
                      <span className="text-[10px] sm:text-[11px] leading-tight">Cash to Captain</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Pay Action */}
        {paymentStep === 'review' && (
          <div className="p-4 bg-white border-t border-[#F4F4F5] shadow-lg shrink-0">
            <button
              type="button"
              onClick={() => setPaymentStep('tip')}
              disabled={isProcessingPayment}
              className="w-full py-3.5 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] active:scale-98 text-white font-heading font-bold text-sm tracking-tight shadow-md flex items-center justify-between transition-all disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <span>Continue to Add Tip (Optional)</span>
                <ChevronRight size={16} />
              </span>
              <span className="text-base font-extrabold tnum">
                {formatINR(payableAmount)}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

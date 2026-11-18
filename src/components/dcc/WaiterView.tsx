import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  Droplets,
  UtensilsCrossed,
  Sparkles,
  CreditCard,
  MessageSquare,
  Coffee,
  Check,
  Flame,
  Wallet,
  QrCode,
  Receipt,
  Copy,
  X,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  BadgeCheck,
  Users,
  Heart,
  TrendingUp,
  CalendarClock,
  MapPin,
  Clock,
  Play,
  Square,
} from 'lucide-react';
import { WaiterRequest, Order, RestaurantTable, RestaurantTenant } from '../../types/dcc';
import { formatINR } from '../../utils/formatters';
import { useRealtimeSync } from '../../context/RealtimeSyncContext';

interface WaiterViewProps {
  restaurant?: RestaurantTenant;
  paymentConfig?: {
    restaurantUpiId: string;
    restaurantUpiName: string;
  };
  currentStaffId?: string;
  currentStaffName?: string;
  waiterRequests: WaiterRequest[];
  orders: Order[];
  tables: RestaurantTable[];
  onAcknowledgeRequest: (requestId: string) => void;
  onResolveRequest: (requestId: string) => void;
  onMarkOrderServed: (orderId: string) => void;
  onConfirmOfflinePayment?: (
    order: Order,
    method: 'cash' | 'direct_upi',
    options?: {
      reference?: string;
      tip?: number;
      serviceCharge?: number;
      grandTotal?: number;
    }
  ) => Promise<void> | void;
}

export const WaiterView: React.FC<WaiterViewProps> = ({
  restaurant,
  paymentConfig,
  currentStaffId,
  currentStaffName,
  waiterRequests,
  orders,
  tables,
  onAcknowledgeRequest,
  onResolveRequest,
  onMarkOrderServed,
  onConfirmOfflinePayment,
}) => {
  const {
    initiateUpiGatewayPayment,
    getStaffSchedules,
    setWaiterDutyStatus,
    toggleBreakWindowStatus,
  } = useRealtimeSync();

  const [activeConsoleTab, setActiveConsoleTab] = useState<'station' | 'billing' | 'earnings' | 'schedule'>('station');

  const restaurantId = restaurant?.id || 'demo-restaurant';
  const staffSchedules = getStaffSchedules(restaurantId);

  const mySchedule = useMemo(() => {
    if (staffSchedules.length === 0) return null;
    if (currentStaffId) {
      const byId = staffSchedules.find((s) => s.staffId === currentStaffId);
      if (byId) return byId;
    }
    if (currentStaffName) {
      const lower = currentStaffName.trim().toLowerCase();
      const byName = staffSchedules.find((s) => s.staffName.trim().toLowerCase() === lower);
      if (byName) return byName;
    }
    return null;
  }, [staffSchedules, currentStaffId, currentStaffName]);

  const getTableZone = (tableNumber?: string): string | undefined => {
    if (!tableNumber) return undefined;
    const clean = String(tableNumber).replace(/^Table\s*/i, '').trim().toLowerCase();
    const matched = tables.find(
      (t) => t.number.trim().toLowerCase() === clean || `table ${t.number.trim().toLowerCase()}` === clean
    );
    return matched?.zone;
  };

  const isTableInMyZone = (tableNumber?: string): boolean => {
    if (!mySchedule || mySchedule.assignedZones.length === 0) return false;
    const zone = getTableZone(tableNumber);
    if (!zone) return false;
    return mySchedule.assignedZones.includes(zone);
  };

  const pendingRequests = waiterRequests.filter((r) => r.status !== 'resolved');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  const earningsMetrics = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'cancelled');
    const paid = valid.filter(
      (o) => o.paymentStatus === 'paid' || o.paymentStatus === 'verified_by_staff'
    );
    const totalSettledVolume = paid.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0);
    const settledTips = paid.reduce((s, o) => s + (Number(o.tip) || 0), 0);
    const pendingTips = valid
      .filter((o) => o.paymentStatus !== 'paid' && o.paymentStatus !== 'verified_by_staff')
      .reduce((s, o) => s + (Number(o.tip) || 0), 0);
    const totalTipsEarned = settledTips + pendingTips;
    const upiTips = paid
      .filter((o) => o.paymentMethod !== 'cash')
      .reduce((s, o) => s + (Number(o.tip) || 0), 0);
    const cashTips = paid
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((s, o) => s + (Number(o.tip) || 0), 0);
    const tippedOrders = valid.filter((o) => (Number(o.tip) || 0) > 0);
    const avgTip =
      tippedOrders.length > 0 ? Math.round(totalTipsEarned / tippedOrders.length) : 0;

    return {
      paidOrdersCount: paid.length,
      totalSettledVolume,
      settledTips,
      pendingTips,
      totalTipsEarned,
      upiTips,
      cashTips,
      tippedOrdersCount: tippedOrders.length,
      avgTip,
      tippedOrders: tippedOrders.sort((a, b) => (b.paidAt || b.placedAt || 0) - (a.paidAt || a.placedAt || 0)),
      settledOrders: paid.sort((a, b) => (b.paidAt || b.placedAt || 0) - (a.paidAt || a.placedAt || 0)),
    };
  }, [orders]);

  const pendingPaymentOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.status !== 'cancelled' &&
            o.paymentStatus !== 'paid' &&
            o.paymentStatus !== 'verified_by_staff' &&
            (o.paymentStatus === 'pending_payment' ||
              (o.paymentStatus === 'pending' && (o.status === 'served' || o.status === 'ready')))
        )
        .sort((a, b) => {
          if (a.paymentStatus === 'pending_payment' && b.paymentStatus !== 'pending_payment') return -1;
          if (b.paymentStatus === 'pending_payment' && a.paymentStatus !== 'pending_payment') return 1;
          return (b.placedAt || 0) - (a.placedAt || 0);
        }),
    [orders]
  );

  const activeKitchenUnpaidOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== 'cancelled' &&
          o.paymentStatus === 'pending' &&
          (o.status === 'received' || o.status === 'accepted' || o.status === 'preparing')
      ),
    [orders]
  );

  const allUnpaidOrders = useMemo(
    () => [...pendingPaymentOrders, ...activeKitchenUnpaidOrders],
    [pendingPaymentOrders, activeKitchenUnpaidOrders]
  );

  const recentPaidOrders = useMemo(
    () =>
      orders
        .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'verified_by_staff')
        .sort((a, b) => (b.paidAt || b.placedAt || 0) - (a.paidAt || a.placedAt || 0))
        .slice(0, 6),
    [orders]
  );

  // Selected order for dedicated Billing interface (mirrors CustomerPortal BillSplitModal UI)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => allUnpaidOrders[0]?.id || null
  );
  const [billingMethod, setBillingMethod] = useState<'direct_upi' | 'cash'>('direct_upi');
  const [splitCount, setSplitCount] = useState<number>(1);
  const [includeServiceCharge, setIncludeServiceCharge] = useState<boolean>(true);
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [referenceInput, setReferenceInput] = useState<string>('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [gatewayOrderId, setGatewayOrderId] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [isCopiedVpa, setIsCopiedVpa] = useState<boolean>(false);
  const [isSubmittingOffline, setIsSubmittingOffline] = useState<boolean>(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementSuccessToast, setSettlementSuccessToast] = useState<string | null>(null);

  const activeBillingOrder = useMemo(() => {
    if (allUnpaidOrders.length === 0) return null;
    return allUnpaidOrders.find((o) => o.id === selectedOrderId) || allUnpaidOrders[0];
  }, [allUnpaidOrders, selectedOrderId]);

  useEffect(() => {
    if (allUnpaidOrders.length > 0 && !allUnpaidOrders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(allUnpaidOrders[0].id);
    }
  }, [allUnpaidOrders, selectedOrderId]);

  const effectiveUpiVpa =
    paymentConfig?.restaurantUpiId ||
    `${(restaurant?.slug || restaurant?.id || 'urdearmenu').replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`;
  const effectivePayeeName =
    paymentConfig?.restaurantUpiName || restaurant?.name || 'Ur.Dear.Menu Restaurant';

  const openBillingForOrder = (ord: Order, initialMethod: 'direct_upi' | 'cash') => {
    setSelectedOrderId(ord.id);
    setBillingMethod(initialMethod);
    setSplitCount(1);
    setIncludeServiceCharge(
      (ord.serviceCharge ?? 0) > 0 || (restaurant?.serviceChargePercent ?? 5) > 0
    );
    setSelectedTip(ord.tip || 0);
    setReferenceInput('');
    setSettlementError(null);
    setActiveConsoleTab('billing');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Compute live bill breakdown mirroring CustomerPortal BillSplitModal
  const billSubtotal = activeBillingOrder ? Number(activeBillingOrder.subtotal || 0) : 0;
  const billCgst = activeBillingOrder
    ? activeBillingOrder.cgst !== undefined
      ? Number(activeBillingOrder.cgst)
      : billSubtotal * 0.025
    : 0;
  const billSgst = activeBillingOrder
    ? activeBillingOrder.sgst !== undefined
      ? Number(activeBillingOrder.sgst)
      : billSubtotal * 0.025
    : 0;
  const serviceChargeRate = (restaurant?.serviceChargePercent ?? 5) / 100;
  const baseServiceCharge = activeBillingOrder
    ? activeBillingOrder.serviceCharge !== undefined && activeBillingOrder.serviceCharge > 0
      ? Number(activeBillingOrder.serviceCharge)
      : billSubtotal * serviceChargeRate
    : 0;
  const billServiceCharge = includeServiceCharge ? baseServiceCharge : 0;
  const billGrandTotal = activeBillingOrder
    ? Math.max(1, Math.round(billSubtotal + billCgst + billSgst + billServiceCharge + selectedTip))
    : 0;
  const perPersonShare = Math.max(1, Math.round(billGrandTotal / Math.max(1, splitCount)));
  const qrPayableAmount = splitCount > 1 ? perPersonShare : billGrandTotal;

  // Generate dynamic gateway UPI QR whenever billing order, amount, or method changes
  useEffect(() => {
    if (
      activeConsoleTab !== 'billing' ||
      !activeBillingOrder ||
      billingMethod !== 'direct_upi'
    ) {
      return;
    }

    let isMounted = true;
    setIsGeneratingQr(true);

    initiateUpiGatewayPayment({
      restaurantId: activeBillingOrder.restaurantId || restaurant?.id || 'demo-restaurant',
      orderId: activeBillingOrder.id,
      orderNumber: activeBillingOrder.orderNumber,
      tableNumber: activeBillingOrder.tableNumber,
      amount: qrPayableAmount,
      customerName: activeBillingOrder.dinerName,
      payeeNameOverride: effectivePayeeName,
      vpaOverride: effectiveUpiVpa,
    })
      .then((gw) => {
        if (!isMounted) return;
        setUpiQrDataUrl(gw.qrDataUrl);
        setGatewayOrderId(gw.gatewayOrderId);
      })
      .catch(() => {
        if (!isMounted) return;
        setUpiQrDataUrl('');
      })
      .finally(() => {
        if (isMounted) setIsGeneratingQr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeConsoleTab,
    activeBillingOrder,
    billingMethod,
    qrPayableAmount,
    effectiveUpiVpa,
    effectivePayeeName,
    restaurant?.id,
    initiateUpiGatewayPayment,
  ]);

  const handleCopyVpa = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveUpiVpa).catch(() => {});
    }
    setIsCopiedVpa(true);
    setTimeout(() => setIsCopiedVpa(false), 2000);
  };

  const handleConfirmSettlement = async () => {
    if (!activeBillingOrder || !onConfirmOfflinePayment) return;
    setIsSubmittingOffline(true);
    setSettlementError(null);
    try {
      await onConfirmOfflinePayment(activeBillingOrder, billingMethod, {
        reference: referenceInput.trim() || (billingMethod === 'direct_upi' ? gatewayOrderId : ''),
        tip: selectedTip,
        serviceCharge: billServiceCharge,
        grandTotal: billGrandTotal,
      });
      const settledSummary = `Table ${activeBillingOrder.tableNumber} (${activeBillingOrder.orderNumber}) settled as Paid via ${
        billingMethod === 'direct_upi' ? 'UPI' : 'Cash'
      } • ${formatINR(billGrandTotal)}`;
      setReferenceInput('');
      setSettlementSuccessToast(settledSummary);
      setTimeout(() => setSettlementSuccessToast(null), 5000);
    } catch (err: any) {
      setSettlementError(err?.message || 'Could not settle payment. Please retry.');
    } finally {
      setIsSubmittingOffline(false);
    }
  };

  const getRequestIcon = (type: WaiterRequest['requestType']) => {
    switch (type) {
      case 'water':
        return <Droplets className="text-[#2563EB]" size={18} />;
      case 'chutney_onions':
        return <Flame className="text-[#16A34A]" size={18} />;
      case 'cutlery':
        return <UtensilsCrossed className="text-[#A14000]" size={18} />;
      case 'finger_bowl':
        return <Coffee className="text-[#F76707]" size={18} />;
      case 'bill_upi':
        return <CreditCard className="text-[#16A34A]" size={18} />;
      case 'captain':
        return <MessageSquare className="text-[#DC2626]" size={18} />;
      default:
        return <Bell className="text-[#F76707]" size={18} />;
    }
  };

  const getRequestTitle = (type: WaiterRequest['requestType']) => {
    switch (type) {
      case 'water':
        return 'Water Carafe Refill';
      case 'chutney_onions':
        return 'Sirka Pyaz & Mint Chutney Refill';
      case 'cutlery':
        return 'Extra Spoons & Bowls';
      case 'finger_bowl':
        return 'Warm Lemon Finger Bowl';
      case 'bill_upi':
        return 'Bring Bill & UPI / Card Settlement';
      case 'captain':
        return 'Table Needs Captain Assistance';
      default:
        return 'Assistance Requested';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Waiter Status & Navigation Banner */}
      <div className="bg-[#18181B] text-white p-3.5 sm:p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold font-heading flex flex-wrap items-center gap-2">
            <span>Floor Captain & Waiter Station</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A] text-white shrink-0">
              ACTIVE
            </span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            {pendingPaymentOrders.length} Pending Bills • {pendingRequests.length} Table Calls •{' '}
            {readyOrders.length} Dishes Ready
          </p>
        </div>

        {/* Dedicated Console View Switcher: Floor Station vs Billing vs Earnings */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveConsoleTab('station')}
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeConsoleTab === 'station'
                  ? 'bg-white text-[#18181B] shadow-xs'
                  : 'text-[#D4D4D8] hover:text-white'
              }`}
            >
              <Bell size={13} />
              <span>Floor Station</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveConsoleTab('billing')}
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeConsoleTab === 'billing'
                  ? 'bg-[#F76707] text-white shadow-xs'
                  : 'text-[#D4D4D8] hover:text-white'
              }`}
            >
              <Receipt size={13} />
              <span>Billing</span>
              {allUnpaidOrders.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tnum ${
                    activeConsoleTab === 'billing'
                      ? 'bg-white text-[#18181B]'
                      : 'bg-[#F76707] text-white'
                  }`}
                >
                  {allUnpaidOrders.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveConsoleTab('earnings')}
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeConsoleTab === 'earnings'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#D4D4D8] hover:text-white'
              }`}
            >
              <Heart size={13} />
              <span>Earnings</span>
              {earningsMetrics.totalTipsEarned > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-white/20 text-white tnum">
                  {formatINR(earningsMetrics.totalTipsEarned)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveConsoleTab('schedule')}
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeConsoleTab === 'schedule'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#D4D4D8] hover:text-white'
              }`}
            >
              <CalendarClock size={13} />
              <span>Zones &amp; Breaks</span>
              {staffSchedules.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-white/20 text-white tnum">
                  {staffSchedules.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-[11px] font-mono text-[#E4E4E7]">
            <QrCode size={14} className="text-[#F76707]" />
            <span>UPI: {effectiveUpiVpa}</span>
          </div>
        </div>
      </div>

      {/* Waiter Earnings & Tips Live Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div
          onClick={() => setActiveConsoleTab('earnings')}
          className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between text-[11px] text-[#71717A] font-semibold">
            <span>Tips Earned</span>
            <Heart size={13} className="text-[#F76707]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-heading text-[#16A34A] tnum mt-0.5">
            {formatINR(earningsMetrics.totalTipsEarned)}
          </div>
          <span className="text-[10px] text-[#71717A]">
            {earningsMetrics.tippedOrdersCount} tipped {earningsMetrics.tippedOrdersCount === 1 ? 'table' : 'tables'}
          </span>
        </div>

        <div
          onClick={() => setActiveConsoleTab('earnings')}
          className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between text-[11px] text-[#71717A] font-semibold">
            <span>Settled Earnings</span>
            <TrendingUp size={13} className="text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-heading text-[#18181B] tnum mt-0.5">
            {formatINR(earningsMetrics.totalSettledVolume)}
          </div>
          <span className="text-[10px] text-[#71717A]">
            {earningsMetrics.paidOrdersCount} paid {earningsMetrics.paidOrdersCount === 1 ? 'bill' : 'bills'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#71717A] font-semibold">
            <span>Avg Tip / Table</span>
            <Sparkles size={13} className="text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-heading text-[#F76707] tnum mt-0.5">
            {earningsMetrics.tippedOrdersCount > 0 ? formatINR(earningsMetrics.avgTip) : '—'}
          </div>
          <span className="text-[10px] text-[#71717A]">
            {earningsMetrics.pendingTips > 0
              ? `${formatINR(earningsMetrics.pendingTips)} pending settlement`
              : 'Direct guest gratuity'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#71717A] font-semibold">
            <span>Pending Bills</span>
            <Wallet size={13} className="text-[#2563EB]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-heading text-[#18181B] tnum mt-0.5">
            {allUnpaidOrders.length}
          </div>
          <span className="text-[10px] text-[#71717A]">
            {pendingRequests.length} active table calls
          </span>
        </div>
      </div>

      {/* Live Assigned Floor Zones & Break Strip */}
      {staffSchedules.length > 0 && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E4E4E7] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {mySchedule ? (
            <>
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#F76707]" />
                    <span>My Floor Station ({mySchedule.staffName})</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                    Shift {mySchedule.shiftStart}–{mySchedule.shiftEnd}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      mySchedule.dutyStatus === 'on_duty'
                        ? 'bg-emerald-100 text-emerald-800'
                        : mySchedule.dutyStatus === 'on_break'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#F4F4F5] text-[#52525B]'
                    }`}
                  >
                    {mySchedule.dutyStatus === 'on_duty'
                      ? 'On Duty'
                      : mySchedule.dutyStatus === 'on_break'
                      ? 'On Break'
                      : 'Off Duty'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {mySchedule.assignedZones.map((z) => (
                    <span
                      key={z}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#18181B] text-white"
                    >
                      {z}
                    </span>
                  ))}
                  {mySchedule.notes && (
                    <span className="text-[11px] text-[#52525B] truncate">
                      • {mySchedule.notes}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {mySchedule.breaks.map((brk) => (
                  <button
                    key={brk.id}
                    type="button"
                    onClick={() => toggleBreakWindowStatus(restaurantId, mySchedule.staffId, brk.id)}
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                      brk.status === 'active'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : brk.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                        : 'bg-[#FAFAFA] text-[#18181B] border-[#E4E4E7] hover:border-[#F76707]'
                    }`}
                  >
                    <Coffee size={12} />
                    <span>{brk.label}</span>
                    <span className="font-mono text-[10px] opacity-80">
                      {brk.startTime}–{brk.endTime}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setWaiterDutyStatus(
                      restaurantId,
                      mySchedule.staffId,
                      mySchedule.dutyStatus === 'on_break' ? 'on_duty' : 'on_break'
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    mySchedule.dutyStatus === 'on_break'
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {mySchedule.dutyStatus === 'on_break' ? 'Resume Duty' : 'Take Break'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock size={16} className="text-[#2563EB] shrink-0" />
                <div className="text-xs text-[#18181B] truncate">
                  <strong>{staffSchedules.length} waiter shift{staffSchedules.length === 1 ? '' : 's'}</strong>{' '}
                  scheduled across floor zones:{' '}
                  <span className="text-[#52525B]">
                    {staffSchedules.map((s) => `${s.staffName} (${s.assignedZones.join(', ') || 'Floor'})`).join(' • ')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveConsoleTab('schedule')}
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 shrink-0"
              >
                View Zones &amp; Breaks
              </button>
            </div>
          )}
        </div>
      )}

      {/* Settlement Success Banner */}
      {settlementSuccessToast && (
        <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#16A34A]/40 text-[#15803D] text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-[#16A34A]" />
            <span>{settlementSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSettlementSuccessToast(null)}
            className="text-[#15803D]/70 hover:text-[#15803D]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ================= TAB 1: FLOOR STATION ================= */}
      {activeConsoleTab === 'station' && (
        <div className="space-y-5">
          {/* SECTION: PENDING TABLE & COUNTER PAYMENTS */}
          {pendingPaymentOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 font-heading">
                  <Wallet size={14} className="text-amber-600" />
                  Pending Table Payments ({pendingPaymentOrders.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Cash Settlement / Direct UPI QR
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingPaymentOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs min-w-0"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span className="text-base font-extrabold font-heading text-[#18181B]">
                            Table {ord.tableNumber}
                          </span>
                          <span className="text-xs text-[#71717A] ml-2 font-mono">
                            {ord.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold font-mono text-amber-800 bg-white px-2 py-0.5 rounded-full border border-amber-300">
                          {ord.paymentStatus === 'pending_payment'
                            ? 'Guest Requested Pay'
                            : 'Unsettled'}
                        </span>
                      </div>

                      <div className="mt-2 text-xs flex justify-between font-semibold text-[#18181B]">
                        <span className="truncate pr-2">Diner: {ord.dinerName}</span>
                        <span className="text-base font-black text-[#F76707] font-heading tnum shrink-0">
                          {formatINR(ord.grandTotal)}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#71717A] mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>Subtotal: {formatINR(ord.subtotal)} • {ord.items.length} items</span>
                        {(ord.tip || 0) > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold tnum">
                            Includes +{formatINR(ord.tip)} tip
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-amber-200/70 space-y-1">
                        {ord.items.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-[11px] text-[#3F3F46]"
                          >
                            <span className="truncate pr-2">
                              <strong className="text-[#18181B]">{item.quantity}×</strong>{' '}
                              {item.name}
                            </span>
                            <span className="font-semibold tnum shrink-0">
                              {formatINR(item.itemTotal)}
                            </span>
                          </div>
                        ))}
                        {ord.items.length > 3 && (
                          <div className="text-[10px] text-[#71717A] font-medium">
                            +{ord.items.length - 3} more items
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openBillingForOrder(ord, 'cash')}
                        className="flex-1 min-w-[125px] py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold font-heading flex items-center justify-center gap-1 shadow-xs transition-all"
                      >
                        <Wallet size={14} />
                        <span>Accept Cash ({formatINR(ord.grandTotal)})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openBillingForOrder(ord, 'direct_upi')}
                        className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 shadow-xs transition-all"
                      >
                        <QrCode size={14} className="text-[#F76707]" />
                        <span>Generate UPI QR</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: ACTIVE KITCHEN TABLES (EARLY BILLING & UPI QR GENERATION) */}
          {activeKitchenUnpaidOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#52525B] flex items-center gap-1.5 font-heading">
                  <Receipt size={14} className="text-[#F76707]" />
                  Open Table Bills ({activeKitchenUnpaidOrders.length})
                </h3>
                <span className="text-[10px] font-semibold text-[#71717A]">
                  Open in Billing tab anytime to split, generate UPI QR or collect cash
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeKitchenUnpaidOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white border border-[#E4E4E7] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold font-heading text-[#18181B]">
                          Table {ord.tableNumber}
                        </span>
                        <span className="text-[10px] font-mono text-[#71717A]">
                          {ord.orderNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#52525B] truncate">
                        {ord.dinerName} • {ord.items.length} items •{' '}
                        <span className="font-bold text-[#F76707] tnum">
                          {formatINR(ord.grandTotal)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBillingForOrder(ord, 'direct_upi')}
                      className="px-3 py-1.5 rounded-xl bg-[#F4F4F5] hover:bg-[#18181B] hover:text-white text-[#18181B] text-[11px] font-bold font-heading flex items-center gap-1.5 shrink-0 transition-all"
                    >
                      <QrCode size={13} />
                      <span>Open Billing</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 1: READY ORDERS FROM KITCHEN TO BE SERVED */}
          {readyOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#16A34A] flex items-center gap-1.5 font-heading">
                  <Sparkles size={14} />
                  Hot Dishes Ready for Table Pickup ({readyOrders.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {readyOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-[#F0FDF4] border-2 border-[#16A34A] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs min-w-0"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-extrabold font-heading text-[#18181B]">
                          Table {ord.tableNumber}
                        </span>
                        <span className="text-xs font-bold font-mono text-[#16A34A] bg-white px-2 py-0.5 rounded-full border border-[#16A34A]/30">
                          Plated by Chef
                        </span>
                      </div>

                      <div className="mt-2 space-y-1">
                        {ord.items.map((i) => (
                          <div
                            key={i.id}
                            className="text-xs text-[#18181B] font-semibold flex justify-between gap-2"
                          >
                            <span className="truncate">
                              {i.quantity}x {i.name}
                            </span>
                            {i.customization.isJain && (
                              <span className="text-[10px] text-[#854D0E] bg-[#FEFCE8] px-1 rounded-sm shrink-0">
                                Jain
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => onMarkOrderServed(ord.id)}
                      className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Check size={14} />
                      <span>Mark Served to Table {ord.tableNumber}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: GUEST ASSISTANCE CALLS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5 font-heading">
              <Bell size={14} className="text-[#F76707]" />
              Table Paging & Service Calls ({pendingRequests.length})
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-[#E4E4E7] space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center mx-auto">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-[#18181B]">No pending table calls</p>
                <p className="text-[11px] text-[#71717A]">
                  When guests tap assistance buttons on their phone, alerts appear here instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] flex items-center justify-center shrink-0">
                        {getRequestIcon(req.requestType)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-extrabold font-heading text-[#18181B]">
                            Table {req.tableNumber}
                          </span>
                          {getTableZone(req.tableNumber) && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                isTableInMyZone(req.tableNumber)
                                  ? 'bg-[#FFF4ED] text-[#F76707] border border-[#F76707]/30'
                                  : 'bg-[#F4F4F5] text-[#52525B]'
                              }`}
                            >
                              {isTableInMyZone(req.tableNumber)
                                ? `Your Zone • ${getTableZone(req.tableNumber)}`
                                : getTableZone(req.tableNumber)}
                            </span>
                          )}
                          <span className="text-[10px] text-[#71717A]">
                            {Math.max(1, Math.floor((Date.now() - req.timestamp) / 60000))}m ago
                          </span>
                        </div>
                        <div className="text-xs font-medium text-[#52525B] truncate">
                          {getRequestTitle(req.requestType)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' ? (
                        <button
                          onClick={() => onAcknowledgeRequest(req.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-xs"
                        >
                          Attend
                        </button>
                      ) : (
                        <button
                          onClick={() => onResolveRequest(req.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold font-heading shadow-xs"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: DEDICATED WAITER BILLING CONSOLE (MIRRORS CUSTOMER PAYMENT UI) ================= */}
      {activeConsoleTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Active Table Bills Picker & Settled History */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold font-heading uppercase tracking-wider text-[#18181B]">
                  Select Table Bill ({allUnpaidOrders.length})
                </h3>
                <span className="text-[10px] font-bold text-[#F76707]">Live Sync</span>
              </div>

              {allUnpaidOrders.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2">
                  <CheckCircle2 size={24} className="text-[#16A34A] mx-auto" />
                  <div className="text-xs font-bold text-[#18181B]">
                    All table bills are settled!
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    Active dine-in orders will appear here ready for UPI QR generation or cash collection.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                  {allUnpaidOrders.map((ord) => {
                    const isSelected = activeBillingOrder?.id === ord.id;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setSelectedTip(ord.tip || 0);
                          setReferenceInput('');
                          setSettlementError(null);
                        }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all space-y-1 ${
                          isSelected
                            ? 'border-[#F76707] bg-[#FFF4ED] shadow-xs'
                            : 'border-[#E4E4E7] bg-white hover:border-[#D4D4D8]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-extrabold font-heading text-[#18181B]">
                              Table {ord.tableNumber}
                            </span>
                            <span className="text-[10px] font-mono text-[#71717A] truncate">
                              {ord.orderNumber}
                            </span>
                          </div>
                          <span className="text-sm font-black font-heading text-[#F76707] tnum shrink-0">
                            {formatINR(ord.grandTotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#52525B]">
                          <span className="truncate pr-2">
                            {ord.dinerName} • {ord.items.length} items
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              ord.paymentStatus === 'pending_payment'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#F4F4F5] text-[#52525B]'
                            }`}
                          >
                            {ord.paymentStatus === 'pending_payment' ? 'Requested Pay' : ord.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recently Settled Orders */}
            {recentPaidOrders.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-extrabold font-heading uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <BadgeCheck size={14} className="text-emerald-600" />
                    <span>Recently Settled ({recentPaidOrders.length})</span>
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {recentPaidOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-2.5 rounded-xl bg-[#F0FDF4]/60 border border-emerald-200 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#18181B] truncate">
                          Table {ord.tableNumber} • {ord.orderNumber}
                        </div>
                        <div className="text-[10px] text-[#52525B] truncate">
                          {ord.dinerName} •{' '}
                          {ord.paymentMethod === 'cash' ? 'Cash' : 'UPI'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-emerald-700 tnum">
                          {formatINR(ord.grandTotal)}
                        </div>
                        <span className="text-[9px] font-bold uppercase text-emerald-700">
                          Paid ✓
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Customer-Mirrored Tax Invoice, Bill Split & Payment QR Panel */}
          <div className="lg:col-span-8">
            {!activeBillingOrder ? (
              <div className="bg-white rounded-2xl border border-[#E4E4E7] p-10 text-center space-y-3 shadow-xs">
                <Receipt size={32} className="text-[#A1A1AA] mx-auto" />
                <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                  No Unpaid Table Bill Selected
                </h3>
                <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                  When a table places an order or requests checkout, you can inspect the itemized GST invoice, split evenly, generate a dynamic UPI Payment QR, or accept cash right here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
                {/* Invoice Header (matches BillSplitModal header) */}
                <div className="px-4 sm:px-5 py-4 border-b border-[#F4F4F5] flex flex-wrap items-center justify-between gap-2 bg-white">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold font-heading text-[#18181B] flex items-center gap-2">
                      <Receipt size={18} className="text-[#F76707]" />
                      <span>Tax Invoice & Table Checkout</span>
                    </h3>
                    <p className="text-xs text-[#71717A]">
                      Table {activeBillingOrder.tableNumber} • {activeBillingOrder.orderNumber} •{' '}
                      Diner: <strong>{activeBillingOrder.dinerName}</strong>
                      {restaurant?.gstin ? ` • GSTIN: ${restaurant.gstin}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {activeBillingOrder.paymentStatus === 'pending_payment'
                      ? 'Guest Requested Bill'
                      : 'Ready to Settle'}
                  </span>
                </div>

                <div className="p-4 sm:p-5 space-y-4 text-[#18181B]">
                  {/* Payment Method Selector (mirrors CustomerPortal) */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7]">
                    <button
                      type="button"
                      onClick={() => setBillingMethod('direct_upi')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all ${
                        billingMethod === 'direct_upi'
                          ? 'bg-[#18181B] text-white shadow-xs'
                          : 'text-[#52525B] hover:text-[#18181B]'
                      }`}
                    >
                      <QrCode size={14} className={billingMethod === 'direct_upi' ? 'text-[#F76707]' : ''} />
                      <span>Generate UPI QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMethod('cash')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all ${
                        billingMethod === 'cash'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-[#52525B] hover:text-[#18181B]'
                      }`}
                    >
                      <Wallet size={14} />
                      <span>Accept Cash</span>
                    </button>
                  </div>

                  {/* Equal Split Control (mirrors CustomerPortal BillSplitModal) */}
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold font-heading text-[#18181B] flex items-center gap-1.5">
                        <Users size={13} className="text-[#F76707]" />
                        <span>Split Bill Equally</span>
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
                    {splitCount > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#E4E4E7]/60 text-xs">
                        <span className="text-[#71717A]">Per Guest Share (1 of {splitCount}):</span>
                        <span className="font-extrabold font-heading text-[#F76707] text-base tnum">
                          {formatINR(perPersonShare)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Two-column split on desktop: Left = Invoice Breakdown, Right = Dynamic Payment QR / Cash Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {/* Itemized Invoice & Taxes */}
                    <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                        <span>Order Items ({activeBillingOrder.items.length})</span>
                        <span>Amount</span>
                      </div>

                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {activeBillingOrder.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[#18181B]">
                                {item.quantity}× {item.name}
                                {item.customization?.isJain && (
                                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                    Jain
                                  </span>
                                )}
                              </div>
                              {(item.customization?.portion ||
                                (item.customization?.addons &&
                                  item.customization.addons.length > 0)) && (
                                <div className="text-[10px] text-[#71717A]">
                                  {[
                                    item.customization?.portion?.name,
                                    ...(item.customization?.addons || []).map((a) => a.name),
                                  ]
                                    .filter(Boolean)
                                    .join(', ')}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-[#18181B] tnum shrink-0">
                              {formatINR(item.itemTotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-[#E4E4E7] space-y-1.5 text-xs text-[#52525B]">
                        <div className="flex justify-between">
                          <span>Food & Beverage Subtotal</span>
                          <span className="font-semibold text-[#18181B] tnum">
                            {formatINR(billSubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Central GST (CGST @ 2.5%)</span>
                          <span className="font-semibold text-[#18181B] tnum">
                            {formatINR(billCgst, true)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>State GST (SGST @ 2.5%)</span>
                          <span className="font-semibold text-[#18181B] tnum">
                            {formatINR(billSgst, true)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={includeServiceCharge}
                              onChange={(e) => setIncludeServiceCharge(e.target.checked)}
                              className="rounded-xs text-[#F76707] focus:ring-0"
                            />
                            <span>
                              Service Charge ({restaurant?.serviceChargePercent ?? 5}%)
                            </span>
                          </label>
                          <span className="font-semibold text-[#18181B] tnum">
                            {includeServiceCharge ? formatINR(billServiceCharge, true) : '₹0.00'}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-[#E4E4E7]/70 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#18181B]">
                              Captain & Kitchen Gratuity
                            </span>
                            <span className="font-semibold text-[#18181B] tnum">
                              {formatINR(selectedTip)}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[0, 30, 50, 100].map((tip) => (
                              <button
                                key={tip}
                                type="button"
                                onClick={() => setSelectedTip(tip)}
                                className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  selectedTip === tip
                                    ? 'bg-[#18181B] text-white'
                                    : 'bg-white border border-[#E4E4E7] text-[#52525B]'
                                }`}
                              >
                                {tip === 0 ? 'No Tip' : `₹${tip}`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between pt-2 border-t border-[#E4E4E7] text-sm font-extrabold font-heading text-[#18181B]">
                          <span>Total Payable</span>
                          <span className="text-[#F76707] text-base tnum">
                            {formatINR(billGrandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Payment Settlement Panel */}
                    <div className="space-y-3">
                      {billingMethod === 'direct_upi' ? (
                        <div className="rounded-2xl border-2 border-[#18181B]/15 bg-[#FAFAFA] p-4 text-center space-y-3">
                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold font-heading text-[#18181B] uppercase tracking-wider">
                            <Smartphone size={14} className="text-[#2563EB]" />
                            <span>Scan with any UPI App</span>
                          </div>

                          {isGeneratingQr ? (
                            <div className="w-48 h-48 mx-auto flex flex-col items-center justify-center bg-white rounded-2xl border border-[#E4E4E7] gap-2">
                              <RefreshCw size={24} className="text-[#F76707] animate-spin" />
                              <span className="text-[11px] text-[#71717A] font-semibold">
                                Generating Dynamic QR...
                              </span>
                            </div>
                          ) : upiQrDataUrl ? (
                            <div className="bg-white p-2.5 rounded-2xl border border-[#E4E4E7] inline-block shadow-xs">
                              <img
                                src={upiQrDataUrl}
                                alt={`UPI QR Code for Table ${activeBillingOrder.tableNumber}`}
                                className="w-48 h-48 mx-auto object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-48 h-48 mx-auto flex items-center justify-center bg-white rounded-2xl border border-[#E4E4E7]">
                              <QrCode size={36} className="text-[#A1A1AA] animate-pulse" />
                            </div>
                          )}

                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <div className="px-2.5 py-1 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#52525B] break-all">
                              {effectiveUpiVpa}
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyVpa}
                              className="p-1.5 bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] rounded-lg text-xs text-[#18181B] flex items-center gap-1"
                              title="Copy UPI VPA"
                            >
                              {isCopiedVpa ? (
                                <Check size={14} className="text-[#16A34A]" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>

                          {gatewayOrderId && (
                            <div className="text-[10px] font-mono text-[#71717A]">
                              Ref: {gatewayOrderId}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#E4E4E7] text-[#18181B]">
                              GPay / PhonePe / Paytm
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#E4E4E7] text-[#18181B] tnum">
                              QR Amount: {formatINR(qrPayableAmount)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-extrabold font-heading text-amber-900">
                            <Wallet size={16} className="text-amber-700" />
                            <span>Counter / Table Cash Collection</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Verify physical cash received from{' '}
                            <strong>{activeBillingOrder.dinerName}</strong> at Table{' '}
                            <strong>{activeBillingOrder.tableNumber}</strong>. Confirming marks the
                            order as <strong>Paid</strong> immediately on the Kitchen Display.
                          </p>
                          <div className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs">
                            <span className="text-[#52525B] font-semibold">Cash to Collect:</span>
                            <span className="text-lg font-black text-amber-700 font-heading tnum">
                              {formatINR(billGrandTotal)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#52525B] block">
                          {billingMethod === 'direct_upi'
                            ? 'UPI Transaction ID / UTR (Optional)'
                            : 'Cash Counter Receipt / Note (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={referenceInput}
                          onChange={(e) => setReferenceInput(e.target.value)}
                          placeholder={
                            billingMethod === 'direct_upi'
                              ? 'e.g. UTR 431298761234'
                              : 'e.g. Counter Cash Drawer #1'
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-mono focus:outline-none focus:border-[#F76707]"
                        />
                      </div>

                      {settlementError && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                          <AlertTriangle size={15} className="shrink-0" />
                          <span>{settlementError}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isSubmittingOffline}
                        onClick={handleConfirmSettlement}
                        className={`w-full py-3.5 px-4 rounded-xl text-white text-xs font-bold font-heading shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
                          billingMethod === 'direct_upi'
                            ? 'bg-[#16A34A] hover:bg-[#15803D]'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        <Check size={15} />
                        <span>
                          {isSubmittingOffline
                            ? 'Marking Paid...'
                            : billingMethod === 'direct_upi'
                            ? `Confirm UPI Paid (${formatINR(billGrandTotal)})`
                            : `Accept Cash & Mark Paid (${formatINR(billGrandTotal)})`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: WAITER EARNINGS & TIPS DASHBOARD ================= */}
      {activeConsoleTab === 'earnings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                Total Tips Collected
              </span>
              <div className="text-2xl font-extrabold font-heading text-[#16A34A] tnum">
                {formatINR(earningsMetrics.totalTipsEarned)}
              </div>
              <p className="text-[11px] text-[#71717A]">
                {formatINR(earningsMetrics.settledTips)} settled • {formatINR(earningsMetrics.pendingTips)} pending payment
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                UPI vs Cash Tips
              </span>
              <div className="text-lg font-extrabold font-heading text-[#18181B] tnum">
                UPI {formatINR(earningsMetrics.upiTips)} • Cash {formatINR(earningsMetrics.cashTips)}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Settled gratuity across floor payment channels
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                Average Tip &amp; Bill Volume
              </span>
              <div className="text-lg font-extrabold font-heading text-[#F76707] tnum">
                {earningsMetrics.tippedOrdersCount > 0
                  ? `${formatINR(earningsMetrics.avgTip)} avg tip`
                  : '—'}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Across {formatINR(earningsMetrics.totalSettledVolume)} settled bills
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                  <Heart size={15} className="text-[#F76707]" />
                  <span>Waiter Tip &amp; Settlement Ledger ({earningsMetrics.settledOrders.length})</span>
                </h3>
                <p className="text-xs text-[#71717A]">
                  Real-time tips added by guests via CustomerPortal optional Add Tip checkout
                </p>
              </div>
            </div>

            {earningsMetrics.tippedOrders.length === 0 && earningsMetrics.settledOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#FAFAFA] border border-dashed border-[#E4E4E7] text-center space-y-2">
                <Heart size={24} className="text-[#A1A1AA] mx-auto" />
                <div className="text-xs font-bold text-[#18181B]">
                  No Tips or Settled Bills Recorded Yet
                </div>
                <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                  When guests select a tip in the checkout flow or you settle a table bill with gratuity, tips appear here immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(earningsMetrics.tippedOrders.length > 0
                  ? earningsMetrics.tippedOrders
                  : earningsMetrics.settledOrders
                ).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold font-heading text-[#18181B]">
                          Table {ord.tableNumber}
                        </span>
                        <span className="text-[11px] font-mono text-[#71717A]">{ord.orderNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.paymentStatus === 'paid' || ord.paymentStatus === 'verified_by_staff'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.paymentStatus === 'paid' || ord.paymentStatus === 'verified_by_staff'
                            ? `Paid (${ord.paymentMethod === 'cash' ? 'Cash' : 'UPI'})`
                            : 'Pending Settlement'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#52525B] mt-0.5">
                        Diner: {ord.dinerName} • Bill Total: <strong className="tnum">{formatINR(ord.grandTotal)}</strong>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-[#71717A]">Tip Metric</div>
                      <div
                        className={`text-sm font-extrabold font-heading tnum ${
                          (ord.tip || 0) > 0 ? 'text-[#16A34A]' : 'text-[#A1A1AA]'
                        }`}
                      >
                        {(ord.tip || 0) > 0 ? `+${formatINR(ord.tip)}` : '₹0'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: ASSIGNED FLOOR ZONES & BREAK SCHEDULES ================= */}
      {activeConsoleTab === 'schedule' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold font-heading text-[#18181B] flex items-center gap-2">
                <CalendarClock size={18} className="text-[#2563EB]" />
                <span>Floor Zone Assignments &amp; Break Schedules</span>
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Live roster published from OwnerPortal — tap a break window to start or finish your break
              </p>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB]">
              {staffSchedules.length} Scheduled {staffSchedules.length === 1 ? 'Waiter' : 'Waiters'}
            </span>
          </div>

          {staffSchedules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-10 text-center space-y-2 shadow-xs">
              <CalendarClock size={30} className="text-[#A1A1AA] mx-auto" />
              <div className="text-sm font-extrabold font-heading text-[#18181B]">
                No Floor Zone Schedules Published Yet
              </div>
              <p className="text-xs text-[#71717A] max-w-md mx-auto">
                Ask the Restaurant Owner / Manager to assign floor zones and break windows in the OwnerPortal Staff Scheduling tab. They will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {staffSchedules.map((sched) => {
                const isMine = mySchedule?.staffId === sched.staffId;
                const coveredTables = tables.filter((t) =>
                  sched.assignedZones.includes((t.zone || '').trim())
                );
                return (
                  <div
                    key={sched.staffId}
                    className={`rounded-2xl p-4 sm:p-5 border-2 shadow-xs space-y-3 transition-all ${
                      isMine
                        ? 'bg-[#FFF4ED]/60 border-[#F76707]'
                        : 'bg-white border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-extrabold font-heading text-[#18181B]">
                            {sched.staffName}
                          </span>
                          {isMine && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F76707] text-white">
                              YOU
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                            {sched.role}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-[#71717A] mt-0.5 flex items-center gap-1">
                          <Clock size={12} />
                          <span>
                            Shift: {sched.shiftStart} – {sched.shiftEnd}
                          </span>
                        </div>
                      </div>

                      <select
                        value={sched.dutyStatus}
                        onChange={(e) =>
                          setWaiterDutyStatus(
                            restaurantId,
                            sched.staffId,
                            e.target.value as 'on_duty' | 'on_break' | 'off_duty'
                          )
                        }
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border ${
                          sched.dutyStatus === 'on_duty'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : sched.dutyStatus === 'on_break'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                        }`}
                      >
                        <option value="on_duty">On Duty</option>
                        <option value="on_break">On Break</option>
                        <option value="off_duty">Off Duty</option>
                      </select>
                    </div>

                    {/* Assigned Zones & Covered Tables */}
                    <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] flex items-center gap-1">
                        <MapPin size={11} className="text-[#F76707]" />
                        <span>Assigned Floor Zones</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sched.assignedZones.length > 0 ? (
                          sched.assignedZones.map((zone) => (
                            <span
                              key={zone}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#18181B] text-white"
                            >
                              {zone}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#71717A]">All Floor Tables</span>
                        )}
                      </div>
                      {coveredTables.length > 0 && (
                        <div className="text-[11px] text-[#52525B] pt-1">
                          Covering tables:{' '}
                          <span className="font-bold text-[#18181B]">
                            {coveredTables.map((t) => `T${t.number}`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Break Windows */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] flex items-center gap-1">
                        <Coffee size={11} className="text-[#F76707]" />
                        <span>Break Schedule ({sched.breaks.length})</span>
                      </div>
                      {sched.breaks.length === 0 ? (
                        <div className="text-xs text-[#71717A] italic">No breaks scheduled for this shift.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {sched.breaks.map((brk) => (
                            <button
                              key={brk.id}
                              type="button"
                              onClick={() =>
                                toggleBreakWindowStatus(restaurantId, sched.staffId, brk.id)
                              }
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                                brk.status === 'active'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                  : brk.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                                  : 'bg-white text-[#18181B] border-[#E4E4E7] hover:border-[#F76707]'
                              }`}
                            >
                              {brk.status === 'active' ? (
                                <Square size={10} className="fill-amber-700 text-amber-700" />
                              ) : brk.status === 'completed' ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Play size={10} className="text-[#F76707]" />
                              )}
                              <span>{brk.label}</span>
                              <span className="font-mono text-[11px] opacity-80">
                                {brk.startTime}–{brk.endTime}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {sched.notes && (
                      <div className="text-xs text-[#52525B] bg-[#FAFAFA] px-3 py-2 rounded-xl border border-[#E4E4E7]">
                        <strong>Captain Note:</strong> {sched.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

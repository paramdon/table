import React, { useState } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Flame,
  Check,
  Filter,
  ArrowRight,
  Sparkles,
  Bell,
  Send,
  Radio,
  RefreshCw,
  BadgeCheck,
  CreditCard,
  PackageX,
  AlertTriangle,
  Search,
  Power,
  Utensils,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  LiveTableCartActivity,
  MenuItem,
  LowInventoryAlert,
  InventoryStockStatus,
} from '../../types/dcc';
import { formatINR } from '../../utils/formatters';

interface KitchenDisplayViewProps {
  orders: Order[];
  liveCarts?: LiveTableCartActivity[];
  menuItems?: MenuItem[];
  lowInventoryAlerts?: LowInventoryAlert[];
  syncStatus?: string;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onSendOrderReadyAlert?: (order: Order, customMessage?: string) => Promise<{ success: boolean; deliveredToCustomerCount?: number }>;
  onUpdateItemInventory?: (
    itemId: string,
    isAvailable: boolean,
    stockStatus?: InventoryStockStatus
  ) => Promise<void> | void;
}

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  liveCarts = [],
  menuItems = [],
  lowInventoryAlerts = [],
  syncStatus = 'connected',
  onUpdateOrderStatus,
  onSendOrderReadyAlert,
  onUpdateItemInventory,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'inventory'>('tickets');
  const [filter, setFilter] = useState<'all' | 'active' | 'ready' | 'paid'>('active');
  const [stockFilter, setStockFilter] = useState<'all' | 'sold_out' | 'low_stock' | 'in_stock'>('all');
  const [stockSearch, setStockSearch] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertingOrderId, setAlertingOrderId] = useState<string | null>(null);
  const [alertFeedbackMap, setAlertFeedbackMap] = useState<
    Record<string, { timestamp: number; deliveredCount: number; statusText: string }>
  >({});

  const isOrderPaid = (ord: Order) =>
    ord.paymentStatus === 'paid' || ord.paymentStatus === 'verified_by_staff';

  const soldOutItems = menuItems.filter(
    (m) => !m.isAvailable || m.stockStatus === 'sold_out'
  );
  const lowStockItems = menuItems.filter(
    (m) => m.isAvailable && m.stockStatus === 'low_stock'
  );
  const activeAlertCount = Math.max(
    soldOutItems.length + lowStockItems.length,
    lowInventoryAlerts.length
  );

  const handleInventoryChange = async (
    itemId: string,
    isAvailable: boolean,
    stockStatus: InventoryStockStatus
  ) => {
    if (!onUpdateItemInventory) return;
    setUpdatingItemId(itemId);
    try {
      await onUpdateItemInventory(itemId, isAvailable, stockStatus);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const isSoldOut = !item.isAvailable || item.stockStatus === 'sold_out';
    const isLowStock = item.isAvailable && item.stockStatus === 'low_stock';

    if (stockFilter === 'sold_out' && !isSoldOut) return false;
    if (stockFilter === 'low_stock' && !isLowStock) return false;
    if (stockFilter === 'in_stock' && (isSoldOut || isLowStock)) return false;

    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleManualAlertCustomer = async (ord: Order) => {
    if (!onSendOrderReadyAlert) return;
    setAlertingOrderId(ord.id);
    try {
      const res = await onSendOrderReadyAlert(ord);
      setAlertFeedbackMap((prev) => ({
        ...prev,
        [ord.id]: {
          timestamp: Date.now(),
          deliveredCount: res.deliveredToCustomerCount || 0,
          statusText:
            res.deliveredToCustomerCount && res.deliveredToCustomerCount > 0
              ? `Delivered directly to Table ${ord.tableNumber} screen`
              : `Dispatched (will show when table reconnects)`,
        },
      }));
    } catch (err) {
      console.warn('Failed to send alert:', err);
    } finally {
      setAlertingOrderId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((ord) => {
    if (filter === 'active') {
      return ord.status === 'received' || ord.status === 'accepted' || ord.status === 'preparing';
    }
    if (filter === 'ready') {
      return ord.status === 'ready';
    }
    if (filter === 'paid') {
      return isOrderPaid(ord);
    }
    return true;
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'received':
        return 'bg-[#FEF2F2] border-[#DC2626] text-[#DC2626]';
      case 'accepted':
      case 'preparing':
        return 'bg-[#FFFBEB] border-[#F59E0B] text-[#D97706]';
      case 'ready':
        return 'bg-[#F0FDF4] border-[#16A34A] text-[#16A34A]';
      case 'served':
        return 'bg-[#F4F4F5] border-[#E4E4E7] text-[#71717A]';
      default:
        return 'bg-[#FAFAFA] border-[#E4E4E7] text-[#71717A]';
    }
  };

  const getElapsedMinutes = (timestamp: number) => {
    const elapsedMs = Date.now() - timestamp;
    return Math.max(1, Math.floor(elapsedMs / 60000));
  };

  return (
    <div className="space-y-4">
      {/* KDS Control Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F76707] flex items-center justify-center text-white shadow-xs shrink-0">
              <ChefHat size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold font-heading text-[#18181B] flex flex-wrap items-center gap-2">
                <span>Kitchen Display System (KDS)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 flex items-center gap-1 shrink-0">
                  <Radio size={10} className="animate-pulse" />
                  <span>LIVE {syncStatus === 'connected' ? 'WS' : 'SYNC'}</span>
                </span>
              </h2>
              <p className="text-xs text-[#71717A] truncate">
                Tandoor & Curry Station • Real-time Order, Payment & 86 Stock Pipeline
              </p>
            </div>
          </div>

          {/* Primary Mode Tabs: Tickets vs Menu Stock / 86 Board */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex bg-[#F4F4F5] p-1 rounded-xl text-xs font-bold gap-1 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setActiveTab('tickets')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  activeTab === 'tickets'
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                <Flame size={13} />
                <span>Orders ({orders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  activeTab === 'inventory'
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                <PackageX size={13} />
                <span>Stock / 86 Board</span>
                {activeAlertCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#DC2626] text-white tnum">
                    {activeAlertCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-all shrink-0 ${
                soundEnabled
                  ? 'bg-[#F4F4F5] text-[#18181B] border-[#E4E4E7]'
                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30'
              }`}
              title={soundEnabled ? 'Kitchen Bell Enabled' : 'Muted'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>

        {/* Sub-filters */}
        {activeTab === 'tickets' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F4F4F5]">
            <div className="flex flex-wrap bg-[#F4F4F5] p-1 rounded-xl text-[11px] sm:text-xs font-bold gap-0.5">
              <button
                onClick={() => setFilter('active')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filter === 'active' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                Cooking ({orders.filter((o) => ['received', 'accepted', 'preparing'].includes(o.status)).length})
              </button>
              <button
                onClick={() => setFilter('ready')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filter === 'ready' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                Ready ({orders.filter((o) => o.status === 'ready').length})
              </button>
              <button
                onClick={() => setFilter('paid')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filter === 'paid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                Paid ({orders.filter((o) => isOrderPaid(o)).length})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filter === 'all' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                All ({orders.length})
              </button>
            </div>

            {activeAlertCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all"
              >
                <AlertTriangle size={12} />
                <span>
                  {soldOutItems.length} Sold Out • {lowStockItems.length} Low Stock
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#F4F4F5]">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-2.5 text-[#71717A]" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search dish to mark Sold Out or Low Stock..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div className="flex flex-wrap bg-[#F4F4F5] p-1 rounded-xl text-[11px] font-bold gap-0.5">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap ${
                  stockFilter === 'all' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                All ({menuItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('sold_out')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap ${
                  stockFilter === 'sold_out'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-[#71717A]'
                }`}
              >
                Sold Out ({soldOutItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('low_stock')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap ${
                  stockFilter === 'low_stock'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-[#71717A]'
                }`}
              >
                Low Stock ({lowStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('in_stock')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap ${
                  stockFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-[#71717A]'
                }`}
              >
                In Stock ({Math.max(0, menuItems.length - soldOutItems.length - lowStockItems.length)})
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'inventory' ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-[#18181B]">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle size={16} className="text-[#F76707] shrink-0" />
              <span>
                Marking any dish <strong>Unavailable (Sold Out)</strong> immediately flags it as{' '}
                <strong>Sold Out</strong> on all Customer QR menus via RealtimeSyncContext.
              </span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[#A14000] tnum">
              {soldOutItems.length} 86&apos;d • {lowStockItems.length} Low
            </span>
          </div>

          {filteredMenuItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-[#E4E4E7] text-center space-y-2 text-[#18181B]">
              <Utensils size={26} className="text-[#A1A1AA] mx-auto" />
              <div className="text-sm font-bold font-heading">No menu items match this filter</div>
              <p className="text-xs text-[#71717A]">
                {menuItems.length === 0
                  ? 'Add menu items in the Owner Portal to manage kitchen availability here.'
                  : 'Clear search or switch stock filter above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => {
                const isSoldOut = !item.isAvailable || item.stockStatus === 'sold_out';
                const isLowStock = item.isAvailable && item.stockStatus === 'low_stock';
                const isBusy = updatingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 border-2 shadow-xs flex flex-col justify-between gap-3 text-[#18181B] transition-all min-w-0 ${
                      isSoldOut
                        ? 'border-rose-300 bg-rose-50/30'
                        : isLowStock
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-bold font-heading text-[#18181B] truncate">
                            {item.name}
                          </h4>
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                              SOLD OUT
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                              LOW STOCK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              AVAILABLE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#71717A] line-clamp-1 mt-0.5">
                          {item.description || 'Menu dish'}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-[#18181B] tnum shrink-0">
                        {formatINR(item.price)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F4F4F5]">
                      {isSoldOut ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleInventoryChange(item.id, true, 'in_stock')}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          <span>{isBusy ? 'Updating...' : 'Restore Available'}</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleInventoryChange(item.id, false, 'sold_out')}
                            className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <Power size={13} />
                            <span>{isBusy ? 'Updating...' : 'Mark Sold Out'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleInventoryChange(
                                item.id,
                                true,
                                isLowStock ? 'in_stock' : 'low_stock'
                              )
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold font-heading border transition-all disabled:opacity-50 ${
                              isLowStock
                                ? 'bg-[#18181B] text-white border-[#18181B]'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {isLowStock ? 'Clear Low' : 'Low Stock'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Live Customer Carts Synced from CustomerPortal */}
      {liveCarts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F76707] animate-ping" />
              <h3 className="text-xs font-extrabold font-heading text-[#18181B] uppercase tracking-wider">
                Live Customer Carts Building Now ({liveCarts.length})
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#A14000] border border-amber-200">
              Preview Only — Awaiting Customer Fire
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveCarts.map((cart) => (
              <div
                key={`${cart.restaurantId}-${cart.tableNumber}`}
                className="bg-white rounded-xl p-3.5 border border-amber-200 shadow-xs space-y-2 text-[#18181B]"
              >
                <div className="flex items-center justify-between border-b border-[#F4F4F5] pb-2">
                  <div>
                    <span className="text-xs font-extrabold font-heading text-[#18181B]">
                      Table {cart.tableNumber}
                    </span>
                    <span className="text-[11px] text-[#71717A] ml-1.5">
                      • {cart.dinerName || 'Guest'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-[#F76707] tnum">
                    {formatINR(cart.cartTotal)}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-[#52525B]">
                      <span className="font-semibold truncate pr-2">
                        <strong className="text-[#18181B]">{item.quantity}x</strong> {item.name}
                      </span>
                      <span className="text-[11px] text-[#71717A] shrink-0 tnum">
                        {formatINR(item.itemTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Grid / Stack */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E4E4E7] space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-base font-bold font-heading text-[#18181B]">
            All table tickets are clear!
          </h3>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto">
            New orders fired from any customer QR stand will appear here in real time with audio alert.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredOrders.map((ord) => {
            const elapsed = getElapsedMinutes(ord.placedAt);
            const paid = isOrderPaid(ord);
            const isDelayed = elapsed > 15 && ord.status !== 'served' && !paid;
            const methodLabel =
              ord.paymentMethod === 'cash'
                ? 'CASH'
                : ord.paymentMethod === 'card_pos'
                ? 'CARD'
                : 'UPI';
            return (
              <div
                key={ord.id}
                className={`bg-white rounded-2xl border-2 shadow-xs flex flex-col justify-between overflow-hidden transition-all min-w-0 ${
                  paid
                    ? 'border-[#16A34A]/60 ring-1 ring-[#16A34A]/15'
                    : isDelayed
                    ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                    : 'border-[#E4E4E7]'
                }`}
              >
                {/* Order Top Bar */}
                <div className="p-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold font-heading text-[#18181B]">
                        Table {ord.tableNumber}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#71717A]">
                        {ord.orderNumber}
                      </span>
                      {paid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#16A34A] text-white shadow-2xs">
                          <BadgeCheck size={11} />
                          <span>Paid • {methodLabel}</span>
                        </span>
                      ) : ord.paymentStatus === 'pending_payment' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <CreditCard size={10} />
                          <span>Bill Requested</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]">
                          <span>Unpaid</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#71717A] mt-0.5 flex items-center gap-2">
                      <span className="truncate">{ord.dinerName}</span>
                      <span>•</span>
                      <span className="font-bold text-[#18181B] tnum">{formatINR(ord.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Elapsed Timer with visual priority */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-heading shrink-0 ${
                      isDelayed
                        ? 'bg-[#FEF2F2] text-[#DC2626] animate-pulse border border-[#DC2626]/30'
                        : elapsed > 8
                        ? 'bg-[#FFFBEB] text-[#D97706]'
                        : 'bg-[#F0FDF4] text-[#16A34A]'
                    }`}
                  >
                    <Clock size={12} />
                    <span>{elapsed}m elapsed</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 space-y-3 flex-1 text-xs">
                  {ord.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#F4F4F5] space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                          <span className="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center text-[11px] font-heading shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="leading-snug">{item.name}</span>
                        </div>
                        <span className="font-bold text-[#71717A] shrink-0 tnum">
                          {formatINR(item.itemTotal)}
                        </span>
                      </div>

                      {/* Customizations & Jain tag */}
                      {(item.customization.portion ||
                        item.customization.isJain ||
                        item.customization.selectedSpice ||
                        item.customization.addons.length > 0 ||
                        item.customization.specialNotes) && (
                        <div className="pl-6 space-y-0.5 text-[11px]">
                          {item.customization.isJain && (
                            <span className="inline-block px-1.5 py-0.2 rounded-sm bg-[#FEFCE8] text-[#854D0E] font-bold border border-[#CA8A04]/30">
                              JAIN (NO ONION/GARLIC)
                            </span>
                          )}
                          {item.customization.portion && (
                            <div className="text-[#52525B]">
                              Size: <strong>{item.customization.portion.name}</strong>
                            </div>
                          )}
                          {item.customization.selectedSpice && (
                            <div className="text-[#A14000]">
                              Prep: {item.customization.selectedSpice}
                            </div>
                          )}
                          {item.customization.addons.length > 0 && (
                            <div className="text-[#71717A]">
                              Extra: {item.customization.addons.map((a) => a.name).join(', ')}
                            </div>
                          )}
                          {item.customization.specialNotes && (
                            <div className="italic text-[#DC2626] font-medium">
                              Note: "{item.customization.specialNotes}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status Advancement Actions */}
                <div className="p-3 bg-[#FAFAFA] border-t border-[#E4E4E7] flex items-center gap-2">
                  {ord.status === 'received' && (
                    <button
                      onClick={() => onUpdateOrderStatus(ord.id, 'preparing')}
                      className="w-full py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Flame size={14} />
                      <span>Accept & Fire in Tandoor</span>
                    </button>
                  )}

                  {ord.status === 'preparing' && (
                    <button
                      onClick={() => onUpdateOrderStatus(ord.id, 'ready')}
                      className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Bell size={14} className="animate-bounce" />
                      <span>Mark Ready & Alert Table {ord.tableNumber}</span>
                    </button>
                  )}

                  {ord.status === 'ready' && (
                    <div className="w-full space-y-2">
                      {alertFeedbackMap[ord.id] && (
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span>{alertFeedbackMap[ord.id].statusText}</span>
                          </span>
                          <span className="text-[10px] text-emerald-600 font-mono">
                            {new Date(alertFeedbackMap[ord.id].timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleManualAlertCustomer(ord)}
                          disabled={alertingOrderId === ord.id}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                          title="Send 'Order Ready' WebSocket alert directly to customer session"
                        >
                          {alertingOrderId === ord.id ? (
                            <>
                              <RefreshCw size={13} className="animate-spin text-emerald-600" />
                              <span>Alerting...</span>
                            </>
                          ) : (
                            <>
                              <Bell size={13} className="text-emerald-600" />
                              <span>Alert Table {ord.tableNumber}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onUpdateOrderStatus(ord.id, 'served')}
                          className="py-2 px-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          <Check size={14} />
                          <span>Served</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {ord.status === 'served' && (
                    <div className="w-full py-2 text-center text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] rounded-xl border border-[#16A34A]/20">
                      ✓ Served to Guest
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};

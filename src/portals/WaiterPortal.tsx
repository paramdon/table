import React, { useState, useEffect } from 'react';
import { restaurantDb, DbEvent } from '../services/db';
import { portalAuth, StaffAuthSession } from '../services/auth';
import { WaiterView } from '../components/dcc/WaiterView';
import { StaffLoginGate } from '../components/auth/StaffLoginGate';
import { Order, WaiterRequest, RestaurantTable } from '../types/dcc';
import { realtimeWs } from '../services/websocket';
import { useRealtimeSync } from '../context/RealtimeSyncContext';
import { Bell, Lock, ShieldCheck } from 'lucide-react';

export const WaiterPortal: React.FC = () => {
  const [session, setSession] = useState<StaffAuthSession | null>(() =>
    portalAuth.getSession()
  );
  const [wasRevoked, setWasRevoked] = useState(false);

  const [restaurant, setRestaurant] = useState(() =>
    restaurantDb.getRestaurant(session?.restaurantId)
  );
  const activeRestaurantId = session?.restaurantId || restaurant.id;

  const { subscribeEvents, emitOrderEvent, syncRestaurantOrders, getOrdersForRestaurant } =
    useRealtimeSync();

  const [orders, setOrders] = useState<Order[]>(() => {
    const dbOrders = restaurantDb.getOrders(activeRestaurantId);
    return dbOrders.length > 0 ? dbOrders : getOrdersForRestaurant(activeRestaurantId);
  });
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>(() =>
    restaurantDb.getWaiterRequests(activeRestaurantId)
  );
  const [tables, setTables] = useState<RestaurantTable[]>(() =>
    restaurantDb.getTables(activeRestaurantId)
  );
  const [paymentConfig, setPaymentConfig] = useState<{
    restaurantUpiId: string;
    restaurantUpiName: string;
  }>({
    restaurantUpiId: `${(restaurant.slug || activeRestaurantId).replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`,
    restaurantUpiName: restaurant.name || 'Ur.Dear.Menu Restaurant',
  });
  const [livePagingAlert, setLivePagingAlert] = useState<{ tableNumber: string; reason: string } | null>(null);

  useEffect(() => {
    const targetRestId = session?.restaurantId;
    if (!targetRestId) return;
    let isMounted = true;

    fetch(`/api/workspace/${encodeURIComponent(targetRestId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted || !data.success || !data.restaurant) return;
        restaurantDb.hydrateFromServer({
          restaurantId: data.restaurant.id,
          restaurant: data.restaurant,
          tables: data.tables || [],
          categories: data.categories || [],
          menuItems: data.menuItems || [],
          orders: data.orders || [],
          waiterRequests: data.waiterRequests || [],
        });
        syncRestaurantOrders(data.restaurant.id, data.orders || []);
        setRestaurant(data.restaurant);
        setOrders(restaurantDb.getOrders(data.restaurant.id));
        setTables(restaurantDb.getTables(data.restaurant.id));
        setWaiterRequests(restaurantDb.getWaiterRequests(data.restaurant.id));
        setPaymentConfig((prev) => ({
          restaurantUpiId:
            prev.restaurantUpiId ||
            `${(data.restaurant.slug || data.restaurant.id).replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`,
          restaurantUpiName: data.restaurant.name || prev.restaurantUpiName,
        }));
      })
      .catch(() => {});

    fetch(`/api/billing/payment-methods/${encodeURIComponent(targetRestId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted || !data.success || !data.paymentMethods) return;
        const pm = data.paymentMethods;
        setPaymentConfig({
          restaurantUpiId:
            pm.restaurantUpiId ||
            pm.directUpiVpa ||
            `${targetRestId.replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`,
          restaurantUpiName: pm.restaurantUpiName || restaurant.name || 'Ur.Dear.Menu Restaurant',
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [session?.restaurantId, syncRestaurantOrders, restaurant.name]);

  // WebSocket Registration & Real-time synchronization
  useEffect(() => {
    realtimeWs.register({
      role: 'waiter',
      restaurantId: activeRestaurantId,
      staffName: session?.staffName,
    });

    const unsubWs = realtimeWs.onWaiterCallAlert((alert) => {
      setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
      setLivePagingAlert({ tableNumber: alert.tableNumber, reason: alert.reason });
      setTimeout(() => setLivePagingAlert(null), 10000);
    });

    const unsubAuth = portalAuth.subscribe((newSess, isRevoked) => {
      setSession(newSess);
      if (isRevoked) {
        setWasRevoked(true);
      }
    });

    const unsubscribeDb = restaurantDb.subscribe((event: DbEvent) => {
      if (
        event.type === 'WAITER_REQUEST_CREATED' ||
        event.type === 'WAITER_REQUEST_UPDATED' ||
        event.type === 'TABLES_UPDATED'
      ) {
        setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
        setTables(restaurantDb.getTables(activeRestaurantId));
      } else if (
        event.type === 'ORDER_CREATED' ||
        event.type === 'ORDER_STATUS_UPDATED'
      ) {
        setOrders(restaurantDb.getOrders(activeRestaurantId));
        setTables(restaurantDb.getTables(activeRestaurantId));
      } else if (event.type === 'RESTAURANT_UPDATED') {
        setRestaurant(restaurantDb.getRestaurant(activeRestaurantId));
      }
    });

    const unsubscribeSync = subscribeEvents((evt) => {
      if (evt.type === 'ORDER_SYNC' && evt.restaurantId === activeRestaurantId) {
        const synced = getOrdersForRestaurant(activeRestaurantId);
        const dbOrders = restaurantDb.getOrders(activeRestaurantId);
        setOrders(synced.length > 0 ? synced : dbOrders);
        setTables(restaurantDb.getTables(activeRestaurantId));
      }
    });

    return () => {
      unsubWs();
      unsubAuth();
      unsubscribeDb();
      unsubscribeSync();
    };
  }, [activeRestaurantId, session?.staffName, subscribeEvents]);

  const handleAcknowledgeRequest = (requestId: string) => {
    restaurantDb.acknowledgeWaiterRequest(requestId);
    setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
  };

  const handleResolveRequest = (requestId: string) => {
    restaurantDb.resolveWaiterRequest(requestId);
    setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
  };

  const handleMarkOrderServed = (orderId: string) => {
    const updatedOrders = restaurantDb.updateOrderStatus(orderId, 'served');
    const scopedOrders = restaurantDb.getOrders(activeRestaurantId);
    setOrders(scopedOrders);
    emitOrderEvent({
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId: activeRestaurantId,
      orderId,
      status: 'served',
      orders: updatedOrders,
      tables: restaurantDb.getTables(activeRestaurantId),
    });
  };

  const handleConfirmOfflinePayment = async (
    order: Order,
    method: 'cash' | 'direct_upi',
    options?: {
      reference?: string;
      tip?: number;
      serviceCharge?: number;
      grandTotal?: number;
    }
  ) => {
    const finalGrandTotal = options?.grandTotal ?? order.grandTotal;
    const res = await fetch('/api/payments/confirm-offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: activeRestaurantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        amount: finalGrandTotal,
        eligibleSubtotal: order.subtotal,
        paymentMethod: method,
        upiReference: options?.reference || '',
        tip: options?.tip,
        serviceCharge: options?.serviceCharge,
        grandTotal: finalGrandTotal,
        staffId: session?.staffId,
        staffName: session?.staffName,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to settle table payment on server.');
    }

    const updatedOrders = restaurantDb.updateOrderPayment(order.id, 'paid', method, {
      tip: options?.tip,
      grandTotal: finalGrandTotal,
      restaurantId: activeRestaurantId,
    });
    restaurantDb.resolveWaiterRequestsForTable(order.tableNumber, activeRestaurantId, 'bill_upi');

    const scopedOrders = restaurantDb.getOrders(activeRestaurantId);
    const updatedOrderObj = scopedOrders.find((o) => o.id === order.id) || data.order;
    setOrders(scopedOrders);
    setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
    setTables(restaurantDb.getTables(activeRestaurantId));

    emitOrderEvent({
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId: activeRestaurantId,
      orderId: order.id,
      status: updatedOrderObj?.status || order.status,
      order: updatedOrderObj,
      orders: updatedOrders,
      tables: restaurantDb.getTables(activeRestaurantId),
    });
  };

  const handleLogout = async () => {
    await portalAuth.logout();
    setSession(null);
  };

  // Enforce staff authentication gate
  if (!session) {
    return (
      <StaffLoginGate
        role="waiter"
        restaurantName={restaurant.name}
        onAuthenticated={(sess) => {
          setSession(sess);
          setWasRevoked(false);
        }}
        revocationNotice={wasRevoked}
      />
    );
  }

  // Strict Role Guard: Kitchen staff cannot access waiter terminal
  if (session.role !== 'waiter' && session.role !== 'owner') {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#27272A] border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold font-heading text-white">Access Denied (Role Isolation)</h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            You are logged in as <strong>{session.staffName}</strong> with the <strong>{session.role.toUpperCase()}</strong> role. This terminal is strictly reserved for Floor Waiters.
          </p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => window.location.href = '/kitchen'}
              className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold font-heading"
            >
              Go to Kitchen Portal
            </button>
            <button
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl bg-white/10 text-white text-xs font-bold"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] flex flex-col font-sans overflow-x-hidden">
      {/* DEDICATED WAITER TOPBAR */}
      <header className="sticky top-0 z-40 bg-[#18181B] text-white border-b border-white/10 px-3 sm:px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-xs shrink-0">
              <Bell size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-extrabold font-heading text-white tracking-tight truncate">
                  Floor Captain & Waiter Console
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  Floor Active
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] truncate">
                {restaurant.name} • {session.staffName} ({session.roleTitle})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>Dedicated Waiter Service</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              title="Lock Terminal"
            >
              <Lock size={13} />
              <span>Lock</span>
              <span className="hidden sm:inline">Terminal</span>
            </button>
          </div>
        </div>
      </header>

      {/* FULL-SCREEN WAITER CONSOLE */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
        {livePagingAlert && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F76707] to-[#DC2626] text-white shadow-xl flex items-center justify-between gap-4 animate-bounce">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Bell size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-black font-heading tracking-tight">
                  TABLE {livePagingAlert.tableNumber} REQUESTING ASSISTANCE!
                </div>
                <div className="text-xs text-white/90">
                  {livePagingAlert.reason} • Attend table immediately
                </div>
              </div>
            </div>
            <button
              onClick={() => setLivePagingAlert(null)}
              className="py-1.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <WaiterView
          restaurant={restaurant}
          paymentConfig={paymentConfig}
          currentStaffId={session?.staffId}
          currentStaffName={session?.staffName}
          waiterRequests={waiterRequests}
          orders={orders}
          tables={tables}
          onAcknowledgeRequest={handleAcknowledgeRequest}
          onResolveRequest={handleResolveRequest}
          onMarkOrderServed={handleMarkOrderServed}
          onConfirmOfflinePayment={handleConfirmOfflinePayment}
        />
      </main>
    </div>
  );
};

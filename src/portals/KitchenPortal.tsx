import React, { useState, useEffect } from 'react';
import { restaurantDb, DbEvent } from '../services/db';
import { portalAuth, StaffAuthSession } from '../services/auth';
import { KitchenDisplayView } from '../components/dcc/KitchenDisplayView';
import { StaffLoginGate } from '../components/auth/StaffLoginGate';
import { Order, OrderStatus, MenuItem, InventoryStockStatus } from '../types/dcc';
import { ChefHat, Lock, ShieldCheck } from 'lucide-react';
import { realtimeWs } from '../services/websocket';
import { useRealtimeSync } from '../context/RealtimeSyncContext';

export const KitchenPortal: React.FC = () => {
  const [session, setSession] = useState<StaffAuthSession | null>(() =>
    portalAuth.getSession()
  );
  const [wasRevoked, setWasRevoked] = useState(false);

  const [restaurant, setRestaurant] = useState(() =>
    restaurantDb.getRestaurant(session?.restaurantId)
  );
  const {
    connectionStatus,
    getCartsForRestaurant,
    getOrdersForRestaurant,
    getMenuForRestaurant,
    getLowInventoryAlerts,
    syncRestaurantOrders,
    syncRestaurantMenu,
    markMenuItemAvailability,
    emitOrderEvent,
    subscribeEvents,
  } = useRealtimeSync();

  const activeRestaurantId = session?.restaurantId || restaurant.id;
  const [orders, setOrders] = useState<Order[]>(() => {
    const dbOrders = restaurantDb.getOrders(activeRestaurantId);
    return dbOrders.length > 0 ? dbOrders : getOrdersForRestaurant(activeRestaurantId);
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const dbMenu = restaurantDb.getMenuItems(activeRestaurantId);
    return dbMenu.length > 0 ? dbMenu : getMenuForRestaurant(activeRestaurantId).menuItems;
  });
  const liveCarts = getCartsForRestaurant(activeRestaurantId);
  const lowInventoryAlerts = getLowInventoryAlerts(activeRestaurantId);

  // Hydrate kitchen workspace for the logged-in staff's restaurant
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
        syncRestaurantMenu(
          data.restaurant.id,
          restaurantDb.getCategories(data.restaurant.id),
          restaurantDb.getMenuItems(data.restaurant.id)
        );
        setRestaurant(data.restaurant);
        setOrders(restaurantDb.getOrders(data.restaurant.id));
        setMenuItems(restaurantDb.getMenuItems(data.restaurant.id));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [session?.restaurantId, syncRestaurantOrders, syncRestaurantMenu]);

  // Register Kitchen in Real-Time WebSocket Pipeline
  useEffect(() => {
    if (session && (session.role === 'kitchen' || session.role === 'owner')) {
      realtimeWs.register({
        role: 'kitchen',
        restaurantId: activeRestaurantId,
        staffName: session.staffName,
      });
    }
  }, [activeRestaurantId, session]);

  // Listen to remote revocation, DB changes, and RealtimeSyncContext events
  useEffect(() => {
    const unsubAuth = portalAuth.subscribe((newSess, isRevoked) => {
      setSession(newSess);
      if (isRevoked) {
        setWasRevoked(true);
      }
    });

    const unsubscribeDb = restaurantDb.subscribe((event: DbEvent) => {
      if (
        event.type === 'ORDER_CREATED' ||
        event.type === 'ORDER_STATUS_UPDATED' ||
        event.type === 'TABLES_UPDATED'
      ) {
        setOrders(restaurantDb.getOrders(activeRestaurantId));
      } else if (event.type === 'MENU_UPDATED') {
        setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
      } else if (event.type === 'RESTAURANT_UPDATED') {
        setRestaurant(restaurantDb.getRestaurant(activeRestaurantId));
      }
    });

    const unsubscribeSync = subscribeEvents((evt) => {
      if (evt.type === 'ORDER_SYNC' && evt.restaurantId === activeRestaurantId) {
        const synced = getOrdersForRestaurant(activeRestaurantId);
        const dbOrders = restaurantDb.getOrders(activeRestaurantId);
        setOrders(synced.length > 0 ? synced : dbOrders);
      } else if (
        (evt.type === 'MENU_UPDATED' || evt.type === 'INVENTORY_UPDATED') &&
        evt.restaurantId === activeRestaurantId
      ) {
        const dbMenu = restaurantDb.getMenuItems(activeRestaurantId);
        const ctxMenu = getMenuForRestaurant(activeRestaurantId).menuItems;
        setMenuItems(dbMenu.length > 0 ? dbMenu : ctxMenu);
      }
    });

    return () => {
      unsubAuth();
      unsubscribeDb();
      unsubscribeSync();
    };
  }, [activeRestaurantId, subscribeEvents, getOrdersForRestaurant, getMenuForRestaurant]);

  const handleUpdateItemInventory = async (
    itemId: string,
    isAvailable: boolean,
    stockStatus?: InventoryStockStatus
  ) => {
    await markMenuItemAvailability({
      restaurantId: activeRestaurantId,
      itemId,
      isAvailable,
      stockStatus,
      updatedBy: session?.staffName || 'Kitchen Station',
    });
    const refreshed = restaurantDb.getMenuItems(activeRestaurantId);
    setMenuItems(
      refreshed.length > 0 ? refreshed : getMenuForRestaurant(activeRestaurantId).menuItems
    );
  };

  const handleSendOrderReadyAlert = async (order: Order, customMessage?: string) => {
    return await realtimeWs.sendOrderReadyAlert({
      restaurantId: activeRestaurantId,
      tableNumber: order.tableNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      message:
        customMessage ||
        `Chef ${session?.staffName || 'Kitchen Team'} has finished preparing Order #${order.orderNumber}. Your hot dishes are ready to serve!`,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    });
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const updatedOrders = restaurantDb.updateOrderStatus(orderId, status);
    const scopedOrders = restaurantDb.getOrders(activeRestaurantId);
    setOrders(scopedOrders);

    emitOrderEvent({
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId: activeRestaurantId,
      orderId,
      status,
      orders: updatedOrders,
      tables: restaurantDb.getTables(activeRestaurantId),
    });

    // Automatically trigger 'Order Ready' WebSocket alert directly to customer at table
    if (status === 'ready') {
      const order = scopedOrders.find((o) => o.id === orderId) || orders.find((o) => o.id === orderId);
      if (order) {
        await handleSendOrderReadyAlert(order);
      }
    }
  };

  const handleLogout = async () => {
    await portalAuth.logout();
    setSession(null);
  };

  // If not logged in or session is revoked, enforce login gate
  if (!session) {
    return (
      <StaffLoginGate
        role="kitchen"
        restaurantName={restaurant.name}
        onAuthenticated={(sess) => {
          setSession(sess);
          setWasRevoked(false);
        }}
        revocationNotice={wasRevoked}
      />
    );
  }

  // Strict Role Guard: Waiter cannot access kitchen terminal
  if (session.role !== 'kitchen' && session.role !== 'owner') {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#27272A] border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold font-heading text-white">Access Denied (Role Isolation)</h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            You are logged in as <strong>{session.staffName}</strong> with the <strong>{session.role.toUpperCase()}</strong> role. This terminal is strictly reserved for Kitchen Staff.
          </p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => window.location.href = '/waiter'}
              className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold font-heading"
            >
              Go to Waiter Portal
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
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col font-sans overflow-x-hidden">
      {/* DEDICATED KITCHEN KDS TOPBAR */}
      <header className="sticky top-0 z-40 bg-[#27272A] border-b border-white/10 px-3 sm:px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F76707] flex items-center justify-center text-white shadow-xs shrink-0">
              <ChefHat size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-extrabold font-heading text-white tracking-tight truncate">
                  Kitchen Display Terminal (KDS)
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                  Station Active
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
              <span>
                {connectionStatus === 'connected' ? 'Live Sync Connected' : 'Context Sync Active'}
              </span>
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

      {/* FULL-SCREEN KITCHEN DISPLAY */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full">
        <KitchenDisplayView
          orders={orders}
          liveCarts={liveCarts}
          menuItems={menuItems}
          lowInventoryAlerts={lowInventoryAlerts}
          syncStatus={connectionStatus}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onSendOrderReadyAlert={handleSendOrderReadyAlert}
          onUpdateItemInventory={handleUpdateItemInventory}
        />
      </main>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../router/Router';
import { restaurantDb, DbEvent } from '../services/db';
import { portalAuth } from '../services/auth';
import { CustomerQrView } from '../components/dcc/CustomerQrView';
import { useRealtimeSync } from '../context/RealtimeSyncContext';
import {
  RestaurantTenant,
  RestaurantTable,
  MenuItem,
  MenuCategory,
  Order,
  WaiterRequest,
  OrderItem,
  CustomerProfile,
} from '../types/dcc';
import { AlertTriangle, Bell, RefreshCw, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { realtimeWs } from '../services/websocket';

export const CustomerPortal: React.FC = () => {
  const { queryParams, navigate } = useRouter();
  const {
    emitOrderEvent,
    clearTableCart,
    subscribeEvents,
    syncRestaurantOrders,
    syncRestaurantMenu,
    getMenuForRestaurant,
    getOrdersForRestaurant,
    getLowInventoryAlerts,
    getSoldOutItemIds,
    awardLoyaltyPointsForOrder,
  } = useRealtimeSync();

  // Parse parameters from URL query string
  // Expected format: /customer?restaurant=<restaurant_id>&table=<table_id>&token=<optional_tracking_token>
  const urlRestaurantParam = queryParams.get('restaurant') || queryParams.get('rest') || '';
  const urlTableParam = queryParams.get('table') || queryParams.get('tbl') || '';
  const urlTableIdParam = queryParams.get('tableId') || '';
  const urlTokenParam = queryParams.get('token') || '';
  const isCustomerPreview = queryParams.get('view') === 'customer';

  // Local state hydrated from centralized database + RealtimeSyncContext localStorage + backend workspace API
  const [restaurant, setRestaurant] = useState<RestaurantTenant>(() =>
    restaurantDb.getRestaurant(urlRestaurantParam)
  );
  const [tables, setTables] = useState<RestaurantTable[]>(() =>
    restaurantDb.getTables(restaurant.id)
  );
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    const dbCats = restaurantDb.getCategories(restaurant.id);
    return dbCats.length > 0 ? dbCats : getMenuForRestaurant(restaurant.id).categories;
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const dbItems = restaurantDb.getMenuItems(restaurant.id);
    return dbItems.length > 0 ? dbItems : getMenuForRestaurant(restaurant.id).menuItems;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const dbOrders = restaurantDb.getOrders(restaurant.id);
    return dbOrders.length > 0 ? dbOrders : getOrdersForRestaurant(restaurant.id);
  });
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>(() =>
    restaurantDb.getWaiterRequests(restaurant.id)
  );

  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [staffCalled, setStaffCalled] = useState(false);

  // Smart Device Recognition state
  const [recognizing, setRecognizing] = useState(true);
  const [recognizedCustomer, setRecognizedCustomer] = useState<CustomerProfile | null>(null);
  const [staffRedirectInfo, setStaffRedirectInfo] = useState<{
    role: string;
    staffName: string;
    redirectTo: string;
  } | null>(null);

  const scanTrackedRef = useRef<string>('');

  const cleanUrlTable = urlTableParam.replace(/^Table\s*/i, '').trim();
  const matchedTable =
    (urlTableIdParam ? tables.find((t) => t.id === urlTableIdParam) : undefined) ||
    (urlTableParam
      ? restaurantDb.getTableByNumber(cleanUrlTable, restaurant.id) ||
        tables.find((t) => {
          const tClean = String(t.number || '').replace(/^Table\s*/i, '').trim();
          return (
            tClean === cleanUrlTable ||
            tClean.padStart(2, '0') === cleanUrlTable.padStart(2, '0')
          );
        })
      : tables[0] || restaurantDb.getTables(restaurant.id)[0]);

  const [activeTableNumber, setActiveTableNumber] = useState<string>(() => {
    if (matchedTable) return matchedTable.number;
    if (urlTableParam) return cleanUrlTable;
    return '01';
  });

  // Hydrate multi-tenant workspace (restaurant, tables, menu, orders) from backend
  useEffect(() => {
    let isMounted = true;
    const targetSlug = urlRestaurantParam || 'demo-restaurant';

    const loadWorkspace = async () => {
      setIsWorkspaceLoading(true);
      setWorkspaceError(null);
      try {
        const params = new URLSearchParams();
        if (urlTableParam) params.set('table', urlTableParam);
        if (urlTableIdParam) params.set('tableId', urlTableIdParam);
        if (urlTokenParam) params.set('token', urlTokenParam);
        const res = await fetch(
          `/api/workspace/${encodeURIComponent(targetSlug)}?${params.toString()}`
        );
        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.success || data.notFound) {
          setWorkspaceError(
            data.error || `We couldn't locate the restaurant "${urlRestaurantParam || 'requested'}".`
          );
          setIsWorkspaceLoading(false);
          return;
        }

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
        setTables(data.tables || []);
        setCategories(restaurantDb.getCategories(data.restaurant.id));
        setMenuItems(restaurantDb.getMenuItems(data.restaurant.id));
        setOrders(restaurantDb.getOrders(data.restaurant.id));
        setWaiterRequests(data.waiterRequests || []);

        if (data.tokenInvalid) {
          setWorkspaceError(data.tokenReason || 'This QR code has been reset or deactivated.');
        } else if (data.matchedTable) {
          setActiveTableNumber(data.matchedTable.number);
        } else if (urlTableParam) {
          setActiveTableNumber(urlTableParam.replace(/^Table\s*/i, '').trim());
        }

        // Record scan analytics if valid
        if (!data.tokenInvalid && data.restaurant?.id) {
          const scanKey = `${data.restaurant.id}:${urlTableParam}:${urlTokenParam}`;
          if (scanTrackedRef.current !== scanKey) {
            scanTrackedRef.current = scanKey;
            fetch('/api/qr/track-scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                restaurantId: data.restaurant.id,
                tableNumber: data.matchedTable?.number || urlTableParam || '01',
                token: urlTokenParam || undefined,
              }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Workspace load fallback to local cache:', err);
      } finally {
        if (isMounted) setIsWorkspaceLoading(false);
      }
    };

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [urlRestaurantParam, urlTableParam, urlTableIdParam, urlTokenParam, syncRestaurantOrders, syncRestaurantMenu]);

  // Register customer table session in Realtime WebSocket Pipeline
  useEffect(() => {
    realtimeWs.register({
      role: 'customer',
      restaurantId: restaurant.id,
      tableNumber: activeTableNumber,
      customerToken: localStorage.getItem('urdearmenu_customer_token') || undefined,
    });
  }, [restaurant.id, activeTableNumber]);

  // Smart Device Recognition: Check for recognized returning customer or optional staff shortcut (never hijack customer menu)
  useEffect(() => {
    let isMounted = true;

    const performDeviceRecognition = async () => {
      try {
        const staffSession = portalAuth.getSession();
        const staffToken = isCustomerPreview ? undefined : staffSession?.sessionToken;
        const customerToken = localStorage.getItem('urdearmenu_customer_token');

        const res = await fetch('/api/auth/recognize-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: restaurant.id,
            staffToken,
            customerToken,
          }),
        });
        const data = await res.json();
        if (!isMounted) return;

        if (!isCustomerPreview && data.isStaff && data.redirectTo) {
          setStaffRedirectInfo({
            role: data.role,
            staffName: data.staffName,
            redirectTo: data.redirectTo,
          });
        }

        if (data.isCustomer && data.customer) {
          setRecognizedCustomer(data.customer);
        }
      } catch (err) {
        console.warn('Smart device recognition check failed:', err);
      } finally {
        if (isMounted) setRecognizing(false);
      }
    };

    performDeviceRecognition();

    return () => {
      isMounted = false;
    };
  }, [restaurant.id, isCustomerPreview]);

  // Keep state in sync with URL parameters
  useEffect(() => {
    if (urlTableParam) {
      const clean = urlTableParam.replace(/^Table\s*/i, '').trim();
      setActiveTableNumber(clean);
    }
  }, [urlTableParam]);

  // Subscribe to real-time events from unified database & RealtimeSyncContext
  useEffect(() => {
    const unsubscribeDb = restaurantDb.subscribe((event: DbEvent) => {
      if (event.type === 'ORDER_CREATED' || event.type === 'ORDER_STATUS_UPDATED') {
        setOrders(restaurantDb.getOrders(restaurant.id));
        setTables(restaurantDb.getTables(restaurant.id));
      } else if (
        event.type === 'WAITER_REQUEST_CREATED' ||
        event.type === 'WAITER_REQUEST_UPDATED'
      ) {
        setWaiterRequests(restaurantDb.getWaiterRequests(restaurant.id));
        setTables(restaurantDb.getTables(restaurant.id));
      } else if (event.type === 'MENU_UPDATED') {
        setMenuItems(restaurantDb.getMenuItems(restaurant.id));
        setCategories(restaurantDb.getCategories(restaurant.id));
      } else if (event.type === 'RESTAURANT_UPDATED') {
        setRestaurant(restaurantDb.getRestaurant(restaurant.id));
      } else if (event.type === 'TABLES_UPDATED') {
        setTables(restaurantDb.getTables(restaurant.id));
      }
    });

    const unsubscribeSync = subscribeEvents((evt) => {
      if (evt.type === 'ORDER_SYNC' && evt.restaurantId === restaurant.id) {
        setOrders(restaurantDb.getOrders(restaurant.id));
        setTables(restaurantDb.getTables(restaurant.id));
      } else if (evt.type === 'TABLES_UPDATED' && evt.restaurantId === restaurant.id) {
        setTables(restaurantDb.getTables(restaurant.id));
      } else if (
        (evt.type === 'MENU_UPDATED' || evt.type === 'INVENTORY_UPDATED') &&
        evt.restaurantId === restaurant.id
      ) {
        const dbItems = restaurantDb.getMenuItems(restaurant.id);
        const ctxMenu = getMenuForRestaurant(restaurant.id);
        setMenuItems(dbItems.length > 0 ? dbItems : ctxMenu.menuItems);
        setCategories(
          restaurantDb.getCategories(restaurant.id).length > 0
            ? restaurantDb.getCategories(restaurant.id)
            : ctxMenu.categories
        );
      }
    });

    return () => {
      unsubscribeDb();
      unsubscribeSync();
    };
  }, [restaurant.id, subscribeEvents, getMenuForRestaurant]);

  // Check if QR code table is invalid ONLY after backend workspace lookup completes
  const isInvalidTable =
    !isWorkspaceLoading &&
    (workspaceError !== null ||
      ((urlTableParam !== '' || urlTableIdParam !== '') && !matchedTable));

  // Order & Waiter Handlers that mutate the centralized database + sync context
  const handlePlaceOrder = (items: OrderItem[], dinerName: string): Order => {
    const createdOrder = restaurantDb.createCustomerOrder(activeTableNumber, items, dinerName, {
      restaurantId: restaurant.id,
    });
    const updatedOrders = restaurantDb.getOrders(restaurant.id);
    const updatedTables = restaurantDb.getTables(restaurant.id);
    setOrders(updatedOrders);
    setTables(updatedTables);

    awardLoyaltyPointsForOrder({
      restaurantId: restaurant.id,
      order: createdOrder,
      customerName: dinerName || recognizedCustomer?.name,
      phoneNumber: recognizedCustomer?.phoneNumber,
      customerToken:
        recognizedCustomer?.customerToken ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('urdearmenu_customer_token') || undefined
          : undefined),
    });

    clearTableCart(restaurant.id, activeTableNumber);
    emitOrderEvent({
      eventType: 'ORDER_CREATED',
      restaurantId: restaurant.id,
      order: createdOrder,
      orders: updatedOrders,
      tables: updatedTables,
    });
    return createdOrder;
  };

  const handleCallWaiter = (reason: any) => {
    restaurantDb.createWaiterRequest(activeTableNumber, reason);
    setWaiterRequests(restaurantDb.getWaiterRequests(restaurant.id));
    setTables(restaurantDb.getTables(restaurant.id));
  };

  const handleCancelWaiter = () => {
    restaurantDb.cancelWaiterRequest(activeTableNumber);
    setWaiterRequests(restaurantDb.getWaiterRequests(restaurant.id));
    setTables(restaurantDb.getTables(restaurant.id));
  };

  const handleSettleBill = () => {
    const activeOrd = orders.find(
      (o) =>
        o.tableNumber === activeTableNumber &&
        o.status !== 'served' &&
        o.status !== 'cancelled'
    );
    if (activeOrd) {
      const updatedOrders = restaurantDb.updateOrderStatus(activeOrd.id, 'served');
      const updatedTables = restaurantDb.getTables(restaurant.id);
      setOrders(updatedOrders);
      emitOrderEvent({
        eventType: 'ORDER_STATUS_UPDATED',
        restaurantId: restaurant.id,
        orderId: activeOrd.id,
        status: 'served',
        orders: updatedOrders,
        tables: updatedTables,
      });
    }
  };

  if (isWorkspaceLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-3xl p-8 border border-[#E4E4E7] shadow-lg text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-[#F76707] mx-auto" />
          <div className="text-sm font-bold font-heading text-[#18181B]">
            Loading Menu & Table Session...
          </div>
          <p className="text-xs text-[#71717A]">
            Connecting to {urlRestaurantParam || 'restaurant'} • Table {urlTableParam || '01'}
          </p>
        </div>
      </div>
    );
  }

  // Friendly Error State if the QR table or token or restaurant is invalid
  if (isInvalidTable) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-3xl p-6 sm:p-8 border border-[#E4E4E7] shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626] mx-auto flex items-center justify-center">
            <AlertTriangle size={28} />
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-extrabold font-heading text-[#18181B]">
              Table QR Code Not Found
            </h1>
            <p className="text-xs text-[#71717A] leading-relaxed">
              {workspaceError ? (
                workspaceError
              ) : (
                <>
                  We couldn't locate <strong>Table {urlTableParam}</strong> for{' '}
                  <strong>{restaurant.name}</strong>. The QR stand may have been reset or assigned a new token.
                </>
              )}
            </p>
          </div>

          <div className="p-3 bg-[#F4F4F5] rounded-xl text-xs text-[#52525B] text-left space-y-1">
            <div className="font-bold text-[#18181B]">Scanned Details:</div>
            <div className="font-mono text-[11px] text-[#71717A]">
              Restaurant: {urlRestaurantParam || restaurant.slug || 'Default'}
              <br />
              Requested Table: {urlTableParam || 'Not specified'}
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                restaurantDb.createWaiterRequest('Front Desk', 'captain');
                setStaffCalled(true);
              }}
              disabled={staffCalled}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold font-heading flex items-center justify-center gap-2 transition-all ${
                staffCalled
                  ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30'
                  : 'bg-[#F76707] hover:bg-[#D85800] text-white shadow-md'
              }`}
            >
              {staffCalled ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Staff Alerted! Captain Coming</span>
                </>
              ) : (
                <>
                  <Bell size={16} />
                  <span>Call Floor Staff for Assistance</span>
                </>
              )}
            </button>

            {tables.length > 0 && !workspaceError && (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-[#71717A] block mb-2">
                  Or select your table number:
                </span>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        const restSlug = restaurant.slug || restaurant.id;
                        navigate(`/customer?restaurant=${encodeURIComponent(restSlug)}&table=${encodeURIComponent(t.number)}`);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B]"
                    >
                      Table {t.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const effectiveTable =
    matchedTable ||
    tables.find((t) => t.number === activeTableNumber) ||
    tables[0] ||
    ({
      id: 'tbl-default',
      restaurantId: restaurant.id,
      number: activeTableNumber,
      name: `Table ${activeTableNumber}`,
      capacity: 4,
      zone: 'Main Dining',
      status: 'available',
      secureToken: 'tok-direct',
      activeDinersCount: 1,
      lastActivityAt: Date.now(),
    } as RestaurantTable);

  const activeOrder = orders.find(
    (o) =>
      o.tableNumber === effectiveTable.number &&
      o.status !== 'served' &&
      o.status !== 'cancelled'
  );

  const isWaiterActive = waiterRequests.some(
    (r) => r.tableNumber === effectiveTable.number && r.status === 'pending'
  );

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] flex flex-col font-sans overflow-x-hidden">
      {staffRedirectInfo && !isCustomerPreview && (
        <div className="bg-[#18181B] text-white px-3 py-2 border-b border-white/10">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck size={14} className="text-[#F76707] shrink-0" />
              <span className="truncate">
                Staff session: <strong>{staffRedirectInfo.staffName}</strong> ({staffRedirectInfo.role})
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate(staffRedirectInfo.redirectTo)}
                className="px-2.5 py-1 rounded-lg bg-[#F76707] hover:bg-[#D85800] text-white font-bold text-[10px] flex items-center gap-1"
              >
                <span>Open {staffRedirectInfo.role.toUpperCase()}</span>
                <ArrowRight size={11} />
              </button>
              <button
                type="button"
                onClick={() => setStaffRedirectInfo(null)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-semibold text-[10px]"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}
      {/* FULL-SCREEN CUSTOMER EXPERIENCE - NO ADMIN NAVBAR, NO KITCHEN, NO WAITER */}
      <main className="flex-1 p-0 sm:p-4 max-w-md mx-auto w-full">
        <CustomerQrView
          restaurant={restaurant}
          table={effectiveTable}
          menuItems={menuItems}
          categories={categories}
          activeOrder={activeOrder}
          onPlaceOrder={handlePlaceOrder}
          onCallWaiter={handleCallWaiter}
          onCancelWaiter={handleCancelWaiter}
          waiterCallActive={isWaiterActive}
          onSettleBill={handleSettleBill}
          initialCustomer={recognizedCustomer}
          lowInventoryAlerts={getLowInventoryAlerts(restaurant.id)}
          soldOutItemIds={getSoldOutItemIds(restaurant.id)}
        />
      </main>
    </div>
  );
};

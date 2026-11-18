import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  CustomerLoyaltyProfile,
  GuestDiningReceipt,
  InventoryStockStatus,
  LiveTableCartActivity,
  LowInventoryAlert,
  LoyaltyPointTransaction,
  LoyaltyTier,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  RestaurantTable,
  StaffScheduleAssignment,
  WaiterBreakWindow,
  WaiterShiftStatus,
} from '../types/dcc';
import { realtimeWs, WsConnectionStatus } from '../services/websocket';
import { restaurantDb } from '../services/db';
import { generateUpiUri } from '../utils/formatters';

const CONTEXT_BUS_NAME = 'urdearmenu_ws_context_bus';
const CART_ACTIVITY_STORAGE_KEY = 'urdearmenu_live_table_carts_v1';
const ORDERS_STORAGE_KEY = 'urdearmenu_realtime_orders_v1';
const MENU_STORAGE_KEY = 'urdearmenu_realtime_menu_v1';
const INVENTORY_STORAGE_KEY = 'urdearmenu_low_inventory_v1';
const LOYALTY_STORAGE_KEY = 'urdearmenu_loyalty_points_v1';
const SCHEDULES_STORAGE_KEY = 'urdearmenu_staff_schedules_v1';
const DINING_HISTORY_STORAGE_KEY = 'urdearmenu_guest_dining_history_v1';
const CART_TTL_MS = 12 * 60 * 60 * 1000;

export interface PersistedRestaurantMenu {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  updatedAt: number;
}

export interface UpiGatewayInitResult {
  transactionId: string;
  gatewayOrderId: string;
  vpa: string;
  payeeName: string;
  upiUri: string;
  qrDataUrl: string;
  amount: number;
}

export type RealtimeSyncEvent =
  | { type: 'CART_UPDATED'; activity: LiveTableCartActivity }
  | {
      type: 'ORDER_SYNC';
      eventType: 'ORDER_CREATED' | 'ORDER_STATUS_UPDATED';
      restaurantId: string;
      order?: Order;
      orderId?: string;
      status?: OrderStatus;
      orders?: Order[];
      tables?: RestaurantTable[];
      timestamp: number;
    }
  | { type: 'TABLES_UPDATED'; restaurantId: string; tables: RestaurantTable[] }
  | {
      type: 'MENU_UPDATED';
      restaurantId: string;
      categories?: MenuCategory[];
      menuItems?: MenuItem[];
    }
  | {
      type: 'INVENTORY_UPDATED';
      restaurantId: string;
      itemId: string;
      itemName?: string;
      isAvailable: boolean;
      stockStatus: InventoryStockStatus;
      remainingCount?: number;
      updatedBy?: string;
      timestamp: number;
    }
  | {
      type: 'LOYALTY_UPDATED';
      restaurantId: string;
      customerKey: string;
      profile: CustomerLoyaltyProfile;
      timestamp: number;
    }
  | {
      type: 'STAFF_SCHEDULE_UPDATED';
      restaurantId: string;
      schedules: StaffScheduleAssignment[];
      timestamp: number;
    };

interface RealtimeSyncContextValue {
  connectionStatus: WsConnectionStatus;
  activeTableCarts: Record<string, LiveTableCartActivity>;
  ordersByRestaurant: Record<string, Order[]>;
  menuByRestaurant: Record<string, PersistedRestaurantMenu>;
  lowInventoryAlertsByRestaurant: Record<string, LowInventoryAlert[]>;
  loyaltyByKey: Record<string, CustomerLoyaltyProfile>;
  schedulesByRestaurant: Record<string, StaffScheduleAssignment[]>;
  lastEventAt: number | null;
  getCartsForRestaurant: (restaurantId: string) => LiveTableCartActivity[];
  getTableCart: (restaurantId: string, tableNumber: string) => OrderItem[];
  getOrdersForTable: (restaurantId: string, tableNumber: string) => Order[];
  getOrdersForRestaurant: (restaurantId: string) => Order[];
  getMenuForRestaurant: (restaurantId: string) => PersistedRestaurantMenu;
  getLowInventoryAlerts: (restaurantId: string) => LowInventoryAlert[];
  getSoldOutItemIds: (restaurantId: string) => string[];
  isItemSoldOut: (restaurantId: string, itemId: string) => boolean;
  getCustomerLoyalty: (lookup: {
    restaurantId: string;
    phoneNumber?: string;
    customerToken?: string;
    customerName?: string;
    tableNumber?: string;
  }) => CustomerLoyaltyProfile;
  awardLoyaltyPointsForOrder: (payload: {
    restaurantId: string;
    order: {
      id: string;
      orderNumber: string;
      grandTotal: number;
      tableNumber?: string;
      dinerName?: string;
      placedAt?: number;
    };
    customerName?: string;
    phoneNumber?: string;
    customerToken?: string;
  }) => { pointsAwarded: number; profile: CustomerLoyaltyProfile };
  markMenuItemAvailability: (payload: {
    restaurantId: string;
    itemId: string;
    isAvailable: boolean;
    stockStatus?: InventoryStockStatus;
    remainingCount?: number;
    updatedBy?: string;
  }) => Promise<void>;
  syncRestaurantOrders: (restaurantId: string, orders: Order[]) => void;
  syncRestaurantMenu: (
    restaurantId: string,
    categories: MenuCategory[],
    menuItems: MenuItem[]
  ) => void;
  syncCartAction: (
    restaurantId: string,
    tableNumber: string,
    items: OrderItem[],
    dinerName?: string
  ) => void;
  clearTableCart: (restaurantId: string, tableNumber: string) => void;
  emitOrderEvent: (payload: {
    eventType: 'ORDER_CREATED' | 'ORDER_STATUS_UPDATED';
    restaurantId: string;
    order?: Order;
    orderId?: string;
    status?: OrderStatus;
    orders?: Order[];
    tables?: RestaurantTable[];
  }) => void;
  emitMenuEvent: (payload: {
    restaurantId: string;
    categories: MenuCategory[];
    menuItems: MenuItem[];
  }) => void;
  initiateUpiGatewayPayment: (payload: {
    restaurantId: string;
    orderId: string;
    orderNumber?: string;
    tableNumber: string;
    amount: number;
    customerName?: string;
    customerPhone?: string;
    payeeNameOverride?: string;
    vpaOverride?: string;
  }) => Promise<UpiGatewayInitResult>;
  confirmUpiGatewayPayment: (payload: {
    restaurantId: string;
    orderId: string;
    paymentTransactionId?: string;
    amount?: number;
    eligibleSubtotal?: number;
    tip?: number;
    serviceCharge?: number;
    grandTotal?: number;
    upiRef?: string;
  }) => Promise<{ success: boolean; settledRef: string; order?: Order }>;
  getStaffSchedules: (restaurantId: string) => StaffScheduleAssignment[];
  upsertStaffSchedule: (
    restaurantId: string,
    payload: {
      staffId: string;
      staffName: string;
      username?: string;
      role?: 'waiter' | 'manager' | 'kitchen' | 'owner';
      assignedZones: string[];
      shiftStart: string;
      shiftEnd: string;
      dutyStatus: WaiterShiftStatus;
      breaks: WaiterBreakWindow[];
      notes?: string;
    }
  ) => StaffScheduleAssignment;
  deleteStaffSchedule: (restaurantId: string, staffId: string) => void;
  setWaiterDutyStatus: (
    restaurantId: string,
    staffId: string,
    dutyStatus: WaiterShiftStatus
  ) => void;
  toggleBreakWindowStatus: (
    restaurantId: string,
    staffId: string,
    breakId: string,
    nextStatus?: 'scheduled' | 'active' | 'completed'
  ) => void;
  recordGuestDiningReceipt: (receipt: Partial<GuestDiningReceipt> & {
    orderId: string;
    restaurantId: string;
  }) => void;
  getGuestDiningHistory: (lookup: {
    restaurantId: string;
    phoneNumber?: string;
    customerToken?: string;
    customerName?: string;
    tableNumber?: string;
  }) => GuestDiningReceipt[];
  subscribeEvents: (callback: (event: RealtimeSyncEvent) => void) => () => void;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextValue | undefined>(undefined);

function normalizeTableNumber(tableNumber: string) {
  const clean = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
  return /^\d{1,2}$/.test(clean) ? clean.padStart(2, '0') : clean;
}

function makeCartKey(restaurantId: string, tableNumber: string) {
  return `${restaurantId}:${normalizeTableNumber(tableNumber)}`;
}

function mergeRestaurantOrders(existing: Order[], incoming: Order[]): Order[] {
  const byId = new Map<string, Order>();
  existing.forEach((o) => {
    if (o?.id) byId.set(o.id, o);
  });
  incoming.forEach((o) => {
    if (o?.id) byId.set(o.id, o);
  });
  return Array.from(byId.values()).sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
}

function loadInitialCarts(): Record<string, LiveTableCartActivity> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CART_ACTIVITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - CART_TTL_MS;
    const fresh: Record<string, LiveTableCartActivity> = {};
    Object.entries(parsed || {}).forEach(([, v]: [string, any]) => {
      if (v && v.restaurantId && v.tableNumber && v.itemCount > 0 && (v.updatedAt || 0) > cutoff) {
        const normKey = makeCartKey(v.restaurantId, v.tableNumber);
        fresh[normKey] = {
          ...v,
          tableNumber: normalizeTableNumber(v.tableNumber),
        };
      }
    });
    return fresh;
  } catch {
    return {};
  }
}

function loadInitialOrders(): Record<string, Order[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, Order[]> = {};
    Object.entries(parsed).forEach(([restId, list]: [string, any]) => {
      if (Array.isArray(list)) {
        clean[restId] = list
          .filter((o) => o && o.id && o.id !== 'ord-past-01' && o.id !== 'ord-sample-1')
          .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
      }
    });
    return clean;
  } catch {
    return {};
  }
}

function loadInitialMenus(): Record<string, PersistedRestaurantMenu> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, PersistedRestaurantMenu> = {};
    Object.entries(parsed).forEach(([restId, val]: [string, any]) => {
      if (val && typeof val === 'object') {
        clean[restId] = {
          categories: Array.isArray(val.categories) ? val.categories : [],
          menuItems: Array.isArray(val.menuItems)
            ? val.menuItems.map((m: any) => {
                const img = (m?.imageUrl ?? m?.image ?? '').trim();
                return { ...m, image: img, imageUrl: img };
              })
            : [],
          updatedAt: Number(val.updatedAt) || Date.now(),
        };
      }
    });
    return clean;
  } catch {
    return {};
  }
}

function loadInitialInventoryAlerts(): Record<string, LowInventoryAlert[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadInitialLoyalty(): Record<string, CustomerLoyaltyProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOYALTY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadInitialSchedules(): Record<string, StaffScheduleAssignment[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadInitialDiningHistory(): GuestDiningReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DINING_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && r.orderId && r.orderId !== 'ord-past-01' && r.orderId !== 'ord-sample-1')
      .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
  } catch {
    return [];
  }
}

function normalizePhoneDigits(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function buildLoyaltyKey(params: {
  restaurantId: string;
  phoneNumber?: string;
  customerToken?: string;
  tableNumber?: string;
  customerName?: string;
}): string {
  const normPhone = normalizePhoneDigits(params.phoneNumber);
  if (normPhone.length >= 10) return `${params.restaurantId}:phone:${normPhone}`;
  if (params.customerToken) return `${params.restaurantId}:token:${params.customerToken}`;
  const cleanName = String(params.customerName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (cleanName && cleanName !== 'guest' && cleanName !== 'tableguest') {
    return `${params.restaurantId}:name:${cleanName}`;
  }
  return `${params.restaurantId}:table:${normalizeTableNumber(params.tableNumber || '01')}`;
}

function calculateLoyaltyPointsForAmount(orderTotal: number): number {
  const safeAmount = Math.max(0, Number(orderTotal) || 0);
  if (safeAmount <= 0) return 0;
  return Math.max(10, Math.floor(safeAmount / 10));
}

function resolveLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 1500) return 'Platinum';
  if (lifetimePoints >= 750) return 'Gold';
  if (lifetimePoints >= 250) return 'Silver';
  return 'Bronze';
}

export const RealtimeSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>(() =>
    realtimeWs.getStatus()
  );
  const [activeTableCarts, setActiveTableCarts] =
    useState<Record<string, LiveTableCartActivity>>(loadInitialCarts);
  const [ordersByRestaurant, setOrdersByRestaurant] =
    useState<Record<string, Order[]>>(loadInitialOrders);
  const [menuByRestaurant, setMenuByRestaurant] =
    useState<Record<string, PersistedRestaurantMenu>>(loadInitialMenus);
  const [lowInventoryAlertsByRestaurant, setLowInventoryAlertsByRestaurant] =
    useState<Record<string, LowInventoryAlert[]>>(loadInitialInventoryAlerts);
  const [loyaltyByKey, setLoyaltyByKey] =
    useState<Record<string, CustomerLoyaltyProfile>>(loadInitialLoyalty);
  const [schedulesByRestaurant, setSchedulesByRestaurant] =
    useState<Record<string, StaffScheduleAssignment[]>>(loadInitialSchedules);
  const [diningHistory, setDiningHistory] =
    useState<GuestDiningReceipt[]>(loadInitialDiningHistory);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const listenersRef = useRef<Set<(event: RealtimeSyncEvent) => void>>(new Set());

  const persistDiningHistory = useCallback((next: GuestDiningReceipt[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DINING_HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistSchedules = useCallback((next: Record<string, StaffScheduleAssignment[]>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistLoyalty = useCallback((next: Record<string, CustomerLoyaltyProfile>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOYALTY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistCarts = useCallback((next: Record<string, LiveTableCartActivity>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CART_ACTIVITY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistOrders = useCallback((next: Record<string, Order[]>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistMenus = useCallback((next: Record<string, PersistedRestaurantMenu>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const persistInventoryAlerts = useCallback((next: Record<string, LowInventoryAlert[]>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  const applyRestaurantOrders = useCallback(
    (
      restaurantId: string,
      incomingOrders?: Order[],
      singleOrder?: Order,
      statusUpdate?: { orderId: string; status: OrderStatus },
      replace = false
    ) => {
      if (!restaurantId) return;
      setOrdersByRestaurant((prev) => {
        const current = prev[restaurantId] || restaurantDb.getOrders(restaurantId) || [];
        let nextList: Order[];
        if (replace && Array.isArray(incomingOrders)) {
          nextList = [...incomingOrders].sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
        } else {
          const additions = [
            ...(Array.isArray(incomingOrders) ? incomingOrders : []),
            ...(singleOrder ? [singleOrder] : []),
          ];
          nextList = mergeRestaurantOrders(current, additions);
        }
        if (statusUpdate?.orderId) {
          nextList = nextList.map((o) =>
            o.id === statusUpdate.orderId ? { ...o, status: statusUpdate.status } : o
          );
        }
        const next = {
          ...prev,
          [restaurantId]: nextList,
        };
        persistOrders(next);
        return next;
      });
    },
    [persistOrders]
  );

  const syncRestaurantOrders = useCallback(
    (restaurantId: string, orders: Order[]) => {
      applyRestaurantOrders(restaurantId, orders, undefined, undefined, true);
    },
    [applyRestaurantOrders]
  );

  const deriveInventoryAlertsFromMenu = useCallback(
    (restaurantId: string, items: MenuItem[], existingAlerts: LowInventoryAlert[] = []): LowInventoryAlert[] => {
      const existingById = new Map(existingAlerts.map((a) => [a.itemId, a]));
      const nextAlerts: LowInventoryAlert[] = [];
      (items || []).forEach((item) => {
        const prevAlert = existingById.get(item.id);
        const derivedStatus: InventoryStockStatus =
          !item.isAvailable || item.stockStatus === 'sold_out'
            ? 'sold_out'
            : item.stockStatus === 'low_stock' ||
              (item.remainingCount !== undefined && item.remainingCount <= 5)
            ? 'low_stock'
            : 'in_stock';
        if (derivedStatus !== 'in_stock') {
          nextAlerts.push({
            itemId: item.id,
            restaurantId,
            itemName: item.name,
            stockStatus: derivedStatus,
            isAvailable: derivedStatus !== 'sold_out',
            remainingCount: item.remainingCount ?? prevAlert?.remainingCount,
            updatedAt: prevAlert?.updatedAt || Date.now(),
            updatedBy: prevAlert?.updatedBy,
          });
        }
      });
      return nextAlerts.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    []
  );

  const syncRestaurantMenu = useCallback(
    (restaurantId: string, categories: MenuCategory[], menuItems: MenuItem[]) => {
      if (!restaurantId) return;
      const normalizedItems = (menuItems || []).map((m) => {
        const img = (m.imageUrl ?? m.image ?? '').trim();
        const resolvedAvail = m.isAvailable !== false;
        const resolvedStatus: InventoryStockStatus = !resolvedAvail
          ? 'sold_out'
          : m.stockStatus === 'low_stock' ||
            (m.remainingCount !== undefined && m.remainingCount <= 5)
          ? 'low_stock'
          : 'in_stock';
        const prepMins = Number(m.prepTimeMinutes) || 12;
        const resolvedDifficulty =
          m.difficultyLevel === 'Easy' || m.difficultyLevel === 'Medium' || m.difficultyLevel === 'Hard'
            ? m.difficultyLevel
            : prepMins >= 16
            ? 'Hard'
            : prepMins >= 10
            ? 'Medium'
            : 'Easy';
        return {
          ...m,
          restaurantId: m.restaurantId || restaurantId,
          image: img,
          imageUrl: img,
          difficultyLevel: resolvedDifficulty,
          isAvailable: resolvedAvail,
          stockStatus: resolvedStatus,
        };
      });
      const normalizedCats = (categories || [])
        .map((c) => ({ ...c, restaurantId: c.restaurantId || restaurantId }))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      setMenuByRestaurant((prev) => {
        const next: Record<string, PersistedRestaurantMenu> = {
          ...prev,
          [restaurantId]: {
            categories: normalizedCats,
            menuItems: normalizedItems,
            updatedAt: Date.now(),
          },
        };
        persistMenus(next);
        return next;
      });

      setLowInventoryAlertsByRestaurant((prev) => {
        const nextAlerts = deriveInventoryAlertsFromMenu(
          restaurantId,
          normalizedItems,
          prev[restaurantId] || []
        );
        const next = {
          ...prev,
          [restaurantId]: nextAlerts,
        };
        persistInventoryAlerts(next);
        return next;
      });
    },
    [deriveInventoryAlertsFromMenu, persistInventoryAlerts, persistMenus]
  );

  const notifyListeners = useCallback((event: RealtimeSyncEvent) => {
    setLastEventAt(Date.now());
    listenersRef.current.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[RealtimeSyncContext] Subscriber error:', err);
      }
    });
  }, []);

  const applyCartActivity = useCallback(
    (activity: LiveTableCartActivity) => {
      const normTable = normalizeTableNumber(activity.tableNumber);
      const key = makeCartKey(activity.restaurantId, normTable);
      const normalizedActivity: LiveTableCartActivity = {
        ...activity,
        tableNumber: normTable,
      };
      setActiveTableCarts((prev) => {
        const next = { ...prev };
        if (normalizedActivity.itemCount <= 0 || normalizedActivity.items.length === 0) {
          delete next[key];
        } else {
          next[key] = normalizedActivity;
        }
        persistCarts(next);
        return next;
      });
      notifyListeners({ type: 'CART_UPDATED', activity: normalizedActivity });
    },
    [notifyListeners, persistCarts]
  );

  // Hydrate restaurantDb on boot from persisted menus/orders if restaurantDb lacks entries
  useEffect(() => {
    Object.entries(menuByRestaurant).forEach(([restId, entry]) => {
      const existingCats = restaurantDb.getCategories(restId);
      const existingItems = restaurantDb.getMenuItems(restId);
      if (
        existingCats.length === 0 &&
        existingItems.length === 0 &&
        (entry.categories.length > 0 || entry.menuItems.length > 0)
      ) {
        restaurantDb.hydrateFromServer({
          restaurantId: restId,
          categories: entry.categories,
          menuItems: entry.menuItems,
        });
      }
    });

    Object.entries(ordersByRestaurant).forEach(([restId, list]) => {
      const existingOrders = restaurantDb.getOrders(restId);
      if (existingOrders.length === 0 && list.length > 0) {
        restaurantDb.hydrateFromServer({
          restaurantId: restId,
          orders: list,
        });
      }
    });
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically mirror local restaurantDb mutations into RealtimeSyncContext + localStorage
  useEffect(() => {
    const unsubDb = restaurantDb.subscribe((event) => {
      if (event.type === 'MENU_UPDATED') {
        const byRest = new Map<string, { categories: MenuCategory[]; menuItems: MenuItem[] }>();
        (event.categories || []).forEach((c) => {
          if (!c.restaurantId) return;
          if (!byRest.has(c.restaurantId)) {
            byRest.set(c.restaurantId, { categories: [], menuItems: [] });
          }
          byRest.get(c.restaurantId)!.categories.push(c);
        });
        (event.menuItems || []).forEach((m) => {
          if (!m.restaurantId) return;
          if (!byRest.has(m.restaurantId)) {
            byRest.set(m.restaurantId, { categories: [], menuItems: [] });
          }
          byRest.get(m.restaurantId)!.menuItems.push(m);
        });
        byRest.forEach((val, rId) => {
          syncRestaurantMenu(rId, val.categories, val.menuItems);
        });
      } else if (event.type === 'ORDER_CREATED') {
        if (event.order?.restaurantId) {
          applyRestaurantOrders(event.order.restaurantId, undefined, event.order);
        }
      } else if (event.type === 'ORDER_STATUS_UPDATED') {
        const targetOrders = event.orders || [];
        const grouped = new Map<string, Order[]>();
        targetOrders.forEach((o) => {
          if (!o.restaurantId) return;
          if (!grouped.has(o.restaurantId)) grouped.set(o.restaurantId, []);
          grouped.get(o.restaurantId)!.push(o);
        });
        grouped.forEach((list, rId) => {
          applyRestaurantOrders(rId, list, undefined, undefined, true);
        });
      }
    });
    return () => unsubDb();
  }, [applyRestaurantOrders, syncRestaurantMenu]);

  // Connect WebSocket status, WebSocket incoming messages, BroadcastChannel, and storage events
  useEffect(() => {
    const unsubStatus = realtimeWs.onConnectionStatus((status) => {
      setConnectionStatus(status);
    });

    const unsubWsMsg = realtimeWs.onMessage((data) => {
      if (!data || !data.type) return;

      if (data.type === 'cart_sync') {
        const activity: LiveTableCartActivity = {
          restaurantId: data.restaurantId,
          tableNumber: data.tableNumber,
          dinerName: data.dinerName || 'Guest',
          items: Array.isArray(data.items) ? data.items : [],
          itemCount: Number(data.itemCount) || 0,
          cartTotal: Number(data.cartTotal) || 0,
          updatedAt: data.updatedAt || Date.now(),
        };
        applyCartActivity(activity);
      } else if (data.type === 'order_sync') {
        if (Array.isArray(data.orders) || data.order) {
          restaurantDb.hydrateFromServer({
            restaurantId: data.restaurantId,
            tables: Array.isArray(data.tables) ? data.tables : undefined,
            orders: Array.isArray(data.orders) ? data.orders : data.order ? [data.order] : undefined,
          });
        }
        applyRestaurantOrders(
          data.restaurantId,
          Array.isArray(data.orders) ? data.orders : undefined,
          data.order,
          data.orderId && data.status ? { orderId: data.orderId, status: data.status } : undefined
        );
        notifyListeners({
          type: 'ORDER_SYNC',
          eventType: data.eventType || 'ORDER_STATUS_UPDATED',
          restaurantId: data.restaurantId,
          order: data.order,
          orderId: data.orderId,
          status: data.status,
          orders: data.orders,
          tables: data.tables,
          timestamp: data.timestamp || Date.now(),
        });
      } else if (data.type === 'tables_updated' && Array.isArray(data.tables)) {
        restaurantDb.hydrateFromServer({ restaurantId: data.restaurantId, tables: data.tables });
        notifyListeners({
          type: 'TABLES_UPDATED',
          restaurantId: data.restaurantId,
          tables: data.tables,
        });
      } else if (data.type === 'menu_updated') {
        const cats = Array.isArray(data.categories) ? data.categories : undefined;
        const items = Array.isArray(data.menuItems) ? data.menuItems : undefined;
        restaurantDb.hydrateFromServer({
          restaurantId: data.restaurantId,
          categories: cats,
          menuItems: items,
        });
        if (data.restaurantId && (cats || items)) {
          syncRestaurantMenu(
            data.restaurantId,
            cats || restaurantDb.getCategories(data.restaurantId),
            items || restaurantDb.getMenuItems(data.restaurantId)
          );
        }
        notifyListeners({
          type: 'MENU_UPDATED',
          restaurantId: data.restaurantId,
          categories: cats,
          menuItems: items,
        });
      } else if (data.type === 'inventory_updated' && data.restaurantId && data.itemId) {
        const nextAvail = Boolean(data.isAvailable);
        const nextStockStatus: InventoryStockStatus =
          data.stockStatus || (nextAvail ? 'in_stock' : 'sold_out');
        if (Array.isArray(data.menuItems) || Array.isArray(data.categories)) {
          restaurantDb.hydrateFromServer({
            restaurantId: data.restaurantId,
            categories: data.categories,
            menuItems: data.menuItems,
          });
        } else {
          restaurantDb.updateMenuItem(data.itemId, {
            isAvailable: nextAvail,
            stockStatus: nextStockStatus,
            ...(data.remainingCount !== undefined
              ? { remainingCount: Number(data.remainingCount) }
              : {}),
          });
        }
        const refreshedItems = restaurantDb.getMenuItems(data.restaurantId);
        const refreshedCats = restaurantDb.getCategories(data.restaurantId);
        syncRestaurantMenu(data.restaurantId, refreshedCats, refreshedItems);
        notifyListeners({
          type: 'INVENTORY_UPDATED',
          restaurantId: data.restaurantId,
          itemId: data.itemId,
          itemName: data.itemName,
          isAvailable: nextAvail,
          stockStatus: nextStockStatus,
          remainingCount: data.remainingCount,
          updatedBy: data.updatedBy,
          timestamp: data.timestamp || Date.now(),
        });
      }
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(CONTEXT_BUS_NAME);
        channelRef.current = bc;
        bc.onmessage = (event) => {
          const msg = event.data;
          if (!msg) return;
          if (msg.type === 'CART_UPDATED' && msg.activity) {
            applyCartActivity(msg.activity);
          } else if (msg.type === 'ORDER_SYNC') {
            if (Array.isArray(msg.orders) || msg.order) {
              restaurantDb.hydrateFromServer({
                restaurantId: msg.restaurantId,
                tables: Array.isArray(msg.tables) ? msg.tables : undefined,
                orders: Array.isArray(msg.orders)
                  ? msg.orders
                  : msg.order
                  ? [msg.order]
                  : undefined,
              });
            }
            applyRestaurantOrders(
              msg.restaurantId,
              Array.isArray(msg.orders) ? msg.orders : undefined,
              msg.order,
              msg.orderId && msg.status ? { orderId: msg.orderId, status: msg.status } : undefined
            );
            notifyListeners(msg);
          } else if (msg.type === 'MENU_UPDATED' && msg.restaurantId) {
            if (Array.isArray(msg.categories) || Array.isArray(msg.menuItems)) {
              restaurantDb.hydrateFromServer({
                restaurantId: msg.restaurantId,
                categories: msg.categories,
                menuItems: msg.menuItems,
              });
              syncRestaurantMenu(
                msg.restaurantId,
                msg.categories || restaurantDb.getCategories(msg.restaurantId),
                msg.menuItems || restaurantDb.getMenuItems(msg.restaurantId)
              );
            }
            notifyListeners(msg);
          } else if (msg.type === 'INVENTORY_UPDATED' && msg.restaurantId && msg.itemId) {
            restaurantDb.updateMenuItem(msg.itemId, {
              isAvailable: Boolean(msg.isAvailable),
              stockStatus: msg.stockStatus,
              ...(msg.remainingCount !== undefined
                ? { remainingCount: msg.remainingCount }
                : {}),
            });
            syncRestaurantMenu(
              msg.restaurantId,
              restaurantDb.getCategories(msg.restaurantId),
              restaurantDb.getMenuItems(msg.restaurantId)
            );
            notifyListeners(msg);
          } else if (msg.type === 'LOYALTY_UPDATED' && msg.customerKey && msg.profile) {
            setLoyaltyByKey((prev) => {
              const next = { ...prev, [msg.customerKey]: msg.profile };
              persistLoyalty(next);
              return next;
            });
            notifyListeners(msg);
          } else if (
            msg.type === 'STAFF_SCHEDULE_UPDATED' &&
            msg.restaurantId &&
            Array.isArray(msg.schedules)
          ) {
            setSchedulesByRestaurant((prev) => {
              const next = { ...prev, [msg.restaurantId]: msg.schedules };
              persistSchedules(next);
              return next;
            });
            notifyListeners(msg);
          }
        };
      } catch {
        // BroadcastChannel unsupported
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_ACTIVITY_STORAGE_KEY && e.newValue) {
        try {
          setActiveTableCarts(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === ORDERS_STORAGE_KEY && e.newValue) {
        try {
          setOrdersByRestaurant(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === MENU_STORAGE_KEY && e.newValue) {
        try {
          setMenuByRestaurant(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === INVENTORY_STORAGE_KEY && e.newValue) {
        try {
          setLowInventoryAlertsByRestaurant(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === LOYALTY_STORAGE_KEY && e.newValue) {
        try {
          setLoyaltyByKey(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === SCHEDULES_STORAGE_KEY && e.newValue) {
        try {
          setSchedulesByRestaurant(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      } else if (e.key === DINING_HISTORY_STORAGE_KEY && e.newValue) {
        try {
          setDiningHistory(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      unsubStatus();
      unsubWsMsg();
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [applyCartActivity, applyRestaurantOrders, notifyListeners, syncRestaurantMenu]);

  const syncCartAction = useCallback(
    (restaurantId: string, tableNumber: string, items: OrderItem[], dinerName?: string) => {
      if (!restaurantId) return;
      const cleanTable = normalizeTableNumber(tableNumber);
      const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
      const cartTotal = items.reduce((sum, i) => sum + i.itemTotal, 0);
      const activity: LiveTableCartActivity = {
        restaurantId,
        tableNumber: cleanTable,
        dinerName: dinerName || 'Guest',
        items,
        itemCount,
        cartTotal,
        updatedAt: Date.now(),
      };

      applyCartActivity(activity);

      if (channelRef.current) {
        try {
          channelRef.current.postMessage({ type: 'CART_UPDATED', activity });
        } catch {
          // ignore
        }
      }

      realtimeWs.sendCartSync(activity);
    },
    [applyCartActivity]
  );

  const clearTableCart = useCallback(
    (restaurantId: string, tableNumber: string) => {
      syncCartAction(restaurantId, tableNumber, [], 'Guest');
    },
    [syncCartAction]
  );

  const getTableCart = useCallback(
    (restaurantId: string, tableNumber: string): OrderItem[] => {
      if (!restaurantId) return [];
      const key = makeCartKey(restaurantId, tableNumber);
      const entry = activeTableCarts[key];
      if (entry && Array.isArray(entry.items)) {
        return entry.items;
      }
      // Fallback check across slightly differently formatted keys
      const targetNorm = normalizeTableNumber(tableNumber);
      const match = Object.values(activeTableCarts).find(
        (c) => c.restaurantId === restaurantId && normalizeTableNumber(c.tableNumber) === targetNorm
      );
      return match?.items || [];
    },
    [activeTableCarts]
  );

  const emitOrderEvent = useCallback(
    (payload: {
      eventType: 'ORDER_CREATED' | 'ORDER_STATUS_UPDATED';
      restaurantId: string;
      order?: Order;
      orderId?: string;
      status?: OrderStatus;
      orders?: Order[];
      tables?: RestaurantTable[];
    }) => {
      applyRestaurantOrders(
        payload.restaurantId,
        payload.orders,
        payload.order,
        payload.orderId && payload.status
          ? { orderId: payload.orderId, status: payload.status }
          : undefined
      );

      const event: RealtimeSyncEvent = {
        type: 'ORDER_SYNC',
        ...payload,
        timestamp: Date.now(),
      };
      notifyListeners(event);

      if (channelRef.current) {
        try {
          channelRef.current.postMessage(event);
        } catch {
          // ignore
        }
      }

      realtimeWs.sendOrderSync(payload);
    },
    [applyRestaurantOrders, notifyListeners]
  );

  const emitMenuEvent = useCallback(
    (payload: { restaurantId: string; categories: MenuCategory[]; menuItems: MenuItem[] }) => {
      syncRestaurantMenu(payload.restaurantId, payload.categories, payload.menuItems);
      const event: RealtimeSyncEvent = {
        type: 'MENU_UPDATED',
        restaurantId: payload.restaurantId,
        categories: payload.categories,
        menuItems: payload.menuItems,
      };
      notifyListeners(event);
      if (channelRef.current) {
        try {
          channelRef.current.postMessage(event);
        } catch {
          // ignore
        }
      }
    },
    [notifyListeners, syncRestaurantMenu]
  );

  const getCartsForRestaurant = useCallback(
    (restaurantId: string) => {
      return Object.values(activeTableCarts)
        .filter((c) => c.restaurantId === restaurantId && c.itemCount > 0 && c.items.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    [activeTableCarts]
  );

  const getOrdersForRestaurant = useCallback(
    (restaurantId: string): Order[] => {
      const ctxOrders = ordersByRestaurant[restaurantId] || [];
      const dbOrders = restaurantDb.getOrders(restaurantId) || [];
      return mergeRestaurantOrders(dbOrders, ctxOrders);
    },
    [ordersByRestaurant]
  );

  const getOrdersForTable = useCallback(
    (restaurantId: string, tableNumber: string): Order[] => {
      const targetNorm = normalizeTableNumber(tableNumber);
      const merged = getOrdersForRestaurant(restaurantId);
      return merged
        .filter(
          (o) =>
            o.restaurantId === restaurantId &&
            normalizeTableNumber(o.tableNumber) === targetNorm
        )
        .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
    },
    [getOrdersForRestaurant]
  );

  const getMenuForRestaurant = useCallback(
    (restaurantId: string): PersistedRestaurantMenu => {
      const persisted = menuByRestaurant[restaurantId];
      if (persisted && (persisted.menuItems.length > 0 || persisted.categories.length > 0)) {
        return persisted;
      }
      return {
        categories: restaurantDb.getCategories(restaurantId),
        menuItems: restaurantDb.getMenuItems(restaurantId),
        updatedAt: Date.now(),
      };
    },
    [menuByRestaurant]
  );

  const getLowInventoryAlerts = useCallback(
    (restaurantId: string): LowInventoryAlert[] => {
      const explicitAlerts = lowInventoryAlertsByRestaurant[restaurantId] || [];
      const items = getMenuForRestaurant(restaurantId).menuItems;
      return deriveInventoryAlertsFromMenu(restaurantId, items, explicitAlerts);
    },
    [deriveInventoryAlertsFromMenu, getMenuForRestaurant, lowInventoryAlertsByRestaurant]
  );

  const getSoldOutItemIds = useCallback(
    (restaurantId: string): string[] => {
      return getLowInventoryAlerts(restaurantId)
        .filter((a) => a.stockStatus === 'sold_out' || !a.isAvailable)
        .map((a) => a.itemId);
    },
    [getLowInventoryAlerts]
  );

  const isItemSoldOut = useCallback(
    (restaurantId: string, itemId: string): boolean => {
      const alerts = getLowInventoryAlerts(restaurantId);
      const alert = alerts.find((a) => a.itemId === itemId);
      if (alert) return alert.stockStatus === 'sold_out' || !alert.isAvailable;
      const item = getMenuForRestaurant(restaurantId).menuItems.find((m) => m.id === itemId);
      return item ? !item.isAvailable || item.stockStatus === 'sold_out' : false;
    },
    [getLowInventoryAlerts, getMenuForRestaurant]
  );

  const markMenuItemAvailability = useCallback(
    async (payload: {
      restaurantId: string;
      itemId: string;
      isAvailable: boolean;
      stockStatus?: InventoryStockStatus;
      remainingCount?: number;
      updatedBy?: string;
    }) => {
      const { restaurantId, itemId, isAvailable, remainingCount, updatedBy } = payload;
      const nextStockStatus: InventoryStockStatus =
        payload.stockStatus || (isAvailable ? 'in_stock' : 'sold_out');
      const existingItem =
        restaurantDb.getMenuItems(restaurantId).find((i) => i.id === itemId) ||
        getMenuForRestaurant(restaurantId).menuItems.find((i) => i.id === itemId);
      const itemName = existingItem?.name || 'Dish';

      restaurantDb.updateMenuItem(itemId, {
        isAvailable,
        stockStatus: nextStockStatus,
        ...(remainingCount !== undefined ? { remainingCount } : {}),
      });

      const updatedItems = restaurantDb.getMenuItems(restaurantId);
      const categories = restaurantDb.getCategories(restaurantId);
      syncRestaurantMenu(restaurantId, categories, updatedItems);

      setLowInventoryAlertsByRestaurant((prev) => {
        const currentList = (prev[restaurantId] || []).filter((a) => a.itemId !== itemId);
        const nextList =
          nextStockStatus === 'in_stock'
            ? currentList
            : [
                {
                  itemId,
                  restaurantId,
                  itemName,
                  stockStatus: nextStockStatus,
                  isAvailable,
                  remainingCount,
                  updatedAt: Date.now(),
                  updatedBy: updatedBy || 'Kitchen Display',
                },
                ...currentList,
              ];
        const next = { ...prev, [restaurantId]: nextList };
        persistInventoryAlerts(next);
        return next;
      });

      const invEvent: RealtimeSyncEvent = {
        type: 'INVENTORY_UPDATED',
        restaurantId,
        itemId,
        itemName,
        isAvailable,
        stockStatus: nextStockStatus,
        remainingCount,
        updatedBy: updatedBy || 'Kitchen Display',
        timestamp: Date.now(),
      };
      notifyListeners(invEvent);

      if (channelRef.current) {
        try {
          channelRef.current.postMessage(invEvent);
        } catch {
          // ignore
        }
      }

      realtimeWs.sendInventoryUpdate({
        restaurantId,
        itemId,
        itemName,
        isAvailable,
        stockStatus: nextStockStatus,
        remainingCount,
        updatedBy: updatedBy || 'Kitchen Display',
      });

      try {
        await fetch(`/api/workspace/${encodeURIComponent(restaurantId)}/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId,
            isAvailable,
            stockStatus: nextStockStatus,
            remainingCount,
            updatedBy: updatedBy || 'Kitchen Display',
          }),
        });
      } catch {
        // Offline optimistic sync remains active via context & localStorage
      }
    },
    [getMenuForRestaurant, notifyListeners, persistInventoryAlerts, syncRestaurantMenu]
  );

  const getCustomerLoyalty = useCallback(
    (lookup: {
      restaurantId: string;
      phoneNumber?: string;
      customerToken?: string;
      customerName?: string;
      tableNumber?: string;
    }): CustomerLoyaltyProfile => {
      const restId = lookup.restaurantId || 'demo-restaurant';
      const primaryKey = buildLoyaltyKey(lookup);
      const normPhone = normalizePhoneDigits(lookup.phoneNumber);
      const normTable = normalizeTableNumber(lookup.tableNumber || '01');

      const allForRest = Object.values(loyaltyByKey).filter(
        (p) => p && p.restaurantId === restId
      );

      const directMatch = loyaltyByKey[primaryKey];
      const tokenMatch = lookup.customerToken
        ? allForRest.find((p) => p.customerToken && p.customerToken === lookup.customerToken)
        : undefined;
      const phoneMatch =
        normPhone.length >= 10
          ? allForRest.find((p) => normalizePhoneDigits(p.phoneNumber) === normPhone)
          : undefined;

      // Also gather any table-scoped profile if the diner hasn't registered a phone yet
      const tableKey = `${restId}:table:${normTable}`;
      const tableMatch = loyaltyByKey[tableKey];

      const matchedProfiles = [directMatch, phoneMatch, tokenMatch, tableMatch].filter(
        (p, idx, arr): p is CustomerLoyaltyProfile =>
          Boolean(p) && arr.findIndex((x) => x?.customerKey === p?.customerKey) === idx
      );

      if (matchedProfiles.length === 0) {
        return {
          customerKey: primaryKey,
          restaurantId: restId,
          name: lookup.customerName || 'Guest',
          phoneNumber: lookup.phoneNumber || undefined,
          customerToken: lookup.customerToken || undefined,
          pointsBalance: 0,
          lifetimeEarnedPoints: 0,
          lifetimeRedeemedPoints: 0,
          totalOrdersCount: 0,
          tier: 'Bronze',
          transactions: [],
        };
      }

      // Deduplicate transactions across matched identities by orderId
      const txMap = new Map<string, LoyaltyPointTransaction>();
      matchedProfiles.forEach((prof) => {
        (prof.transactions || []).forEach((t) => {
          const dedupKey = t.orderId ? `${t.type}:${t.orderId}` : t.id;
          if (!txMap.has(dedupKey)) txMap.set(dedupKey, t);
        });
      });

      const mergedTransactions = Array.from(txMap.values()).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      const earned = mergedTransactions
        .filter((t) => t.type === 'earn')
        .reduce((s, t) => s + (t.points || 0), 0);
      const redeemed = mergedTransactions
        .filter((t) => t.type === 'redeem')
        .reduce((s, t) => s + (t.points || 0), 0);
      const balance = Math.max(0, earned - redeemed);
      const primaryProfile = matchedProfiles[0];

      return {
        customerKey: primaryProfile.customerKey,
        restaurantId: restId,
        name: lookup.customerName || primaryProfile.name || 'Guest',
        phoneNumber: lookup.phoneNumber || primaryProfile.phoneNumber,
        customerToken: lookup.customerToken || primaryProfile.customerToken,
        pointsBalance: balance,
        lifetimeEarnedPoints: earned,
        lifetimeRedeemedPoints: redeemed,
        totalOrdersCount: mergedTransactions.filter((t) => t.type === 'earn').length,
        tier: resolveLoyaltyTier(earned),
        lastEarnedAt: mergedTransactions[0]?.timestamp,
        transactions: mergedTransactions,
      };
    },
    [loyaltyByKey]
  );

  const awardLoyaltyPointsForOrder = useCallback(
    (payload: {
      restaurantId: string;
      order: {
        id: string;
        orderNumber: string;
        grandTotal: number;
        tableNumber?: string;
        dinerName?: string;
        placedAt?: number;
      };
      customerName?: string;
      phoneNumber?: string;
      customerToken?: string;
    }) => {
      const { restaurantId, order, customerName, phoneNumber, customerToken } = payload;
      const customerKey = buildLoyaltyKey({
        restaurantId,
        phoneNumber,
        customerToken,
        tableNumber: order.tableNumber,
        customerName: customerName || order.dinerName,
      });

      const pointsEarned = calculateLoyaltyPointsForAmount(order.grandTotal);
      let awarded = 0;

      const existingProfile =
        loyaltyByKey[customerKey] ||
        getCustomerLoyalty({
          restaurantId,
          phoneNumber,
          customerToken,
          customerName: customerName || order.dinerName,
          tableNumber: order.tableNumber,
        });

      const alreadyAwarded = existingProfile.transactions.some(
        (t) => t.type === 'earn' && t.orderId === order.id
      );

      let nextProfile: CustomerLoyaltyProfile = existingProfile;

      if (!alreadyAwarded && pointsEarned > 0) {
        awarded = pointsEarned;
        const newTx: LoyaltyPointTransaction = {
          id: `loy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          restaurantId,
          customerKey,
          orderId: order.id,
          orderNumber: order.orderNumber,
          dinerName: customerName || order.dinerName || existingProfile.name || 'Guest',
          phoneNumber: phoneNumber || existingProfile.phoneNumber,
          type: 'earn',
          points: pointsEarned,
          orderTotal: order.grandTotal,
          description: `Earned on Order ${order.orderNumber} (₹${Math.round(order.grandTotal)})`,
          timestamp: order.placedAt || Date.now(),
        };

        const nextTransactions = [newTx, ...existingProfile.transactions];
        const nextLifetime = existingProfile.lifetimeEarnedPoints + pointsEarned;
        const nextBalance = Math.max(0, existingProfile.pointsBalance + pointsEarned);

        nextProfile = {
          customerKey,
          restaurantId,
          name: customerName || order.dinerName || existingProfile.name || 'Guest',
          phoneNumber: phoneNumber || existingProfile.phoneNumber,
          customerToken: customerToken || existingProfile.customerToken,
          pointsBalance: nextBalance,
          lifetimeEarnedPoints: nextLifetime,
          lifetimeRedeemedPoints: existingProfile.lifetimeRedeemedPoints,
          totalOrdersCount: nextTransactions.filter((t) => t.type === 'earn').length,
          tier: resolveLoyaltyTier(nextLifetime),
          lastEarnedAt: newTx.timestamp,
          transactions: nextTransactions,
        };

        setLoyaltyByKey((prev) => {
          const updated = { ...prev, [customerKey]: nextProfile };
          persistLoyalty(updated);
          return updated;
        });

        const loyEvent: RealtimeSyncEvent = {
          type: 'LOYALTY_UPDATED',
          restaurantId,
          customerKey,
          profile: nextProfile,
          timestamp: Date.now(),
        };
        notifyListeners(loyEvent);
        if (channelRef.current) {
          try {
            channelRef.current.postMessage(loyEvent);
          } catch {
            // ignore
          }
        }
      }

      return { pointsAwarded: awarded, profile: nextProfile };
    },
    [getCustomerLoyalty, loyaltyByKey, notifyListeners, persistLoyalty]
  );

  const initiateUpiGatewayPayment = useCallback(
    async (payload: {
      restaurantId: string;
      orderId: string;
      orderNumber?: string;
      tableNumber: string;
      amount: number;
      customerName?: string;
      customerPhone?: string;
      payeeNameOverride?: string;
      vpaOverride?: string;
    }): Promise<UpiGatewayInitResult> => {
      const cleanTable = normalizeTableNumber(payload.tableNumber);
      const effectiveAmount = Math.max(1, Math.round(Number(payload.amount) || 0));
      let transactionId = `tx_sim_${Date.now()}`;
      let gatewayOrderId = `order_gw_sim_${Date.now()}`;
      let vpa =
        payload.vpaOverride ||
        `${payload.restaurantId.replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`;
      let payeeName = payload.payeeNameOverride || 'Ur.Dear.Menu Restaurant';

      try {
        const res = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: payload.restaurantId,
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            dinerTable: cleanTable,
            tableNumber: cleanTable,
            amount: effectiveAmount,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
          }),
        });
        const data = await res.json();
        if (data?.success) {
          transactionId = data.paymentOrder?.id || data.transactionId || transactionId;
          gatewayOrderId =
            data.paymentOrder?.gatewayOrderId || data.gatewayOrderId || gatewayOrderId;
          vpa =
            payload.vpaOverride ||
            data.paymentOrder?.restaurantUpiId ||
            data.restaurantUpiId ||
            vpa;
          payeeName =
            payload.payeeNameOverride ||
            data.paymentOrder?.restaurantName ||
            data.restaurantName ||
            payeeName;
        }
      } catch {
        // Offline / simulated fallback preserves local dynamic QR generation
      }

      const baseUri = generateUpiUri({
        payeeVpa: vpa,
        payeeName,
        amount: effectiveAmount,
        transactionNote: `Table ${cleanTable} ${payload.orderNumber || ''} Ref ${gatewayOrderId}`.trim(),
      });
      const upiUri = `${baseUri}&tr=${encodeURIComponent(gatewayOrderId)}`;
      const qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#18181B',
          light: '#FFFFFF',
        },
      });

      return {
        transactionId,
        gatewayOrderId,
        vpa,
        payeeName,
        upiUri,
        qrDataUrl,
        amount: effectiveAmount,
      };
    },
    []
  );

  const confirmUpiGatewayPayment = useCallback(
    async (payload: {
      restaurantId: string;
      orderId: string;
      paymentTransactionId?: string;
      amount?: number;
      eligibleSubtotal?: number;
      tip?: number;
      serviceCharge?: number;
      grandTotal?: number;
      upiRef?: string;
    }): Promise<{ success: boolean; settledRef: string; order?: Order }> => {
      let settledRef = payload.upiRef || `UPI-${Date.now().toString().slice(-6)}`;
      let serverOrder: Order | undefined;

      try {
        if (payload.paymentTransactionId && !payload.paymentTransactionId.startsWith('tx_sim_')) {
          const res = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId: payload.restaurantId,
              orderId: payload.orderId,
              paymentTransactionId: payload.paymentTransactionId,
              gatewayPaymentId: payload.upiRef || `pay_upi_${Date.now()}`,
              gatewaySignature: 'sig_valid',
              amount: payload.amount,
              eligibleSubtotal: payload.eligibleSubtotal,
              tip: payload.tip,
              serviceCharge: payload.serviceCharge,
              grandTotal: payload.grandTotal,
              paymentMethod: 'upi',
            }),
          });
          const data = await res.json();
          if (data?.success) {
            settledRef = data.transaction?.gatewayTransactionId || settledRef;
            serverOrder = data.order || undefined;
          }
        } else {
          // Ensure order payment status persists on server even for simulated fallback
          const putRes = await fetch(
            `/api/workspace/${encodeURIComponent(payload.restaurantId)}/orders/${encodeURIComponent(
              payload.orderId
            )}/payment`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentStatus: 'paid',
                paymentMethod: 'upi',
                ...(payload.tip !== undefined ? { tip: payload.tip } : {}),
                ...(payload.serviceCharge !== undefined
                  ? { serviceCharge: payload.serviceCharge }
                  : {}),
                ...(payload.grandTotal !== undefined ? { grandTotal: payload.grandTotal } : {}),
              }),
            }
          );
          const putData = await putRes.json().catch(() => null);
          if (putData?.order) serverOrder = putData.order;
        }
      } catch {
        // Local optimistic persistence continues seamlessly
      }

      const updatedOrders = restaurantDb.updateOrderPayment(payload.orderId, 'paid', 'upi', {
        restaurantId: payload.restaurantId,
        tip: payload.tip,
        grandTotal: payload.grandTotal,
      });
      const updatedOrder =
        serverOrder || updatedOrders.find((o) => o.id === payload.orderId);
      if (updatedOrder?.tableNumber) {
        restaurantDb.resolveWaiterRequestsForTable(
          updatedOrder.tableNumber,
          payload.restaurantId,
          'bill_upi'
        );
      }

      emitOrderEvent({
        eventType: 'ORDER_STATUS_UPDATED',
        restaurantId: payload.restaurantId,
        orderId: payload.orderId,
        status: updatedOrder?.status || 'received',
        order: updatedOrder,
        orders: updatedOrders,
        tables: restaurantDb.getTables(payload.restaurantId),
      });

      return {
        success: true,
        settledRef,
        order: updatedOrder,
      };
    },
    [emitOrderEvent]
  );

  const getStaffSchedules = useCallback(
    (restaurantId: string): StaffScheduleAssignment[] => {
      if (!restaurantId) return [];
      return (schedulesByRestaurant[restaurantId] || []).sort((a, b) =>
        a.staffName.localeCompare(b.staffName)
      );
    },
    [schedulesByRestaurant]
  );

  const broadcastScheduleUpdate = useCallback(
    (restaurantId: string, updatedList: StaffScheduleAssignment[]) => {
      const event: RealtimeSyncEvent = {
        type: 'STAFF_SCHEDULE_UPDATED',
        restaurantId,
        schedules: updatedList,
        timestamp: Date.now(),
      };
      notifyListeners(event);
      if (channelRef.current) {
        try {
          channelRef.current.postMessage(event);
        } catch {
          // ignore
        }
      }
    },
    [notifyListeners]
  );

  const upsertStaffSchedule = useCallback(
    (
      restaurantId: string,
      payload: {
        staffId: string;
        staffName: string;
        username?: string;
        role?: 'waiter' | 'manager' | 'kitchen' | 'owner';
        assignedZones: string[];
        shiftStart: string;
        shiftEnd: string;
        dutyStatus: WaiterShiftStatus;
        breaks: WaiterBreakWindow[];
        notes?: string;
      }
    ): StaffScheduleAssignment => {
      const existingList = schedulesByRestaurant[restaurantId] || [];
      const existing = existingList.find((s) => s.staffId === payload.staffId);
      const record: StaffScheduleAssignment = {
        id: existing?.id || `sched-${payload.staffId}-${Date.now()}`,
        restaurantId,
        staffId: payload.staffId,
        staffName: payload.staffName.trim(),
        username: payload.username,
        role: payload.role || existing?.role || 'waiter',
        assignedZones: Array.from(new Set(payload.assignedZones.filter(Boolean))),
        shiftStart: payload.shiftStart || '11:00',
        shiftEnd: payload.shiftEnd || '23:00',
        dutyStatus: payload.dutyStatus,
        breaks: payload.breaks || [],
        notes: payload.notes?.trim() || undefined,
        updatedAt: Date.now(),
      };
      const updatedList = existing
        ? existingList.map((s) => (s.staffId === payload.staffId ? record : s))
        : [...existingList, record];

      setSchedulesByRestaurant((prev) => {
        const next = { ...prev, [restaurantId]: updatedList };
        persistSchedules(next);
        return next;
      });
      broadcastScheduleUpdate(restaurantId, updatedList);
      return record;
    },
    [schedulesByRestaurant, persistSchedules, broadcastScheduleUpdate]
  );

  const deleteStaffSchedule = useCallback(
    (restaurantId: string, staffId: string) => {
      const existingList = schedulesByRestaurant[restaurantId] || [];
      const updatedList = existingList.filter((s) => s.staffId !== staffId);
      setSchedulesByRestaurant((prev) => {
        const next = { ...prev, [restaurantId]: updatedList };
        persistSchedules(next);
        return next;
      });
      broadcastScheduleUpdate(restaurantId, updatedList);
    },
    [schedulesByRestaurant, persistSchedules, broadcastScheduleUpdate]
  );

  const setWaiterDutyStatus = useCallback(
    (restaurantId: string, staffId: string, dutyStatus: WaiterShiftStatus) => {
      const existingList = schedulesByRestaurant[restaurantId] || [];
      const updatedList = existingList.map((s) =>
        s.staffId === staffId ? { ...s, dutyStatus, updatedAt: Date.now() } : s
      );
      setSchedulesByRestaurant((prev) => {
        const next = { ...prev, [restaurantId]: updatedList };
        persistSchedules(next);
        return next;
      });
      broadcastScheduleUpdate(restaurantId, updatedList);
    },
    [schedulesByRestaurant, persistSchedules, broadcastScheduleUpdate]
  );

  const toggleBreakWindowStatus = useCallback(
    (
      restaurantId: string,
      staffId: string,
      breakId: string,
      nextStatus?: 'scheduled' | 'active' | 'completed'
    ) => {
      const existingList = schedulesByRestaurant[restaurantId] || [];
      const updatedList = existingList.map((s) => {
        if (s.staffId !== staffId) return s;
        const updatedBreaks = s.breaks.map((brk) => {
          if (brk.id !== breakId) return brk;
          const resolvedStatus =
            nextStatus ||
            (brk.status === 'scheduled'
              ? 'active'
              : brk.status === 'active'
              ? 'completed'
              : 'scheduled');
          return { ...brk, status: resolvedStatus };
        });
        const hasActiveBreak = updatedBreaks.some((b) => b.status === 'active');
        const nextDuty: WaiterShiftStatus = hasActiveBreak
          ? 'on_break'
          : s.dutyStatus === 'on_break'
          ? 'on_duty'
          : s.dutyStatus;
        return {
          ...s,
          breaks: updatedBreaks,
          dutyStatus: nextDuty,
          updatedAt: Date.now(),
        };
      });

      setSchedulesByRestaurant((prev) => {
        const next = { ...prev, [restaurantId]: updatedList };
        persistSchedules(next);
        return next;
      });
      broadcastScheduleUpdate(restaurantId, updatedList);
    },
    [schedulesByRestaurant, persistSchedules, broadcastScheduleUpdate]
  );

  const recordGuestDiningReceipt = useCallback(
    (payload: Partial<GuestDiningReceipt> & { orderId: string; restaurantId: string }) => {
      if (!payload.orderId || !payload.restaurantId) return;
      if (payload.orderId === 'ord-past-01' || payload.orderId === 'ord-sample-1') return;

      setDiningHistory((prev) => {
        const existing = prev.find((r) => r.orderId === payload.orderId);
        const subtotal = Number(payload.subtotal ?? existing?.subtotal ?? 0);
        const cgst = Number(payload.cgst ?? existing?.cgst ?? Math.round(subtotal * 0.025 * 100) / 100);
        const sgst = Number(payload.sgst ?? existing?.sgst ?? Math.round(subtotal * 0.025 * 100) / 100);
        const serviceCharge = Number(payload.serviceCharge ?? existing?.serviceCharge ?? 0);
        const tip = Number(payload.tip ?? existing?.tip ?? 0);
        const grandTotal = Number(
          payload.grandTotal ?? existing?.grandTotal ?? Math.round(subtotal + cgst + sgst + serviceCharge + tip)
        );

        const nextReceipt: GuestDiningReceipt = {
          id: existing?.id || `rcpt-${payload.orderId}`,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber || existing?.orderNumber || `#${payload.orderId.slice(-4)}`,
          restaurantId: payload.restaurantId,
          restaurantName: payload.restaurantName || existing?.restaurantName,
          tableNumber: normalizeTableNumber(payload.tableNumber || existing?.tableNumber || '01'),
          dinerName: payload.dinerName || existing?.dinerName || 'Guest',
          phoneNumber: payload.phoneNumber || existing?.phoneNumber,
          customerToken: payload.customerToken || existing?.customerToken,
          items:
            Array.isArray(payload.items) && payload.items.length > 0
              ? payload.items
              : existing?.items || [],
          subtotal,
          cgst,
          sgst,
          serviceCharge,
          tip,
          grandTotal,
          paymentStatus: payload.paymentStatus || existing?.paymentStatus || 'pending',
          paymentMethod: payload.paymentMethod || existing?.paymentMethod,
          upiReference: payload.upiReference || existing?.upiReference,
          placedAt: payload.placedAt || existing?.placedAt || Date.now(),
          paidAt: payload.paidAt || existing?.paidAt,
          status: payload.status || existing?.status || 'received',
        };

        const filtered = prev.filter((r) => r.orderId !== payload.orderId);
        const nextList = [nextReceipt, ...filtered].sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
        persistDiningHistory(nextList);
        return nextList;
      });
    },
    [persistDiningHistory]
  );

  const getGuestDiningHistory = useCallback(
    (lookup: {
      restaurantId: string;
      phoneNumber?: string;
      customerToken?: string;
      customerName?: string;
      tableNumber?: string;
    }): GuestDiningReceipt[] => {
      const restId = lookup.restaurantId || 'demo-restaurant';
      const normPhone = normalizePhoneDigits(lookup.phoneNumber);
      const normTable = normalizeTableNumber(lookup.tableNumber || '01');
      const cleanName = String(lookup.customerName || '').trim().toLowerCase();

      const byOrderId = new Map<string, GuestDiningReceipt>();

      // 1. Persisted personal guest dining receipts in localStorage
      diningHistory.forEach((rec) => {
        if (!rec || rec.restaurantId !== restId) return;
        if (rec.orderId === 'ord-past-01' || rec.orderId === 'ord-sample-1') return;
        byOrderId.set(rec.orderId, rec);
      });

      // 2. Merge matching live/persisted restaurant orders for this guest/table so existing orders are reflected too
      const restOrders = getOrdersForRestaurant(restId);
      restOrders.forEach((ord) => {
        if (!ord || ord.id === 'ord-past-01' || ord.id === 'ord-sample-1') return;
        const ordTable = normalizeTableNumber(ord.tableNumber);
        const ordName = String(ord.dinerName || '').trim().toLowerCase();
        const matchesTable = ordTable === normTable;
        const matchesName =
          Boolean(cleanName) &&
          cleanName !== 'guest' &&
          cleanName !== 'table guest' &&
          ordName === cleanName;

        const existing = byOrderId.get(ord.id);
        if (existing) {
          // Keep live status / payment updates synchronized on stored receipt
          byOrderId.set(ord.id, {
            ...existing,
            status: ord.status || existing.status,
            paymentStatus: ord.paymentStatus || existing.paymentStatus,
            paymentMethod: ord.paymentMethod || existing.paymentMethod,
            upiReference: ord.upiReference || existing.upiReference,
            tip: ord.tip !== undefined ? ord.tip : existing.tip,
            serviceCharge: ord.serviceCharge !== undefined ? ord.serviceCharge : existing.serviceCharge,
            grandTotal: ord.grandTotal || existing.grandTotal,
            paidAt: ord.paidAt || existing.paidAt,
          });
        } else if (matchesTable || matchesName) {
          const subtotal = Number(ord.subtotal || 0);
          byOrderId.set(ord.id, {
            id: `rcpt-${ord.id}`,
            orderId: ord.id,
            orderNumber: ord.orderNumber || `#${ord.id.slice(-4)}`,
            restaurantId: ord.restaurantId,
            tableNumber: ordTable,
            dinerName: ord.dinerName || 'Guest',
            items: Array.isArray(ord.items) ? ord.items : [],
            subtotal,
            cgst: ord.cgst !== undefined ? Number(ord.cgst) : Math.round(subtotal * 0.025 * 100) / 100,
            sgst: ord.sgst !== undefined ? Number(ord.sgst) : Math.round(subtotal * 0.025 * 100) / 100,
            serviceCharge: Number(ord.serviceCharge || 0),
            tip: Number(ord.tip || 0),
            grandTotal: Number(ord.grandTotal || 0),
            paymentStatus: ord.paymentStatus,
            paymentMethod: ord.paymentMethod,
            upiReference: ord.upiReference,
            placedAt: ord.placedAt || Date.now(),
            paidAt: ord.paidAt,
            status: ord.status,
          });
        }
      });

      return Array.from(byOrderId.values())
        .filter((rec) => {
          // When saved directly via guest dining history or matching phone/token/name/table
          const recInLocal = diningHistory.some((d) => d.orderId === rec.orderId);
          if (recInLocal) return true;
          if (normPhone.length >= 10 && normalizePhoneDigits(rec.phoneNumber) === normPhone) return true;
          if (lookup.customerToken && rec.customerToken === lookup.customerToken) return true;
          if (cleanName && cleanName !== 'guest' && rec.dinerName.trim().toLowerCase() === cleanName) return true;
          return normalizeTableNumber(rec.tableNumber) === normTable;
        })
        .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
    },
    [diningHistory, getOrdersForRestaurant]
  );

  const subscribeEvents = useCallback((callback: (event: RealtimeSyncEvent) => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  return (
    <RealtimeSyncContext.Provider
      value={{
        connectionStatus,
        activeTableCarts,
        ordersByRestaurant,
        menuByRestaurant,
        lowInventoryAlertsByRestaurant,
        loyaltyByKey,
        schedulesByRestaurant,
        lastEventAt,
        getCartsForRestaurant,
        getTableCart,
        getOrdersForTable,
        getOrdersForRestaurant,
        getMenuForRestaurant,
        getLowInventoryAlerts,
        getSoldOutItemIds,
        isItemSoldOut,
        getCustomerLoyalty,
        awardLoyaltyPointsForOrder,
        markMenuItemAvailability,
        syncRestaurantOrders,
        syncRestaurantMenu,
        syncCartAction,
        clearTableCart,
        emitOrderEvent,
        emitMenuEvent,
        initiateUpiGatewayPayment,
        confirmUpiGatewayPayment,
        getStaffSchedules,
        upsertStaffSchedule,
        deleteStaffSchedule,
        setWaiterDutyStatus,
        toggleBreakWindowStatus,
        recordGuestDiningReceipt,
        getGuestDiningHistory,
        subscribeEvents,
      }}
    >
      {children}
    </RealtimeSyncContext.Provider>
  );
};

export function useRealtimeSync() {
  const ctx = useContext(RealtimeSyncContext);
  if (!ctx) {
    throw new Error('useRealtimeSync must be used inside a RealtimeSyncProvider');
  }
  return ctx;
}

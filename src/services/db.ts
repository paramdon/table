import {
  RestaurantTenant,
  RestaurantTable,
  MenuCategory,
  MenuItem,
  Order,
  WaiterRequest,
  StaffMember,
  OrderStatus,
  TableStatus,
  OrderItem,
  DifficultyLevel,
} from '../types/dcc';
import {
  DEMO_RESTAURANT,
  INITIAL_TABLES,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_SAMPLE_ORDERS,
  INITIAL_WAITER_REQUESTS,
  INITIAL_STAFF,
} from '../store/restaurantStore';

const DB_NAME = 'UrDearMenu_IndexedDB_v3';
const DB_VERSION = 1;
const STORAGE_BACKUP_KEY = 'urdearmenu_persistent_db_v3';
const SYNC_CHANNEL_NAME = 'urdearmenu_realtime_bus';

export interface DatabaseSchema {
  restaurant: RestaurantTenant;
  tables: RestaurantTable[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  orders: Order[];
  waiterRequests: WaiterRequest[];
  staff: StaffMember[];
}

export type DbEvent =
  | { type: 'ORDER_CREATED'; order: Order }
  | { type: 'ORDER_STATUS_UPDATED'; orderId: string; status: OrderStatus; orders: Order[]; tables: RestaurantTable[] }
  | { type: 'WAITER_REQUEST_CREATED'; request: WaiterRequest }
  | { type: 'WAITER_REQUEST_UPDATED'; requestId: string; status: string; requests: WaiterRequest[] }
  | { type: 'TABLES_UPDATED'; tables: RestaurantTable[] }
  | { type: 'MENU_UPDATED'; menuItems: MenuItem[]; categories: MenuCategory[] }
  | { type: 'RESTAURANT_UPDATED'; restaurant: RestaurantTenant };

class CentralizedRestaurantDatabase {
  private channel: BroadcastChannel | null = null;
  private subscribers: ((event: DbEvent) => void)[] = [];
  private idb: IDBDatabase | null = null;
  private cache: DatabaseSchema;
  private isInitialized = false;
  private hasExplicitRestaurant = false;
  private knownRestaurants: Record<string, RestaurantTenant> = {};
  private serverHydratedRestaurants = new Set<string>();
  private pendingSyncIds = new Set<string>();

  constructor() {
    this.loadPendingSyncIds();
    this.cache = this.loadInitialCache();
    if (this.cache.restaurant?.id) {
      this.knownRestaurants[this.cache.restaurant.id] = this.cache.restaurant;
    }
    this.initIndexedDb();
    this.initSyncChannels();
  }

  private loadPendingSyncIds() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('urdearmenu_pending_sync_ids_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.pendingSyncIds = new Set(arr.filter((x) => typeof x === 'string'));
        }
      }
    } catch {
      // ignore
    }
  }

  private savePendingSyncIds() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('urdearmenu_pending_sync_ids_v1', JSON.stringify(Array.from(this.pendingSyncIds)));
    } catch {
      // ignore
    }
  }

  private markPendingSync(id: string) {
    this.pendingSyncIds.add(id);
    this.savePendingSyncIds();
  }

  private clearPendingSync(id: string) {
    if (this.pendingSyncIds.delete(id)) {
      this.savePendingSyncIds();
    }
  }

  private getInitialData(): DatabaseSchema {
    return {
      restaurant: {
        id: 'demo-restaurant',
        name: 'Ur.Dear.Menu Restaurant',
        hindiName: 'रेस्तरां',
        slug: 'demo-restaurant',
        tagline: 'Modern Dine-in & Digital QR Menu',
        phone: '+91 98000 00000',
        gstin: '',
        fssaiLic: '',
        address: 'New Delhi, India',
        currency: 'INR',
        wifiSsid: 'Guest_WiFi',
        wifiPassword: 'eatfreshbutter',
        logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80',
        serviceChargePercent: 5,
        gstPercent: 5,
        status: 'active',
        plan: 'flex',
      },
      tables: [],
      categories: [],
      menuItems: [],
      orders: [],
      waiterRequests: [],
      staff: [],
    };
  }

  private loadInitialCache(): DatabaseSchema {
    if (typeof window === 'undefined') return this.getInitialData();
    try {
      const raw = localStorage.getItem(STORAGE_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // If local storage has old fake demo data, purge it to adhere to zero fake data requirement
        const hasFakeData =
          (parsed.orders && parsed.orders.length > 0 && parsed.orders.some((o: any) => o.id === 'ord-past-01' || o.id === 'ord-sample-1')) ||
          (parsed.tables && parsed.tables.some((t: any) => t.id === 'tbl-1' && t.restaurantId === 'rest-saffron-01'));

        if (!hasFakeData && parsed.restaurant) {
          parsed.tables = parsed.tables || [];
          parsed.categories = parsed.categories || [];
          parsed.menuItems = parsed.menuItems || [];
          parsed.orders = parsed.orders || [];
          parsed.waiterRequests = parsed.waiterRequests || [];
          parsed.staff = parsed.staff || [];
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read initial backup', e);
    }
    const initial = this.getInitialData();
    try {
      localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(initial));
    } catch (e) {
      // ignore
    }
    return initial;
  }

  private initIndexedDb() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('restaurant')) {
          db.createObjectStore('restaurant', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('restaurantId', 'restaurantId', { unique: false });
        }
        if (!db.objectStoreNames.contains('menu_items')) {
          const itemStore = db.createObjectStore('menu_items', { keyPath: 'id' });
          itemStore.createIndex('restaurantId', 'restaurantId', { unique: false });
          itemStore.createIndex('categoryId', 'categoryId', { unique: false });
        }
        if (!db.objectStoreNames.contains('tables')) {
          const tableStore = db.createObjectStore('tables', { keyPath: 'id' });
          tableStore.createIndex('restaurantId', 'restaurantId', { unique: false });
        }
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('restaurantId', 'restaurantId', { unique: false });
        }
        if (!db.objectStoreNames.contains('waiter_requests')) {
          const wrStore = db.createObjectStore('waiter_requests', { keyPath: 'id' });
          wrStore.createIndex('restaurantId', 'restaurantId', { unique: false });
        }
        if (!db.objectStoreNames.contains('staff')) {
          const staffStore = db.createObjectStore('staff', { keyPath: 'id' });
          staffStore.createIndex('restaurantId', 'restaurantId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.idb = (event.target as IDBOpenDBRequest).result;
        this.hydrateFromIndexedDb();
      };

      request.onerror = (e) => {
        console.warn('IndexedDB open error, falling back to persistent storage', e);
      };
    } catch (err) {
      console.warn('IndexedDB not available', err);
    }
  }

  private hydrateFromIndexedDb() {
    if (!this.idb) return;
    try {
      const tx = this.idb.transaction(
        ['restaurant', 'categories', 'menu_items', 'tables', 'orders', 'waiter_requests'],
        'readonly'
      );

      const restReq = tx.objectStore('restaurant').getAll();
      const catReq = tx.objectStore('categories').getAll();
      const itemReq = tx.objectStore('menu_items').getAll();
      const tableReq = tx.objectStore('tables').getAll();
      const orderReq = tx.objectStore('orders').getAll();
      const wrReq = tx.objectStore('waiter_requests').getAll();

      tx.oncomplete = () => {
        let addedMissingData = false;
        const mergeMissingById = <T extends { id: string; restaurantId?: string }>(
          current: T[],
          idbRows: T[]
        ): T[] => {
          if (!Array.isArray(idbRows) || idbRows.length === 0) return current;
          const existingIds = new Set(current.map((item) => item.id));
          const missing = idbRows.filter(
            (row) =>
              row &&
              row.id &&
              !existingIds.has(row.id) &&
              (!row.restaurantId || !this.serverHydratedRestaurants.has(row.restaurantId))
          );
          if (missing.length > 0) {
            addedMissingData = true;
            return [...current, ...missing];
          }
          return current;
        };

        if (catReq.result && catReq.result.length > 0) {
          this.cache.categories = mergeMissingById(this.cache.categories, catReq.result).sort(
            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
          );
        }
        if (itemReq.result && itemReq.result.length > 0) {
          this.cache.menuItems = mergeMissingById(this.cache.menuItems, itemReq.result);
        }
        if (tableReq.result && tableReq.result.length > 0) {
          this.cache.tables = mergeMissingById(this.cache.tables, tableReq.result);
        }
        if (restReq.result && restReq.result.length > 0) {
          restReq.result.forEach((r: RestaurantTenant) => {
            if (r?.id && !this.knownRestaurants[r.id]) {
              this.knownRestaurants[r.id] = r;
            }
          });
          if (!this.hasExplicitRestaurant && this.cache.restaurant.id === 'demo-restaurant') {
            this.cache.restaurant = restReq.result[0];
            addedMissingData = true;
          }
        }
        if (orderReq.result && orderReq.result.length > 0) {
          this.cache.orders = mergeMissingById(this.cache.orders, orderReq.result);
        }
        if (wrReq.result && wrReq.result.length > 0) {
          this.cache.waiterRequests = mergeMissingById(this.cache.waiterRequests, wrReq.result);
        }

        if (addedMissingData) {
          this.isInitialized = true;
          this.persistBackup();
          this.broadcast({
            type: 'MENU_UPDATED',
            menuItems: this.cache.menuItems,
            categories: this.cache.categories,
          });
        } else if (!this.isInitialized) {
          this.isInitialized = true;
          this.saveAllToIndexedDb(this.cache);
        }
      };
    } catch (e) {
      console.warn('Error hydrating from IndexedDB', e);
    }
  }

  private saveAllToIndexedDb(db: DatabaseSchema) {
    if (!this.idb) return;
    try {
      const tx = this.idb.transaction(
        ['restaurant', 'categories', 'menu_items', 'tables', 'orders', 'waiter_requests'],
        'readwrite'
      );

      const restStore = tx.objectStore('restaurant');
      restStore.clear();
      restStore.put(db.restaurant);

      const catStore = tx.objectStore('categories');
      catStore.clear();
      db.categories.forEach((c) => catStore.put(c));

      const itemStore = tx.objectStore('menu_items');
      itemStore.clear();
      db.menuItems.forEach((i) => itemStore.put(i));

      const tableStore = tx.objectStore('tables');
      tableStore.clear();
      db.tables.forEach((t) => tableStore.put(t));

      const orderStore = tx.objectStore('orders');
      orderStore.clear();
      db.orders.forEach((o) => orderStore.put(o));

      const wrStore = tx.objectStore('waiter_requests');
      wrStore.clear();
      db.waiterRequests.forEach((w) => wrStore.put(w));
    } catch (e) {
      console.warn('Failed writing to IndexedDB', e);
    }
  }

  private initSyncChannels() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notifySubscribers(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel error', err);
      }

      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_BACKUP_KEY && e.newValue) {
          try {
            const data: DatabaseSchema = JSON.parse(e.newValue);
            this.cache = data;
            this.notifySubscribers({
              type: 'MENU_UPDATED',
              menuItems: data.menuItems,
              categories: data.categories,
            });
            this.notifySubscribers({
              type: 'ORDER_STATUS_UPDATED',
              orderId: '',
              status: 'received',
              orders: data.orders,
              tables: data.tables,
            });
          } catch (err) {
            // ignore
          }
        }
      });
    }
  }

  private persistBackup() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(this.cache));
      } catch (err) {
        // quota
      }
    }
    this.saveAllToIndexedDb(this.cache);
  }

  private broadcast(event: DbEvent) {
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {
        // channel error
      }
    }
    this.notifySubscribers(event);
  }

  private notifySubscribers(event: DbEvent) {
    this.subscribers.forEach((sub) => {
      try {
        sub(event);
      } catch (err) {
        console.error('Subscriber error', err);
      }
    });
  }

  public subscribe(callback: (event: DbEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private async postJson(
    url: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: any,
    ackId?: string
  ): Promise<boolean> {
    if (typeof fetch === 'undefined') return false;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        keepalive: true,
      });
      if (res.ok) {
        if (ackId) this.clearPendingSync(ackId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ==================== RESTAURANT API ====================
  public getRestaurant(slugOrId?: string): RestaurantTenant {
    if (slugOrId) {
      const clean = slugOrId.trim().toLowerCase();
      const all = [this.cache.restaurant, ...Object.values(this.knownRestaurants)];
      const match = all.find(
        (r) =>
          r &&
          (r.id === slugOrId ||
            r.slug === slugOrId ||
            (r.slug && r.slug.toLowerCase() === clean) ||
            (r.name && r.name.toLowerCase() === clean))
      );
      if (match) return match;
    }
    return this.cache.restaurant;
  }

  public setActiveRestaurant(restaurant: RestaurantTenant): RestaurantTenant {
    if (!restaurant || !restaurant.id) return this.cache.restaurant;
    this.hasExplicitRestaurant = true;
    this.knownRestaurants[restaurant.id] = restaurant;
    this.cache.restaurant = restaurant;
    this.persistBackup();
    this.notifySubscribers({ type: 'RESTAURANT_UPDATED', restaurant });
    return restaurant;
  }

  public hydrateFromServer(payload: {
    restaurantId?: string;
    restaurant?: RestaurantTenant;
    tables?: RestaurantTable[];
    categories?: MenuCategory[];
    menuItems?: MenuItem[];
    orders?: Order[];
    waiterRequests?: WaiterRequest[];
  }) {
    const targetRestId = payload.restaurant?.id || payload.restaurantId || this.cache.restaurant.id;
    if (targetRestId) {
      this.serverHydratedRestaurants.add(targetRestId);
    }

    if (payload.restaurant && payload.restaurant.id) {
      this.hasExplicitRestaurant = true;
      this.knownRestaurants[payload.restaurant.id] = payload.restaurant;
      this.cache.restaurant = payload.restaurant;
      this.notifySubscribers({ type: 'RESTAURANT_UPDATED', restaurant: payload.restaurant });
    }

    if (Array.isArray(payload.tables)) {
      const otherTables = this.cache.tables.filter((t) => t.restaurantId !== targetRestId);
      const serverTables = payload.tables.map((t) => ({ ...t, restaurantId: t.restaurantId || targetRestId }));
      this.cache.tables = [...serverTables, ...otherTables];
      this.notifySubscribers({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    }

    let needsResyncToServer = false;

    if (Array.isArray(payload.categories) || Array.isArray(payload.menuItems)) {
      if (Array.isArray(payload.categories)) {
        const otherCats = this.cache.categories.filter((c) => c.restaurantId !== targetRestId);
        const serverCats = payload.categories.map((c) => ({ ...c, restaurantId: c.restaurantId || targetRestId }));
        const serverCatIds = new Set(serverCats.map((c) => c.id));
        const unsyncedLocalCats = this.cache.categories.filter(
          (c) => c.restaurantId === targetRestId && this.pendingSyncIds.has(c.id) && !serverCatIds.has(c.id)
        );
        if (unsyncedLocalCats.length > 0) needsResyncToServer = true;
        this.cache.categories = [...serverCats, ...unsyncedLocalCats, ...otherCats].sort(
          (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
        );
      }
      if (Array.isArray(payload.menuItems)) {
        const otherItems = this.cache.menuItems.filter((m) => m.restaurantId !== targetRestId);
        const serverItems = payload.menuItems.map((m) => {
          const resolvedImg = (m.imageUrl ?? m.image ?? '').trim();
          return {
            ...m,
            restaurantId: m.restaurantId || targetRestId,
            image: resolvedImg,
            imageUrl: resolvedImg,
          };
        });
        const serverItemIds = new Set(serverItems.map((m) => m.id));
        const unsyncedLocalItems = this.cache.menuItems.filter(
          (m) => m.restaurantId === targetRestId && this.pendingSyncIds.has(m.id) && !serverItemIds.has(m.id)
        );
        if (unsyncedLocalItems.length > 0) needsResyncToServer = true;
        this.cache.menuItems = [...serverItems, ...unsyncedLocalItems, ...otherItems];
      }
      this.notifySubscribers({
        type: 'MENU_UPDATED',
        menuItems: this.cache.menuItems,
        categories: this.cache.categories,
      });
    }

    if (Array.isArray(payload.orders)) {
      const byId = new Map<string, Order>();
      this.cache.orders.forEach((o) => byId.set(o.id, o));
      payload.orders.forEach((o) => byId.set(o.id, { ...o, restaurantId: o.restaurantId || targetRestId }));
      this.cache.orders = Array.from(byId.values()).sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
      this.notifySubscribers({
        type: 'ORDER_STATUS_UPDATED',
        orderId: '',
        status: 'received',
        orders: this.cache.orders,
        tables: this.cache.tables,
      });
    }

    if (Array.isArray(payload.waiterRequests)) {
      const byId = new Map<string, WaiterRequest>();
      this.cache.waiterRequests.forEach((w) => byId.set(w.id, w));
      payload.waiterRequests.forEach((w) =>
        byId.set(w.id, { ...w, restaurantId: w.restaurantId || targetRestId })
      );
      this.cache.waiterRequests = Array.from(byId.values()).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      this.notifySubscribers({
        type: 'WAITER_REQUEST_UPDATED',
        requestId: '',
        status: 'pending',
        requests: this.cache.waiterRequests,
      });
    }

    this.persistBackup();

    if (needsResyncToServer && targetRestId) {
      this.syncToServer(targetRestId);
    }
  }

  public async syncToServer(restaurantId?: string) {
    const rId = restaurantId || this.cache.restaurant.id;
    if (!rId || typeof fetch === 'undefined') return;
    try {
      const cats = this.getCategories(rId);
      const items = this.getMenuItems(rId);
      const res = await fetch(`/api/workspace/${encodeURIComponent(rId)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: this.cache.restaurant.id === rId ? this.cache.restaurant : undefined,
          tables: this.getTables(rId),
          categories: cats,
          menuItems: items,
          orders: this.getOrders(rId),
        }),
      });
      if (res.ok) {
        cats.forEach((c) => this.clearPendingSync(c.id));
        items.forEach((m) => this.clearPendingSync(m.id));
      }
    } catch {
      // ignore offline
    }
  }

  public updateRestaurant(data: Partial<RestaurantTenant>): RestaurantTenant {
    if (data.id) {
      this.hasExplicitRestaurant = true;
    }
    this.cache.restaurant = { ...this.cache.restaurant, ...data };
    this.knownRestaurants[this.cache.restaurant.id] = this.cache.restaurant;
    this.persistBackup();
    this.broadcast({ type: 'RESTAURANT_UPDATED', restaurant: this.cache.restaurant });
    this.postJson(`/api/workspace/${encodeURIComponent(this.cache.restaurant.id)}/sync`, 'POST', {
      restaurant: this.cache.restaurant,
    });
    return this.cache.restaurant;
  }

  // ==================== TABLES API ====================
  public getTables(restaurantId?: string): RestaurantTable[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.tables.filter((t) => t.restaurantId === rId);
  }

  public getTableByNumber(tableNumber: string, restaurantId?: string): RestaurantTable | undefined {
    const cleanNumber = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    const padded = cleanNumber.padStart(2, '0');
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.tables.find((t) => {
      if (t.restaurantId !== rId) return false;
      const tClean = String(t.number || '').replace(/^Table\s*/i, '').trim();
      return (
        tClean === cleanNumber ||
        t.number === tableNumber ||
        tClean.padStart(2, '0') === padded
      );
    });
  }

  public createTable(tableData: Partial<RestaurantTable>): RestaurantTable {
    const rId = tableData.restaurantId || this.cache.restaurant.id;
    const rawNum = tableData.number || `${this.getTables(rId).length + 1}`;
    const cleanNumber = String(rawNum).replace(/^Table\s*/i, '').trim();
    const paddedNumber = /^\d{1,2}$/.test(cleanNumber) ? cleanNumber.padStart(2, '0') : cleanNumber;
    const newTable: RestaurantTable = {
      id: `tbl-${rId}-${paddedNumber}-${Date.now().toString(36)}`,
      restaurantId: rId,
      number: paddedNumber,
      name: tableData.name || `Table ${paddedNumber}`,
      capacity: tableData.capacity || 4,
      zone: tableData.zone || 'Main Dining',
      status: 'available',
      secureToken: `tok-${Date.now().toString(36)}`,
      activeDinersCount: 0,
      lastActivityAt: Date.now(),
    };
    this.cache.tables = [newTable, ...this.cache.tables];
    this.persistBackup();
    this.broadcast({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    this.postJson(`/api/workspace/${encodeURIComponent(rId)}/tables`, 'POST', newTable);
    return newTable;
  }

  public updateTableStatus(tableId: string, status: TableStatus): RestaurantTable[] {
    let targetRestId = this.cache.restaurant.id;
    this.cache.tables = this.cache.tables.map((t) => {
      if (t.id === tableId) {
        targetRestId = t.restaurantId;
        return { ...t, status };
      }
      return t;
    });
    this.persistBackup();
    this.broadcast({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    this.postJson(`/api/workspace/${encodeURIComponent(targetRestId)}/tables/${encodeURIComponent(tableId)}`, 'PUT', {
      status,
    });
    return this.cache.tables;
  }

  public regenerateTableToken(tableId: string): RestaurantTable[] {
    let targetRestId = this.cache.restaurant.id;
    const nextToken = `tok-${Date.now().toString(36)}`;
    this.cache.tables = this.cache.tables.map((t) => {
      if (t.id === tableId) {
        targetRestId = t.restaurantId;
        return { ...t, secureToken: nextToken };
      }
      return t;
    });
    this.persistBackup();
    this.broadcast({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    this.postJson(`/api/workspace/${encodeURIComponent(targetRestId)}/tables/${encodeURIComponent(tableId)}`, 'PUT', {
      secureToken: nextToken,
    });
    return this.cache.tables;
  }

  // ==================== CATEGORIES CRUD API ====================
  public getCategories(restaurantId?: string): MenuCategory[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.categories
      .filter((c) => c.restaurantId === rId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  public createCategory(categoryData: {
    restaurantId?: string;
    name: string;
    hindiName?: string;
    icon?: string;
    sortOrder?: number;
  }): MenuCategory {
    const rId = categoryData.restaurantId || this.cache.restaurant.id;
    const newCategory: MenuCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: rId,
      name: categoryData.name.trim(),
      hindiName: categoryData.hindiName?.trim(),
      icon: categoryData.icon || 'Utensils',
      sortOrder:
        categoryData.sortOrder !== undefined
          ? categoryData.sortOrder
          : this.getCategories(rId).length + 1,
    };
    this.markPendingSync(newCategory.id);
    this.cache.categories = [...this.cache.categories, newCategory];
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    void this.postJson(`/api/workspace/${encodeURIComponent(rId)}/categories`, 'POST', newCategory, newCategory.id);
    return newCategory;
  }

  public updateCategory(
    categoryId: string,
    updates: Partial<MenuCategory>
  ): MenuCategory[] {
    let updatedCat: MenuCategory | undefined;
    this.cache.categories = this.cache.categories.map((c) => {
      if (c.id === categoryId) {
        updatedCat = { ...c, ...updates };
        return updatedCat;
      }
      return c;
    });
    if (updatedCat) {
      this.markPendingSync(updatedCat.id);
    }
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    if (updatedCat) {
      void this.postJson(
        `/api/workspace/${encodeURIComponent(updatedCat.restaurantId)}/categories`,
        'POST',
        updatedCat,
        updatedCat.id
      );
    }
    return this.cache.categories;
  }

  public deleteCategory(categoryId: string): MenuCategory[] {
    const existing = this.cache.categories.find((c) => c.id === categoryId);
    const rId = existing?.restaurantId || this.cache.restaurant.id;
    this.clearPendingSync(categoryId);
    this.cache.categories = this.cache.categories.filter((c) => c.id !== categoryId);
    // Reassign items in deleted category to first available category
    const fallbackCatId = this.getCategories(rId)[0]?.id || 'cat-curries';
    this.cache.menuItems = this.cache.menuItems.map((i) =>
      i.categoryId === categoryId ? { ...i, categoryId: fallbackCatId } : i
    );
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    void this.postJson(`/api/workspace/${encodeURIComponent(rId)}/categories/${encodeURIComponent(categoryId)}`, 'DELETE');
    return this.cache.categories;
  }

  public reorderCategories(orderedIds: string[], restaurantId?: string): MenuCategory[] {
    const rId = restaurantId || this.cache.restaurant.id;
    this.cache.categories = this.cache.categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx !== -1 ? { ...c, sortOrder: idx + 1 } : c;
    });
    this.cache.categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    void this.postJson(`/api/workspace/${encodeURIComponent(rId)}/sync`, 'POST', {
      categories: this.getCategories(rId),
    });
    return this.cache.categories;
  }

  private resolveDifficultyLevel(
    explicit?: DifficultyLevel | string,
    prepTimeMinutes?: number
  ): DifficultyLevel {
    if (explicit === 'Easy' || explicit === 'Medium' || explicit === 'Hard') {
      return explicit;
    }
    const prep = Number(prepTimeMinutes) || 12;
    if (prep >= 16) return 'Hard';
    if (prep >= 10) return 'Medium';
    return 'Easy';
  }

  // ==================== MENU ITEMS CRUD API ====================
  public getMenuItems(restaurantId?: string): MenuItem[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.menuItems
      .filter((i) => i.restaurantId === rId)
      .map((i) => {
        const resolvedImg = (i.imageUrl ?? i.image ?? '').trim();
        return {
          ...i,
          image: resolvedImg,
          imageUrl: resolvedImg,
          difficultyLevel: this.resolveDifficultyLevel(i.difficultyLevel, i.prepTimeMinutes),
        };
      });
  }

  public createMenuItem(itemData: Partial<MenuItem>): MenuItem {
    const rId = itemData.restaurantId || this.cache.restaurant.id;
    const resolvedImageUrl = (itemData.imageUrl ?? itemData.image ?? '').trim();
    const prepMins = itemData.prepTimeMinutes || 12;
    const newItem: MenuItem = {
      id: `dish-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: rId,
      categoryId: itemData.categoryId || this.getCategories(rId)[0]?.id || 'cat-curries',
      name: itemData.name?.trim() || 'New Chef Dish',
      hindiName: itemData.hindiName?.trim(),
      description: itemData.description?.trim() || '',
      price: Number(itemData.price) || 250,
      dietType: itemData.dietType || 'veg',
      difficultyLevel: this.resolveDifficultyLevel(itemData.difficultyLevel, prepMins),
      image: resolvedImageUrl,
      imageUrl: resolvedImageUrl,
      prepTimeMinutes: prepMins,
      isAvailable: itemData.isAvailable !== false,
      isJainAvailable: Boolean(itemData.isJainAvailable),
      isBestseller: Boolean(itemData.isBestseller || itemData.isPopular),
      isPopular: Boolean(itemData.isBestseller || itemData.isPopular),
      isDailySpecial: Boolean(itemData.isDailySpecial),
      spiceLevel: itemData.spiceLevel || 1,
    };

    this.markPendingSync(newItem.id);
    this.cache.menuItems = [newItem, ...this.cache.menuItems];
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    void this.postJson(`/api/workspace/${encodeURIComponent(rId)}/menu-items`, 'POST', newItem, newItem.id);
    return newItem;
  }

  public updateMenuItem(itemId: string, updates: Partial<MenuItem>): MenuItem | null {
    let updatedItem: MenuItem | null = null;
    this.cache.menuItems = this.cache.menuItems.map((item) => {
      if (item.id === itemId) {
        const hasImageUpdate = updates.imageUrl !== undefined || updates.image !== undefined;
        const resolvedImg = hasImageUpdate
          ? String(updates.imageUrl ?? updates.image ?? '').trim()
          : String(item.imageUrl ?? item.image ?? '').trim();
        updatedItem = {
          ...item,
          ...updates,
          image: resolvedImg,
          imageUrl: resolvedImg,
          difficultyLevel: this.resolveDifficultyLevel(
            updates.difficultyLevel ?? item.difficultyLevel,
            updates.prepTimeMinutes ?? item.prepTimeMinutes
          ),
          price: updates.price !== undefined ? Number(updates.price) : item.price,
          stockStatus:
            updates.stockStatus !== undefined
              ? updates.stockStatus
              : updates.isAvailable === false
              ? 'sold_out'
              : updates.isAvailable === true && item.stockStatus === 'sold_out'
              ? 'in_stock'
              : item.stockStatus,
          remainingCount:
            updates.remainingCount !== undefined ? updates.remainingCount : item.remainingCount,
          isDailySpecial:
            updates.isDailySpecial !== undefined ? updates.isDailySpecial : item.isDailySpecial,
          isBestseller:
            updates.isBestseller !== undefined
              ? updates.isBestseller
              : updates.isPopular !== undefined
              ? updates.isPopular
              : item.isBestseller,
          isPopular:
            updates.isBestseller !== undefined
              ? updates.isBestseller
              : updates.isPopular !== undefined
              ? updates.isPopular
              : item.isPopular,
        };
        return updatedItem;
      }
      return item;
    });

    if (updatedItem) {
      const target = updatedItem as MenuItem;
      this.markPendingSync(target.id);
      void this.postJson(
        `/api/workspace/${encodeURIComponent(target.restaurantId)}/menu-items`,
        'POST',
        target,
        target.id
      );
    }

    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    return updatedItem;
  }

  public deleteMenuItem(itemId: string): MenuItem[] {
    const existing = this.cache.menuItems.find((i) => i.id === itemId);
    const rId = existing?.restaurantId || this.cache.restaurant.id;
    this.clearPendingSync(itemId);
    this.cache.menuItems = this.cache.menuItems.filter((i) => i.id !== itemId);
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    void this.postJson(`/api/workspace/${encodeURIComponent(rId)}/menu-items/${encodeURIComponent(itemId)}`, 'DELETE');
    return this.cache.menuItems;
  }

  public toggleItemAvailability(itemId: string): MenuItem[] {
    let updatedItem: MenuItem | undefined;
    this.cache.menuItems = this.cache.menuItems.map((i) => {
      if (i.id === itemId) {
        const nextAvail = !i.isAvailable;
        updatedItem = {
          ...i,
          isAvailable: nextAvail,
          stockStatus: nextAvail ? 'in_stock' : 'sold_out',
        };
        return updatedItem;
      }
      return i;
    });
    if (updatedItem) {
      this.markPendingSync(updatedItem.id);
    }
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    if (updatedItem) {
      void this.postJson(
        `/api/workspace/${encodeURIComponent(updatedItem.restaurantId)}/menu-items`,
        'POST',
        updatedItem,
        updatedItem.id
      );
    }
    return this.cache.menuItems;
  }

  public getDailySpecials(restaurantId?: string): MenuItem[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.menuItems.filter((i) => i.restaurantId === rId && (i.isDailySpecial || (i as any).isSpecial));
  }

  public toggleDailySpecial(itemId: string): MenuItem | null {
    const target = this.cache.menuItems.find((i) => i.id === itemId);
    if (!target) return null;
    return this.updateMenuItem(itemId, { isDailySpecial: !target.isDailySpecial });
  }

  public loadStarterTemplate(restaurantId?: string): { categories: MenuCategory[]; menuItems: MenuItem[] } {
    const rId = restaurantId || this.cache.restaurant.id;

    const starterCategories: MenuCategory[] = [
      { id: `cat_${rId}_starters`, restaurantId: rId, name: 'Tandoor & Appetizers', hindiName: 'तंदूर स्टार्टर्स', icon: 'Flame', sortOrder: 1 },
      { id: `cat_${rId}_mains`, restaurantId: rId, name: 'Signature Curries', hindiName: 'मुख्य करी', icon: 'Utensils', sortOrder: 2 },
      { id: `cat_${rId}_biryani`, restaurantId: rId, name: 'Biryani & Pulao', hindiName: 'दम बिरयानी', icon: 'Sparkles', sortOrder: 3 },
      { id: `cat_${rId}_breads`, restaurantId: rId, name: 'Fresh Clay Breads', hindiName: 'तंदूरी रोटियां', icon: 'Coffee', sortOrder: 4 },
      { id: `cat_${rId}_drinks`, restaurantId: rId, name: 'Beverages & Lassi', hindiName: 'पेय और लस्सी', icon: 'Wine', sortOrder: 5 },
    ];

    const starterItems: MenuItem[] = [
      {
        id: `dish_${rId}_paneer_tikka`,
        restaurantId: rId,
        categoryId: `cat_${rId}_starters`,
        name: 'Angara Paneer Tikka',
        hindiName: 'अंगारा पनीर टिक्का',
        description: 'Charcoal-grilled cottage cheese cubes marinated in Kashmiri deghi mirch, hung curd and mustard oil.',
        price: 340,
        dietType: 'veg',
        difficultyLevel: 'Medium',
        image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 15,
        isAvailable: true,
        isBestseller: true,
        isPopular: true,
        isDailySpecial: true,
        spiceLevel: 2,
      },
      {
        id: `dish_${rId}_butter_chicken`,
        restaurantId: rId,
        categoryId: `cat_${rId}_mains`,
        name: 'Old Delhi Butter Chicken',
        hindiName: 'बटर चिकन',
        description: 'Slow-simmered bone-in roasted chicken in rich vine-ripened plum tomato gravy with white makkhan.',
        price: 490,
        dietType: 'non-veg',
        difficultyLevel: 'Medium',
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 18,
        isAvailable: true,
        isBestseller: true,
        isPopular: true,
        isDailySpecial: true,
        spiceLevel: 1,
      },
      {
        id: `dish_${rId}_dal_makhani`,
        restaurantId: rId,
        categoryId: `cat_${rId}_mains`,
        name: 'Smoked Dal Bukhara Makhani',
        hindiName: 'दाल मखनी',
        description: 'Black urad lentils slow-cooked for 18 hours over charcoal embers with butter and fresh cream.',
        price: 360,
        dietType: 'veg',
        difficultyLevel: 'Hard',
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 12,
        isAvailable: true,
        isBestseller: true,
        isPopular: true,
        isDailySpecial: false,
        spiceLevel: 1,
      },
      {
        id: `dish_${rId}_dum_biryani`,
        restaurantId: rId,
        categoryId: `cat_${rId}_biryani`,
        name: 'Awadhi Murgh Dum Biryani',
        hindiName: 'दम बिरयानी',
        description: 'Aged basmati rice sealed with dough pot, infused with saffron, mace, rose water and tender chicken.',
        price: 450,
        dietType: 'non-veg',
        difficultyLevel: 'Hard',
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 20,
        isAvailable: true,
        isBestseller: true,
        isPopular: true,
        isDailySpecial: true,
        spiceLevel: 2,
      },
      {
        id: `dish_${rId}_garlic_naan`,
        restaurantId: rId,
        categoryId: `cat_${rId}_breads`,
        name: 'Butter Garlic Naan',
        hindiName: 'गार्लिक नान',
        description: 'Hand-stretched leavened flatbread baked on tandoor wall with minced garlic and melted amul butter.',
        price: 85,
        dietType: 'veg',
        difficultyLevel: 'Easy',
        image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 6,
        isAvailable: true,
        isBestseller: false,
        isPopular: false,
        isDailySpecial: false,
        spiceLevel: 0,
      },
    ];

    // Filter out existing for this restaurant and replace with starter template
    this.cache.categories = [
      ...this.cache.categories.filter((c) => c.restaurantId !== rId),
      ...starterCategories,
    ];
    this.cache.menuItems = [
      ...this.cache.menuItems.filter((i) => i.restaurantId !== rId),
      ...starterItems,
    ];

    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    this.postJson(`/api/workspace/${encodeURIComponent(rId)}/sync`, 'POST', {
      categories: starterCategories,
      menuItems: starterItems,
    });

    return { categories: starterCategories, menuItems: starterItems };
  }

  public updateItemPrice(itemId: string, newPrice: number): MenuItem[] {
    let updatedItem: MenuItem | undefined;
    this.cache.menuItems = this.cache.menuItems.map((i) => {
      if (i.id === itemId) {
        updatedItem = { ...i, price: Number(newPrice) };
        return updatedItem;
      }
      return i;
    });
    if (updatedItem) {
      this.markPendingSync(updatedItem.id);
    }
    this.persistBackup();
    this.broadcast({
      type: 'MENU_UPDATED',
      menuItems: this.cache.menuItems,
      categories: this.cache.categories,
    });
    if (updatedItem) {
      void this.postJson(
        `/api/workspace/${encodeURIComponent(updatedItem.restaurantId)}/menu-items`,
        'POST',
        updatedItem,
        updatedItem.id
      );
    }
    return this.cache.menuItems;
  }

  // ==================== ORDERS API ====================
  public getOrders(restaurantId?: string): Order[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.orders.filter((o) => o.restaurantId === rId);
  }

  public createCustomerOrder(
    tableNumber: string,
    items: OrderItem[],
    dinerName: string,
    options?: { restaurantId?: string; orderId?: string; orderNumber?: string }
  ): Order {
    const rId = options?.restaurantId || this.cache.restaurant.id;
    const activeRest = this.getRestaurant(rId);
    const cleanNumber = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    const subtotal = items.reduce((sum, i) => sum + i.itemTotal, 0);
    const cgst = subtotal * 0.025;
    const sgst = subtotal * 0.025;
    const serviceCharge = subtotal * ((activeRest.serviceChargePercent ?? 5) / 100);
    const grandTotal = Math.round(subtotal + cgst + sgst + serviceCharge);

    const newOrder: Order = {
      id: options?.orderId || `ord-${Date.now()}`,
      orderNumber: options?.orderNumber || `#UDM-${Math.floor(100 + Math.random() * 900)}`,
      restaurantId: rId,
      tableId: `tbl-${cleanNumber}`,
      tableNumber: cleanNumber,
      dinerName: dinerName || 'Table Guest',
      status: 'received',
      items,
      subtotal,
      cgst,
      sgst,
      serviceCharge,
      tip: 0,
      grandTotal,
      paymentStatus: 'pending',
      placedAt: Date.now(),
    };

    this.cache.orders = [newOrder, ...this.cache.orders];

    // Automatically update table state on the floor map
    this.cache.tables = this.cache.tables.map((t) =>
      t.restaurantId === rId &&
      (t.number === cleanNumber ||
        t.number === tableNumber ||
        t.number.padStart(2, '0') === cleanNumber.padStart(2, '0'))
        ? {
            ...t,
            status: 'new_order' as TableStatus,
            currentOrderId: newOrder.id,
            activeDinersCount: Math.max(t.activeDinersCount, 1),
            lastActivityAt: Date.now(),
          }
        : t
    );

    this.persistBackup();
    this.broadcast({ type: 'ORDER_CREATED', order: newOrder });
    this.broadcast({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    this.postJson(`/api/workspace/${encodeURIComponent(rId)}/orders`, 'POST', newOrder);
    return newOrder;
  }

  public updateOrderStatus(orderId: string, status: OrderStatus): Order[] {
    const order = this.cache.orders.find((o) => o.id === orderId);
    const rId = order?.restaurantId || this.cache.restaurant.id;

    this.cache.orders = this.cache.orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status,
          acceptedAt: status === 'accepted' ? Date.now() : o.acceptedAt,
          preparedAt: status === 'ready' ? Date.now() : o.preparedAt,
          servedAt: status === 'served' ? Date.now() : o.servedAt,
        };
      }
      return o;
    });

    if (order) {
      this.cache.tables = this.cache.tables.map((t) => {
        if (
          t.restaurantId === rId &&
          (t.number === order.tableNumber ||
            t.number.padStart(2, '0') === String(order.tableNumber).padStart(2, '0'))
        ) {
          if (status === 'served' || status === 'ready' || status === 'preparing') {
            return { ...t, status: 'occupied' as TableStatus };
          }
        }
        return t;
      });
    }

    this.persistBackup();
    this.broadcast({
      type: 'ORDER_STATUS_UPDATED',
      orderId,
      status,
      orders: this.cache.orders,
      tables: this.cache.tables,
    });
    this.postJson(`/api/workspace/${encodeURIComponent(rId)}/orders/${encodeURIComponent(orderId)}/status`, 'PUT', {
      status,
    });
    return this.cache.orders;
  }

  public updateOrderPayment(
    orderId: string,
    paymentStatus: Order['paymentStatus'],
    paymentMethod?: Order['paymentMethod'],
    extras?: { tip?: number; grandTotal?: number; restaurantId?: string }
  ): Order[] {
    const order = this.cache.orders.find((o) => o.id === orderId);
    const rId = extras?.restaurantId || order?.restaurantId || this.cache.restaurant.id;

    this.cache.orders = this.cache.orders.map((o) => {
      if (o.id === orderId) {
        const isSettled = paymentStatus === 'paid' || paymentStatus === 'verified_by_staff';
        return {
          ...o,
          paymentStatus,
          paymentMethod: paymentMethod || o.paymentMethod,
          ...(isSettled ? { paidAt: o.paidAt || Date.now() } : {}),
          ...(extras?.tip !== undefined ? { tip: extras.tip } : {}),
          ...(extras?.grandTotal !== undefined ? { grandTotal: extras.grandTotal } : {}),
        };
      }
      return o;
    });
    this.persistBackup();
    this.broadcast({
      type: 'ORDER_STATUS_UPDATED',
      orderId,
      status: this.cache.orders.find((o) => o.id === orderId)?.status || 'received',
      orders: this.cache.orders,
      tables: this.cache.tables,
    });
    this.postJson(`/api/workspace/${encodeURIComponent(rId)}/orders/${encodeURIComponent(orderId)}/payment`, 'PUT', {
      paymentStatus,
      paymentMethod,
      ...(extras?.tip !== undefined ? { tip: extras.tip } : {}),
      ...(extras?.grandTotal !== undefined ? { grandTotal: extras.grandTotal } : {}),
    });
    return this.cache.orders;
  }

  // ==================== WAITER REQUESTS API ====================
  public getWaiterRequests(restaurantId?: string): WaiterRequest[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.waiterRequests.filter((w) => w.restaurantId === rId);
  }

  public createWaiterRequest(
    tableNumber: string,
    requestType: WaiterRequest['requestType'],
    restaurantId?: string
  ): WaiterRequest {
    const rId = restaurantId || this.cache.restaurant.id;
    const cleanNumber = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    const newRequest: WaiterRequest = {
      id: `wr-${Date.now()}`,
      restaurantId: rId,
      tableId: `tbl-${cleanNumber}`,
      tableNumber: cleanNumber,
      requestType,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.cache.waiterRequests = [newRequest, ...this.cache.waiterRequests];

    this.cache.tables = this.cache.tables.map((t) =>
      t.restaurantId === rId &&
      (t.number === cleanNumber ||
        t.number === tableNumber ||
        t.number.padStart(2, '0') === cleanNumber.padStart(2, '0'))
        ? { ...t, status: 'waiting_waiter' as TableStatus }
        : t
    );

    this.persistBackup();
    this.broadcast({ type: 'WAITER_REQUEST_CREATED', request: newRequest });
    this.broadcast({ type: 'TABLES_UPDATED', tables: this.cache.tables });
    return newRequest;
  }

  public cancelWaiterRequest(tableNumber: string, restaurantId?: string): WaiterRequest[] {
    const rId = restaurantId || this.cache.restaurant.id;
    const cleanNumber = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    this.cache.waiterRequests = this.cache.waiterRequests.filter(
      (r) =>
        !(
          r.restaurantId === rId &&
          String(r.tableNumber).replace(/^Table\s*/i, '').trim().padStart(2, '0') === cleanNumber.padStart(2, '0') &&
          r.status === 'pending'
        )
    );
    this.persistBackup();
    this.broadcast({
      type: 'WAITER_REQUEST_UPDATED',
      requestId: '',
      status: 'cancelled',
      requests: this.cache.waiterRequests,
    });
    return this.cache.waiterRequests;
  }

  public acknowledgeWaiterRequest(requestId: string): WaiterRequest[] {
    this.cache.waiterRequests = this.cache.waiterRequests.map((r) =>
      r.id === requestId ? { ...r, status: 'acknowledged' as const } : r
    );
    this.persistBackup();
    this.broadcast({
      type: 'WAITER_REQUEST_UPDATED',
      requestId,
      status: 'acknowledged',
      requests: this.cache.waiterRequests,
    });
    return this.cache.waiterRequests;
  }

  public resolveWaiterRequest(requestId: string): WaiterRequest[] {
    this.cache.waiterRequests = this.cache.waiterRequests.map((r) =>
      r.id === requestId ? { ...r, status: 'resolved' as const, resolvedAt: Date.now() } : r
    );
    this.persistBackup();
    this.broadcast({
      type: 'WAITER_REQUEST_UPDATED',
      requestId,
      status: 'resolved',
      requests: this.cache.waiterRequests,
    });
    return this.cache.waiterRequests;
  }

  public resolveWaiterRequestsForTable(
    tableNumber: string,
    restaurantId?: string,
    requestType?: WaiterRequest['requestType']
  ): WaiterRequest[] {
    const rId = restaurantId || this.cache.restaurant.id;
    const cleanNorm = String(tableNumber || '').replace(/^Table\s*/i, '').trim().padStart(2, '0');
    let changed = false;
    this.cache.waiterRequests = this.cache.waiterRequests.map((r) => {
      const rNorm = String(r.tableNumber || '').replace(/^Table\s*/i, '').trim().padStart(2, '0');
      if (
        r.restaurantId === rId &&
        rNorm === cleanNorm &&
        r.status !== 'resolved' &&
        (!requestType || r.requestType === requestType)
      ) {
        changed = true;
        return { ...r, status: 'resolved' as const, resolvedAt: Date.now() };
      }
      return r;
    });
    if (changed) {
      this.persistBackup();
      this.broadcast({
        type: 'WAITER_REQUEST_UPDATED',
        requestId: '',
        status: 'resolved',
        requests: this.cache.waiterRequests,
      });
    }
    return this.cache.waiterRequests;
  }

  // ==================== STAFF API ====================
  public getStaff(restaurantId?: string): StaffMember[] {
    const rId = restaurantId || this.cache.restaurant.id;
    return this.cache.staff.filter((s) => s.restaurantId === rId);
  }

  public createStaffMember(member: Partial<StaffMember>): StaffMember {
    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      restaurantId: this.cache.restaurant.id,
      name: member.name || 'New Staff',
      role: member.role || 'waiter',
      phone: member.phone || '+91 98000 00000',
      activeZone: member.activeZone || 'Main Dining Hall',
      status: 'active',
    };
    this.cache.staff = [...this.cache.staff, newStaff];
    this.persistBackup();
    return newStaff;
  }
}

export const restaurantDb = new CentralizedRestaurantDatabase();

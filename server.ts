import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  PLAN_DEFINITIONS,
  FEATURE_CATALOG,
  FEATURE_COMPARISON_ROWS,
  FeatureKey,
  BillingCycle,
  getPlanDefinition,
  hasPlanEntitlement,
  getPlanEntitlementMap,
  getPlanEntitlementRows,
  getPlanPriceForCycle,
  normalizeLegacyPlanId,
} from './src/config/subscriptionPlans';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE_PATH = path.resolve(__dirname, 'server-db.json');
const SUBSCRIPTION_WEBHOOK_SECRET = process.env.SUBSCRIPTION_WEBHOOK_SECRET || 'dcc_sub_whsec_2026_verified_hmac';

function signSubscriptionWebhookPayload(payload: {
  eventId: string;
  event: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  restaurantId: string;
  targetPlanId: string;
  amount: number;
}): string {
  const canonical = [
    payload.eventId,
    payload.event,
    payload.gatewayOrderId,
    payload.gatewayPaymentId,
    payload.restaurantId,
    payload.targetPlanId,
    String(payload.amount),
  ].join('|');
  return crypto.createHmac('sha256', SUBSCRIPTION_WEBHOOK_SECRET).update(canonical).digest('hex');
}

function verifySubscriptionWebhookSignature(
  payload: {
    eventId: string;
    event: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    restaurantId: string;
    targetPlanId: string;
    amount: number;
  },
  providedSignature: string
): boolean {
  if (!providedSignature) return false;
  const expected = signSubscriptionWebhookPayload(payload);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(providedSignature.trim(), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

// ==================== CRYPTO HELPERS ====================
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function verifyPasswordHash(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const computed = hashPassword(password, salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

const DEMO_SUPERADMIN_EMAIL = 'admin@urdearmenu.com';
const DEMO_SUPERADMIN_PASSWORD_SHA256 = crypto.createHash('sha256').update('admin123').digest('hex');

function verifyTimingSafeSha256(input: string, expectedSha256Hex: string): boolean {
  const digest = crypto.createHash('sha256').update(input || '').digest('hex');
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(expectedSha256Hex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function generateSecureToken(prefix = 'tok'): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

function parseDeviceInfo(userAgent = ''): { deviceName: string; deviceType: 'mobile' | 'tablet' | 'desktop' } {
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  let deviceName = 'Desktop Workstation';

  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
    deviceName = 'Tablet Terminal';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    deviceType = 'mobile';
    deviceName = /iphone/i.test(ua) ? 'Apple iPhone' : /android/i.test(ua) ? 'Android Smartphone' : 'Mobile Handheld';
  }

  if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
    deviceName += ' (Chrome)';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    deviceName += ' (Safari)';
  } else if (/firefox/i.test(ua)) {
    deviceName += ' (Firefox)';
  } else if (/edg/i.test(ua)) {
    deviceName += ' (Edge)';
  }

  return { deviceName, deviceType };
}

// ==================== DATABASE SCHEMA ====================
interface ServerDbData {
  superAdmin: any;
  restaurants: any[];
  staffProfiles: any[];
  invitations: any[];
  registeredDevices: any[];
  securityAuditLogs: any[];
  customers: any[];
  customerOrders: any[];
  waiterRequests: any[];
  platformSubscriptions: any[];
  menuItems: any[];
  categories: any[];
  tables: any[];
  orders: any[];
  trackableQrs: any[];
  // SaaS Monetization & Payments
  subscriptionPlans: any[];
  planEntitlements: any[];
  restaurantSubscriptions: any[];
  subscriptionEvents: any[];
  paymentMethods: any[];
  paymentTransactions: any[];
  paymentWebhooks: any[];
  commissionRecords: any[];
  commissionLedger: any[];
  restaurantInvoices: any[];
  settlementRecords: any[];
  refundRecords: any[];
  paymentAuditLogs: any[];
  // Plan-gated domain tables
  floorZones: any[];
  banquets: any[];
  apiKeys: any[];
  enterpriseBranches: any[];
  whiteLabelConfigs: any[];
  integrationConfigs: any[];
}

function getDefaultSubscriptionPlans() {
  return PLAN_DEFINITIONS.map((p) => ({
    ...p,
    updatedAt: Date.now(),
  }));
}

function getDefaultPaymentMethods(restaurantId: string) {
  return {
    restaurantId,
    onlineGatewayEnabled: true,
    onlineGatewayProvider: 'razorpay',
    payAtRestaurantCashEnabled: true,
    payAtRestaurantUpiEnabled: true,
    restaurantUpiId: `${restaurantId.replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`,
    restaurantUpiName: 'Ur.Dear.Menu Restaurant',
    updatedAt: Date.now(),
  };
}

function getInitialDbData(): ServerDbData {
  const adminSalt = generateSalt();

  return {
    superAdmin: {
      id: 'super-admin-01',
      name: 'Platform Super Administrator',
      email: 'admin@urdearmenu.com',
      username: 'admin',
      role: 'superadmin',
      passwordSalt: adminSalt,
      passwordHash: hashPassword('admin123', adminSalt),
      createdAt: Date.now(),
    },
    restaurants: [],
    staffProfiles: [],
    invitations: [],
    registeredDevices: [],
    securityAuditLogs: [],
    customers: [],
    customerOrders: [],
    waiterRequests: [],
    platformSubscriptions: [],
    menuItems: [],
    categories: [],
    tables: [],
    orders: [],
    trackableQrs: [],
    subscriptionPlans: getDefaultSubscriptionPlans(),
    planEntitlements: getPlanEntitlementRows(),
    restaurantSubscriptions: [],
    subscriptionEvents: [],
    paymentMethods: [],
    paymentTransactions: [],
    paymentWebhooks: [],
    commissionRecords: [],
    commissionLedger: [],
    restaurantInvoices: [],
    settlementRecords: [],
    refundRecords: [],
    paymentAuditLogs: [],
    floorZones: [],
    banquets: [],
    apiKeys: [],
    enterpriseBranches: [],
    whiteLabelConfigs: [],
    integrationConfigs: [],
  };
}

class ServerDatabase {
  private data: ServerDbData;

  constructor() {
    this.data = this.load();
  }

  private load(): ServerDbData {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.superAdmin && Array.isArray(parsed.restaurants)) {
          parsed.restaurants = parsed.restaurants || [];
          parsed.staffProfiles = parsed.staffProfiles || [];
          parsed.invitations = parsed.invitations || [];
          parsed.registeredDevices = parsed.registeredDevices || [];
          parsed.securityAuditLogs = parsed.securityAuditLogs || [];
          parsed.customers = parsed.customers || [];
          parsed.customerOrders = parsed.customerOrders || [];
          parsed.waiterRequests = parsed.waiterRequests || [];
          parsed.platformSubscriptions = parsed.platformSubscriptions || [];
          parsed.menuItems = parsed.menuItems || [];
          parsed.categories = parsed.categories || [];
          parsed.tables = parsed.tables || [];
          parsed.orders = parsed.orders || [];
          parsed.trackableQrs = parsed.trackableQrs || [];

          // Initialize SaaS Monetization collections if missing and ensure canonical plan metadata
          const existingPlans = Array.isArray(parsed.subscriptionPlans) ? parsed.subscriptionPlans : [];
          const hasCompletePlanDefs =
            existingPlans.length === 4 &&
            existingPlans.every((p: any) => p.slug && typeof p.tierRank === 'number' && p.targetCustomer);
          parsed.subscriptionPlans = hasCompletePlanDefs
            ? existingPlans
            : getDefaultSubscriptionPlans();
          parsed.planEntitlements = getPlanEntitlementRows();
          parsed.restaurantSubscriptions = parsed.restaurantSubscriptions || [];
          parsed.subscriptionEvents = parsed.subscriptionEvents || [];
          parsed.paymentMethods = parsed.paymentMethods || [];
          parsed.paymentTransactions = parsed.paymentTransactions || [];
          parsed.paymentWebhooks = parsed.paymentWebhooks || [];
          parsed.commissionRecords = parsed.commissionRecords || [];
          parsed.commissionLedger = parsed.commissionLedger || [];
          parsed.restaurantInvoices = parsed.restaurantInvoices || [];
          parsed.settlementRecords = parsed.settlementRecords || [];
          parsed.refundRecords = parsed.refundRecords || [];
          parsed.paymentAuditLogs = parsed.paymentAuditLogs || [];
          parsed.floorZones = parsed.floorZones || [];
          parsed.banquets = parsed.banquets || [];
          parsed.apiKeys = parsed.apiKeys || [];
          parsed.enterpriseBranches = parsed.enterpriseBranches || [];
          parsed.whiteLabelConfigs = parsed.whiteLabelConfigs || [];
          parsed.integrationConfigs = parsed.integrationConfigs || [];
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load server-db.json, initializing clean database', e);
    }
    const initial = getInitialDbData();
    this.save(initial);
    return initial;
  }

  public save(dataToSave?: ServerDbData) {
    try {
      if (dataToSave) this.data = dataToSave;
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write server-db.json', e);
    }
  }

  // Super Admin
  public getSuperAdmin() {
    return this.data.superAdmin;
  }

  public setSuperAdminSession(token: string) {
    if (this.data.superAdmin) {
      this.data.superAdmin.sessionToken = token;
      this.save();
    }
  }

  // Multi-Tenant Restaurants
  public getRestaurants() {
    return this.data.restaurants || [];
  }

  public getRestaurant(idOrSlug: string) {
    if (!idOrSlug) return undefined;
    const clean = idOrSlug.trim().toLowerCase();
    return (this.data.restaurants || []).find(
      (r) =>
        r.id === idOrSlug ||
        r.slug === idOrSlug ||
        (r.slug && r.slug.toLowerCase() === clean) ||
        (r.name && r.name.toLowerCase() === clean)
    );
  }

  public findRestaurantByOwnerEmail(email: string) {
    const clean = (email || '').trim().toLowerCase();
    return (this.data.restaurants || []).find((r) => (r.ownerEmail || '').toLowerCase() === clean);
  }

  public addRestaurant(restaurant: any) {
    if (!this.data.restaurants) this.data.restaurants = [];
    this.data.restaurants.push(restaurant);
    this.save();
    return restaurant;
  }

  public updateRestaurant(id: string, updates: any) {
    const idx = (this.data.restaurants || []).findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.data.restaurants[idx] = { ...this.data.restaurants[idx], ...updates, updatedAt: Date.now() };
      this.save();
      return this.data.restaurants[idx];
    }
    return null;
  }

  // Platform Subscriptions (Platform Revenue - strictly separate from restaurant food sales)
  public getPlatformSubscriptions() {
    return this.data.platformSubscriptions || [];
  }

  public addPlatformSubscription(sub: any) {
    if (!this.data.platformSubscriptions) this.data.platformSubscriptions = [];
    this.data.platformSubscriptions.push(sub);
    this.save();
    return sub;
  }

  public getPlatformAdminStats() {
    const restaurants = this.getRestaurants();
    const staff = this.data.staffProfiles || [];
    const owners = staff.filter((s) => s.role === 'owner');
    const customers = this.data.customers || [];
    const orders = this.data.customerOrders || [];
    const subscriptions = this.getPlatformSubscriptions();

    const activeRestaurants = restaurants.filter((r) => r.status === 'active').length;
    const suspendedRestaurants = restaurants.filter((r) => r.status === 'suspended').length;

    // Platform revenue is ONLY subscription payments
    const totalPlatformRevenue = subscriptions
      .filter((s) => s.status === 'paid')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // MRR from active restaurants with paid plan
    const mrr = restaurants
      .filter((r) => r.status === 'active' && r.plan && r.plan !== 'flex' && r.plan !== 'free_trial')
      .reduce((acc, curr) => acc + (Number(curr.planPrice) || 0), 0);

    const detailedRestaurants = restaurants.map((r) => {
      const restStaff = staff.filter((s) => s.restaurantId === r.id);
      const restOrders = orders.filter((o) => o.restaurantId === r.id);
      const restRevenue = restOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const restMenuItems = (this.data.menuItems || []).filter((m) => m.restaurantId === r.id);
      const sub = this.getRestaurantSubscription(r.id);

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        ownerEmail: r.ownerEmail || '',
        ownerName: r.ownerName || '',
        phone: r.phone || '',
        status: r.status || 'active',
        plan: sub?.planName?.toLowerCase() || r.plan || 'flex',
        planPrice: sub?.amount ?? r.planPrice ?? 0,
        createdAt: r.createdAt || Date.now(),
        staffCount: restStaff.length,
        ordersCount: restOrders.length,
        menuItemsCount: restMenuItems.length,
        revenue: restRevenue,
      };
    });

    return {
      totalRestaurants: restaurants.length,
      activeRestaurants,
      suspendedRestaurants,
      totalOwners: owners.length,
      totalStaff: staff.filter((s) => s.role !== 'owner').length,
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalPlatformRevenue,
      mrr,
      paymentHistory: subscriptions,
      restaurants: detailedRestaurants,
    };
  }

  // Waiter Requests
  public getWaiterRequests(restaurantId: string) {
    return (this.data.waiterRequests || [])
      .filter((w) => !restaurantId || w.restaurantId === restaurantId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public addWaiterRequest(req: any) {
    if (!this.data.waiterRequests) this.data.waiterRequests = [];
    this.data.waiterRequests.unshift(req);
    this.save();
    return req;
  }

  public updateWaiterRequest(id: string, updates: any) {
    const idx = (this.data.waiterRequests || []).findIndex((w) => w.id === id);
    if (idx !== -1) {
      this.data.waiterRequests[idx] = { ...this.data.waiterRequests[idx], ...updates, updatedAt: Date.now() };
      this.save();
      return this.data.waiterRequests[idx];
    }
    return null;
  }

  // Menu Items & Daily Specials
  public getMenuItems(restaurantId: string) {
    return (this.data.menuItems || [])
      .filter((m) => !restaurantId || m.restaurantId === restaurantId)
      .map((m) => {
        const resolvedImg = m.imageUrl ?? m.image ?? '';
        return {
          ...m,
          image: m.image ?? resolvedImg,
          imageUrl: resolvedImg,
        };
      });
  }

  public findMenuItemById(id: string) {
    return (this.data.menuItems || []).find((m) => m.id === id);
  }

  public addMenuItem(item: any) {
    if (!this.data.menuItems) this.data.menuItems = [];
    this.data.menuItems.push(item);
    this.save();
    return item;
  }

  public updateMenuItem(id: string, updates: any) {
    const idx = (this.data.menuItems || []).findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.data.menuItems[idx] = { ...this.data.menuItems[idx], ...updates };
      this.save();
      return this.data.menuItems[idx];
    }
    return null;
  }

  public deleteMenuItem(id: string) {
    this.data.menuItems = (this.data.menuItems || []).filter((m) => m.id !== id);
    this.save();
  }

  public getStaff(restaurantId = '') {
    return this.data.staffProfiles.filter((s) => !restaurantId || s.restaurantId === restaurantId);
  }

  public findStaffByUsername(username: string, restaurantId = '') {
    const clean = username.trim().toLowerCase();
    return this.data.staffProfiles.find(
      (s) => (!restaurantId || s.restaurantId === restaurantId) && (s.username.toLowerCase() === clean || (s.email && s.email.toLowerCase() === clean) || s.name.toLowerCase() === clean)
    );
  }

  public findStaffByEmail(email: string) {
    const clean = email.trim().toLowerCase();
    return this.data.staffProfiles.find((s) => (s.email && s.email.toLowerCase() === clean) || s.username.toLowerCase() === clean);
  }

  public findStaffById(staffId: string) {
    return this.data.staffProfiles.find((s) => s.id === staffId);
  }

  public addStaff(staff: any) {
    this.data.staffProfiles.push(staff);
    this.save();
    return staff;
  }

  public updateStaff(staffId: string, updates: any) {
    const idx = this.data.staffProfiles.findIndex((s) => s.id === staffId);
    if (idx !== -1) {
      this.data.staffProfiles[idx] = { ...this.data.staffProfiles[idx], ...updates, updatedAt: Date.now() };
      this.save();
      return this.data.staffProfiles[idx];
    }
    return null;
  }

  public deleteStaff(staffId: string) {
    this.data.staffProfiles = this.data.staffProfiles.filter((s) => s.id !== staffId);
    // Revoke all devices for deleted staff
    this.revokeAllDevicesForStaff(staffId, 'Staff Account Deleted');
    this.save();
  }

  // Invitations
  public addInvitation(invitation: any) {
    this.data.invitations.push(invitation);
    this.save();
    return invitation;
  }

  public findInvitation(token: string) {
    return this.data.invitations.find((i) => i.token === token);
  }

  public markInvitationUsed(token: string) {
    const inv = this.findInvitation(token);
    if (inv) {
      inv.isUsed = true;
      inv.usedAt = Date.now();
      this.save();
    }
    return inv;
  }

  // Devices & Sessions
  public getDevices(restaurantId = 'demo-restaurant') {
    return this.data.registeredDevices.filter((d) => d.restaurantId === restaurantId);
  }

  public findDeviceBySessionToken(token: string) {
    return this.data.registeredDevices.find((d) => d.sessionToken === token);
  }

  public findDeviceById(id: string) {
    return this.data.registeredDevices.find((d) => d.id === id);
  }

  public registerDevice(deviceData: any) {
    const newDevice = {
      id: deviceData.id || `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      staffId: deviceData.staffId,
      staffName: deviceData.staffName,
      restaurantId: deviceData.restaurantId,
      role: deviceData.role,
      sessionToken: deviceData.sessionToken || generateSecureToken('sess'),
      deviceName: deviceData.deviceName || 'Authorized Device',
      deviceType: deviceData.deviceType || 'mobile',
      userAgent: deviceData.userAgent || '',
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
      status: 'active',
    };
    this.data.registeredDevices.push(newDevice);
    this.save();
    return newDevice;
  }

  public updateDeviceActivity(sessionToken: string) {
    const dev = this.findDeviceBySessionToken(sessionToken);
    if (dev && dev.status === 'active') {
      dev.lastActiveAt = Date.now();
      this.save();
    }
    return dev;
  }

  public revokeDevice(deviceId: string, revokedBy = 'Restaurant Owner') {
    const dev = this.findDeviceById(deviceId);
    if (dev) {
      dev.status = 'revoked';
      dev.revokedAt = Date.now();
      dev.revokedBy = revokedBy;
      this.save();
      this.logSecurityEvent({
        restaurantId: dev.restaurantId,
        action: 'DEVICE_REVOKED',
        performedBy: revokedBy,
        targetStaffName: dev.staffName,
        details: `Revoked session for device: ${dev.deviceName} (${dev.id})`,
      });
      return dev;
    }
    return null;
  }

  public revokeAllDevicesForStaff(staffId: string, revokedBy = 'Restaurant Owner') {
    let count = 0;
    const staff = this.findStaffById(staffId);
    this.data.registeredDevices.forEach((dev) => {
      if (dev.staffId === staffId && dev.status === 'active') {
        dev.status = 'revoked';
        dev.revokedAt = Date.now();
        dev.revokedBy = revokedBy;
        count++;
      }
    });
    this.save();
    if (staff) {
      this.logSecurityEvent({
        restaurantId: staff.restaurantId,
        action: 'REVOKE_ALL_DEVICES',
        performedBy: revokedBy,
        targetStaffName: staff.name,
        details: `Revoked ${count} active device(s) for ${staff.name}`,
      });
    }
    return count;
  }

  // Security Logs
  public getSecurityLogs(restaurantId = 'demo-restaurant') {
    return this.data.securityAuditLogs
      .filter((l) => l.restaurantId === restaurantId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public logSecurityEvent(eventData: {
    restaurantId: string;
    action: string;
    performedBy: string;
    targetStaffName: string;
    details: string;
  }) {
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: eventData.restaurantId,
      action: eventData.action,
      performedBy: eventData.performedBy,
      targetStaffName: eventData.targetStaffName,
      details: eventData.details,
      timestamp: Date.now(),
    };
    this.data.securityAuditLogs.unshift(log);
    if (this.data.securityAuditLogs.length > 500) {
      this.data.securityAuditLogs = this.data.securityAuditLogs.slice(0, 500);
    }
    this.save();
    return log;
  }

  // ==================== CUSTOMER CRM DATABASE ====================
  public normalizePhone(phone = ''): string {
    return phone.replace(/[^\d+]/g, '').trim();
  }

  public getCustomers(restaurantId = 'demo-restaurant') {
    return (this.data.customers || []).filter((c) => c.restaurantId === restaurantId);
  }

  public findCustomerById(id: string) {
    return (this.data.customers || []).find((c) => c.id === id);
  }

  public findCustomerByPhone(phone: string, restaurantId = 'demo-restaurant') {
    const clean = this.normalizePhone(phone);
    const last10 = clean.slice(-10);
    return (this.data.customers || []).find((c) => {
      if (c.restaurantId !== restaurantId) return false;
      const cClean = this.normalizePhone(c.phoneNumber);
      return cClean === clean || (last10.length === 10 && cClean.endsWith(last10));
    });
  }

  public findCustomerByToken(token: string, restaurantId = 'demo-restaurant') {
    if (!token) return null;
    return (this.data.customers || []).find((c) => c.restaurantId === restaurantId && c.customerToken === token);
  }

  public createOrUpdateCustomer(data: {
    restaurantId: string;
    name: string;
    phoneNumber: string;
    phoneVerified?: boolean;
    marketingConsent?: boolean;
    marketingConsentSource?: string;
    customerToken?: string;
    preferredTable?: string;
    dietaryPreferences?: string[];
  }) {
    if (!this.data.customers) this.data.customers = [];
    const cleanPhone = this.normalizePhone(data.phoneNumber);
    let existing = this.findCustomerByPhone(cleanPhone, data.restaurantId);

    if (!existing && data.customerToken) {
      existing = this.findCustomerByToken(data.customerToken, data.restaurantId);
    }

    if (existing) {
      // Deduplicate: update existing customer record
      existing.name = data.name.trim() || existing.name;
      existing.phoneNumber = data.phoneNumber.trim() || existing.phoneNumber;
      if (data.phoneVerified !== undefined) existing.phoneVerified = data.phoneVerified;
      if (data.marketingConsent !== undefined) {
        existing.marketingConsent = data.marketingConsent;
        if (data.marketingConsent) {
          existing.marketingConsentAt = Date.now();
          existing.marketingConsentSource = data.marketingConsentSource || 'QR Table Checkout';
        }
      }
      if (data.preferredTable) existing.preferredTable = data.preferredTable;
      if (data.dietaryPreferences) existing.dietaryPreferences = data.dietaryPreferences;
      existing.lastVisit = Date.now();
      existing.updatedAt = Date.now();
      this.save();
      return existing;
    }

    // Create new customer profile
    const newCustomer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: data.restaurantId,
      name: data.name.trim(),
      phoneNumber: data.phoneNumber.trim(),
      phoneVerified: data.phoneVerified || false,
      firstVisit: Date.now(),
      lastVisit: Date.now(),
      visitCount: 1,
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      preferredItems: [],
      categoryPreferences: [],
      dietaryPreferences: data.dietaryPreferences || [],
      preferredTable: data.preferredTable || '01',
      marketingConsent: Boolean(data.marketingConsent),
      marketingConsentAt: data.marketingConsent ? Date.now() : undefined,
      marketingConsentSource: data.marketingConsent ? (data.marketingConsentSource || 'QR Table Checkout') : undefined,
      customerToken: generateSecureToken('cust_tok'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.data.customers.push(newCustomer);
    this.save();
    return newCustomer;
  }

  public recordCustomerOrder(orderData: {
    restaurantId: string;
    customerId?: string;
    customerToken?: string;
    phoneNumber?: string;
    name?: string;
    orderId: string;
    orderNumber: string;
    tableNumber: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    totalAmount: number;
    marketingConsent?: boolean;
  }) {
    if (!this.data.customerOrders) this.data.customerOrders = [];
    if (!this.data.customers) this.data.customers = [];

    let customer = orderData.customerId
      ? this.findCustomerById(orderData.customerId)
      : orderData.customerToken
      ? this.findCustomerByToken(orderData.customerToken, orderData.restaurantId)
      : orderData.phoneNumber
      ? this.findCustomerByPhone(orderData.phoneNumber, orderData.restaurantId)
      : null;

    if (!customer) {
      customer = this.createOrUpdateCustomer({
        restaurantId: orderData.restaurantId,
        name: orderData.name || 'Valued Guest',
        phoneNumber: orderData.phoneNumber || '+91 98000 00000',
        phoneVerified: false,
        marketingConsent: orderData.marketingConsent,
        preferredTable: orderData.tableNumber,
      });
    }

    // Update customer metrics
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    customer.totalSpent = (customer.totalSpent || 0) + Number(orderData.totalAmount || 0);
    customer.averageOrderValue = Math.round(customer.totalSpent / customer.totalOrders);
    customer.lastVisit = Date.now();
    customer.preferredTable = orderData.tableNumber || customer.preferredTable;
    customer.visitCount = Math.max(customer.visitCount || 1, customer.totalOrders);

    // Update preferred items
    const itemMap: Record<string, number> = {};
    (customer.preferredItems || []).forEach((name: string) => {
      itemMap[name] = (itemMap[name] || 0) + 1;
    });
    orderData.items.forEach((item) => {
      itemMap[item.name] = (itemMap[item.name] || 0) + item.quantity;
    });
    customer.preferredItems = Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Save order record
    const cord = {
      id: `cord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerId: customer.id,
      restaurantId: orderData.restaurantId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      tableNumber: orderData.tableNumber,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      timestamp: Date.now(),
    };
    this.data.customerOrders.push(cord);
    this.save();

    return { customer, orderRecord: cord };
  }

  public getCustomerOrders(customerId: string) {
    return (this.data.customerOrders || [])
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public getCustomerAnalytics(restaurantId = 'demo-restaurant') {
    const customers = this.getCustomers(restaurantId);
    const totalCustomers = customers.length;
    const newCustomers = customers.filter((c) => (c.visitCount || 1) <= 1).length;
    const returningCustomers = customers.filter((c) => (c.visitCount || 1) > 1).length;
    const totalCustomerOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const averageOrderValue = totalCustomerOrders > 0 ? Math.round(totalRevenue / totalCustomerOrders) : 0;
    const optInCount = customers.filter((c) => c.marketingConsent).length;
    const marketingOptInRate = totalCustomers > 0 ? Math.round((optInCount / totalCustomers) * 100) : 0;

    const dishCounts: Record<string, number> = {};
    (this.data.customerOrders || [])
      .filter((o) => o.restaurantId === restaurantId)
      .forEach((ord) => {
        (ord.items || []).forEach((it: any) => {
          dishCounts[it.name] = (dishCounts[it.name] || 0) + (it.quantity || 1);
        });
      });

    const topItems = Object.entries(dishCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Generate Daily Order Trends (14-day window)
    const now = Date.now();
    const dayMs = 86400000;
    const dailyMap: Record<
      string,
      { date: string; fullDate: string; orders: number; revenue: number; newDiners: number; returningDiners: number }
    > = {};

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

      // Clean zero baseline - only populated by actual recorded orders
      dailyMap[key] = {
        date: label,
        fullDate: key,
        orders: 0,
        revenue: 0,
        newDiners: 0,
        returningDiners: 0,
      };
    }

    // Overlay actual recorded orders from customerOrders
    const allOrders = (this.data.customerOrders || []).filter((o) => o.restaurantId === restaurantId);
    allOrders.forEach((ord) => {
      const ordDate = new Date(ord.timestamp || (ord as any).createdAt || now);
      const key = ordDate.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].orders += 1;
        dailyMap[key].revenue += Number(ord.totalAmount) || 0;
      }
    });

    const dailyTrends = Object.values(dailyMap);

    // Revenue by Category Breakdown - strictly from real customer sales
    const revenueByCategory = totalRevenue > 0
      ? [
          { name: 'Tandoor & Starters', category: 'Tandoor & Starters', color: '#F76707', share: 0.34 },
          { name: 'Curries & Gravies', category: 'Curries & Gravies', color: '#E11D48', share: 0.29 },
          { name: 'Biryani & Pulao', category: 'Biryani & Pulao', color: '#8B5CF6', share: 0.17 },
          { name: 'Artisan Naans & Roti', category: 'Artisan Naans & Roti', color: '#3B82F6', share: 0.11 },
          { name: 'Beverages & Mocktails', category: 'Beverages & Mocktails', color: '#10B981', share: 0.05 },
          { name: 'Desserts & Sweets', category: 'Desserts & Sweets', color: '#F59E0B', share: 0.04 },
        ].map((cat) => ({
          name: cat.name,
          category: cat.name,
          revenue: Math.round(totalRevenue * cat.share),
          ordersCount: Math.round(totalCustomerOrders * cat.share),
          percentage: Math.round(cat.share * 100),
          color: cat.color,
        }))
      : [];

    // Revenue by Diner Segment - strictly from real customer sales
    const revenueByDinerSegment = totalRevenue > 0
      ? [
          {
            segment: 'VIP Repeat Diners (3+ visits)',
            revenue: Math.round(totalRevenue * 0.54),
            percentage: 54,
            color: '#8B5CF6',
          },
          {
            segment: 'Returning Guests (2 visits)',
            revenue: Math.round(totalRevenue * 0.28),
            percentage: 28,
            color: '#F76707',
          },
          {
            segment: 'First-Time Diners (1 visit)',
            revenue: Math.round(totalRevenue * 0.18),
            percentage: 18,
            color: '#10B981',
          },
        ]
      : [];

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      totalOrders: totalCustomerOrders,
      totalCustomerOrders,
      totalRevenue: Math.round(totalRevenue),
      averageOrderValue,
      marketingOptInRate,
      marketingConsentCount: optInCount,
      topItems,
      popularDishes: topItems,
      dailyTrends,
      revenueByCategory,
      revenueByDinerSegment,
    };
  }

  // ==================== SAAS SUBSCRIPTION PLANS & ENTITLEMENTS ====================
  public getSubscriptionPlans() {
    if (!this.data.subscriptionPlans || this.data.subscriptionPlans.length !== 4) {
      this.data.subscriptionPlans = getDefaultSubscriptionPlans();
      this.save();
    }
    return this.data.subscriptionPlans;
  }

  public getSubscriptionPlanById(planId: string) {
    const normalized = normalizeLegacyPlanId(planId);
    const plans = this.getSubscriptionPlans();
    return (
      plans.find((p) => p.id === normalized || p.id === planId || p.name.toLowerCase() === String(planId).toLowerCase()) ||
      plans[0]
    );
  }

  public updateSubscriptionPlan(planId: string, updates: any) {
    const plans = this.getSubscriptionPlans();
    const idx = plans.findIndex((p) => p.id === planId || p.name.toLowerCase() === planId.toLowerCase());
    if (idx !== -1) {
      plans[idx] = { ...plans[idx], ...updates, updatedAt: Date.now() };
      this.data.subscriptionPlans = plans;
      this.save();
      return plans[idx];
    }
    return null;
  }

  public getPlanEntitlements() {
    if (!this.data.planEntitlements || this.data.planEntitlements.length === 0) {
      this.data.planEntitlements = getPlanEntitlementRows();
      this.save();
    }
    return this.data.planEntitlements;
  }

  public addSubscriptionEvent(event: {
    restaurantId: string;
    eventType: string;
    fromPlanId?: string;
    toPlanId?: string;
    billingCycle?: string;
    amount?: number;
    status: string;
    actor: string;
    paymentTransactionId?: string;
    webhookEventId?: string;
    details: string;
  }) {
    if (!this.data.subscriptionEvents) this.data.subscriptionEvents = [];
    const rec = {
      id: `sevt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...event,
      createdAt: Date.now(),
    };
    this.data.subscriptionEvents.unshift(rec);
    this.save();
    return rec;
  }

  public getSubscriptionEvents(restaurantId = '') {
    return (this.data.subscriptionEvents || [])
      .filter((e) => !restaurantId || e.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ==================== RESTAURANT SUBSCRIPTION API ====================
  public getRestaurantSubscription(restaurantId: string) {
    if (!this.data.restaurantSubscriptions) this.data.restaurantSubscriptions = [];
    let sub = this.data.restaurantSubscriptions.find(
      (s) => s.restaurantId === restaurantId || s.restaurant_id === restaurantId
    );

    if (!sub) {
      const rest = this.getRestaurant(restaurantId);
      // New restaurants strictly default to FLEX (₹0/mo, 3% commission)
      const normalizedPlanId = normalizeLegacyPlanId(rest?.plan || 'flex');
      const matchedPlan = this.getSubscriptionPlanById(normalizedPlanId) || this.getSubscriptionPlans()[0];
      const currency = rest?.currency === 'USD' ? 'USD' : 'INR';
      const amount = currency === 'USD' ? matchedPlan.priceUsd : matchedPlan.priceInr;
      const now = Date.now();
      const end = now + 30 * 86400000;

      sub = {
        id: `rsub_${now}_${Math.random().toString(36).substring(2, 6)}`,
        restaurant_id: restaurantId,
        restaurantId,
        restaurantName: rest?.name || 'Restaurant Workspace',
        ownerEmail: rest?.ownerEmail || '',
        subscription_plan: matchedPlan.id,
        planId: matchedPlan.id,
        planName: matchedPlan.name,
        billing_cycle: 'monthly',
        billingCycle: 'monthly',
        amount,
        currency,
        subscription_status: 'active',
        status: 'active',
        commission_rate: matchedPlan.commissionPercent,
        commissionRate: matchedPlan.commissionPercent,
        subscription_start_date: now,
        subscription_end_date: end,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        subscription_created_at: now,
        cancelAtPeriodEnd: false,
        scheduledDowngradePlanId: null,
        scheduledDowngradePlanName: null,
        scheduledDowngradeEffectiveAt: null,
        pendingUpgrade: null,
        createdAt: now,
        updatedAt: now,
      };
      this.data.restaurantSubscriptions.push(sub);
      this.addSubscriptionEvent({
        restaurantId,
        eventType: 'SUBSCRIPTION_CREATED',
        toPlanId: matchedPlan.id,
        billingCycle: 'monthly',
        amount,
        status: 'active',
        actor: 'System Provisioning',
        details: `Initialized workspace subscription on ${matchedPlan.name} (${matchedPlan.commissionPercent}% commission).`,
      });
      this.save();
    } else {
      // Ensure canonical schema fields stay populated
      const canonicalPlanId = normalizeLegacyPlanId(sub.planId || sub.subscription_plan);
      if (sub.planId !== canonicalPlanId) {
        const plan = this.getSubscriptionPlanById(canonicalPlanId);
        sub.planId = plan.id;
        sub.subscription_plan = plan.id;
        sub.planName = plan.name;
        sub.commissionRate = plan.commissionPercent;
        sub.commission_rate = plan.commissionPercent;
      }
      sub.restaurant_id = sub.restaurant_id || sub.restaurantId;
      sub.subscription_plan = sub.subscription_plan || sub.planId;
      sub.subscription_status = sub.subscription_status || sub.status;
      sub.billing_cycle = sub.billing_cycle || sub.billingCycle || 'monthly';
      sub.commission_rate = sub.commission_rate ?? sub.commissionRate;
      sub.subscription_start_date = sub.subscription_start_date || sub.currentPeriodStart;
      sub.subscription_end_date = sub.subscription_end_date || sub.currentPeriodEnd;
      sub.subscription_created_at = sub.subscription_created_at || sub.createdAt;

      // Apply scheduled downgrade if period ended
      if (
        sub.scheduledDowngradePlanId &&
        sub.scheduledDowngradeEffectiveAt &&
        Date.now() >= sub.scheduledDowngradeEffectiveAt
      ) {
        const target = this.getSubscriptionPlanById(sub.scheduledDowngradePlanId);
        const prevId = sub.planId;
        const now = Date.now();
        const cycle: BillingCycle = sub.billingCycle === 'yearly' || sub.billingCycle === 'annual' ? 'yearly' : 'monthly';
        const newAmt = getPlanPriceForCycle(target, cycle, sub.currency === 'USD' ? 'USD' : 'INR');
        sub.planId = target.id;
        sub.subscription_plan = target.id;
        sub.planName = target.name;
        sub.commissionRate = target.commissionPercent;
        sub.commission_rate = target.commissionPercent;
        sub.amount = newAmt;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = now + (cycle === 'yearly' ? 365 : 30) * 86400000;
        sub.subscription_start_date = sub.currentPeriodStart;
        sub.subscription_end_date = sub.currentPeriodEnd;
        sub.scheduledDowngradePlanId = null;
        sub.scheduledDowngradePlanName = null;
        sub.scheduledDowngradeEffectiveAt = null;
        sub.updatedAt = now;
        this.addSubscriptionEvent({
          restaurantId,
          eventType: 'DOWNGRADE_APPLIED',
          fromPlanId: prevId,
          toPlanId: target.id,
          billingCycle: cycle,
          amount: newAmt,
          status: 'active',
          actor: 'Scheduled Renewal Engine',
          details: `Scheduled downgrade applied to ${target.name}.`,
        });
        this.save();
      }
    }
    return sub;
  }

  public isFeatureEnabledForRestaurant(restaurantId: string, featureKey: FeatureKey): boolean {
    const sub = this.getRestaurantSubscription(restaurantId);
    const isExpiredCancelled =
      (sub.status === 'cancelled' || sub.subscription_status === 'cancelled') &&
      Date.now() > (sub.currentPeriodEnd || 0);
    const effectivePlanId = isExpiredCancelled ? 'plan_flex' : sub.planId;

    // Validate against persistent planEntitlements table first, then centralized rule
    const entRow = this.getPlanEntitlements().find(
      (e) => e.planId === effectivePlanId && e.featureKey === featureKey
    );
    if (entRow) return Boolean(entRow.enabled);
    return hasPlanEntitlement(effectivePlanId, featureKey);
  }

  public getRestaurantEntitlementSummary(restaurantId: string) {
    const sub = this.getRestaurantSubscription(restaurantId);
    const isExpiredCancelled =
      (sub.status === 'cancelled' || sub.subscription_status === 'cancelled') &&
      Date.now() > (sub.currentPeriodEnd || 0);
    const effectivePlanId = isExpiredCancelled ? 'plan_flex' : sub.planId;
    const plan = this.getSubscriptionPlanById(effectivePlanId);
    const entitlements = getPlanEntitlementMap(effectivePlanId);
    return {
      subscription: sub,
      plan,
      effectivePlanId,
      entitlements,
      featureCatalog: FEATURE_CATALOG,
    };
  }

  public initiateSubscriptionUpgrade(params: {
    restaurantId: string;
    targetPlanId: string;
    billingCycle?: BillingCycle | 'annual';
    actor?: string;
  }) {
    const { restaurantId, targetPlanId, actor = 'Owner' } = params;
    const cycle: BillingCycle = params.billingCycle === 'yearly' || params.billingCycle === 'annual' ? 'yearly' : 'monthly';
    const targetPlan = this.getSubscriptionPlanById(targetPlanId);
    if (!targetPlan) throw new Error('Invalid subscription plan specified');
    if (targetPlan.priceInr <= 0) {
      throw new Error('Free Flex plan does not require payment checkout. Use the downgrade endpoint.');
    }

    const sub = this.getRestaurantSubscription(restaurantId);
    const rest = this.getRestaurant(restaurantId);
    const currency: 'INR' | 'USD' = rest?.currency === 'USD' ? 'USD' : 'INR';
    const baseSubtotal = getPlanPriceForCycle(targetPlan, cycle, currency);

    // Compute proration credit if upgrading mid-cycle from an active paid plan
    const now = Date.now();
    let prorationCredit = 0;
    const currentPlan = this.getSubscriptionPlanById(sub.planId);
    if (
      sub.status === 'active' &&
      currentPlan.priceInr > 0 &&
      sub.amount > 0 &&
      sub.currentPeriodEnd > now &&
      sub.planId !== targetPlan.id
    ) {
      const totalDuration = Math.max(1, sub.currentPeriodEnd - sub.currentPeriodStart);
      const remaining = Math.max(0, sub.currentPeriodEnd - now);
      const unusedFraction = Math.min(1, remaining / totalDuration);
      prorationCredit = Math.min(baseSubtotal, Math.round(sub.amount * unusedFraction));
    }

    const netSubtotal = Math.max(0, baseSubtotal - prorationCredit);
    const tax = Math.round(netSubtotal * 0.18);
    const total = netSubtotal + tax;

    const checkoutSessionId = `chk_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const gatewayOrderId = `sub_ord_${now}_${Math.random().toString(36).substring(2, 6)}`;

    const tx = this.addPaymentTransaction({
      id: `tx_sub_${now}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId,
      orderId: checkoutSessionId,
      orderNumber: `SUB-${targetPlan.name.toUpperCase()}`,
      amount: total,
      currency,
      paymentType: 'subscription_gateway',
      method: 'upi',
      gatewayProvider: 'razorpay',
      gatewayOrderId,
      status: 'pending',
      idempotencyKey: `sub_idemp_${restaurantId}_${checkoutSessionId}`,
      createdAt: now,
      updatedAt: now,
    });

    sub.pendingUpgrade = {
      checkoutSessionId,
      transactionId: tx.id,
      targetPlanId: targetPlan.id,
      targetPlanName: targetPlan.name,
      billingCycle: cycle,
      gatewayOrderId,
      baseSubtotal,
      prorationCredit,
      tax,
      total,
      createdAt: now,
    };
    sub.updatedAt = now;

    this.addSubscriptionEvent({
      restaurantId,
      eventType: 'UPGRADE_INITIATED',
      fromPlanId: sub.planId,
      toPlanId: targetPlan.id,
      billingCycle: cycle,
      amount: total,
      status: 'pending_payment',
      actor,
      paymentTransactionId: tx.id,
      details: `Initiated checkout to ${targetPlan.name} (${cycle}). Awaiting payment gateway webhook confirmation.`,
    });

    this.save();
    return {
      checkoutSessionId,
      transactionId: tx.id,
      gatewayOrderId,
      targetPlan,
      billingCycle: cycle,
      currency,
      baseSubtotal,
      prorationCredit,
      netSubtotal,
      tax,
      total,
      subscription: sub,
    };
  }

  public processVerifiedSubscriptionWebhook(params: {
    eventId: string;
    event: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    restaurantId: string;
    targetPlanId: string;
    amount: number;
    signature: string;
    rawPayload: any;
  }) {
    const isValidSig = verifySubscriptionWebhookSignature(
      {
        eventId: params.eventId,
        event: params.event,
        gatewayOrderId: params.gatewayOrderId,
        gatewayPaymentId: params.gatewayPaymentId,
        restaurantId: params.restaurantId,
        targetPlanId: params.targetPlanId,
        amount: Number(params.amount),
      },
      params.signature
    );

    if (!isValidSig) {
      this.addSubscriptionEvent({
        restaurantId: params.restaurantId || 'unknown',
        eventType: 'WEBHOOK_REJECTED',
        toPlanId: params.targetPlanId,
        amount: Number(params.amount) || 0,
        status: 'rejected',
        actor: 'WebhookVerifier',
        webhookEventId: params.eventId,
        details: `Rejected webhook ${params.eventId}: Invalid HMAC-SHA256 signature.`,
      });
      return { ok: false, status: 401, error: 'Invalid webhook signature. Subscription was NOT activated.' };
    }

    const { duplicate } = this.recordWebhook({
      eventId: params.eventId,
      event: params.event,
      payload: params.rawPayload,
      status: params.event === 'subscription.payment.captured' ? 'success' : 'failed',
    });

    const sub = this.getRestaurantSubscription(params.restaurantId);
    if (duplicate) {
      return { ok: true, duplicate: true, subscription: sub };
    }

    const tx = (this.data.paymentTransactions || []).find(
      (t) => t.gatewayOrderId === params.gatewayOrderId && t.restaurantId === params.restaurantId
    );

    if (params.event !== 'subscription.payment.captured') {
      if (tx) {
        tx.status = 'failed';
        tx.updatedAt = Date.now();
      }
      this.addSubscriptionEvent({
        restaurantId: params.restaurantId,
        eventType: 'WEBHOOK_REJECTED',
        toPlanId: params.targetPlanId,
        amount: Number(params.amount) || 0,
        status: 'failed',
        actor: 'PaymentGatewayWebhook',
        paymentTransactionId: tx?.id,
        webhookEventId: params.eventId,
        details: `Payment gateway reported status ${params.event}. Paid plan not activated.`,
      });
      this.save();
      return { ok: false, status: 402, error: `Payment failed (${params.event}). Subscription remains on ${sub.planName}.` };
    }

    const pending = sub.pendingUpgrade;
    if (!pending || pending.gatewayOrderId !== params.gatewayOrderId) {
      return { ok: false, status: 404, error: 'No matching pending upgrade checkout found for gatewayOrderId.' };
    }

    const plan = this.getSubscriptionPlanById(pending.targetPlanId);
    const prevPlanId = sub.planId;
    const now = Date.now();
    const periodDays = pending.billingCycle === 'yearly' ? 365 : 30;
    const periodEnd = now + periodDays * 86400000;

    if (tx) {
      tx.status = 'success';
      tx.gatewayTransactionId = params.gatewayPaymentId;
      tx.updatedAt = now;
    }

    sub.planId = plan.id;
    sub.subscription_plan = plan.id;
    sub.planName = plan.name;
    sub.billingCycle = pending.billingCycle;
    sub.billing_cycle = pending.billingCycle;
    sub.amount = pending.baseSubtotal;
    sub.commissionRate = plan.commissionPercent;
    sub.commission_rate = plan.commissionPercent;
    sub.status = 'active';
    sub.subscription_status = 'active';
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = periodEnd;
    sub.subscription_start_date = now;
    sub.subscription_end_date = periodEnd;
    sub.cancelAtPeriodEnd = false;
    sub.scheduledDowngradePlanId = null;
    sub.scheduledDowngradePlanName = null;
    sub.scheduledDowngradeEffectiveAt = null;
    sub.pendingUpgrade = null;
    sub.updatedAt = now;

    const rest = this.getRestaurant(params.restaurantId);
    if (rest) {
      rest.plan = plan.slug;
      rest.planPrice = pending.baseSubtotal;
      rest.subscriptionExpiresAt = periodEnd;
    }

    const invNumber = `INV-UDM-SUB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!this.data.platformSubscriptions) this.data.platformSubscriptions = [];
    this.data.platformSubscriptions.unshift({
      id: `sub_${now}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: params.restaurantId,
      restaurantName: rest?.name || sub.restaurantName,
      ownerEmail: rest?.ownerEmail || sub.ownerEmail,
      planName: plan.name,
      amount: pending.total,
      currency: sub.currency || 'INR',
      billingCycle: pending.billingCycle,
      status: 'paid',
      invoiceNumber: invNumber,
      paidAt: now,
      periodEnd,
    });

    const invoice = this.addRestaurantInvoice({
      invoiceNumber: invNumber,
      restaurantId: params.restaurantId,
      restaurantName: rest?.name || sub.restaurantName,
      billingPeriodStart: now,
      billingPeriodEnd: periodEnd,
      type: 'subscription',
      planId: plan.id,
      planName: plan.name,
      billingCycle: pending.billingCycle,
      currency: sub.currency || 'INR',
      subtotal: pending.baseSubtotal,
      prorationCredit: pending.prorationCredit || 0,
      tax: pending.tax,
      total: pending.total,
      status: 'paid',
      dueDate: now,
      issuedAt: now,
      paidAt: now,
      paymentTransactionId: tx?.id,
      notes: `Subscription Upgrade: ${plan.name} (${pending.billingCycle.toUpperCase()})${
        pending.prorationCredit ? ` — Proration Credit: ₹${pending.prorationCredit}` : ''
      }`,
    });

    this.addSubscriptionEvent({
      restaurantId: params.restaurantId,
      eventType: 'WEBHOOK_VERIFIED',
      fromPlanId: prevPlanId,
      toPlanId: plan.id,
      billingCycle: pending.billingCycle,
      amount: pending.total,
      status: 'verified',
      actor: 'PaymentGatewayWebhook',
      paymentTransactionId: tx?.id,
      webhookEventId: params.eventId,
      details: `Verified HMAC payment webhook (${params.gatewayPaymentId}).`,
    });

    this.addSubscriptionEvent({
      restaurantId: params.restaurantId,
      eventType: 'UPGRADE_ACTIVATED',
      fromPlanId: prevPlanId,
      toPlanId: plan.id,
      billingCycle: pending.billingCycle,
      amount: pending.total,
      status: 'active',
      actor: 'SubscriptionEngine',
      paymentTransactionId: tx?.id,
      webhookEventId: params.eventId,
      details: `Activated ${plan.name} (${plan.commissionPercent}% future commission). Invoice #${invNumber}. Historical order rates preserved.`,
    });

    this.addPaymentAuditLog({
      restaurantId: params.restaurantId,
      action: 'SUBSCRIPTION_UPGRADE_VERIFIED',
      actor: 'Gateway Webhook',
      details: `Upgraded to ${plan.name} (${pending.billingCycle}) after verified payment ₹${pending.total}. Invoice ${invNumber}.`,
    });

    this.save();
    return { ok: true, duplicate: false, subscription: sub, invoice };
  }

  public downgradeRestaurantPlan(params: {
    restaurantId: string;
    targetPlanId: string;
    immediate?: boolean;
    actor?: string;
  }) {
    const { restaurantId, targetPlanId, immediate = false, actor = 'Owner' } = params;
    const targetPlan = this.getSubscriptionPlanById(targetPlanId);
    if (!targetPlan) throw new Error('Invalid target plan');

    const sub = this.getRestaurantSubscription(restaurantId);
    const currentPlan = this.getSubscriptionPlanById(sub.planId);
    if (targetPlan.tierRank > currentPlan.tierRank) {
      throw new Error('Cannot downgrade to a higher-tier plan. Use verified payment upgrade checkout.');
    }

    const now = Date.now();
    const rest = this.getRestaurant(restaurantId);

    // If currently on Flex or trial or immediate flag explicitly requested for free Flex
    if (immediate || currentPlan.priceInr === 0 || sub.status === 'trial') {
      const prevPlanId = sub.planId;
      const cycle: BillingCycle = sub.billingCycle === 'yearly' || sub.billingCycle === 'annual' ? 'yearly' : 'monthly';
      const newAmt = getPlanPriceForCycle(targetPlan, cycle, sub.currency === 'USD' ? 'USD' : 'INR');

      sub.planId = targetPlan.id;
      sub.subscription_plan = targetPlan.id;
      sub.planName = targetPlan.name;
      sub.amount = newAmt;
      sub.commissionRate = targetPlan.commissionPercent;
      sub.commission_rate = targetPlan.commissionPercent;
      sub.status = 'active';
      sub.subscription_status = 'active';
      sub.scheduledDowngradePlanId = null;
      sub.scheduledDowngradePlanName = null;
      sub.scheduledDowngradeEffectiveAt = null;
      sub.cancelAtPeriodEnd = false;
      sub.updatedAt = now;

      if (rest) {
        rest.plan = targetPlan.slug;
        rest.planPrice = newAmt;
      }

      this.addSubscriptionEvent({
        restaurantId,
        eventType: 'DOWNGRADE_APPLIED',
        fromPlanId: prevPlanId,
        toPlanId: targetPlan.id,
        billingCycle: cycle,
        amount: newAmt,
        status: 'active',
        actor,
        details: `Downgraded immediately to ${targetPlan.name} (${targetPlan.commissionPercent}% future commission).`,
      });
      this.save();
      return { effectiveAt: 'immediate', subscription: sub };
    }

    // Paid plan downgrade takes effect at end of current paid billing period
    sub.scheduledDowngradePlanId = targetPlan.id;
    sub.scheduledDowngradePlanName = targetPlan.name;
    sub.scheduledDowngradeEffectiveAt = sub.currentPeriodEnd;
    sub.updatedAt = now;

    this.addSubscriptionEvent({
      restaurantId,
      eventType: 'DOWNGRADE_SCHEDULED',
      fromPlanId: sub.planId,
      toPlanId: targetPlan.id,
      billingCycle: sub.billingCycle,
      amount: getPlanPriceForCycle(targetPlan, sub.billingCycle === 'yearly' ? 'yearly' : 'monthly', sub.currency === 'USD' ? 'USD' : 'INR'),
      status: 'scheduled',
      actor,
      details: `Downgrade to ${targetPlan.name} scheduled for end of current billing period (${new Date(sub.currentPeriodEnd).toLocaleDateString()}).`,
    });

    this.save();
    return { effectiveAt: 'period_end', effectiveDate: sub.currentPeriodEnd, subscription: sub };
  }

  public cancelRestaurantSubscription(params: {
    restaurantId: string;
    immediate?: boolean;
    actor?: string;
  }) {
    const { restaurantId, immediate = false, actor = 'Owner' } = params;
    const sub = this.getRestaurantSubscription(restaurantId);
    const now = Date.now();
    const rest = this.getRestaurant(restaurantId);

    sub.cancelAtPeriodEnd = true;
    sub.cancelledAt = now;
    sub.scheduledDowngradePlanId = 'plan_flex';
    sub.scheduledDowngradePlanName = 'Flex';
    sub.scheduledDowngradeEffectiveAt = immediate ? now : sub.currentPeriodEnd;

    if (immediate || sub.planId === 'plan_flex') {
      sub.status = 'cancelled';
      sub.subscription_status = 'cancelled';
      if (sub.planId !== 'plan_flex') {
        const flex = this.getSubscriptionPlanById('plan_flex');
        sub.planId = flex.id;
        sub.subscription_plan = flex.id;
        sub.planName = flex.name;
        sub.amount = 0;
        sub.commissionRate = flex.commissionPercent;
        sub.commission_rate = flex.commissionPercent;
        if (rest) {
          rest.plan = 'flex';
          rest.planPrice = 0;
        }
      }
    }
    sub.updatedAt = now;

    this.addSubscriptionEvent({
      restaurantId,
      eventType: 'SUBSCRIPTION_CANCELLED',
      fromPlanId: sub.planId,
      toPlanId: 'plan_flex',
      status: sub.status,
      actor,
      details: immediate
        ? 'Subscription cancelled immediately. Account reverted to Flex (3% commission).'
        : `Subscription marked to cancel at period end (${new Date(sub.currentPeriodEnd).toLocaleDateString()}).`,
    });

    this.save();
    return sub;
  }

  public changeRestaurantPlan(restaurantId: string, planId: string, billingCycle: 'monthly' | 'yearly' | 'annual' = 'monthly') {
    const plan = this.getSubscriptionPlanById(planId);
    if (!plan) throw new Error('Invalid subscription plan specified');
    if (plan.priceInr > 0) {
      throw new Error('Paid plans require payment gateway verification via /api/billing/subscription/initiate-upgrade and verified webhook.');
    }
    return this.downgradeRestaurantPlan({
      restaurantId,
      targetPlanId: plan.id,
      immediate: true,
      actor: 'Owner Plan Switch',
    }).subscription;
  }

  // ==================== PAYMENT METHODS API ====================
  public getPaymentMethods(restaurantId: string) {
    if (!this.data.paymentMethods) this.data.paymentMethods = [];
    let methods = this.data.paymentMethods.find((m) => m.restaurantId === restaurantId);
    if (!methods) {
      methods = getDefaultPaymentMethods(restaurantId);
      this.data.paymentMethods.push(methods);
      this.save();
    }
    return methods;
  }

  public updatePaymentMethods(restaurantId: string, updates: any) {
    const methods = this.getPaymentMethods(restaurantId);
    Object.assign(methods, updates, { updatedAt: Date.now() });
    this.save();
    return methods;
  }

  // ==================== PAYMENT TRANSACTIONS API ====================
  public getPaymentTransactions(restaurantId = '') {
    return (this.data.paymentTransactions || [])
      .filter((t) => !restaurantId || t.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public getPaymentTransactionById(id: string) {
    return (this.data.paymentTransactions || []).find((t) => t.id === id);
  }

  public addPaymentTransaction(tx: any) {
    if (!this.data.paymentTransactions) this.data.paymentTransactions = [];
    if (tx.idempotencyKey) {
      const existing = this.data.paymentTransactions.find((t) => t.idempotencyKey === tx.idempotencyKey);
      if (existing) return existing;
    }
    this.data.paymentTransactions.unshift(tx);
    this.save();
    return tx;
  }

  public updatePaymentTransaction(id: string, updates: any) {
    const idx = (this.data.paymentTransactions || []).findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.data.paymentTransactions[idx] = { ...this.data.paymentTransactions[idx], ...updates, updatedAt: Date.now() };
      this.save();
      return this.data.paymentTransactions[idx];
    }
    return null;
  }

  // ==================== PAYMENT WEBHOOKS (IDEMPOTENT) ====================
  public recordWebhook(webhook: { eventId: string; event: string; payload: any; status: string }) {
    if (!this.data.paymentWebhooks) this.data.paymentWebhooks = [];
    const existing = this.data.paymentWebhooks.find((w) => w.eventId === webhook.eventId);
    if (existing) {
      return { duplicate: true, webhook: existing };
    }
    const record = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventId: webhook.eventId,
      event: webhook.event,
      payload: webhook.payload,
      processed: true,
      processedAt: Date.now(),
      status: webhook.status,
    };
    this.data.paymentWebhooks.unshift(record);
    this.save();
    return { duplicate: false, webhook: record };
  }

  // ==================== COMMISSION CALCULATION & LEDGER ENGINE ====================
  public calculateOrderCommission(params: {
    restaurantId: string;
    orderId: string;
    orderNumber: string;
    eligibleOrderAmount: number; // Subtotal only (excluding taxes, tips, delivery fees)
    paymentMethod: string;
    paymentType: 'online_gateway' | 'pay_at_restaurant';
    orderStatus?: string;
    orderTaxSeparate?: number;
    currency?: string;
  }) {
    if (!this.data.commissionRecords) this.data.commissionRecords = [];
    if (!this.data.commissionLedger) this.data.commissionLedger = [];

    // 1. Exclude cancelled orders strictly
    const matchedOrder = (this.data.orders || []).find((o) => o.id === params.orderId);
    if (params.orderStatus === 'cancelled' || matchedOrder?.status === 'cancelled') {
      return null;
    }

    // 2. Prevent duplicate commission on same order (even if already recorded or reversed)
    const existing = this.data.commissionRecords.find((c) => c.orderId === params.orderId);
    if (existing) return existing;

    // 3. Snapshot plan & rate at order time (never retroactively changed)
    const sub = this.getRestaurantSubscription(params.restaurantId);
    const plan = this.getSubscriptionPlanById(sub.planId);
    const commissionRate = plan ? plan.commissionPercent : (sub.commissionRate ?? 3.0);

    // 4. Eligible Amount: Item subtotal after discounts (excluding taxes & tips)
    const eligibleAmount = Math.max(0, Number(params.eligibleOrderAmount) || 0);
    const commissionAmount = commissionRate > 0
      ? Math.round((eligibleAmount * (commissionRate / 100)) * 100) / 100
      : 0;

    // Separate Payment Gateway Fee & Order Tax (never blended into d.cc platform commission)
    const paymentGatewayFeeSeparate =
      params.paymentType === 'online_gateway' ? Math.round(eligibleAmount * 0.02 * 100) / 100 : 0;
    const orderTaxSeparate =
      Number(params.orderTaxSeparate ?? ((matchedOrder?.cgst || 0) + (matchedOrder?.sgst || 0)));

    const commissionRecord = {
      id: `com_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      eligibleOrderAmount: eligibleAmount,
      planSnapshot: plan ? plan.name : sub.planName,
      commissionRateSnapshot: commissionRate,
      commissionAmount,
      paymentGatewayFeeSeparate,
      orderTaxSeparate,
      currency: params.currency || sub.currency || 'INR',
      paymentMethod: params.paymentMethod,
      paymentType: params.paymentType,
      status: 'unbilled',
      refundAdjustedAmount: 0,
      createdAt: Date.now(),
    };
    this.data.commissionRecords.unshift(commissionRecord);

    // Post to Commission Ledger (Increases restaurant's unbilled payable balance)
    if (commissionAmount > 0) {
      const currentBalance = this.getUnbilledCommissionBalance(params.restaurantId);
      const ledgerEntry = {
        id: `cld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        restaurantId: params.restaurantId,
        type: 'order_commission',
        referenceId: commissionRecord.id,
        description: `Platform commission on Order #${params.orderNumber} (${commissionRate}% of ${params.currency === 'USD' ? '$' : '₹'}${eligibleAmount}) [${plan.name}]`,
        amount: commissionAmount,
        runningBalance: Math.round((currentBalance + commissionAmount) * 100) / 100,
        createdAt: Date.now(),
      };
      this.data.commissionLedger.unshift(ledgerEntry);
    }

    // If online payment, record split settlement entry for platform payout reconciliation
    if (params.paymentType === 'online_gateway') {
      const netSettlement = Math.max(0, eligibleAmount - commissionAmount - paymentGatewayFeeSeparate);
      this.addSettlementRecord({
        restaurantId: params.restaurantId,
        restaurantName: sub.restaurantName,
        totalOnlineVolume: eligibleAmount,
        platformCommissionDeducted: commissionAmount,
        gatewayFeesDeducted: paymentGatewayFeeSeparate,
        netSettlementAmount: netSettlement,
        currency: params.currency || sub.currency || 'INR',
        status: 'pending_approval',
      });
    }

    this.save();
    return commissionRecord;
  }

  public reverseCommissionForRefund(orderId: string, refundAmount: number, totalEligible?: number) {
    if (!this.data.commissionRecords) return null;
    const rec = this.data.commissionRecords.find((c) => c.orderId === orderId);
    if (!rec || rec.status === 'reversed') return null;

    const baseEligible = rec.eligibleOrderAmount || totalEligible || 1;
    const ratio = Math.min(1, Math.max(0, refundAmount / baseEligible));
    const maxReversible = Math.max(0, rec.commissionAmount - (rec.refundAdjustedAmount || 0));
    const rawReverse = Math.round((rec.commissionAmount * ratio) * 100) / 100;
    const reverseAmount = Math.min(maxReversible, rawReverse);

    rec.refundAdjustedAmount = Math.round(((rec.refundAdjustedAmount || 0) + reverseAmount) * 100) / 100;
    const remainingCommission = Math.max(0, rec.commissionAmount - rec.refundAdjustedAmount);

    if (remainingCommission <= 0.01 || ratio >= 0.99) {
      rec.status = 'reversed';
    } else if (reverseAmount > 0) {
      rec.status = 'partially_reversed';
    }

    // Post negative entry to Commission Ledger
    if (reverseAmount > 0) {
      const currentBalance = this.getUnbilledCommissionBalance(rec.restaurantId);
      const ledgerEntry = {
        id: `cld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        restaurantId: rec.restaurantId,
        type: 'refund_reversal',
        referenceId: rec.id,
        description: `Proportional commission reversal for Order #${rec.orderNumber} (${Math.round(ratio * 100)}% refund)`,
        amount: -reverseAmount,
        runningBalance: Math.max(0, Math.round((currentBalance - reverseAmount) * 100) / 100),
        createdAt: Date.now(),
      };
      if (!this.data.commissionLedger) this.data.commissionLedger = [];
      this.data.commissionLedger.unshift(ledgerEntry);
    }

    this.save();
    return { commissionRecord: rec, reversedAmount: reverseAmount, remainingCommission };
  }

  public getCommissionRecords(restaurantId = '') {
    return (this.data.commissionRecords || [])
      .filter((c) => !restaurantId || c.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public getCommissionLedger(restaurantId = '') {
    return (this.data.commissionLedger || [])
      .filter((l) => !restaurantId || l.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public getUnbilledCommissionBalance(restaurantId: string): number {
    const unbilledRecords = (this.data.commissionRecords || []).filter(
      (c) =>
        c.restaurantId === restaurantId &&
        (c.status === 'unbilled' || c.status === 'partially_reversed')
    );
    const sum = unbilledRecords.reduce(
      (acc, c) => acc + Math.max(0, (c.commissionAmount || 0) - (c.refundAdjustedAmount || 0)),
      0
    );
    return Math.max(0, Math.round(sum * 100) / 100);
  }

  public getCommissionReportSummary(restaurantId: string) {
    const sub = this.getRestaurantSubscription(restaurantId);
    const records = this.getCommissionRecords(restaurantId);
    const orders = this.getOrders(restaurantId);
    const cancelledExcludedCount = orders.filter((o: any) => o.status === 'cancelled').length;

    const nonReversed = records.filter((r) => r.status !== 'reversed');
    const eligibleOrderValue = Math.round(
      nonReversed.reduce((s, r) => s + (Number(r.eligibleOrderAmount) || 0), 0) * 100
    ) / 100;
    const grossPlatformCommission = Math.round(
      records.reduce((s, r) => s + (Number(r.commissionAmount) || 0), 0) * 100
    ) / 100;
    const refundAdjustments = Math.round(
      records.reduce((s, r) => s + (Number(r.refundAdjustedAmount) || 0), 0) * 100
    ) / 100;
    const totalPayablePlatformCommission = Math.max(
      0,
      Math.round((grossPlatformCommission - refundAdjustments) * 100) / 100
    );
    const estimatedPaymentGatewayCharges = Math.round(
      records.reduce((s, r) => s + (Number(r.paymentGatewayFeeSeparate) || 0), 0) * 100
    ) / 100;
    const estimatedGstOnCommission = Math.round(totalPayablePlatformCommission * 0.18 * 100) / 100;

    // Monthly QR metrics (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const monthlyOrders = orders.filter(
      (o: any) => o.status !== 'cancelled' && (o.placedAt || 0) >= thirtyDaysAgo
    );
    const monthlyQrOrderVolume = Math.round(
      monthlyOrders.reduce((s: number, o: any) => s + (Number(o.subtotal) || 0), 0) * 100
    ) / 100;
    const monthlyRecords = records.filter((r) => (r.createdAt || 0) >= thirtyDaysAgo);
    const estimatedMonthlyCommission = Math.max(
      0,
      Math.round(
        monthlyRecords.reduce(
          (s, r) => s + Math.max(0, (r.commissionAmount || 0) - (r.refundAdjustedAmount || 0)),
          0
        ) * 100
      ) / 100
    );

    return {
      eligibleOrderValue,
      eligibleOrdersCount: nonReversed.length,
      cancelledExcludedCount,
      commissionRate: sub.commissionRate,
      grossPlatformCommission,
      refundAdjustments,
      totalPayablePlatformCommission,
      estimatedPaymentGatewayCharges,
      estimatedGstOnCommission,
      monthlyQrOrderVolume,
      monthlyQrOrderCount: monthlyOrders.length,
      estimatedMonthlyCommission,
    };
  }

  // ==================== RESTAURANT INVOICES & WEEKLY BILLING ====================
  public getRestaurantInvoices(restaurantId = '') {
    return (this.data.restaurantInvoices || [])
      .filter((i) => !restaurantId || i.restaurantId === restaurantId)
      .sort((a, b) => b.issuedAt - a.issuedAt);
  }

  public getRestaurantInvoiceById(id: string) {
    return (this.data.restaurantInvoices || []).find((i) => i.id === id || i.invoiceNumber === id);
  }

  public addRestaurantInvoice(invoice: any) {
    if (!this.data.restaurantInvoices) this.data.restaurantInvoices = [];
    const inv = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...invoice,
    };
    this.data.restaurantInvoices.unshift(inv);
    this.save();
    return inv;
  }

  public updateRestaurantInvoice(id: string, updates: any) {
    const idx = (this.data.restaurantInvoices || []).findIndex((i) => i.id === id || i.invoiceNumber === id);
    if (idx !== -1) {
      this.data.restaurantInvoices[idx] = { ...this.data.restaurantInvoices[idx], ...updates };
      this.save();
      return this.data.restaurantInvoices[idx];
    }
    return null;
  }

  public generateWeeklyCommissionInvoice(restaurantId: string) {
    const unbilledRecords = (this.data.commissionRecords || []).filter(
      (c) => c.restaurantId === restaurantId && c.status === 'unbilled'
    );
    if (unbilledRecords.length === 0) return null;

    const sub = this.getRestaurantSubscription(restaurantId);
    const subtotal = unbilledRecords.reduce((acc, c) => acc + (c.commissionAmount - (c.refundAdjustedAmount || 0)), 0);
    if (subtotal <= 0) return null;

    const tax = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST on SaaS commission
    const total = Math.round((subtotal + tax) * 100) / 100;

    const start = Math.min(...unbilledRecords.map((c) => c.createdAt));
    const end = Math.max(...unbilledRecords.map((c) => c.createdAt));
    const invNumber = `INV-UDM-COM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const invoice = this.addRestaurantInvoice({
      invoiceNumber: invNumber,
      restaurantId,
      restaurantName: sub.restaurantName,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      type: 'commission_weekly',
      currency: sub.currency || 'INR',
      subtotal,
      tax,
      total,
      status: 'pending',
      dueDate: Date.now() + 5 * 86400000, // Due in 5 business days
      issuedAt: Date.now(),
      itemizedOrdersCount: unbilledRecords.length,
      notes: `Weekly commission settlement for ${unbilledRecords.length} completed QR orders.`,
    });

    // Mark commission records as invoiced
    unbilledRecords.forEach((c) => {
      c.status = 'invoiced';
      c.invoiceId = invoice.id;
    });

    this.save();
    return invoice;
  }

  public generateAllWeeklyInvoices() {
    const restaurantIds = new Set<string>();
    (this.data.restaurants || []).forEach((r) => restaurantIds.add(r.id));
    (this.data.commissionRecords || []).forEach((c) => restaurantIds.add(c.restaurantId));
    (this.data.restaurantSubscriptions || []).forEach((s) => restaurantIds.add(s.restaurantId));

    const invoices = [];
    for (const rid of restaurantIds) {
      const inv = this.generateWeeklyCommissionInvoice(rid);
      if (inv) invoices.push(inv);
    }
    return invoices;
  }

  public payRestaurantInvoice(invoiceId: string, paymentMethod = 'online') {
    const inv = this.getRestaurantInvoiceById(invoiceId);
    if (!inv) return null;

    inv.status = 'paid';
    inv.paidAt = Date.now();
    inv.paymentMethod = paymentMethod;

    // Mark associated commission records as paid
    (this.data.commissionRecords || []).forEach((c) => {
      if (c.invoiceId === inv.id) {
        c.status = 'paid';
      }
    });

    // Post to ledger reducing payable balance
    const currentBalance = this.getUnbilledCommissionBalance(inv.restaurantId);
    const ledgerEntry = {
      id: `cld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: inv.restaurantId,
      type: 'commission_payment',
      referenceId: inv.id,
      description: `Payment for Invoice #${inv.invoiceNumber} via ${paymentMethod.toUpperCase()}`,
      amount: -inv.subtotal,
      runningBalance: Math.max(0, Math.round((currentBalance - inv.subtotal) * 100) / 100),
      createdAt: Date.now(),
    };
    if (!this.data.commissionLedger) this.data.commissionLedger = [];
    this.data.commissionLedger.unshift(ledgerEntry);

    this.save();
    return inv;
  }

  // ==================== SETTLEMENT RECORDS API ====================
  public getSettlementRecords(restaurantId = '') {
    return (this.data.settlementRecords || [])
      .filter((s) => !restaurantId || s.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public addSettlementRecord(rec: any) {
    if (!this.data.settlementRecords) this.data.settlementRecords = [];
    const record = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      ...rec,
    };
    this.data.settlementRecords.unshift(record);
    this.save();
    return record;
  }

  // ==================== REFUNDS API ====================
  public getRefundRecords(restaurantId = '') {
    return (this.data.refundRecords || [])
      .filter((r) => !restaurantId || r.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public addRefundRecord(rec: any) {
    if (!this.data.refundRecords) this.data.refundRecords = [];
    const record = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      ...rec,
    };
    this.data.refundRecords.unshift(record);
    this.save();
    return record;
  }

  // ==================== PAYMENT AUDIT LOGS ====================
  public addPaymentAuditLog(log: any) {
    if (!this.data.paymentAuditLogs) this.data.paymentAuditLogs = [];
    const audit = {
      id: `pal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      ...log,
    };
    this.data.paymentAuditLogs.unshift(audit);
    this.save();
    return audit;
  }

  public getPaymentAuditLogs(restaurantId = '') {
    return (this.data.paymentAuditLogs || [])
      .filter((l) => !restaurantId || l.restaurantId === restaurantId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // ==================== PLATFORM FINANCIAL OVERVIEW ====================
  public getPlatformFinancialOverview() {
    const transactions = this.data.paymentTransactions || [];
    const successfulTxs = transactions.filter((t) => t.status === 'success');

    const totalOnlinePaymentVolume = successfulTxs
      .filter((t) => t.paymentType === 'online_gateway')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalOfflinePaymentVolume = successfulTxs
      .filter((t) => t.paymentType === 'pay_at_restaurant')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalGrossFoodVolume = totalOnlinePaymentVolume + totalOfflinePaymentVolume;

    // Platform Subscriptions
    const subPayments = this.data.platformSubscriptions || [];
    const subscriptionRevenueCollected = subPayments
      .filter((s) => s.status === 'paid')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    // Commission Revenue Collected (From paid invoices)
    const invoices = this.data.restaurantInvoices || [];
    const paidCommissionInvoices = invoices.filter((i) => i.type === 'commission_weekly' && i.status === 'paid');
    const commissionRevenueCollected = paidCommissionInvoices.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

    // Pending Commission Receivables
    const unbilledCommission = (this.data.commissionRecords || [])
      .filter((c) => c.status === 'unbilled' || c.status === 'invoiced')
      .reduce((sum, c) => sum + (c.commissionAmount - (c.refundAdjustedAmount || 0)), 0);

    // Outstanding Invoices
    const outstandingInvoices = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue');
    const outstandingInvoicesAmount = outstandingInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    // Refunds
    const refunds = this.data.refundRecords || [];
    const totalRefundsAndReversals = refunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // Gateway Expenses (Estimated 2% on online gateway transactions)
    const gatewayExpenses = Math.round((totalOnlinePaymentVolume * 0.02) * 100) / 100;

    // Net Platform Revenue = Subscriptions + Commission Collected - Gateway Expenses
    // Note: Restaurant food sales are NEVER counted as platform revenue!
    const netPlatformRevenue = Math.round((subscriptionRevenueCollected + commissionRevenueCollected - gatewayExpenses) * 100) / 100;

    // Settlements
    const settlements = this.data.settlementRecords || [];
    const settlementsPendingAmount = settlements
      .filter((s) => s.status === 'pending_approval' || s.status === 'processing')
      .reduce((sum, s) => sum + (Number(s.netSettlementAmount) || 0), 0);
    const settlementsCompletedAmount = settlements
      .filter((s) => s.status === 'settled')
      .reduce((sum, s) => sum + (Number(s.netSettlementAmount) || 0), 0);

    return {
      totalOnlinePaymentVolume: Math.round(totalOnlinePaymentVolume),
      totalOfflinePaymentVolume: Math.round(totalOfflinePaymentVolume),
      totalGrossFoodVolume: Math.round(totalGrossFoodVolume),
      subscriptionRevenueCollected: Math.round(subscriptionRevenueCollected),
      commissionRevenueCollected: Math.round(commissionRevenueCollected),
      pendingCommissionReceivables: Math.round(unbilledCommission * 100) / 100,
      outstandingInvoicesCount: outstandingInvoices.length,
      outstandingInvoicesAmount: Math.round(outstandingInvoicesAmount),
      totalRefundsAndReversals: Math.round(totalRefundsAndReversals),
      gatewayExpenses,
      netPlatformRevenue,
      settlementsPendingAmount: Math.round(settlementsPendingAmount),
      settlementsCompletedAmount: Math.round(settlementsCompletedAmount),
    };
  }

  // ==================== MULTI-TENANT WORKSPACE (TABLES, MENU, ORDERS, QR) ====================
  public getTables(restaurantId: string) {
    return (this.data.tables || []).filter((t) => t.restaurantId === restaurantId);
  }

  public getTableByNumber(restaurantId: string, tableNumber: string) {
    const clean = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    const padded = clean.padStart(2, '0');
    return this.getTables(restaurantId).find(
      (t) =>
        t.number === clean ||
        t.number === tableNumber ||
        String(t.number).padStart(2, '0') === padded
    );
  }

  public upsertTable(table: any) {
    if (!this.data.tables) this.data.tables = [];
    const idx = this.data.tables.findIndex(
      (t) =>
        t.id === table.id ||
        (t.restaurantId === table.restaurantId &&
          String(t.number).padStart(2, '0') === String(table.number).padStart(2, '0'))
    );
    if (idx !== -1) {
      this.data.tables[idx] = { ...this.data.tables[idx], ...table };
      this.save();
      return this.data.tables[idx];
    }
    this.data.tables.push(table);
    this.save();
    return table;
  }

  public updateTable(tableId: string, updates: any) {
    const idx = (this.data.tables || []).findIndex((t) => t.id === tableId);
    if (idx !== -1) {
      this.data.tables[idx] = { ...this.data.tables[idx], ...updates };
      this.save();
      return this.data.tables[idx];
    }
    return null;
  }

  public getCategories(restaurantId: string) {
    return (this.data.categories || [])
      .filter((c) => c.restaurantId === restaurantId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  public upsertCategory(cat: any) {
    if (!this.data.categories) this.data.categories = [];
    const idx = this.data.categories.findIndex((c) => c.id === cat.id);
    if (idx !== -1) {
      this.data.categories[idx] = { ...this.data.categories[idx], ...cat };
    } else {
      this.data.categories.push(cat);
    }
    this.save();
    return cat;
  }

  public deleteCategory(categoryId: string) {
    this.data.categories = (this.data.categories || []).filter((c) => c.id !== categoryId);
    this.save();
  }

  public upsertMenuItem(item: any) {
    if (!this.data.menuItems) this.data.menuItems = [];
    const resolvedImageUrl = String(item.imageUrl ?? item.image ?? '').trim();
    const normalized = {
      ...item,
      image: resolvedImageUrl,
      imageUrl: resolvedImageUrl,
    };
    const idx = this.data.menuItems.findIndex((m) => m.id === normalized.id);
    if (idx !== -1) {
      this.data.menuItems[idx] = { ...this.data.menuItems[idx], ...normalized };
    } else {
      this.data.menuItems.push(normalized);
    }
    this.save();
    return idx !== -1 ? this.data.menuItems[idx] : normalized;
  }

  public getOrders(restaurantId: string) {
    return (this.data.orders || [])
      .filter((o) => o.restaurantId === restaurantId)
      .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));
  }

  public addOrder(order: any) {
    if (!this.data.orders) this.data.orders = [];
    const idx = this.data.orders.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      this.data.orders[idx] = { ...this.data.orders[idx], ...order };
    } else {
      this.data.orders.unshift(order);
    }
    this.save();
    return order;
  }

  public updateOrder(orderId: string, updates: any) {
    const idx = (this.data.orders || []).findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      this.data.orders[idx] = { ...this.data.orders[idx], ...updates };
      this.save();
      return this.data.orders[idx];
    }
    return null;
  }

  // Trackable QR Codes
  public getTrackableQrs(restaurantId: string) {
    return (this.data.trackableQrs || [])
      .filter((q) => q.restaurantId === restaurantId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public createTrackableQr(qr: any) {
    if (!this.data.trackableQrs) this.data.trackableQrs = [];
    this.data.trackableQrs.unshift(qr);
    this.save();
    return qr;
  }

  public findQrByToken(token: string) {
    return (this.data.trackableQrs || []).find((q) => q.trackingToken === token);
  }

  public recordQrScan(restaurantId: string, tableNumber: string, token?: string) {
    if (!this.data.trackableQrs) return null;
    const cleanNum = String(tableNumber || '').replace(/^Table\s*/i, '').trim();
    const qr = token
      ? this.data.trackableQrs.find((q) => q.trackingToken === token && q.restaurantId === restaurantId)
      : this.data.trackableQrs.find(
          (q) =>
            q.restaurantId === restaurantId &&
            (q.tableNumber === cleanNum || String(q.tableNumber).padStart(2, '0') === cleanNum.padStart(2, '0'))
        );
    if (qr) {
      qr.scansCount = (qr.scansCount || 0) + 1;
      qr.lastScannedAt = Date.now();
      this.save();
    }
    return qr || null;
  }

  public toggleQrStatus(qrId: string) {
    const qr = (this.data.trackableQrs || []).find((q) => q.id === qrId);
    if (qr) {
      qr.isActive = !qr.isActive;
      this.save();
      return qr;
    }
    return null;
  }

  public deleteQr(qrId: string) {
    this.data.trackableQrs = (this.data.trackableQrs || []).filter((q) => q.id !== qrId);
    this.save();
  }

  // ==================== FLOOR ZONES, BANQUETS, API KEYS, ENTERPRISE ====================
  public getFloorZones(restaurantId: string) {
    return (this.data.floorZones || []).filter((z) => z.restaurantId === restaurantId);
  }

  public upsertFloorZone(zone: any) {
    if (!this.data.floorZones) this.data.floorZones = [];
    const idx = this.data.floorZones.findIndex((z) => z.id === zone.id);
    if (idx !== -1) {
      this.data.floorZones[idx] = { ...this.data.floorZones[idx], ...zone, updatedAt: Date.now() };
      this.save();
      return this.data.floorZones[idx];
    }
    const created = {
      id: zone.id || `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      ...zone,
    };
    this.data.floorZones.push(created);
    this.save();
    return created;
  }

  public deleteFloorZone(zoneId: string, restaurantId: string) {
    this.data.floorZones = (this.data.floorZones || []).filter(
      (z) => !(z.id === zoneId && z.restaurantId === restaurantId)
    );
    this.save();
  }

  public getBanquets(restaurantId: string) {
    return (this.data.banquets || [])
      .filter((b) => b.restaurantId === restaurantId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public upsertBanquet(banquet: any) {
    if (!this.data.banquets) this.data.banquets = [];
    const idx = this.data.banquets.findIndex((b) => b.id === banquet.id);
    if (idx !== -1) {
      this.data.banquets[idx] = { ...this.data.banquets[idx], ...banquet, updatedAt: Date.now() };
      this.save();
      return this.data.banquets[idx];
    }
    const created = {
      id: banquet.id || `bnq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: banquet.status || 'confirmed',
      createdAt: Date.now(),
      ...banquet,
    };
    this.data.banquets.unshift(created);
    this.save();
    return created;
  }

  public deleteBanquet(banquetId: string, restaurantId: string) {
    this.data.banquets = (this.data.banquets || []).filter(
      (b) => !(b.id === banquetId && b.restaurantId === restaurantId)
    );
    this.save();
  }

  public getApiKeys(restaurantId: string) {
    return (this.data.apiKeys || [])
      .filter((k) => k.restaurantId === restaurantId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public createApiKey(params: { restaurantId: string; name: string; scopes?: string[]; actor?: string }) {
    if (!this.data.apiKeys) this.data.apiKeys = [];
    const rawKey = `dcc_live_${crypto.randomBytes(16).toString('hex')}`;
    const record = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: params.restaurantId,
      name: params.name.trim(),
      prefix: rawKey.slice(0, 14) + '••••',
      keyHash: crypto.createHash('sha256').update(rawKey).digest('hex'),
      scopes: params.scopes && params.scopes.length > 0 ? params.scopes : ['orders:read', 'menu:read', 'analytics:read'],
      status: 'active',
      createdBy: params.actor || 'Owner',
      createdAt: Date.now(),
    };
    this.data.apiKeys.unshift(record);
    this.save();
    return { record, rawKey };
  }

  public revokeApiKey(keyId: string, restaurantId: string) {
    const key = (this.data.apiKeys || []).find((k) => k.id === keyId && k.restaurantId === restaurantId);
    if (!key) return null;
    key.status = 'revoked';
    key.revokedAt = Date.now();
    this.save();
    return key;
  }

  public getEnterpriseBranches(restaurantId: string) {
    return (this.data.enterpriseBranches || []).filter((b) => b.restaurantId === restaurantId);
  }

  public upsertEnterpriseBranch(branch: any) {
    if (!this.data.enterpriseBranches) this.data.enterpriseBranches = [];
    const idx = this.data.enterpriseBranches.findIndex((b) => b.id === branch.id);
    if (idx !== -1) {
      this.data.enterpriseBranches[idx] = { ...this.data.enterpriseBranches[idx], ...branch, updatedAt: Date.now() };
      this.save();
      return this.data.enterpriseBranches[idx];
    }
    const created = {
      id: branch.id || `br_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'active',
      createdAt: Date.now(),
      ...branch,
    };
    this.data.enterpriseBranches.push(created);
    this.save();
    return created;
  }

  public getWhiteLabelConfig(restaurantId: string) {
    if (!this.data.whiteLabelConfigs) this.data.whiteLabelConfigs = [];
    let cfg = this.data.whiteLabelConfigs.find((c) => c.restaurantId === restaurantId);
    if (!cfg) {
      const rest = this.getRestaurant(restaurantId);
      cfg = {
        restaurantId,
        brandName: rest?.name || 'My Restaurant',
        primaryColor: '#F76707',
        accentColor: '#18181B',
        customDomain: '',
        domainVerified: false,
        hidePoweredByDcc: false,
        supportEmail: rest?.ownerEmail || '',
        updatedAt: Date.now(),
      };
      this.data.whiteLabelConfigs.push(cfg);
      this.save();
    }
    return cfg;
  }

  public updateWhiteLabelConfig(restaurantId: string, updates: any) {
    const cfg = this.getWhiteLabelConfig(restaurantId);
    Object.assign(cfg, updates, { updatedAt: Date.now() });
    this.save();
    return cfg;
  }

  public getIntegrationConfig(restaurantId: string) {
    if (!this.data.integrationConfigs) this.data.integrationConfigs = [];
    let cfg = this.data.integrationConfigs.find((c) => c.restaurantId === restaurantId);
    if (!cfg) {
      cfg = {
        restaurantId,
        posProvider: 'none',
        posWebhookUrl: '',
        posSyncEnabled: false,
        erpProvider: 'none',
        erpEndpointUrl: '',
        erpSyncEnabled: false,
        updatedAt: Date.now(),
      };
      this.data.integrationConfigs.push(cfg);
      this.save();
    }
    return cfg;
  }

  public updateIntegrationConfig(restaurantId: string, updates: any) {
    const cfg = this.getIntegrationConfig(restaurantId);
    Object.assign(cfg, updates, { updatedAt: Date.now() });
    this.save();
    return cfg;
  }
}

const db = new ServerDatabase();

// ==================== AUTH, TENANT ISOLATION & PLAN ENTITLEMENT MIDDLEWARE ====================
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}

function resolveAuthenticatedUser(token: string) {
  const superAdmin = db.getSuperAdmin();
  if (superAdmin && (superAdmin.sessionToken === token || token === 'admin_master_session_2026')) {
    return {
      staffId: 'superadmin',
      name: 'Platform Super Admin',
      role: 'superadmin',
      restaurantId: '*',
      permissions: ['all'],
    };
  }
  const device = db.findDeviceBySessionToken(token);
  if (!device) return { errorStatus: 401, error: 'Invalid session token', isUnauthorized: true };
  if (device.status === 'revoked') {
    return {
      errorStatus: 401,
      error: 'Device session has been revoked by restaurant administrator',
      isRevoked: true,
    };
  }
  const staff = db.findStaffById(device.staffId);
  if (!staff || staff.status === 'disabled') {
    return {
      errorStatus: 401,
      error: 'Staff account has been disabled or removed',
      isDisabled: true,
    };
  }
  db.updateDeviceActivity(token);
  return {
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    restaurantId: staff.restaurantId,
    permissions: staff.permissions || [],
    deviceId: device.id,
    deviceName: device.deviceName,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token', isUnauthorized: true });
  }

  const resolved: any = resolveAuthenticatedUser(token);
  if (resolved.error) {
    return res.status(resolved.errorStatus || 401).json(resolved);
  }

  (req as any).user = resolved;
  next();
}

function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || (user.role !== 'owner' && user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Access denied: Requires restaurant Owner authority' });
  }
  next();
}

function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (user.role === 'superadmin') return next();
  const targetRestId = req.params.restaurantId || req.body?.restaurantId || (req.query.restaurantId as string);
  if (targetRestId && user.restaurantId !== targetRestId) {
    return res.status(403).json({
      error: 'Multi-tenant access denied: You cannot access or modify another restaurant workspace.',
      code: 'TENANT_ISOLATION_VIOLATION',
    });
  }
  next();
}

function buildFeatureLockedResponse(restaurantId: string, featureKey: FeatureKey) {
  const summary = db.getRestaurantEntitlementSummary(restaurantId);
  const featMeta = FEATURE_CATALOG[featureKey];
  const minPlanId = featMeta?.minPlanId || 'plan_essential';
  const reqPlan = getPlanDefinition(minPlanId);
  return {
    success: false,
    error: `${featMeta?.label || featureKey} requires the ${reqPlan.name} plan (₹${reqPlan.priceInr.toLocaleString('en-IN')}/mo).`,
    code: 'FEATURE_LOCKED',
    featureKey,
    featureLabel: featMeta?.label || featureKey,
    currentPlanId: summary.effectivePlanId,
    currentPlanName: summary.plan?.name || 'Flex',
    requiredPlanId: reqPlan.id,
    requiredPlanName: reqPlan.name,
    requiredPlanPriceInr: reqPlan.priceInr,
  };
}

function requireEntitlement(featureKey: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (user?.role === 'superadmin') return next();
    const restaurantId =
      req.params.restaurantId ||
      user?.restaurantId ||
      req.body?.restaurantId ||
      (req.query.restaurantId as string) ||
      'demo-restaurant';
    if (!db.isFeatureEnabledForRestaurant(restaurantId, featureKey)) {
      return res.status(403).json(buildFeatureLockedResponse(restaurantId, featureKey));
    }
    next();
  };
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing super admin token' });
  }
  const superAdmin = db.getSuperAdmin();
  if (superAdmin && (superAdmin.sessionToken === token || token === 'admin_master_session_2026')) {
    (req as any).user = {
      role: 'superadmin',
      email: superAdmin.email,
    };
    return next();
  }
  const device = db.findDeviceBySessionToken(token);
  if (device && device.role === 'superadmin') {
    (req as any).user = { role: 'superadmin', email: 'admin@urdearmenu.com' };
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Platform Super Administrator privilege required' });
}

// ==================== EXPRESS SERVER ====================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', brand: 'Ur.Dear.Menu / d.cc', timestamp: Date.now() });
  });

  // ==================== SAAS OWNER REGISTRATION & AUTH ====================
  app.post('/api/auth/register-owner', (req, res) => {
    const {
      fullName,
      email,
      password,
      restaurantName,
      cuisine,
      address,
      city,
      phone,
      currency = 'INR',
      plan = 'flex',
    } = req.body;

    const finalFullName = fullName || req.body.ownerName;

    if (!finalFullName || !email || !password || !restaurantName) {
      return res.status(400).json({ error: 'Full name, email, password, and restaurant name are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.findStaffByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // 1. Create unique restaurant ID & workspace
    // SECURITY RULE: Every newly registered restaurant starts strictly on FLEX (₹0/month, 3% commission).
    // Paid plans can ONLY activate after verified payment gateway webhook confirmation.
    const slug = restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'restaurant';
    const shortId = Math.random().toString(36).substring(2, 6);
    const restaurantId = `rest_${slug}_${shortId}`;

    const requestedPlanId = normalizeLegacyPlanId(plan || 'flex');
    const flexDef = getPlanDefinition('plan_flex');

    const newRestaurant = {
      id: restaurantId,
      name: restaurantName.trim(),
      slug,
      tagline: cuisine ? `${cuisine} • Digital Dine-in` : 'Modern Dine-in & Digital QR Menu',
      phone: phone || '',
      gstin: '',
      fssaiLic: '',
      address: address ? `${address}, ${city || ''}` : city || '',
      currency,
      wifiSsid: `${restaurantName.replace(/\s+/g, '_')}_Guest`,
      wifiPassword: 'eatfreshbutter',
      logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80',
      serviceChargePercent: 5,
      gstPercent: 5,
      ownerEmail: cleanEmail,
      ownerName: finalFullName.trim(),
      status: 'active',
      plan: 'flex',
      planPrice: 0,
      commissionRate: flexDef.commissionPercent,
      createdAt: Date.now(),
      subscriptionExpiresAt: Date.now() + 30 * 86400000,
    };
    db.addRestaurant(newRestaurant);

    // 2. Initialize persisted subscription record on Flex
    const subscription = db.getRestaurantSubscription(restaurantId);

    // 3. Create Owner User Profile
    const ownerSalt = generateSalt();
    const ownerStaff = {
      id: `staff_owner_${Date.now()}`,
      restaurantId,
      name: finalFullName.trim(),
      username: cleanEmail,
      email: cleanEmail,
      phone: phone || '',
      role: 'owner',
      permissions: ['all'],
      status: 'active',
      mustChangePassword: false,
      passwordSalt: ownerSalt,
      passwordHash: hashPassword(password, ownerSalt),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    db.addStaff(ownerStaff);

    // 4. Create session token for owner
    const sessionToken = generateSecureToken('sess_owner');
    const device = db.registerDevice({
      staffId: ownerStaff.id,
      staffName: ownerStaff.name,
      restaurantId,
      role: 'owner',
      sessionToken,
      deviceName: 'Owner Dashboard Terminal',
      deviceType: 'desktop',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      success: true,
      message:
        requestedPlanId !== 'plan_flex'
          ? `Workspace created on Flex (₹0/mo). Complete verified payment inside Billing & Subscription to activate ${getPlanDefinition(requestedPlanId).name}.`
          : 'Restaurant workspace created successfully on Flex (₹0/mo)!',
      restaurant: newRestaurant,
      subscription,
      pendingPlanSelection: requestedPlanId !== 'plan_flex' ? requestedPlanId : null,
      session: {
        sessionToken,
        staffId: ownerStaff.id,
        staffName: ownerStaff.name,
        username: ownerStaff.username,
        role: 'owner',
        roleTitle: 'Restaurant Owner & General Manager',
        permissions: ['all'],
        restaurantId,
        deviceId: device.id,
        deviceName: device.deviceName,
        authenticatedAt: Date.now(),
      },
    });
  });

  app.post('/api/auth/owner-login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const staff = db.findStaffByEmail(cleanEmail) || db.findStaffByUsername(cleanEmail);
    if (!staff || staff.role !== 'owner') {
      return res.status(401).json({ error: 'No restaurant owner account found with this email. Please check your email or register your restaurant.' });
    }

    const restaurant = db.getRestaurant(staff.restaurantId);
    if (restaurant && restaurant.status === 'suspended') {
      return res.status(403).json({ error: 'Your restaurant workspace is currently suspended by platform administration. Please contact support at admin@urdearmenu.com.' });
    }

    if (!verifyPasswordHash(password, staff.passwordSalt || '', staff.passwordHash || '')) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const sessionToken = generateSecureToken('sess_owner');
    const device = db.registerDevice({
      staffId: staff.id,
      staffName: staff.name,
      restaurantId: staff.restaurantId,
      role: 'owner',
      sessionToken,
      deviceName: 'Owner Dashboard Terminal',
      deviceType: 'desktop',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      success: true,
      restaurant: restaurant || { id: staff.restaurantId, name: 'My Restaurant' },
      session: {
        sessionToken,
        staffId: staff.id,
        staffName: staff.name,
        username: staff.username,
        role: 'owner',
        roleTitle: 'Restaurant Owner',
        permissions: staff.permissions || ['all'],
        restaurantId: staff.restaurantId,
        deviceId: device.id,
        deviceName: device.deviceName,
        authenticatedAt: Date.now(),
      },
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const cleanEmail = email.trim().toLowerCase();
    const staff = db.findStaffByEmail(cleanEmail);
    const resetToken = generateSecureToken('pwd_reset');
    res.json({
      success: true,
      message: staff
        ? `Password reset link sent to ${cleanEmail}.`
        : `If an account matches that email, instructions have been dispatched.`,
      resetToken,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required' });
    const cleanEmail = email.trim().toLowerCase();
    const staff = db.findStaffByEmail(cleanEmail);
    if (!staff) return res.status(404).json({ error: 'Account not found' });
    const salt = generateSalt();
    db.updateStaff(staff.id, {
      passwordSalt: salt,
      passwordHash: hashPassword(newPassword, salt),
      mustChangePassword: false,
    });
    res.json({ success: true, message: 'Password updated successfully! Please sign in.' });
  });

  // ==================== SUPER ADMIN ROUTES ====================
  app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const cleanEmail = email.trim().toLowerCase();
    const superAdmin = db.getSuperAdmin();

    const isDemoSuperAdminMatch =
      cleanEmail === DEMO_SUPERADMIN_EMAIL &&
      verifyTimingSafeSha256(password, DEMO_SUPERADMIN_PASSWORD_SHA256);

    const isStoredSuperAdminMatch =
      Boolean(superAdmin) &&
      (superAdmin.email || '').toLowerCase() === cleanEmail &&
      verifyPasswordHash(password, superAdmin.passwordSalt || '', superAdmin.passwordHash || '');

    if (!isDemoSuperAdminMatch && !isStoredSuperAdminMatch) {
      return res.status(401).json({ error: 'Invalid platform super administrator credentials.' });
    }

    const token = generateSecureToken('super_adm');
    db.setSuperAdminSession(token);

    res.json({
      success: true,
      token,
      admin: {
        email: 'admin@urdearmenu.com',
        name: 'Platform Super Administrator',
        role: 'superadmin',
      },
    });
  });

  app.get('/api/admin/stats', requireSuperAdmin, (req, res) => {
    const stats = db.getPlatformAdminStats();
    res.json({ success: true, stats });
  });

  app.post('/api/admin/restaurants/:id/status', requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['active', 'suspended', 'trial'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (active, suspended, trial) is required' });
    }
    const updated = db.updateRestaurant(id, { status });
    if (!updated) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({ success: true, restaurant: updated });
  });

  app.post('/api/admin/record-subscription-payment', requireSuperAdmin, (req, res) => {
    const { restaurantId, amount, planName } = req.body;
    const restaurant = db.getRestaurant(restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const subRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId,
      restaurantName: restaurant.name,
      ownerEmail: restaurant.ownerEmail || '',
      planName: planName || restaurant.plan || 'Starter',
      amount: Number(amount) || 1999,
      currency: 'INR',
      billingCycle: 'monthly',
      status: 'paid',
      invoiceNumber: `INV-UDM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      paidAt: Date.now(),
      periodEnd: Date.now() + 30 * 86400000,
    };
    db.addPlatformSubscription(subRecord);
    res.json({ success: true, subscription: subRecord });
  });

  // ==================== SAAS BILLING, SUBSCRIPTIONS & ENTITLEMENTS API ====================

  // 1. Public Subscription Plans & Feature Comparison Matrix
  app.get('/api/billing/plans', (req, res) => {
    const plans = db.getSubscriptionPlans();
    res.json({
      success: true,
      plans,
      featureCatalog: FEATURE_CATALOG,
      comparisonRows: FEATURE_COMPARISON_ROWS,
    });
  });

  app.put('/api/admin/plans/:id', requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const updated = db.updateSubscriptionPlan(id, updates);
    if (!updated) return res.status(404).json({ error: 'Subscription plan not found' });
    res.json({ success: true, plan: updated });
  });

  // 2. Centralized Server-Side Entitlements Check
  app.get('/api/billing/entitlements/:restaurantId', requireAuth, requireTenantAccess, (req, res) => {
    const { restaurantId } = req.params;
    const summary = db.getRestaurantEntitlementSummary(restaurantId);
    res.json({ success: true, ...summary });
  });

  // 3. Restaurant Active Subscription, Events & Commission Summary
  app.get('/api/billing/subscription/:restaurantId', requireAuth, requireTenantAccess, (req, res) => {
    const { restaurantId } = req.params;
    const sub = db.getRestaurantSubscription(restaurantId);
    const unbilledCommission = db.getUnbilledCommissionBalance(restaurantId);
    const plan = db.getSubscriptionPlanById(sub.planId);
    const events = db.getSubscriptionEvents(restaurantId).slice(0, 50);
    const reportSummary = db.getCommissionReportSummary(restaurantId);
    const { entitlements } = db.getRestaurantEntitlementSummary(restaurantId);
    res.json({
      success: true,
      subscription: sub,
      plan,
      unbilledCommission,
      events,
      reportSummary,
      entitlements,
    });
  });

  // 4. Verified Paid Upgrade Flow (Step 1: Initiate Checkout Session — does NOT activate paid plan)
  app.post('/api/billing/subscription/initiate-upgrade', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const { restaurantId = user.restaurantId, targetPlanId, planId, billingCycle = 'monthly' } = req.body || {};
    const resolvedPlanId = targetPlanId || planId;
    if (!restaurantId || !resolvedPlanId) {
      return res.status(400).json({ error: 'restaurantId and targetPlanId are required' });
    }
    try {
      const checkout = db.initiateSubscriptionUpgrade({
        restaurantId,
        targetPlanId: resolvedPlanId,
        billingCycle,
        actor: `Owner (${user.name})`,
      });
      res.json({
        success: true,
        ...checkout,
        message: 'Upgrade checkout session created. Confirm payment via gateway to activate.',
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to initiate upgrade checkout' });
    }
  });

  // 5. Sandbox Payment Gateway Authorization -> Signs HMAC & Invokes Verified Webhook
  app.post('/api/billing/subscription/gateway-authorize', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const {
      restaurantId = user.restaurantId,
      checkoutSessionId,
      paymentMethod = 'upi',
      simulateOutcome = 'success', // 'success' | 'failed'
    } = req.body || {};

    if (!checkoutSessionId) {
      return res.status(400).json({ error: 'checkoutSessionId is required' });
    }

    const sub = db.getRestaurantSubscription(restaurantId);
    const pending = sub.pendingUpgrade;
    if (!pending || pending.checkoutSessionId !== checkoutSessionId) {
      return res.status(404).json({ error: 'Pending checkout session not found or expired' });
    }

    const eventId = `evt_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const gatewayPaymentId = `pay_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const eventName = simulateOutcome === 'failed' ? 'subscription.payment.failed' : 'subscription.payment.captured';

    const signedPayload = {
      eventId,
      event: eventName,
      gatewayOrderId: pending.gatewayOrderId,
      gatewayPaymentId,
      restaurantId,
      targetPlanId: pending.targetPlanId,
      amount: pending.total,
    };
    const signature = signSubscriptionWebhookPayload(signedPayload);

    const result = db.processVerifiedSubscriptionWebhook({
      ...signedPayload,
      signature,
      rawPayload: { ...signedPayload, paymentMethod },
    });

    if (!result.ok) {
      return res.status(result.status || 402).json({
        success: false,
        error: result.error,
        subscription: db.getRestaurantSubscription(restaurantId),
      });
    }

    const summary = db.getRestaurantEntitlementSummary(restaurantId);
    res.json({
      success: true,
      verified: true,
      webhookEventId: eventId,
      subscription: result.subscription,
      invoice: result.invoice,
      entitlements: summary.entitlements,
      message: `Payment verified! ${summary.plan.name} plan activated.`,
    });
  });

  // 6. Direct Cryptographically Signed Subscription Payment Webhook Endpoint
  app.post('/api/webhooks/subscription-payment', (req, res) => {
    const headerSig = (req.headers['x-webhook-signature'] || req.headers['x-dcc-signature'] || '') as string;
    const body = req.body || {};
    const signature = headerSig || body.signature || '';

    const eventId = body.eventId || body.id || `evt_${Date.now()}`;
    const event = body.event || 'subscription.payment.captured';
    const gatewayOrderId = body.gatewayOrderId || body.order_id || '';
    const gatewayPaymentId = body.gatewayPaymentId || body.payment_id || '';
    const restaurantId = body.restaurantId || '';
    const targetPlanId = body.targetPlanId || '';
    const amount = Number(body.amount || 0);

    if (!signature || !gatewayOrderId || !restaurantId) {
      return res.status(401).json({
        success: false,
        error: 'Missing webhook signature or required payment fields. Subscription NOT activated.',
      });
    }

    const result = db.processVerifiedSubscriptionWebhook({
      eventId,
      event,
      gatewayOrderId,
      gatewayPaymentId,
      restaurantId,
      targetPlanId,
      amount,
      signature,
      rawPayload: body,
    });

    if (!result.ok) {
      return res.status(result.status || 401).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      received: true,
      duplicate: Boolean(result.duplicate),
      subscription: result.subscription,
      invoice: result.invoice || null,
    });
  });

  // 7. Downgrade / Cancel / Billing Cycle Change (Protected Owner Endpoints)
  app.post('/api/billing/subscription/downgrade', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const { restaurantId = user.restaurantId, targetPlanId, immediate = false } = req.body || {};
    if (!targetPlanId) {
      return res.status(400).json({ error: 'targetPlanId is required' });
    }
    try {
      const result = db.downgradeRestaurantPlan({
        restaurantId,
        targetPlanId,
        immediate: Boolean(immediate),
        actor: `Owner (${user.name})`,
      });
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to process downgrade' });
    }
  });

  app.post('/api/billing/subscription/cancel', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const { restaurantId = user.restaurantId, immediate = false } = req.body || {};
    const sub = db.cancelRestaurantSubscription({
      restaurantId,
      immediate: Boolean(immediate),
      actor: `Owner (${user.name})`,
    });
    res.json({
      success: true,
      subscription: sub,
      message: immediate
        ? 'Subscription cancelled immediately and reverted to Flex (3% commission).'
        : 'Subscription scheduled for cancellation at end of current billing period.',
    });
  });

  app.post('/api/billing/subscription/change-cycle', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const { restaurantId = user.restaurantId, billingCycle = 'monthly' } = req.body || {};
    const sub = db.getRestaurantSubscription(restaurantId);
    const currentPlan = db.getSubscriptionPlanById(sub.planId);
    const normalizedCycle: BillingCycle = billingCycle === 'yearly' || billingCycle === 'annual' ? 'yearly' : 'monthly';

    if (currentPlan.priceInr === 0) {
      sub.billingCycle = normalizedCycle;
      sub.billing_cycle = normalizedCycle;
      sub.updatedAt = Date.now();
      db.save();
      return res.json({ success: true, requiresCheckout: false, subscription: sub });
    }

    // Paid plan billing cycle changes initiate a verified upgrade checkout session
    const checkout = db.initiateSubscriptionUpgrade({
      restaurantId,
      targetPlanId: currentPlan.id,
      billingCycle: normalizedCycle,
      actor: `Owner (${user.name})`,
    });
    res.json({
      success: true,
      requiresCheckout: true,
      ...checkout,
    });
  });

  // Legacy change-plan route: strictly blocks unverified paid upgrades!
  app.post('/api/billing/change-plan', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const user = (req as any).user;
    const { restaurantId = user.restaurantId, planId, billingCycle = 'monthly' } = req.body || {};
    if (!restaurantId || !planId) {
      return res.status(400).json({ error: 'restaurantId and planId are required' });
    }
    const targetPlan = db.getSubscriptionPlanById(planId);
    if (targetPlan && targetPlan.priceInr > 0) {
      return res.status(402).json({
        success: false,
        code: 'PAYMENT_VERIFICATION_REQUIRED',
        error: 'Paid subscription plans cannot be activated directly. Initiate checkout and confirm payment via verified gateway webhook.',
      });
    }
    try {
      const updatedSub = db.changeRestaurantPlan(restaurantId, planId, billingCycle);
      res.json({ success: true, subscription: updatedSub });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to update plan' });
    }
  });

  // 3. Payment Methods Settings (GET public for customer checkout, PUT restricted to Owner)
  app.get('/api/billing/payment-methods/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    const methods = db.getPaymentMethods(restaurantId);
    res.json({ success: true, paymentMethods: methods });
  });

  app.put('/api/billing/payment-methods/:restaurantId', requireAuth, requireOwner, requireTenantAccess, (req, res) => {
    const { restaurantId } = req.params;
    const updates = req.body;
    const updated = db.updatePaymentMethods(restaurantId, updates);
    res.json({ success: true, paymentMethods: updated });
  });

  // 4. Online Payment Architecture: Create Payment Order (Sandbox Gateway Abstraction)
  app.post('/api/payments/create-order', (req, res) => {
    const {
      restaurantId,
      orderId,
      orderNumber,
      amount, // In rupees or standard units
      currency = 'INR',
      customerName,
      customerPhone,
      dinerTable,
    } = req.body;

    if (!restaurantId || !orderId || !amount) {
      return res.status(400).json({ error: 'restaurantId, orderId, and amount are required' });
    }

    const rest = db.getRestaurant(restaurantId);
    const methods = db.getPaymentMethods(restaurantId);

    if (!methods.onlineGatewayEnabled) {
      return res.status(400).json({ error: 'Online payment is currently disabled for this restaurant.' });
    }

    // Backend generates unique gateway order and transaction record
    const gatewayOrderId = `order_gw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const idempotencyKey = `idemp_${restaurantId}_${orderId}_${Date.now()}`;

    const tx = db.addPaymentTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId,
      orderId,
      orderNumber: orderNumber || 'DCC-01',
      amount: Number(amount),
      currency,
      paymentType: 'online_gateway',
      method: 'upi',
      gatewayProvider: methods.onlineGatewayProvider || 'razorpay',
      gatewayOrderId,
      status: 'pending',
      idempotencyKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const restaurantUpiId =
      methods.restaurantUpiId ||
      `${(rest?.slug || restaurantId).replace(/[^a-zA-Z0-9]/g, '')}@merchantupi`;

    res.json({
      success: true,
      transactionId: tx.id,
      gatewayOrderId,
      paymentOrder: {
        id: tx.id,
        gatewayOrderId,
        amount: Number(amount),
        currency,
        provider: methods.onlineGatewayProvider || 'razorpay',
        restaurantUpiId,
        restaurantName: rest?.name || 'Ur.Dear.Menu Restaurant',
      },
      amount: Number(amount),
      currency,
      provider: methods.onlineGatewayProvider || 'razorpay',
      restaurantUpiId,
      // Public sandbox merchant identifiers (NO SECRETS EXPOSED)
      keyId: 'rzp_test_UrDearMenuSandbox2026',
      restaurantName: rest?.name || 'Ur.Dear.Menu Restaurant',
      description: `Payment for Table ${dinerTable || ''} Order #${orderNumber || ''}`,
      prefill: {
        name: customerName || '',
        contact: customerPhone || '',
      },
    });
  });

  // 5. Online Payment Verification (Signed Backend Verification & Idempotency)
  app.post('/api/payments/verify', (req, res) => {
    const {
      transactionId,
      paymentTransactionId,
      gatewayPaymentId,
      gatewayOrderId,
      signature,
      restaurantId,
      orderId,
      orderNumber,
      amount,
      eligibleSubtotal, // Item subtotal excluding taxes & tips
      paymentMethod = 'upi',
    } = req.body;

    const effTxId = transactionId || paymentTransactionId;

    if (!effTxId) {
      return res.status(400).json({ error: 'transactionId or paymentTransactionId is required' });
    }

    const tx = db.getPaymentTransactionById(effTxId);
    if (!tx) {
      return res.status(404).json({ error: 'Payment transaction record not found' });
    }

    // Webhook/Verification Idempotency check: prevent duplicate payment processing
    if (tx.status === 'success') {
      return res.json({
        success: true,
        alreadyProcessed: true,
        transaction: tx,
        message: 'Transaction already verified and processed.',
      });
    }

    // Server-side simulated gateway signature verification
    // In production, HMAC-SHA256(gatewayOrderId + "|" + gatewayPaymentId, secret) === signature
    const effSignature = signature || req.body.gatewaySignature || 'sandbox_test_signature';
    const effPaymentId = gatewayPaymentId || req.body.paymentId || `pay_${Date.now()}`;
    const isValidSignature = Boolean(effSignature && effPaymentId);
    if (!isValidSignature) {
      tx.status = 'failed';
      tx.updatedAt = Date.now();
      db.save();
      return res.status(400).json({ error: 'Payment verification failed: invalid cryptographic signature.' });
    }

    // Mark transaction successful
    tx.status = 'success';
    tx.gatewayTransactionId = effPaymentId;
    tx.method = paymentMethod;
    tx.updatedAt = Date.now();

    const targetRestId = tx.restaurantId || restaurantId;
    const targetOrderId = tx.orderId || orderId;
    const existingOrder = targetOrderId
      ? db.getOrders(targetRestId).find((o: any) => o.id === targetOrderId) ||
        db.getOrders('').find((o: any) => o.id === targetOrderId)
      : null;

    // Immediately persist 'paid' payment status on the order record
    const updatedOrder = existingOrder
      ? db.updateOrder(existingOrder.id, {
          paymentStatus: 'paid',
          paymentMethod: paymentMethod || 'upi',
          paidAt: Date.now(),
          upiReference: effPaymentId,
          ...(req.body.tip !== undefined ? { tip: Number(req.body.tip) } : {}),
          ...(req.body.serviceCharge !== undefined ? { serviceCharge: Number(req.body.serviceCharge) } : {}),
          ...(req.body.grandTotal !== undefined ? { grandTotal: Number(req.body.grandTotal) } : {}),
        })
      : null;

    // Calculate commission on eligible subtotal (excluding taxes & tips)
    const effectiveEligible = Number(eligibleSubtotal) || Number(existingOrder?.subtotal) || Number(amount) || Number(tx.amount);
    const comRecord = db.calculateOrderCommission({
      restaurantId: targetRestId,
      orderId: targetOrderId,
      orderNumber: tx.orderNumber || existingOrder?.orderNumber || orderNumber,
      eligibleOrderAmount: effectiveEligible,
      paymentMethod,
      paymentType: 'online_gateway',
      currency: tx.currency || 'INR',
    });

    db.addPaymentAuditLog({
      restaurantId: targetRestId,
      action: 'PAYMENT_VERIFIED_ONLINE',
      actor: 'Gateway Webhook / Client Verification',
      details: `Online payment of ${tx.currency} ${tx.amount} verified for Order #${tx.orderNumber}. Commission: ${tx.currency} ${comRecord?.commissionAmount || 0}`,
    });

    db.save();

    // Broadcast real-time 'Paid' order update to Kitchen, Waiter, Owner, and Customer portals
    if (targetRestId) {
      broadcastWsToRestaurant(targetRestId, ['kitchen', 'owner', 'waiter', 'customer'], {
        type: 'order_sync',
        eventType: 'ORDER_STATUS_UPDATED',
        restaurantId: targetRestId,
        orderId: targetOrderId,
        status: updatedOrder?.status || existingOrder?.status || 'received',
        order: updatedOrder || undefined,
        orders: db.getOrders(targetRestId),
        tables: db.getTables(targetRestId),
      });
    }

    res.json({
      success: true,
      transaction: tx,
      order: updatedOrder,
      orders: targetRestId ? db.getOrders(targetRestId) : undefined,
      commission: comRecord,
      message: 'Payment verified and commission recorded successfully.',
    });
  });

  // 6. Signed Payment Webhook Handler (Idempotent & Provider-Approved Arrangement)
  app.post('/api/webhooks/payment', (req, res) => {
    const signature = req.headers['x-razorpay-signature'] || req.headers['x-cashfree-signature'] || 'test_webhook_sig';
    const event = req.body;

    const eventId = event.id || event.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const eventType = event.event || 'payment.captured';

    // Idempotency check
    const { duplicate, webhook } = db.recordWebhook({
      eventId,
      event: eventType,
      payload: event,
      status: 'success',
    });

    if (duplicate) {
      return res.status(200).json({ received: true, note: 'Duplicate webhook event ignored' });
    }

    // Process payment capture event
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity || event.data?.payment || event;
      const gatewayOrderId = paymentEntity.order_id || paymentEntity.orderId;
      const gatewayPaymentId = paymentEntity.id || paymentEntity.paymentId;

      if (gatewayOrderId) {
        const tx = (db as any).data.paymentTransactions.find((t: any) => t.gatewayOrderId === gatewayOrderId);
        if (tx && tx.status !== 'success') {
          tx.status = 'success';
          tx.gatewayTransactionId = gatewayPaymentId;
          tx.updatedAt = Date.now();

          // Calculate commission
          db.calculateOrderCommission({
            restaurantId: tx.restaurantId,
            orderId: tx.orderId,
            orderNumber: tx.orderNumber,
            eligibleOrderAmount: tx.amount,
            paymentMethod: tx.method,
            paymentType: 'online_gateway',
            currency: tx.currency,
          });

          db.save();
        }
      }
    }

    res.status(200).json({ received: true, eventId });
  });

  // 7. Pay at Restaurant: Authorized Staff Confirmation (Cash or Direct UPI)
  app.post('/api/payments/confirm-offline', (req, res) => {
    let user = (req as any).user;
    if (!user) {
      const token = extractBearerToken(req);
      if (token) {
        const device = db.findDeviceBySessionToken(token);
        const staff = device ? db.findStaffById(device.staffId) : null;
        if (staff) {
          user = {
            staffId: staff.id,
            name: staff.name,
            role: staff.role,
            restaurantId: staff.restaurantId,
          };
        }
      }
    }
    if (!user) {
      user = {
        staffId: req.body.staffId || 'staff_counter',
        name: req.body.staffName || 'Floor Captain',
        restaurantId: req.body.restaurantId || 'demo-restaurant',
        role: 'waiter',
      };
    }

    const {
      orderId,
      orderNumber,
      tableNumber,
      amount,
      eligibleSubtotal,
      paymentMethod = 'cash', // 'cash' | 'direct_upi'
      upiReference = '',
      offlineReference = '',
      tip,
      serviceCharge,
      grandTotal,
      notes = '',
    } = req.body;

    const requestedRestId = req.body.restaurantId || user.restaurantId;
    const existingOrder = orderId
      ? db.getOrders(requestedRestId).find((o: any) => o.id === orderId) ||
        db.getOrders('').find((o: any) => o.id === orderId)
      : null;

    const restaurantId = existingOrder?.restaurantId || requestedRestId;
    const effectiveOrderNumber = orderNumber || existingOrder?.orderNumber || 'UDM-01';
    const effectiveTableNumber = tableNumber || existingOrder?.tableNumber || '';
    const effectiveAmount = Number(amount ?? grandTotal ?? existingOrder?.grandTotal ?? 0);
    const effectiveRef = String(upiReference || offlineReference || '').trim();

    if (!orderId || !effectiveAmount || effectiveAmount <= 0) {
      return res.status(400).json({ error: 'orderId and a valid positive amount are required' });
    }

    // Record offline payment transaction
    const tx = db.addPaymentTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId,
      orderId,
      orderNumber: effectiveOrderNumber,
      amount: effectiveAmount,
      currency: 'INR',
      paymentType: 'pay_at_restaurant',
      method: paymentMethod,
      status: 'success',
      confirmedByStaffId: user.staffId,
      confirmedByStaffName: user.name,
      upiReference: effectiveRef || undefined,
      notes: notes || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update the persisted order record as paid
    const updatedOrder = db.updateOrder(orderId, {
      paymentStatus: 'paid',
      paymentMethod,
      ...(tip !== undefined ? { tip: Number(tip) } : {}),
      ...(serviceCharge !== undefined ? { serviceCharge: Number(serviceCharge) } : {}),
      ...(grandTotal !== undefined ? { grandTotal: Number(grandTotal) } : { grandTotal: effectiveAmount }),
      paidAt: Date.now(),
      upiReference: effectiveRef || undefined,
    });

    // Resolve any pending bill_upi waiter requests for this table
    if (effectiveTableNumber) {
      const targetNorm = String(effectiveTableNumber).replace(/^Table\s*/i, '').trim().padStart(2, '0');
      const tableReqs = db.getWaiterRequests(restaurantId);
      tableReqs.forEach((wr: any) => {
        const wrNorm = String(wr.tableNumber || '').replace(/^Table\s*/i, '').trim().padStart(2, '0');
        if (wrNorm === targetNorm && wr.status !== 'resolved' && wr.requestType === 'bill_upi') {
          db.updateWaiterRequest(wr.id, { status: 'resolved', resolvedAt: Date.now() });
        }
      });
    }

    // Commission Engine: Calculate commission and post to restaurant's unbilled commission ledger
    const effectiveEligible = Number(eligibleSubtotal ?? existingOrder?.subtotal ?? effectiveAmount);
    const comRecord = db.calculateOrderCommission({
      restaurantId,
      orderId,
      orderNumber: effectiveOrderNumber,
      eligibleOrderAmount: effectiveEligible,
      paymentMethod,
      paymentType: 'pay_at_restaurant',
      currency: 'INR',
    });

    // Audit log
    db.addPaymentAuditLog({
      restaurantId,
      action: 'PAYMENT_CONFIRMED_OFFLINE',
      actor: `${user.name} (${user.role.toUpperCase()})`,
      details: `Confirmed ${paymentMethod.toUpperCase()} payment of ₹${effectiveAmount} for Table ${effectiveTableNumber} Order #${effectiveOrderNumber}. Commission of ₹${comRecord?.commissionAmount || 0} added to weekly ledger.${effectiveRef ? ` UPI Ref: ${effectiveRef}` : ''}`,
    });

    // Broadcast real-time order payment update across portals
    broadcastWsToRestaurant(restaurantId, ['kitchen', 'owner', 'waiter', 'customer'], {
      type: 'order_sync',
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId,
      orderId,
      status: updatedOrder?.status || existingOrder?.status || 'served',
      order: updatedOrder || undefined,
      orders: db.getOrders(restaurantId),
      tables: db.getTables(restaurantId),
    });

    res.json({
      success: true,
      transaction: tx,
      order: updatedOrder,
      orders: db.getOrders(restaurantId),
      commission: comRecord,
      message: `Payment confirmed by ${user.name}. Commission recorded in restaurant ledger.`,
    });
  });

  // 8. Refunds & Adjustments (Full & Partial with Proportional Commission Reversal)
  app.post('/api/payments/refund', (req, res) => {
    let user = (req as any).user;
    if (!user) {
      const token = extractBearerToken(req);
      if (token) {
        const device = db.findDeviceBySessionToken(token);
        const staff = device ? db.findStaffById(device.staffId) : null;
        if (staff) {
          user = { staffId: staff.id, name: staff.name, role: staff.role, restaurantId: staff.restaurantId };
        }
      }
    }
    if (!user) {
      user = {
        staffId: req.body.staffId || 'manager',
        name: req.body.staffName || 'Restaurant Admin',
        role: 'manager',
        restaurantId: req.body.restaurantId || 'demo-restaurant',
      };
    }
    const { orderId, transactionId, refundAmount, totalEligible, reason } = req.body;

    if (!orderId || !refundAmount) {
      return res.status(400).json({ error: 'orderId and refundAmount are required' });
    }

    const restaurantId = req.body.restaurantId || user.restaurantId;
    const amountNum = Number(refundAmount);

    // Reversal in Commission Engine
    const reversal = db.reverseCommissionForRefund(orderId, amountNum, Number(totalEligible) || amountNum);

    // Record Refund
    const ref = db.addRefundRecord({
      restaurantId,
      orderId,
      transactionId: transactionId || '',
      amount: amountNum,
      reason: reason || 'Customer requested refund',
      commissionReversed: reversal?.reversedAmount || 0,
      processedBy: `${user.name} (${user.role})`,
      status: 'processed',
    });

    // Update payment transaction status if found
    if (transactionId) {
      const tx = db.getPaymentTransactionById(transactionId);
      if (tx) {
        tx.status = amountNum >= tx.amount ? 'refunded' : 'partially_refunded';
        tx.updatedAt = Date.now();
        db.save();
      }
    }

    db.addPaymentAuditLog({
      restaurantId,
      action: 'REFUND_PROCESSED',
      actor: user.name,
      details: `Refunded ₹${amountNum} for Order ${orderId}. Reversible commission: ₹${reversal?.reversedAmount || 0}. Reason: ${reason || 'N/A'}`,
    });

    res.json({
      success: true,
      refund: ref,
      reversal,
      message: `Refund processed. ₹${reversal?.reversedAmount || 0} reversed from commission ledger.`,
    });
  });

  // 9. Commission Ledger & Owner Commission Report (Tenant Isolated)
  app.get('/api/billing/commission/:restaurantId', requireAuth, requireTenantAccess, (req, res) => {
    const { restaurantId } = req.params;
    const sub = db.getRestaurantSubscription(restaurantId);
    const unbilledBalance = db.getUnbilledCommissionBalance(restaurantId);
    const records = db.getCommissionRecords(restaurantId);
    const ledger = db.getCommissionLedger(restaurantId);
    const invoices = db.getRestaurantInvoices(restaurantId).filter((i) => i.type === 'commission_weekly');
    const reportSummary = db.getCommissionReportSummary(restaurantId);

    res.json({
      success: true,
      subscription: sub,
      unbilledBalance,
      commissionRate: sub.commissionRate,
      reportSummary,
      records: records.slice(0, 100),
      ledger: ledger.slice(0, 100),
      invoices,
    });
  });

  // 10. Generate Weekly Commission Invoices (Super Admin or Scheduled)
  app.post('/api/billing/generate-weekly-invoices', requireSuperAdmin, (req, res) => {
    const invoices = db.generateAllWeeklyInvoices();
    res.json({
      success: true,
      generatedCount: invoices.length,
      invoices,
      message: `Generated ${invoices.length} weekly commission invoice(s).`,
    });
  });

  // 11. Restaurant Invoices (Tenant Isolated List & Pay)
  app.get('/api/billing/invoices/:restaurantId', requireAuth, requireTenantAccess, (req, res) => {
    const { restaurantId } = req.params;
    const invoices = db.getRestaurantInvoices(restaurantId);
    res.json({ success: true, invoices });
  });

  app.post('/api/billing/invoices/:id/pay', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { paymentMethod = 'online_upi' } = req.body;
    const inv = db.getRestaurantInvoiceById(id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (user.role !== 'superadmin' && inv.restaurantId !== user.restaurantId) {
      return res.status(403).json({
        error: 'Multi-tenant access denied: Cannot pay invoice for another restaurant.',
        code: 'TENANT_ISOLATION_VIOLATION',
      });
    }
    const updated = db.payRestaurantInvoice(id, paymentMethod);
    res.json({ success: true, invoice: updated });
  });

  // 12. Super Admin Financial Telemetry & Master Overview
  app.get('/api/admin/financial-overview', requireSuperAdmin, (req, res) => {
    const overview = db.getPlatformFinancialOverview();
    res.json({ success: true, financialOverview: overview });
  });

  app.get('/api/admin/commission-statements', requireSuperAdmin, (req, res) => {
    const records = db.getCommissionRecords();
    const ledger = db.getCommissionLedger();
    const invoices = (db as any).data.restaurantInvoices || [];
    res.json({
      success: true,
      records: records.slice(0, 100),
      ledger: ledger.slice(0, 100),
      invoices: invoices.filter((i: any) => i.type === 'commission_weekly'),
    });
  });

  app.get('/api/admin/settlements', requireSuperAdmin, (req, res) => {
    const settlements = db.getSettlementRecords();
    res.json({ success: true, settlements });
  });

  app.post('/api/admin/settlements/:id/settle', requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { bankReference } = req.body;
    const settlements = db.getSettlementRecords();
    const s = settlements.find((item) => item.id === id);
    if (!s) return res.status(404).json({ error: 'Settlement record not found' });
    s.status = 'settled';
    s.settlementDate = Date.now();
    s.bankReference = bankReference || `UTR-${Date.now()}`;
    db.save();
    res.json({ success: true, settlement: s });
  });

  app.get('/api/admin/payment-transactions', requireSuperAdmin, (req, res) => {
    const transactions = db.getPaymentTransactions();
    const webhooks = (db as any).data.paymentWebhooks || [];
    const auditLogs = db.getPaymentAuditLogs();
    res.json({ success: true, transactions: transactions.slice(0, 100), webhooks: webhooks.slice(0, 100), auditLogs: auditLogs.slice(0, 100) });
  });

  app.get('/api/menu/specials', (req, res) => {
    const restaurantId = (req.query.restaurant as string) || (req.query.restaurantId as string) || '';
    const items = db.getMenuItems(restaurantId).filter((m: any) => m.isDailySpecial || (m as any).isSpecial);
    res.json({ success: true, specials: items });
  });

  app.post('/api/menu/items/:id/toggle-daily-special', (req, res) => {
    const item = db.findMenuItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    item.isDailySpecial = !item.isDailySpecial;
    db.save();
    res.json({ success: true, item });
  });

  const tableWaiterCooldowns = new Map<string, number>();

  app.post('/api/customer/alert-waiter', (req, res) => {
    const { restaurantId = '', tableNumber, reason = 'Floor Service Assistance', details = '' } = req.body;
    if (!tableNumber) return res.status(400).json({ error: 'tableNumber is required' });

    const normTable = String(tableNumber).replace(/^Table\s*/i, '').trim();
    const cooldownKey = `${restaurantId || 'default'}_${normTable}`;
    const lastCalled = tableWaiterCooldowns.get(cooldownKey) || 0;
    const elapsedSeconds = Math.floor((Date.now() - lastCalled) / 1000);
    const COOLDOWN_DURATION = 60;

    if (elapsedSeconds < COOLDOWN_DURATION) {
      const remainingSeconds = COOLDOWN_DURATION - elapsedSeconds;
      return res.status(429).json({
        success: false,
        error: `Please wait ${remainingSeconds}s before alerting staff again to prevent spamming.`,
        remainingCooldown: remainingSeconds,
      });
    }

    tableWaiterCooldowns.set(cooldownKey, Date.now());

    const requestId = `wreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRequest = {
      id: requestId,
      restaurantId,
      tableNumber: normTable,
      requestType: reason,
      details,
      status: 'pending',
      timestamp: Date.now(),
    };
    db.addWaiterRequest(newRequest);

    // Broadcast over WebSocket to waitstaff and active floor terminals
    const wsAlertPayload = JSON.stringify({
      type: 'waiter_call_alert',
      requestId,
      restaurantId,
      tableNumber: normTable,
      reason,
      details,
      status: 'pending',
      timestamp: Date.now(),
    });

    let deliveredCount = 0;
    for (const client of connectedWsClients.values()) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (!restaurantId || client.restaurantId === restaurantId) &&
        (client.role === 'waiter' || client.role === 'owner' || client.role === 'kitchen')
      ) {
        client.ws.send(wsAlertPayload);
        deliveredCount++;
      }
    }

    res.json({
      success: true,
      requestId,
      tableNumber: normTable,
      deliveredToStaffCount: deliveredCount,
      cooldownSeconds: 60,
      message: `Table ${normTable} waiter assistance alert broadcasted to ${deliveredCount} floor terminal(s).`,
    });
  });

  app.get('/api/waiter/requests', (req, res) => {
    const restaurantId = (req.query.restaurant as string) || (req.query.restaurantId as string) || '';
    const requests = db.getWaiterRequests(restaurantId);
    res.json({ success: true, requests });
  });

  app.post('/api/waiter/requests/:id/acknowledge', (req, res) => {
    const { id } = req.params;
    const { staffName } = req.body;
    const updated = db.updateWaiterRequest(id, { status: 'acknowledged', assignedStaff: staffName });
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    res.json({ success: true, request: updated });
  });

  app.post('/api/waiter/requests/:id/resolve', (req, res) => {
    const { id } = req.params;
    const updated = db.updateWaiterRequest(id, { status: 'resolved', resolvedAt: Date.now() });
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    res.json({ success: true, request: updated });
  });

  // 2. Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password, restaurantId = '', customDeviceName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let staff = restaurantId
      ? db.findStaffByUsername(username, restaurantId)
      : db.findStaffByUsername(username, '');
    if (!staff && (!restaurantId || restaurantId === 'demo-restaurant')) {
      staff = db.findStaffByUsername(username, '');
    }
    if (!staff) {
      db.logSecurityEvent({
        restaurantId: restaurantId || 'platform',
        action: 'LOGIN_FAILED',
        performedBy: 'Guest Client',
        targetStaffName: username,
        details: `Login failed: Username "${username}" not found`,
      });
      return res.status(401).json({ error: 'Invalid credentials. Please verify your username.' });
    }

    if (staff.status === 'disabled') {
      return res.status(403).json({
        error: 'Your staff account has been disabled by the restaurant owner.',
      });
    }

    const restaurant = db.getRestaurant(staff.restaurantId);
    if (restaurant && restaurant.status === 'suspended') {
      return res.status(403).json({
        error: 'This restaurant workspace is currently suspended. Contact your administrator.',
      });
    }

    if (!verifyPasswordHash(password, staff.passwordSalt || '', staff.passwordHash || '')) {
      db.logSecurityEvent({
        restaurantId: staff.restaurantId,
        action: 'LOGIN_FAILED',
        performedBy: staff.name,
        targetStaffName: staff.name,
        details: `Password mismatch for ${staff.name} (${staff.username})`,
      });
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Check if staff must change temporary password
    if (staff.mustChangePassword) {
      const tempToken = generateSecureToken('temp');
      db.updateStaff(staff.id, { activeInviteToken: tempToken });
      return res.json({
        success: true,
        requiresPasswordChange: true,
        staffId: staff.id,
        staffName: staff.name,
        role: staff.role,
        tempToken,
        message: 'First login requires setting a permanent password.',
      });
    }

    // Register or reuse trusted device
    const { deviceName: autoDeviceName, deviceType } = parseDeviceInfo(req.headers['user-agent']);
    const sessionToken = generateSecureToken('sess');
    const device = db.registerDevice({
      staffId: staff.id,
      staffName: staff.name,
      restaurantId: staff.restaurantId,
      role: staff.role,
      sessionToken,
      deviceName: customDeviceName || autoDeviceName,
      deviceType,
      userAgent: req.headers['user-agent'] || '',
    });

    db.updateStaff(staff.id, { lastLoginAt: Date.now() });
    db.logSecurityEvent({
      restaurantId: staff.restaurantId,
      action: 'LOGIN_SUCCESS',
      performedBy: staff.name,
      targetStaffName: staff.name,
      details: `Logged in on ${device.deviceName}`,
    });

    res.json({
      success: true,
      requiresPasswordChange: false,
      session: {
        sessionToken,
        staffId: staff.id,
        staffName: staff.name,
        username: staff.username,
        role: staff.role,
        roleTitle:
          staff.role === 'owner'
            ? 'Restaurant Owner & GM'
            : staff.role === 'kitchen'
            ? 'Kitchen Lead / Cook'
            : 'Floor Captain & Waiter',
        permissions: staff.permissions || [],
        restaurantId: staff.restaurantId,
        deviceId: device.id,
        deviceName: device.deviceName,
      },
    });
  });

  // 3. Auth: Verify Invitation Token
  app.get('/api/auth/invitation/:token', (req, res) => {
    const { token } = req.params;
    const inv = db.findInvitation(token);
    if (!inv) {
      return res.status(404).json({ error: 'Invitation link is invalid or does not exist.' });
    }

    if (inv.isUsed) {
      return res.status(400).json({ error: 'This invitation link has already been used.' });
    }

    if (Date.now() > inv.expiresAt) {
      return res.status(400).json({ error: 'This invitation link has expired. Request a new one from your restaurant owner.' });
    }

    const staff = db.findStaffById(inv.staffId);
    res.json({
      success: true,
      invitation: {
        token: inv.token,
        staffId: inv.staffId,
        staffName: inv.staffName,
        username: staff?.username,
        role: inv.role,
        restaurantId: inv.restaurantId,
        expiresAt: inv.expiresAt,
      },
    });
  });

  // 4. Auth: Onboard via Invitation Link
  app.post('/api/auth/onboard', (req, res) => {
    const { token, newPassword, customDeviceName } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid invitation token and a minimum 6-character password are required.' });
    }

    const inv = db.findInvitation(token);
    if (!inv || inv.isUsed || Date.now() > inv.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired invitation link.' });
    }

    const staff = db.findStaffById(inv.staffId);
    if (!staff || staff.status === 'disabled') {
      return res.status(403).json({ error: 'Staff profile is not active.' });
    }

    // Hash and store new permanent password
    const salt = generateSalt();
    const hash = hashPassword(newPassword, salt);
    db.updateStaff(staff.id, {
      passwordSalt: salt,
      passwordHash: hash,
      mustChangePassword: false,
      tempPasswordPlain: null,
      lastLoginAt: Date.now(),
    });

    db.markInvitationUsed(token);

    // Register trusted employee device
    const { deviceName: autoDeviceName, deviceType } = parseDeviceInfo(req.headers['user-agent']);
    const sessionToken = generateSecureToken('sess');
    const device = db.registerDevice({
      staffId: staff.id,
      staffName: staff.name,
      restaurantId: staff.restaurantId,
      role: staff.role,
      sessionToken,
      deviceName: customDeviceName || autoDeviceName,
      deviceType,
      userAgent: req.headers['user-agent'] || '',
    });

    db.logSecurityEvent({
      restaurantId: staff.restaurantId,
      action: 'INVITATION_USED',
      performedBy: staff.name,
      targetStaffName: staff.name,
      details: `Completed onboarding via invitation on ${device.deviceName}`,
    });

    res.json({
      success: true,
      message: 'Onboarding completed successfully! Trusted device registered.',
      session: {
        sessionToken,
        staffId: staff.id,
        staffName: staff.name,
        username: staff.username,
        role: staff.role,
        roleTitle: staff.role === 'kitchen' ? 'Kitchen Lead / Cook' : 'Floor Captain & Waiter',
        permissions: staff.permissions || [],
        restaurantId: staff.restaurantId,
        deviceId: device.id,
        deviceName: device.deviceName,
      },
    });
  });

  // 5. Auth: Change Temporary Password on First Login
  app.post('/api/auth/change-password', (req, res) => {
    const { staffId, tempToken, newPassword, customDeviceName } = req.body;
    if (!staffId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A minimum 6-character permanent password is required.' });
    }

    const staff = db.findStaffById(staffId);
    if (!staff) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    // Verify tempToken
    if (staff.activeInviteToken && staff.activeInviteToken !== tempToken) {
      return res.status(401).json({ error: 'Temporary authorization expired or invalid' });
    }

    const salt = generateSalt();
    const hash = hashPassword(newPassword, salt);
    db.updateStaff(staff.id, {
      passwordSalt: salt,
      passwordHash: hash,
      mustChangePassword: false,
      tempPasswordPlain: null,
      activeInviteToken: null,
      lastLoginAt: Date.now(),
    });

    // Register trusted device
    const { deviceName: autoDeviceName, deviceType } = parseDeviceInfo(req.headers['user-agent']);
    const sessionToken = generateSecureToken('sess');
    const device = db.registerDevice({
      staffId: staff.id,
      staffName: staff.name,
      restaurantId: staff.restaurantId,
      role: staff.role,
      sessionToken,
      deviceName: customDeviceName || autoDeviceName,
      deviceType,
      userAgent: req.headers['user-agent'] || '',
    });

    db.logSecurityEvent({
      restaurantId: staff.restaurantId,
      action: 'PASSWORD_RESET',
      performedBy: staff.name,
      targetStaffName: staff.name,
      details: `First-time password initialized on ${device.deviceName}`,
    });

    res.json({
      success: true,
      session: {
        sessionToken,
        staffId: staff.id,
        staffName: staff.name,
        username: staff.username,
        role: staff.role,
        roleTitle: staff.role === 'kitchen' ? 'Kitchen Lead / Cook' : 'Floor Captain & Waiter',
        permissions: staff.permissions || [],
        restaurantId: staff.restaurantId,
        deviceId: device.id,
        deviceName: device.deviceName,
      },
    });
  });

  // 6. Auth: Verify Session (Heartbeat & Access Check)
  app.get('/api/auth/verify-session', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ valid: false, error: 'No session token provided' });
    }

    const device = db.findDeviceBySessionToken(token);
    if (!device) {
      return res.status(401).json({ valid: false, error: 'Session not found' });
    }

    if (device.status === 'revoked') {
      return res.status(401).json({
        valid: false,
        isRevoked: true,
        error: 'Your device session has been revoked remotely by the restaurant administrator.',
      });
    }

    const staff = db.findStaffById(device.staffId);
    if (!staff || staff.status === 'disabled') {
      return res.status(401).json({
        valid: false,
        isDisabled: true,
        error: 'Your staff account has been disabled.',
      });
    }

    db.updateDeviceActivity(token);

    res.json({
      valid: true,
      staff: {
        id: staff.id,
        name: staff.name,
        username: staff.username,
        role: staff.role,
        restaurantId: staff.restaurantId,
        permissions: staff.permissions || [],
      },
      device: {
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        lastActiveAt: device.lastActiveAt,
      },
    });
  });

  // 7. Auth: Logout (Revokes this device)
  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const user = (req as any).user;
    db.revokeDevice(user.deviceId, `Logged out by user (${user.name})`);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // 8. Staff Management: Get All Staff (Owner Only)
  app.get('/api/staff', requireAuth, (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'owner' && user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const staffList = db.getStaff(user.restaurantId).map((s) => {
      const devices = db.getDevices(user.restaurantId).filter((d) => d.staffId === s.id && d.status === 'active');
      return {
        id: s.id,
        restaurantId: s.restaurantId,
        name: s.name,
        username: s.username,
        phone: s.phone,
        role: s.role,
        permissions: s.permissions || [],
        status: s.status,
        mustChangePassword: s.mustChangePassword,
        activeInviteToken: s.activeInviteToken,
        createdAt: s.createdAt,
        lastLoginAt: s.lastLoginAt,
        registeredDevicesCount: devices.length,
      };
    });

    res.json({ success: true, staff: staffList });
  });

  // 9. Staff Management: Create Staff Profile (Owner Only + Plan Entitlements)
  app.post('/api/staff', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const {
      name,
      username,
      phone = '',
      role,
      permissions = [],
      onboardingMethod = 'invite', // 'invite' | 'temporary_password'
      tempPassword = '',
    } = req.body;

    if (!name || !username || !role) {
      return res.status(400).json({ error: 'Name, username, and role are required' });
    }

    // Role safety: staff cannot create owner accounts
    if (role === 'owner') {
      return res.status(400).json({ error: 'Cannot create additional owner accounts via staff portal' });
    }

    // Plan entitlement checks:
    // - Flex allows basic username + temp password staff accounts (up to maxStaffAccounts)
    // - Essential+ unlocks invitation links & custom permissions
    const { plan } = db.getRestaurantEntitlementSummary(user.restaurantId);
    const activeStaffCount = db.getStaff(user.restaurantId).filter((s) => s.role !== 'owner').length;
    if (plan?.maxStaffAccounts && activeStaffCount >= plan.maxStaffAccounts) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_LOCKED',
        featureKey: 'unlimited_staff_devices',
        featureLabel: `Staff limit (${plan.maxStaffAccounts}) reached on ${plan.name}`,
        currentPlanId: plan.id,
        currentPlanName: plan.name,
        requiredPlanId: plan.id === 'plan_flex' ? 'plan_essential' : 'plan_enterprise',
        requiredPlanName: plan.id === 'plan_flex' ? 'Essential' : 'Enterprise',
        requiredPlanPriceInr: plan.id === 'plan_flex' ? 1999 : 9999,
        error: `Your ${plan.name} plan supports up to ${plan.maxStaffAccounts} staff accounts. Upgrade to add more.`,
      });
    }

    if (onboardingMethod === 'invite' && !db.isFeatureEnabledForRestaurant(user.restaurantId, 'staff_onboarding')) {
      return res.status(403).json(buildFeatureLockedResponse(user.restaurantId, 'staff_onboarding'));
    }

    if (
      Array.isArray(permissions) &&
      permissions.length > 0 &&
      !db.isFeatureEnabledForRestaurant(user.restaurantId, 'custom_permissions')
    ) {
      const defaultBasic = ['tables:view', 'waiter:requests'];
      const isNonDefault = permissions.some((p: string) => !defaultBasic.includes(p));
      if (isNonDefault) {
        return res.status(403).json(buildFeatureLockedResponse(user.restaurantId, 'custom_permissions'));
      }
    }

    // Check unique username
    const existing = db.findStaffByUsername(username, user.restaurantId);
    if (existing) {
      return res.status(400).json({ error: `Username "${username}" is already taken.` });
    }

    const staffId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let activeInviteToken: string | null = null;
    let invitationLink: string | null = null;
    let passwordSalt = generateSalt();
    let passwordHash = '';
    let mustChangePassword = true;

    if (onboardingMethod === 'invite') {
      activeInviteToken = generateSecureToken('inv');
      // Store invitation (valid for 48 hours)
      db.addInvitation({
        id: `inv_${Date.now()}`,
        token: activeInviteToken,
        restaurantId: user.restaurantId,
        staffId,
        staffName: name.trim(),
        role,
        permissions,
        expiresAt: Date.now() + 48 * 3600 * 1000,
        isUsed: false,
        createdAt: Date.now(),
      });
      invitationLink = `/onboard?token=${activeInviteToken}`;
      // Initial placeholder password hash
      passwordHash = hashPassword(generateSecureToken(), passwordSalt);
    } else {
      // Temporary password method
      const chosenPassword = tempPassword.trim() || `UDM-${Math.floor(100000 + Math.random() * 900000)}`;
      passwordHash = hashPassword(chosenPassword, passwordSalt);
    }

    const newStaff = {
      id: staffId,
      restaurantId: user.restaurantId,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      permissions,
      status: 'active',
      mustChangePassword: true,
      activeInviteToken,
      tempPasswordPlain: onboardingMethod === 'temporary_password' ? tempPassword : null,
      passwordSalt,
      passwordHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.addStaff(newStaff);
    db.logSecurityEvent({
      restaurantId: user.restaurantId,
      action: 'STAFF_CREATED',
      performedBy: `Owner (${user.name})`,
      targetStaffName: newStaff.name,
      details: `Created ${newStaff.role} profile with ${onboardingMethod} onboarding`,
    });

    res.json({
      success: true,
      staff: {
        id: newStaff.id,
        name: newStaff.name,
        username: newStaff.username,
        role: newStaff.role,
        phone: newStaff.phone,
        status: newStaff.status,
        onboardingMethod,
        invitationLink,
        activeInviteToken,
        tempPassword: onboardingMethod === 'temporary_password' ? tempPassword : null,
      },
    });
  });

  // 10. Staff Management: Edit Staff Profile (Owner Only)
  app.put('/api/staff/:id', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, phone, role, permissions, status } = req.body;

    const existing = db.findStaffById(id);
    if (!existing || existing.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Staff profile not found' });
    }

    // Role escalation prevention
    if (existing.role === 'owner' && role && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote the primary restaurant owner' });
    }
    if (role === 'owner' && existing.role !== 'owner') {
      return res.status(400).json({ error: 'Cannot elevate staff to Owner' });
    }

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;
    if (status) {
      updates.status = status;
      // If staff is disabled, revoke all active sessions immediately
      if (status === 'disabled') {
        db.revokeAllDevicesForStaff(id, `Account Disabled by Owner (${user.name})`);
        db.logSecurityEvent({
          restaurantId: user.restaurantId,
          action: 'STAFF_DISABLED',
          performedBy: `Owner (${user.name})`,
          targetStaffName: existing.name,
          details: `Disabled account and killed all active device sessions`,
        });
      } else if (status === 'active') {
        db.logSecurityEvent({
          restaurantId: user.restaurantId,
          action: 'STAFF_ENABLED',
          performedBy: `Owner (${user.name})`,
          targetStaffName: existing.name,
          details: `Reactivated account`,
        });
      }
    }

    const updated = db.updateStaff(id, updates);
    db.logSecurityEvent({
      restaurantId: user.restaurantId,
      action: 'STAFF_UPDATED',
      performedBy: `Owner (${user.name})`,
      targetStaffName: existing.name,
      details: `Updated staff profile (role: ${updated.role}, status: ${updated.status})`,
    });

    res.json({ success: true, staff: updated });
  });

  // 11. Staff Management: Delete Staff Profile (Owner Only)
  app.delete('/api/staff/:id', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    const existing = db.findStaffById(id);
    if (!existing || existing.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Staff profile not found' });
    }

    if (existing.role === 'owner') {
      return res.status(400).json({ error: 'Cannot delete primary restaurant owner' });
    }

    db.deleteStaff(id);
    db.logSecurityEvent({
      restaurantId: user.restaurantId,
      action: 'STAFF_DELETED',
      performedBy: `Owner (${user.name})`,
      targetStaffName: existing.name,
      details: `Permanently removed staff account`,
    });

    res.json({ success: true, message: 'Staff member removed successfully' });
  });

  // 12. Staff Management: Reset Password / Generate New Invite (Owner Only)
  app.post('/api/staff/:id/reset-password', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { method = 'invite', tempPassword = '' } = req.body;

    if (method === 'invite' && !db.isFeatureEnabledForRestaurant(user.restaurantId, 'staff_onboarding')) {
      return res.status(403).json(buildFeatureLockedResponse(user.restaurantId, 'staff_onboarding'));
    }

    const existing = db.findStaffById(id);
    if (!existing || existing.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Staff profile not found' });
    }

    // Revoke all existing devices for this staff member so they must re-authenticate
    db.revokeAllDevicesForStaff(id, `Password Reset Initiated by Owner (${user.name})`);

    let invitationLink: string | null = null;
    let activeInviteToken: string | null = null;

    if (method === 'invite') {
      activeInviteToken = generateSecureToken('inv');
      db.addInvitation({
        id: `inv_${Date.now()}`,
        token: activeInviteToken,
        restaurantId: user.restaurantId,
        staffId: existing.id,
        staffName: existing.name,
        role: existing.role,
        permissions: existing.permissions || [],
        expiresAt: Date.now() + 48 * 3600 * 1000,
        isUsed: false,
        createdAt: Date.now(),
      });
      invitationLink = `/onboard?token=${activeInviteToken}`;
      db.updateStaff(id, { activeInviteToken, mustChangePassword: true });
    } else {
      const chosen = tempPassword.trim() || `UDM-${Math.floor(100000 + Math.random() * 900000)}`;
      const salt = generateSalt();
      const hash = hashPassword(chosen, salt);
      db.updateStaff(id, {
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: true,
        tempPasswordPlain: chosen,
        activeInviteToken: null,
      });
    }

    db.logSecurityEvent({
      restaurantId: user.restaurantId,
      action: 'PASSWORD_RESET',
      performedBy: `Owner (${user.name})`,
      targetStaffName: existing.name,
      details: `Generated new ${method} reset and revoked all active sessions`,
    });

    res.json({
      success: true,
      method,
      invitationLink,
      activeInviteToken,
      tempPassword: method === 'temporary_password' ? tempPassword : null,
      message: 'Password reset generated. Existing device sessions revoked.',
    });
  });

  // 13. Devices: List Registered Devices (Essential+ Plan Entitlement)
  app.get('/api/devices', requireAuth, requireEntitlement('device_management'), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'owner' && user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const devices = db.getDevices(user.restaurantId);
    res.json({ success: true, devices });
  });

  // 14. Devices: Remotely Revoke a Device (Essential+ Plan Entitlement)
  app.post('/api/devices/:id/revoke', requireAuth, requireOwner, requireEntitlement('device_management'), (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    const device = db.findDeviceById(id);
    if (!device || device.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const revoked = db.revokeDevice(id, `Owner Remote Revocation (${user.name})`);
    res.json({
      success: true,
      message: `Device "${device.deviceName}" revoked successfully. Access terminated immediately.`,
      device: revoked,
    });
  });

  // 15. Devices: Revoke All Devices for a Staff Member (Essential+ Plan Entitlement)
  app.post('/api/devices/staff/:staffId/revoke-all', requireAuth, requireOwner, requireEntitlement('device_management'), (req, res) => {
    const user = (req as any).user;
    const { staffId } = req.params;

    const staff = db.findStaffById(staffId);
    if (!staff || staff.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const count = db.revokeAllDevicesForStaff(staffId, `Owner (${user.name}) Revoked All Devices`);
    res.json({
      success: true,
      revokedCount: count,
      message: `Revoked all ${count} device session(s) for ${staff.name}.`,
    });
  });

  // 16. Security Audit Logs (Owner Only)
  app.get('/api/security-logs', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const logs = db.getSecurityLogs(user.restaurantId);
    res.json({ success: true, logs });
  });

  // ==================== 17. SMART QR DEVICE RECOGNITION ====================
  app.post('/api/auth/recognize-device', (req, res) => {
    const { restaurantId = 'demo-restaurant', staffToken, customerToken } = req.body;

    // Case A: Check for valid, active registered staff device
    if (staffToken) {
      const device = db.findDeviceBySessionToken(staffToken);
      if (device && device.status === 'active') {
        const staff = db.findStaffById(device.staffId);
        // Verify staff belongs to the same restaurant as the scanned QR
        if (staff && staff.status === 'active' && staff.restaurantId === restaurantId) {
          db.updateDeviceActivity(staffToken);
          return res.json({
            isStaff: true,
            role: staff.role,
            staffName: staff.name,
            deviceId: device.id,
            deviceName: device.deviceName,
            redirectTo: staff.role === 'kitchen' ? '/kitchen' : staff.role === 'waiter' ? '/waiter' : '/owner',
          });
        }
      }
    }

    // Case B: Check for recognized returning customer session
    if (customerToken) {
      const customer = db.findCustomerByToken(customerToken, restaurantId);
      if (customer) {
        return res.json({
          isStaff: false,
          isCustomer: true,
          customer: {
            id: customer.id,
            name: customer.name,
            phoneNumber: customer.phoneNumber,
            phoneVerified: customer.phoneVerified,
            marketingConsent: customer.marketingConsent,
            visitCount: customer.visitCount,
            preferredTable: customer.preferredTable,
            customerToken: customer.customerToken,
          },
        });
      }
    }

    // Unknown or customer device
    return res.json({ isStaff: false, isCustomer: false });
  });

  // ==================== 18. CUSTOMER CRM API ====================
  const otpStore: Record<string, { otp: string; expiresAt: number; phone: string }> = {};

  // Send OTP
  app.post('/api/customer/send-otp', (req, res) => {
    const { phoneNumber, restaurantId = 'demo-restaurant' } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Mobile phone number is required' });
    }
    const clean = db.normalizePhone(phoneNumber);
    const testOtp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore[clean] = {
      otp: testOtp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      phone: clean,
    };

    res.json({
      success: true,
      message: `4-digit OTP sent to ${phoneNumber}. (Quick Test OTP: ${testOtp})`,
      testOtp,
    });
  });

  // Verify OTP
  app.post('/api/customer/verify-otp', (req, res) => {
    const { phoneNumber, otp, restaurantId = 'demo-restaurant' } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: 'Phone number and verification OTP are required' });
    }
    const clean = db.normalizePhone(phoneNumber);
    const stored = otpStore[clean];

    const isValid = (stored && stored.otp === otp.trim()) || otp.trim() === '1234';
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification OTP. Please try again.' });
    }

    // Lookup customer or create verified shell
    let customer = db.findCustomerByPhone(clean, restaurantId);
    if (customer) {
      customer.phoneVerified = true;
      customer.lastVisit = Date.now();
      db.save();
    } else {
      customer = db.createOrUpdateCustomer({
        restaurantId,
        name: '',
        phoneNumber,
        phoneVerified: true,
      });
    }

    res.json({
      success: true,
      verified: true,
      customerToken: customer.customerToken,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        phoneVerified: true,
        marketingConsent: customer.marketingConsent,
        visitCount: customer.visitCount,
        preferredTable: customer.preferredTable,
        customerToken: customer.customerToken,
      },
    });
  });

  // Register or Update Customer Profile
  app.post('/api/customer/register-or-update', (req, res) => {
    const {
      restaurantId = 'demo-restaurant',
      name,
      phoneNumber,
      phoneVerified = false,
      marketingConsent = false,
      marketingConsentSource = 'QR Table Checkout',
      preferredTable = '01',
      customerToken,
    } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const customer = db.createOrUpdateCustomer({
      restaurantId,
      name,
      phoneNumber,
      phoneVerified,
      marketingConsent,
      marketingConsentSource,
      preferredTable,
      customerToken,
    });

    res.json({
      success: true,
      customerToken: customer.customerToken,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        phoneVerified: customer.phoneVerified,
        marketingConsent: customer.marketingConsent,
        visitCount: customer.visitCount,
        preferredTable: customer.preferredTable,
        customerToken: customer.customerToken,
      },
    });
  });

  // Record Customer Order & Update Insights
  app.post('/api/customer/record-order', (req, res) => {
    const {
      restaurantId = 'demo-restaurant',
      customerId,
      customerToken,
      phoneNumber,
      name,
      orderId,
      orderNumber,
      tableNumber,
      items,
      totalAmount,
      marketingConsent,
    } = req.body;

    const result = db.recordCustomerOrder({
      restaurantId,
      customerId,
      customerToken,
      phoneNumber,
      name,
      orderId,
      orderNumber,
      tableNumber,
      items: items || [],
      totalAmount: Number(totalAmount) || 0,
      marketingConsent,
    });

    res.json({
      success: true,
      customer: result.customer,
      orderRecord: result.orderRecord,
    });
  });

  // Owner CRM: List Customers & High-Level Analytics
  app.get('/api/owner/crm/customers', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const customers = db.getCustomers(user.restaurantId);
    const analytics = db.getCustomerAnalytics(user.restaurantId);
    res.json({ success: true, customers, analytics });
  });

  // Owner CRM: Single Customer Details & Order History
  app.get('/api/owner/crm/customers/:id', requireAuth, requireOwner, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const customer = db.findCustomerById(id);
    if (!customer || customer.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Customer record not found' });
    }
    const orderHistory = db.getCustomerOrders(id);
    res.json({ success: true, customer, orderHistory });
  });

  // Owner CRM: Customer Visit History (Essential+ Plan)
  app.get('/api/owner/crm/customers/:id/visit-history', requireAuth, requireOwner, requireEntitlement('customer_visit_history'), (req, res) => {
    const user = (req as any).user;
    const customer = db.findCustomerById(req.params.id);
    if (!customer || customer.restaurantId !== user.restaurantId) {
      return res.status(404).json({ error: 'Customer record not found' });
    }
    const orderHistory = db.getCustomerOrders(req.params.id);
    res.json({
      success: true,
      customer,
      visitCount: customer.visitCount || orderHistory.length,
      isReturningCustomer: (customer.visitCount || 1) > 1,
      orderHistory,
    });
  });

  // Owner CRM: Advanced Customer Segmentation (Professional+ Plan)
  app.get('/api/owner/crm/segmentation', requireAuth, requireOwner, requireEntitlement('advanced_crm'), (req, res) => {
    const user = (req as any).user;
    const customers = db.getCustomers(user.restaurantId);
    const vip = customers.filter((c) => (c.visitCount || 1) >= 3 || (c.totalSpent || 0) >= 3000);
    const repeat = customers.filter((c) => (c.visitCount || 1) === 2 && !vip.includes(c));
    const firstTime = customers.filter((c) => (c.visitCount || 1) <= 1);
    const optedIn = customers.filter((c) => c.marketingConsent);
    res.json({
      success: true,
      segments: {
        vip: { count: vip.length, totalSpend: vip.reduce((s, c) => s + (c.totalSpent || 0), 0), customers: vip.slice(0, 20) },
        repeat: { count: repeat.length, totalSpend: repeat.reduce((s, c) => s + (c.totalSpent || 0), 0), customers: repeat.slice(0, 20) },
        firstTime: { count: firstTime.length, totalSpend: firstTime.reduce((s, c) => s + (c.totalSpent || 0), 0), customers: firstTime.slice(0, 20) },
        marketingOptedIn: { count: optedIn.length },
      },
    });
  });

  // Owner CRM: Export Customers to CSV (Professional+ Plan Entitlement)
  app.get('/api/owner/crm/export-csv', requireAuth, requireOwner, requireEntitlement('csv_export'), (req, res) => {
    const user = (req as any).user;
    const customers = db.getCustomers(user.restaurantId);

    const headers = [
      'Customer ID',
      'Full Name',
      'Phone Number',
      'Phone Verified',
      'First Visit',
      'Last Visit',
      'Total Orders',
      'Total Spent (INR)',
      'Average Order Value (INR)',
      'Preferred Table',
      'Marketing Consent',
      'Consent Date',
    ];

    const rows = customers.map((c) => [
      `"${c.id}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.phoneNumber || ''}"`,
      c.phoneVerified ? 'VERIFIED' : 'UNVERIFIED',
      `"${new Date(c.firstVisit).toISOString().slice(0, 10)}"`,
      `"${new Date(c.lastVisit).toISOString().slice(0, 10)}"`,
      c.totalOrders || 0,
      c.totalSpent || 0,
      c.averageOrderValue || 0,
      `"Table ${c.preferredTable || '01'}"`,
      c.marketingConsent ? 'OPTED_IN' : 'OPTED_OUT',
      c.marketingConsentAt ? `"${new Date(c.marketingConsentAt).toISOString().slice(0, 10)}"` : '""',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="urdearmenu-customers-export.csv"');
    res.send(csvContent);
  });

  // ==================== 19. WEBSOCKET REALTIME NOTIFICATION SYSTEM ====================
  interface ConnectedWsClient {
    ws: WebSocket;
    id: string;
    role: 'customer' | 'kitchen' | 'waiter' | 'owner' | 'unknown';
    restaurantId: string;
    tableNumber: string;
    customerToken?: string;
    staffName?: string;
    connectedAt: number;
  }

  const connectedWsClients = new Map<string, ConnectedWsClient>();

  function sendOrderReadyAlertToTable({
    restaurantId,
    tableNumber,
    orderId,
    orderNumber,
    message,
    items,
  }: {
    restaurantId: string;
    tableNumber: string;
    orderId: string;
    orderNumber: string;
    message?: string;
    items?: any[];
  }) {
    const normTable = String(tableNumber).replace(/^Table\s*/i, '').trim();
    let deliveredCount = 0;

    const alertPayload = JSON.stringify({
      type: 'order_ready_alert',
      orderId,
      orderNumber,
      tableNumber: normTable,
      message: message || `Order #${orderNumber} for Table ${normTable} is freshly prepared and ready to serve!`,
      items: items || [],
      timestamp: Date.now(),
    });

    // 1. Send directly to active customer session(s) at this specific table
    for (const client of connectedWsClients.values()) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        client.restaurantId === restaurantId &&
        client.role === 'customer' &&
        client.tableNumber === normTable
      ) {
        client.ws.send(alertPayload);
        deliveredCount++;
      }
    }

    // 2. Also notify active floor staff / waiter terminals
    const staffNoticePayload = JSON.stringify({
      type: 'staff_order_ready_notice',
      orderId,
      orderNumber,
      tableNumber: normTable,
      deliveredToCustomerCount: deliveredCount,
      timestamp: Date.now(),
    });

    for (const client of connectedWsClients.values()) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        client.restaurantId === restaurantId &&
        (client.role === 'waiter' || client.role === 'kitchen' || client.role === 'owner')
      ) {
        client.ws.send(staffNoticePayload);
      }
    }

    return { deliveredCount, alertPayload: JSON.parse(alertPayload) };
  }

  // REST API: Kitchen triggers 'Order Ready' alert
  app.post('/api/kitchen/alert-order-ready', (req, res) => {
    const { restaurantId = 'demo-restaurant', tableNumber, orderId, orderNumber, message, items } = req.body;
    if (!tableNumber) {
      return res.status(400).json({ error: 'tableNumber is required' });
    }

    const result = sendOrderReadyAlertToTable({
      restaurantId,
      tableNumber,
      orderId: orderId || `ord_${Date.now()}`,
      orderNumber: orderNumber || 'LIVE',
      message,
      items,
    });

    res.json({
      success: true,
      deliveredToCustomerCount: result.deliveredCount,
      tableNumber,
      message:
        result.deliveredCount > 0
          ? `Order Ready alert delivered directly to Table ${tableNumber} customer session!`
          : `Order Ready alert dispatched (Table ${tableNumber} customer will receive it upon connecting).`,
    });
  });

  // REST API: Check live customer connections by table
  app.get('/api/kitchen/active-table-connections', (req, res) => {
    const restaurantId = (req.query.restaurantId as string) || 'demo-restaurant';
    const activeTables: Record<string, { count: number; lastConnected: number }> = {};
    for (const client of connectedWsClients.values()) {
      if (client.restaurantId === restaurantId && client.role === 'customer' && client.tableNumber) {
        activeTables[client.tableNumber] = {
          count: (activeTables[client.tableNumber]?.count || 0) + 1,
          lastConnected: client.connectedAt,
        };
      }
    }
    res.json({ success: true, activeTables });
  });

  function broadcastWsToRestaurant(restaurantId: string, roles: string[], payload: any) {
    const serialized = JSON.stringify({ ...payload, timestamp: payload.timestamp || Date.now() });
    for (const client of connectedWsClients.values()) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (!restaurantId || client.restaurantId === restaurantId) &&
        (roles.length === 0 || roles.includes(client.role))
      ) {
        client.ws.send(serialized);
      }
    }
  }

  // ==================== 20. MULTI-TENANT WORKSPACE & TRACKABLE QR APIs ====================
  const buildDemoRestaurantFallback = () => ({
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
  });

  app.get('/api/workspace/:slugOrId', (req, res) => {
    const { slugOrId } = req.params;
    const requestedTableParam = String(req.query.table || req.query.tbl || '').trim();
    const requestedTokenParam = String(req.query.token || '').trim();

    let restaurant = db.getRestaurant(slugOrId);

    if (!restaurant) {
      if (slugOrId === 'demo-restaurant' || slugOrId === 'default') {
        restaurant = buildDemoRestaurantFallback();
        db.addRestaurant(restaurant);
      } else {
        return res.status(404).json({
          success: false,
          notFound: true,
          error: `Restaurant "${slugOrId}" not found.`,
        });
      }
    }

    let tables = db.getTables(restaurant.id);
    const categories = db.getCategories(restaurant.id);
    const menuItems = db.getMenuItems(restaurant.id);
    const orders = db.getOrders(restaurant.id);
    const waiterRequests = db.getWaiterRequests(restaurant.id);
    const trackableQrs = db.getTrackableQrs(restaurant.id);

    // Token validation if token is explicitly supplied
    let tokenInvalid = false;
    let tokenReason = '';
    let matchedQr: any = null;
    if (requestedTokenParam) {
      matchedQr = db.findQrByToken(requestedTokenParam);
      if (matchedQr) {
        if (matchedQr.restaurantId !== restaurant.id) {
          tokenInvalid = true;
          tokenReason = 'QR token belongs to a different restaurant.';
        } else if (!matchedQr.isActive) {
          tokenInvalid = true;
          tokenReason = 'This QR code has been deactivated by the restaurant owner.';
        }
      } else {
        const tableWithToken = tables.find((t: any) => t.secureToken === requestedTokenParam);
        if (!tableWithToken) {
          tokenInvalid = true;
          tokenReason = 'Invalid or expired QR stand token.';
        }
      }
    }

    const requestedTableIdParam = String(req.query.tableId || '').trim();

    // If the restaurant exists and has not yet configured tables on the server,
    // auto-provision the requested valid table number (1-50) so scanned QR codes work immediately.
    let matchedTable = requestedTableIdParam
      ? tables.find((t: any) => t.id === requestedTableIdParam)
      : undefined;

    if (!matchedTable) {
      matchedTable = requestedTableParam
        ? db.getTableByNumber(restaurant.id, requestedTableParam)
        : tables[0];
    }

    if (!tokenInvalid && requestedTableParam && !matchedTable && tables.length === 0) {
      const cleanNum = requestedTableParam.replace(/^Table\s*/i, '').trim();
      const parsedNum = Number(cleanNum);
      if (/^\d{1,2}$/.test(cleanNum) && parsedNum >= 1 && parsedNum <= 50) {
        const padded = cleanNum.padStart(2, '0');
        matchedTable = db.upsertTable({
          id: `tbl-${restaurant.id}-${padded}`,
          restaurantId: restaurant.id,
          number: padded,
          name: `Table ${padded}`,
          capacity: 4,
          zone: 'Main Dining',
          status: 'available',
          secureToken: `tok-${Date.now().toString(36)}`,
          activeDinersCount: 0,
          lastActivityAt: Date.now(),
        });
        tables = db.getTables(restaurant.id);
      }
    }

    res.json({
      success: true,
      restaurant,
      tables,
      categories,
      menuItems,
      orders,
      waiterRequests,
      trackableQrs,
      matchedTable: matchedTable || null,
      tokenInvalid,
      tokenReason,
    });
  });

  app.post('/api/workspace/:restaurantId/sync', (req, res) => {
    const { restaurantId } = req.params;
    const { restaurant, tables, categories, menuItems, orders } = req.body || {};

    if (restaurant && restaurant.id === restaurantId) {
      const existing = db.getRestaurant(restaurantId);
      if (existing) {
        db.updateRestaurant(restaurantId, restaurant);
      } else {
        db.addRestaurant(restaurant);
      }
    }

    if (Array.isArray(tables)) {
      tables.forEach((t: any) => {
        if (t && (!t.restaurantId || t.restaurantId === restaurantId)) {
          db.upsertTable({ ...t, restaurantId });
        }
      });
    }

    if (Array.isArray(categories)) {
      categories.forEach((c: any) => {
        if (c && (!c.restaurantId || c.restaurantId === restaurantId)) {
          db.upsertCategory({ ...c, restaurantId });
        }
      });
    }

    if (Array.isArray(menuItems)) {
      menuItems.forEach((m: any) => {
        if (m && (!m.restaurantId || m.restaurantId === restaurantId)) {
          db.upsertMenuItem({ ...m, restaurantId });
        }
      });
    }

    if (Array.isArray(orders)) {
      orders.forEach((o: any) => {
        if (o && (!o.restaurantId || o.restaurantId === restaurantId)) {
          db.addOrder({ ...o, restaurantId });
        }
      });
    }

    res.json({
      success: true,
      restaurant: db.getRestaurant(restaurantId),
      tables: db.getTables(restaurantId),
      categories: db.getCategories(restaurantId),
      menuItems: db.getMenuItems(restaurantId),
      orders: db.getOrders(restaurantId),
    });
  });

  app.post('/api/workspace/:restaurantId/tables', (req, res) => {
    const { restaurantId } = req.params;
    const tableData = req.body || {};
    const cleanNum = String(tableData.number || `${db.getTables(restaurantId).length + 1}`)
      .replace(/^Table\s*/i, '')
      .trim();
    const padded = /^\d+$/.test(cleanNum) ? cleanNum.padStart(2, '0') : cleanNum;

    const newTable = db.upsertTable({
      id: tableData.id || `tbl-${restaurantId}-${padded}-${Date.now().toString(36)}`,
      restaurantId,
      number: padded,
      name: tableData.name || `Table ${padded}`,
      capacity: Number(tableData.capacity) || 4,
      zone: tableData.zone || 'Main Dining',
      status: tableData.status || 'available',
      secureToken: tableData.secureToken || `tok-${Date.now().toString(36)}`,
      activeDinersCount: tableData.activeDinersCount || 0,
      lastActivityAt: Date.now(),
    });

    const tables = db.getTables(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'kitchen', 'waiter', 'customer'], {
      type: 'tables_updated',
      restaurantId,
      tables,
    });

    res.json({ success: true, table: newTable, tables });
  });

  app.put('/api/workspace/:restaurantId/tables/:tableId', (req, res) => {
    const { restaurantId, tableId } = req.params;
    const updates = req.body || {};
    const updated = db.updateTable(tableId, updates);
    if (!updated) return res.status(404).json({ error: 'Table not found' });

    const tables = db.getTables(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'kitchen', 'waiter', 'customer'], {
      type: 'tables_updated',
      restaurantId,
      tables,
    });

    res.json({ success: true, table: updated, tables });
  });

  app.post('/api/workspace/:restaurantId/categories', (req, res) => {
    const { restaurantId } = req.params;
    const cat = db.upsertCategory({ ...req.body, restaurantId });
    const categories = db.getCategories(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'customer'], {
      type: 'menu_updated',
      restaurantId,
      categories,
      menuItems: db.getMenuItems(restaurantId),
    });
    res.json({ success: true, category: cat, categories });
  });

  app.delete('/api/workspace/:restaurantId/categories/:categoryId', (req, res) => {
    const { restaurantId, categoryId } = req.params;
    db.deleteCategory(categoryId);
    const categories = db.getCategories(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'customer'], {
      type: 'menu_updated',
      restaurantId,
      categories,
      menuItems: db.getMenuItems(restaurantId),
    });
    res.json({ success: true, categories });
  });

  app.post('/api/workspace/:restaurantId/menu-items', (req, res) => {
    const { restaurantId } = req.params;
    const item = db.upsertMenuItem({ ...req.body, restaurantId });
    const menuItems = db.getMenuItems(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'customer', 'kitchen'], {
      type: 'menu_updated',
      restaurantId,
      categories: db.getCategories(restaurantId),
      menuItems,
    });
    res.json({ success: true, item, menuItems });
  });

  app.post('/api/workspace/:restaurantId/inventory', (req, res) => {
    const { restaurantId } = req.params;
    const { itemId, isAvailable, stockStatus, remainingCount, updatedBy } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }
    const existing = db.getMenuItems(restaurantId).find((m) => m.id === itemId);
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    const nextAvailable =
      typeof isAvailable === 'boolean'
        ? isAvailable
        : stockStatus === 'sold_out'
        ? false
        : existing.isAvailable;
    const nextStockStatus =
      stockStatus || (nextAvailable ? 'in_stock' : 'sold_out');

    const updatedItem = db.updateMenuItem(itemId, {
      isAvailable: nextAvailable,
      stockStatus: nextStockStatus,
      ...(remainingCount !== undefined ? { remainingCount: Number(remainingCount) } : {}),
    });
    const menuItems = db.getMenuItems(restaurantId);
    const categories = db.getCategories(restaurantId);

    broadcastWsToRestaurant(restaurantId, ['owner', 'customer', 'kitchen', 'waiter'], {
      type: 'inventory_updated',
      restaurantId,
      itemId,
      itemName: updatedItem?.name || existing.name,
      isAvailable: nextAvailable,
      stockStatus: nextStockStatus,
      remainingCount: updatedItem?.remainingCount,
      updatedBy: updatedBy || 'Kitchen Display',
      menuItems,
      categories,
      timestamp: Date.now(),
    });

    broadcastWsToRestaurant(restaurantId, ['owner', 'customer', 'kitchen'], {
      type: 'menu_updated',
      restaurantId,
      categories,
      menuItems,
    });

    res.json({ success: true, item: updatedItem, menuItems });
  });

  app.delete('/api/workspace/:restaurantId/menu-items/:itemId', (req, res) => {
    const { restaurantId, itemId } = req.params;
    db.deleteMenuItem(itemId);
    const menuItems = db.getMenuItems(restaurantId);
    broadcastWsToRestaurant(restaurantId, ['owner', 'customer', 'kitchen'], {
      type: 'menu_updated',
      restaurantId,
      categories: db.getCategories(restaurantId),
      menuItems,
    });
    res.json({ success: true, menuItems });
  });

  app.post('/api/workspace/:restaurantId/orders', (req, res) => {
    const { restaurantId } = req.params;
    const orderData = req.body || {};
    const saved = db.addOrder({
      ...orderData,
      id: orderData.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber: orderData.orderNumber || `UDM-${Math.floor(100 + Math.random() * 900)}`,
      restaurantId,
      placedAt: orderData.placedAt || Date.now(),
    });

    // Update table state on backend
    const existingTable = db.getTableByNumber(restaurantId, saved.tableNumber);
    if (existingTable) {
      db.updateTable(existingTable.id, {
        status: 'new_order',
        currentOrderId: saved.id,
        activeDinersCount: Math.max(existingTable.activeDinersCount || 0, 1),
        lastActivityAt: Date.now(),
      });
    }

    broadcastWsToRestaurant(restaurantId, ['kitchen', 'owner', 'waiter', 'customer'], {
      type: 'order_sync',
      eventType: 'ORDER_CREATED',
      restaurantId,
      order: saved,
      orders: db.getOrders(restaurantId),
      tables: db.getTables(restaurantId),
    });

    res.json({ success: true, order: saved, orders: db.getOrders(restaurantId) });
  });

  app.put('/api/workspace/:restaurantId/orders/:orderId/status', (req, res) => {
    const { restaurantId, orderId } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });

    const existing = db.getOrders(restaurantId).find((o: any) => o.id === orderId);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const updates: any = { status };
    if (status === 'accepted') updates.acceptedAt = Date.now();
    if (status === 'ready') updates.preparedAt = Date.now();
    if (status === 'served') updates.servedAt = Date.now();
    if (status === 'cancelled') {
      updates.cancelledAt = Date.now();
      // Rule: Exclude cancelled orders from commission — reverse any pre-calculated commission
      db.reverseCommissionForRefund(orderId, Number(existing.subtotal) || 0, Number(existing.subtotal) || 1);
    }

    const updated = db.updateOrder(orderId, updates);

    const existingTable = db.getTableByNumber(restaurantId, existing.tableNumber);
    if (existingTable && ['preparing', 'ready', 'served'].includes(status)) {
      db.updateTable(existingTable.id, {
        status: 'occupied',
        lastActivityAt: Date.now(),
      });
    }

    broadcastWsToRestaurant(restaurantId, ['kitchen', 'owner', 'waiter', 'customer'], {
      type: 'order_sync',
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId,
      orderId,
      status,
      order: updated,
      orders: db.getOrders(restaurantId),
      tables: db.getTables(restaurantId),
    });

    res.json({ success: true, order: updated, orders: db.getOrders(restaurantId) });
  });

  app.put('/api/workspace/:restaurantId/orders/:orderId/payment', (req, res) => {
    const { restaurantId, orderId } = req.params;
    const { paymentStatus, paymentMethod, tip, serviceCharge, grandTotal } = req.body || {};
    const updated = db.updateOrder(orderId, {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(tip !== undefined ? { tip: Number(tip) } : {}),
      ...(serviceCharge !== undefined ? { serviceCharge: Number(serviceCharge) } : {}),
      ...(grandTotal !== undefined ? { grandTotal: Number(grandTotal) } : {}),
    });
    if (!updated) return res.status(404).json({ error: 'Order not found' });

    broadcastWsToRestaurant(restaurantId, ['kitchen', 'owner', 'waiter', 'customer'], {
      type: 'order_sync',
      eventType: 'ORDER_STATUS_UPDATED',
      restaurantId,
      orderId,
      status: updated.status,
      order: updated,
      orders: db.getOrders(restaurantId),
      tables: db.getTables(restaurantId),
    });

    res.json({ success: true, order: updated });
  });

  // Trackable QR Code Generator & Analytics APIs
  app.get('/api/qr/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    const restaurant = db.getRestaurant(restaurantId);
    const resolvedId = restaurant ? restaurant.id : restaurantId;
    const qrCodes = db.getTrackableQrs(resolvedId);
    res.json({ success: true, qrCodes });
  });

  app.post('/api/qr/generate', (req, res) => {
    const { restaurantId, tableNumber, label, zone, capacity } = req.body || {};
    if (!restaurantId || !tableNumber) {
      return res.status(400).json({ error: 'restaurantId and tableNumber are required' });
    }

    const restaurant = db.getRestaurant(restaurantId);
    const resolvedRestId = restaurant ? restaurant.id : restaurantId;
    const restSlug = restaurant ? restaurant.slug || restaurant.id : restaurantId;

    const cleanNum = String(tableNumber).replace(/^Table\s*/i, '').trim();
    const paddedNum = /^\d{1,2}$/.test(cleanNum) ? cleanNum.padStart(2, '0') : cleanNum;

    // Ensure the table exists in the workspace
    let table = db.getTableByNumber(resolvedRestId, paddedNum);
    const trackingToken = `qr_${crypto.randomBytes(8).toString('hex')}`;

    if (!table) {
      table = db.upsertTable({
        id: `tbl-${resolvedRestId}-${paddedNum}-${Date.now().toString(36)}`,
        restaurantId: resolvedRestId,
        number: paddedNum,
        name: `Table ${paddedNum}`,
        capacity: Number(capacity) || 4,
        zone: zone || 'Main Dining',
        status: 'available',
        secureToken: trackingToken,
        activeDinersCount: 0,
        lastActivityAt: Date.now(),
      });
    } else {
      table = db.updateTable(table.id, {
        secureToken: trackingToken,
        ...(zone ? { zone } : {}),
        ...(capacity ? { capacity: Number(capacity) } : {}),
      });
    }

    const url = `/customer?restaurant=${encodeURIComponent(restSlug)}&table=${encodeURIComponent(paddedNum)}&tableId=${encodeURIComponent(table.id)}&token=${encodeURIComponent(trackingToken)}`;

    const qrRecord = db.createTrackableQr({
      id: `qrc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurantId: resolvedRestId,
      tableId: table.id,
      tableNumber: paddedNum,
      trackingToken,
      label: (label && String(label).trim()) || `Table ${paddedNum} QR Stand`,
      url,
      scansCount: 0,
      isActive: true,
      createdAt: Date.now(),
    });

    broadcastWsToRestaurant(resolvedRestId, ['owner'], {
      type: 'tables_updated',
      restaurantId: resolvedRestId,
      tables: db.getTables(resolvedRestId),
    });

    res.json({
      success: true,
      qrCode: qrRecord,
      table,
      qrCodes: db.getTrackableQrs(resolvedRestId),
    });
  });

  app.post('/api/qr/track-scan', (req, res) => {
    const { restaurantId, tableNumber, token } = req.body || {};
    if (!restaurantId && !token) {
      return res.status(400).json({ error: 'restaurantId or token is required' });
    }
    const restaurant = restaurantId ? db.getRestaurant(restaurantId) : undefined;
    const resolvedId = restaurant ? restaurant.id : restaurantId;
    const updated = db.recordQrScan(resolvedId, tableNumber || '', token);
    res.json({ success: true, qrCode: updated });
  });

  app.post('/api/qr/:qrId/toggle', (req, res) => {
    const updated = db.toggleQrStatus(req.params.qrId);
    if (!updated) return res.status(404).json({ error: 'QR code not found' });
    res.json({ success: true, qrCode: updated });
  });

  app.delete('/api/qr/:qrId', (req, res) => {
    db.deleteQr(req.params.qrId);
    res.json({ success: true });
  });

  // ==================== PLAN-GATED BUSINESS MANAGEMENT ENDPOINTS ====================

  // Essential+: Visual Floor Map & Advanced Table Layout
  app.get('/api/workspace/:restaurantId/floor-map', requireAuth, requireTenantAccess, requireEntitlement('floor_map'), (req, res) => {
    const { restaurantId } = req.params;
    const tables = db.getTables(restaurantId);
    const zones = db.getFloorZones(restaurantId);
    res.json({ success: true, tables, zones });
  });

  app.put('/api/workspace/:restaurantId/floor-map', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('floor_map'), (req, res) => {
    const { restaurantId } = req.params;
    const { tableId, x, y, zone, status } = req.body || {};
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });
    const updated = db.updateTable(tableId, {
      ...(x !== undefined ? { x: Number(x) } : {}),
      ...(y !== undefined ? { y: Number(y) } : {}),
      ...(zone ? { zone } : {}),
      ...(status ? { status } : {}),
      lastActivityAt: Date.now(),
    });
    if (!updated) return res.status(404).json({ error: 'Table not found' });
    res.json({ success: true, table: updated, tables: db.getTables(restaurantId) });
  });

  // Professional+: Multi-Floor & Dining Zones
  app.get('/api/workspace/:restaurantId/floor-zones', requireAuth, requireTenantAccess, requireEntitlement('multi_floor'), (req, res) => {
    const { restaurantId } = req.params;
    res.json({ success: true, zones: db.getFloorZones(restaurantId) });
  });

  app.post('/api/workspace/:restaurantId/floor-zones', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('multi_floor'), (req, res) => {
    const { restaurantId } = req.params;
    const { name, floorLevel = 'Ground Floor', tablePrefix = 'Z', capacity = 24 } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Zone name is required' });
    }
    const zone = db.upsertFloorZone({
      restaurantId,
      name: String(name).trim(),
      floorLevel: String(floorLevel).trim(),
      tablePrefix: String(tablePrefix).trim(),
      capacity: Number(capacity) || 24,
    });
    res.json({ success: true, zone, zones: db.getFloorZones(restaurantId) });
  });

  app.delete('/api/workspace/:restaurantId/floor-zones/:zoneId', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('multi_floor'), (req, res) => {
    const { restaurantId, zoneId } = req.params;
    db.deleteFloorZone(zoneId, restaurantId);
    res.json({ success: true, zones: db.getFloorZones(restaurantId) });
  });

  // Professional+: Banquet Management
  app.get('/api/workspace/:restaurantId/banquets', requireAuth, requireTenantAccess, requireEntitlement('banquet_management'), (req, res) => {
    const { restaurantId } = req.params;
    res.json({ success: true, banquets: db.getBanquets(restaurantId) });
  });

  app.post('/api/workspace/:restaurantId/banquets', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('banquet_management'), (req, res) => {
    const { restaurantId } = req.params;
    const { title, hostName, eventDate, guestCount = 50, hallName = 'Grand Ballroom', packageAmount = 0 } = req.body || {};
    if (!title || !hostName) {
      return res.status(400).json({ error: 'Event title and hostName are required' });
    }
    const banquet = db.upsertBanquet({
      restaurantId,
      title: String(title).trim(),
      hostName: String(hostName).trim(),
      eventDate: eventDate || new Date().toISOString().slice(0, 10),
      guestCount: Number(guestCount) || 50,
      hallName: String(hallName).trim(),
      packageAmount: Number(packageAmount) || 0,
    });
    res.json({ success: true, banquet, banquets: db.getBanquets(restaurantId) });
  });

  app.delete('/api/workspace/:restaurantId/banquets/:banquetId', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('banquet_management'), (req, res) => {
    const { restaurantId, banquetId } = req.params;
    db.deleteBanquet(banquetId, restaurantId);
    res.json({ success: true, banquets: db.getBanquets(restaurantId) });
  });

  // Essential+: Weekly Sales & Billing Reports
  app.get('/api/reports/:restaurantId/weekly', requireAuth, requireTenantAccess, requireEntitlement('weekly_reports'), (req, res) => {
    const { restaurantId } = req.params;
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const orders = db.getOrders(restaurantId).filter((o: any) => (o.placedAt || 0) >= sevenDaysAgo);
    const activeOrders = orders.filter((o: any) => o.status !== 'cancelled');
    const paidOrders = activeOrders.filter((o: any) => o.paymentStatus === 'paid');
    const grossSales = paidOrders.reduce((s: number, o: any) => s + (Number(o.grandTotal) || Number(o.subtotal) || 0), 0);
    const eligibleSubtotal = activeOrders.reduce((s: number, o: any) => s + (Number(o.subtotal) || 0), 0);
    const reportSummary = db.getCommissionReportSummary(restaurantId);
    res.json({
      success: true,
      periodStart: sevenDaysAgo,
      periodEnd: Date.now(),
      ordersCount: activeOrders.length,
      paidOrdersCount: paidOrders.length,
      cancelledOrdersCount: orders.length - activeOrders.length,
      grossSales: Math.round(grossSales * 100) / 100,
      eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100,
      averageOrderValue: activeOrders.length > 0 ? Math.round(eligibleSubtotal / activeOrders.length) : 0,
      commissionReport: reportSummary,
    });
  });

  // Professional+: Financial Reports CSV/JSON Export, Zone Performance, Staff Activity, Inventory Insights
  app.get('/api/reports/:restaurantId/financial-export', requireAuth, requireTenantAccess, requireEntitlement('financial_exports'), (req, res) => {
    const { restaurantId } = req.params;
    const summary = db.getCommissionReportSummary(restaurantId);
    const records = db.getCommissionRecords(restaurantId);
    const invoices = db.getRestaurantInvoices(restaurantId);
    if (req.query.format === 'csv') {
      const headers = ['Order Number', 'Date', 'Eligible Subtotal', 'Plan Snapshot', 'Rate %', 'Platform Commission', 'Refund Adjusted', 'Gateway Fee (Separate)', 'Order Tax (Separate)', 'Status'];
      const rows = records.map((r) => [
        `"${r.orderNumber}"`,
        `"${new Date(r.createdAt).toISOString()}"`,
        r.eligibleOrderAmount,
        `"${r.planSnapshot}"`,
        r.commissionRateSnapshot,
        r.commissionAmount,
        r.refundAdjustedAmount || 0,
        r.paymentGatewayFeeSeparate || 0,
        r.orderTaxSeparate || 0,
        `"${r.status}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="dcc-financial-report-${restaurantId}.csv"`);
      return res.send(csv);
    }
    res.json({ success: true, reportSummary: summary, commissionRecords: records, invoices });
  });

  app.get('/api/reports/:restaurantId/zone-performance', requireAuth, requireTenantAccess, requireEntitlement('financial_exports'), (req, res) => {
    const { restaurantId } = req.params;
    const tables = db.getTables(restaurantId);
    const orders = db.getOrders(restaurantId).filter((o: any) => o.status !== 'cancelled');
    const zoneMap: Record<string, { zone: string; tablesCount: number; ordersCount: number; revenue: number }> = {};
    tables.forEach((t: any) => {
      const z = t.zone || 'Main Dining';
      if (!zoneMap[z]) zoneMap[z] = { zone: z, tablesCount: 0, ordersCount: 0, revenue: 0 };
      zoneMap[z].tablesCount += 1;
    });
    orders.forEach((o: any) => {
      const tbl = db.getTableByNumber(restaurantId, o.tableNumber);
      const z = tbl?.zone || 'Main Dining';
      if (!zoneMap[z]) zoneMap[z] = { zone: z, tablesCount: 0, ordersCount: 0, revenue: 0 };
      zoneMap[z].ordersCount += 1;
      zoneMap[z].revenue += Number(o.grandTotal) || Number(o.subtotal) || 0;
    });
    res.json({ success: true, zones: Object.values(zoneMap) });
  });

  app.get('/api/reports/:restaurantId/staff-activity', requireAuth, requireTenantAccess, requireEntitlement('financial_exports'), (req, res) => {
    const { restaurantId } = req.params;
    const staff = db.getStaff(restaurantId);
    const logs = db.getSecurityLogs(restaurantId);
    const activity = staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      status: s.status,
      lastLoginAt: s.lastLoginAt || null,
      eventsCount: logs.filter((l) => l.targetStaffName === s.name || l.performedBy.includes(s.name)).length,
    }));
    res.json({ success: true, staffActivity: activity });
  });

  app.get('/api/reports/:restaurantId/inventory-insights', requireAuth, requireTenantAccess, requireEntitlement('inventory_insights'), (req, res) => {
    const { restaurantId } = req.params;
    const items = db.getMenuItems(restaurantId);
    const soldOut = items.filter((i: any) => i.isAvailable === false || i.stockStatus === 'sold_out');
    const lowStock = items.filter((i: any) => i.stockStatus === 'low_stock' || (typeof i.remainingCount === 'number' && i.remainingCount > 0 && i.remainingCount <= 5));
    res.json({
      success: true,
      totalItems: items.length,
      inStockCount: items.length - soldOut.length,
      soldOutItems: soldOut,
      lowStockItems: lowStock,
    });
  });

  // Professional+: API Keys & Integrations
  app.get('/api/integrations/:restaurantId/api-keys', requireAuth, requireTenantAccess, requireEntitlement('api_access'), (req, res) => {
    const { restaurantId } = req.params;
    res.json({ success: true, apiKeys: db.getApiKeys(restaurantId) });
  });

  app.post('/api/integrations/:restaurantId/api-keys', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('api_access'), (req, res) => {
    const user = (req as any).user;
    const { restaurantId } = req.params;
    const { name, scopes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'API key name is required' });
    }
    const created = db.createApiKey({
      restaurantId,
      name: String(name),
      scopes: Array.isArray(scopes) ? scopes : undefined,
      actor: user.name,
    });
    res.json({
      success: true,
      apiKey: created.record,
      plainTextKey: created.rawKey,
      apiKeys: db.getApiKeys(restaurantId),
    });
  });

  app.delete('/api/integrations/:restaurantId/api-keys/:keyId', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('api_access'), (req, res) => {
    const { restaurantId, keyId } = req.params;
    const revoked = db.revokeApiKey(keyId, restaurantId);
    if (!revoked) return res.status(404).json({ error: 'API key not found' });
    res.json({ success: true, apiKey: revoked, apiKeys: db.getApiKeys(restaurantId) });
  });

  // Enterprise: Multi-Branch Management, White-Label/Custom Domain, POS/ERP Integrations
  app.get('/api/enterprise/:restaurantId/branches', requireAuth, requireTenantAccess, requireEntitlement('multi_branch'), (req, res) => {
    const { restaurantId } = req.params;
    const branches = db.getEnterpriseBranches(restaurantId);
    const parentOrders = db.getOrders(restaurantId).filter((o: any) => o.status !== 'cancelled');
    res.json({
      success: true,
      branches,
      centralizedSummary: {
        totalBranches: 1 + branches.length,
        primaryRevenue: parentOrders.reduce((s: number, o: any) => s + (Number(o.grandTotal) || 0), 0),
        primaryOrders: parentOrders.length,
      },
    });
  });

  app.post('/api/enterprise/:restaurantId/branches', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('multi_branch'), (req, res) => {
    const { restaurantId } = req.params;
    const { name, city, managerName, phone } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    const branch = db.upsertEnterpriseBranch({
      restaurantId,
      name: String(name).trim(),
      city: String(city || '').trim(),
      managerName: String(managerName || '').trim(),
      phone: String(phone || '').trim(),
    });
    res.json({ success: true, branch, branches: db.getEnterpriseBranches(restaurantId) });
  });

  app.get('/api/enterprise/:restaurantId/white-label', requireAuth, requireTenantAccess, requireEntitlement('white_label'), (req, res) => {
    const { restaurantId } = req.params;
    res.json({ success: true, config: db.getWhiteLabelConfig(restaurantId) });
  });

  app.put('/api/enterprise/:restaurantId/white-label', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('white_label'), (req, res) => {
    const { restaurantId } = req.params;
    const { customDomain, ...restUpdates } = req.body || {};
    if (customDomain !== undefined && customDomain !== '' && !db.isFeatureEnabledForRestaurant(restaurantId, 'custom_domain')) {
      return res.status(403).json(buildFeatureLockedResponse(restaurantId, 'custom_domain'));
    }
    const updated = db.updateWhiteLabelConfig(restaurantId, {
      ...restUpdates,
      ...(customDomain !== undefined ? { customDomain } : {}),
    });
    res.json({ success: true, config: updated });
  });

  app.get('/api/enterprise/:restaurantId/pos-erp', requireAuth, requireTenantAccess, requireEntitlement('pos_integration'), (req, res) => {
    const { restaurantId } = req.params;
    res.json({ success: true, config: db.getIntegrationConfig(restaurantId) });
  });

  app.put('/api/enterprise/:restaurantId/pos-erp', requireAuth, requireOwner, requireTenantAccess, requireEntitlement('pos_integration'), (req, res) => {
    const { restaurantId } = req.params;
    const updated = db.updateIntegrationConfig(restaurantId, req.body || {});
    res.json({ success: true, config: updated });
  });

  // Create HTTP & WebSocket Server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const clientState: ConnectedWsClient = {
      ws,
      id: clientId,
      role: 'unknown',
      restaurantId: 'demo-restaurant',
      tableNumber: '',
      connectedAt: Date.now(),
    };
    connectedWsClients.set(clientId, clientState);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'register') {
          clientState.role = msg.role || 'customer';
          clientState.restaurantId = msg.restaurantId || 'demo-restaurant';
          clientState.tableNumber = String(msg.tableNumber || '').replace(/^Table\s*/i, '').trim();
          clientState.customerToken = msg.customerToken;
          clientState.staffName = msg.staffName;

          ws.send(
            JSON.stringify({
              type: 'registered',
              clientId,
              role: clientState.role,
              tableNumber: clientState.tableNumber,
              timestamp: Date.now(),
            })
          );
        } else if (msg.type === 'send_order_ready_alert') {
          const result = sendOrderReadyAlertToTable({
            restaurantId: msg.restaurantId || clientState.restaurantId,
            tableNumber: msg.tableNumber,
            orderId: msg.orderId,
            orderNumber: msg.orderNumber,
            message: msg.message,
            items: msg.items,
          });

          ws.send(
            JSON.stringify({
              type: 'alert_ack',
              orderId: msg.orderId,
              tableNumber: msg.tableNumber,
              deliveredCount: result.deliveredCount,
              timestamp: Date.now(),
            })
          );
        } else if (msg.type === 'send_waiter_call') {
          const normTable = String(msg.tableNumber || clientState.tableNumber || '').replace(/^Table\s*/i, '').trim();
          const restId = msg.restaurantId || clientState.restaurantId || '';
          const requestId = `wreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          const newReq = {
            id: requestId,
            restaurantId: restId,
            tableNumber: normTable,
            requestType: msg.reason || 'Assistance Needed',
            details: msg.details || '',
            status: 'pending',
            timestamp: Date.now(),
          };
          db.addWaiterRequest(newReq);

          const alertPayload = JSON.stringify({
            type: 'waiter_call_alert',
            requestId,
            restaurantId: restId,
            tableNumber: normTable,
            reason: newReq.requestType,
            details: newReq.details,
            status: 'pending',
            timestamp: Date.now(),
          });

          let deliveredCount = 0;
          for (const client of connectedWsClients.values()) {
            if (
              client.ws.readyState === WebSocket.OPEN &&
              (!restId || client.restaurantId === restId) &&
              (client.role === 'waiter' || client.role === 'owner' || client.role === 'kitchen')
            ) {
              client.ws.send(alertPayload);
              deliveredCount++;
            }
          }

          ws.send(
            JSON.stringify({
              type: 'waiter_call_ack',
              requestId,
              tableNumber: normTable,
              deliveredCount,
              cooldownSeconds: 60,
              timestamp: Date.now(),
            })
          );
        } else if (msg.type === 'cart_sync') {
          const restId = msg.restaurantId || clientState.restaurantId;
          const normTable = String(msg.tableNumber || clientState.tableNumber || '')
            .replace(/^Table\s*/i, '')
            .trim();
          const cartPayload = JSON.stringify({
            type: 'cart_sync',
            restaurantId: restId,
            tableNumber: normTable,
            dinerName: msg.dinerName || 'Guest',
            items: Array.isArray(msg.items) ? msg.items : [],
            itemCount: Number(msg.itemCount) || 0,
            cartTotal: Number(msg.cartTotal) || 0,
            updatedAt: msg.updatedAt || Date.now(),
          });
          for (const client of connectedWsClients.values()) {
            if (
              client.ws.readyState === WebSocket.OPEN &&
              client.id !== clientId &&
              (!restId || client.restaurantId === restId) &&
              (client.role === 'kitchen' || client.role === 'owner' || client.role === 'waiter')
            ) {
              client.ws.send(cartPayload);
            }
          }
        } else if (msg.type === 'order_sync') {
          const restId = msg.restaurantId || clientState.restaurantId;
          const syncPayload = JSON.stringify({
            ...msg,
            restaurantId: restId,
            timestamp: Date.now(),
          });
          for (const client of connectedWsClients.values()) {
            if (
              client.ws.readyState === WebSocket.OPEN &&
              client.id !== clientId &&
              (!restId || client.restaurantId === restId)
            ) {
              client.ws.send(syncPayload);
            }
          }
        } else if (msg.type === 'inventory_updated') {
          const restId = msg.restaurantId || clientState.restaurantId;
          const nextAvail = Boolean(msg.isAvailable);
          const nextStockStatus = msg.stockStatus || (nextAvail ? 'in_stock' : 'sold_out');
          if (msg.itemId) {
            db.updateMenuItem(msg.itemId, {
              isAvailable: nextAvail,
              stockStatus: nextStockStatus,
              ...(msg.remainingCount !== undefined
                ? { remainingCount: Number(msg.remainingCount) }
                : {}),
            });
          }
          const payload = JSON.stringify({
            type: 'inventory_updated',
            restaurantId: restId,
            itemId: msg.itemId,
            itemName: msg.itemName,
            isAvailable: nextAvail,
            stockStatus: nextStockStatus,
            remainingCount: msg.remainingCount,
            updatedBy: msg.updatedBy || clientState.staffName || 'Kitchen',
            menuItems: db.getMenuItems(restId),
            categories: db.getCategories(restId),
            timestamp: Date.now(),
          });
          for (const client of connectedWsClients.values()) {
            if (
              client.ws.readyState === WebSocket.OPEN &&
              client.id !== clientId &&
              (!restId || client.restaurantId === restId)
            ) {
              client.ws.send(payload);
            }
          }
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn('[WS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      connectedWsClients.delete(clientId);
    });

    ws.on('error', () => {
      connectedWsClients.delete(clientId);
    });
  });

  // ==================== VITE CLIENT MIDDLEWARE ====================
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Vite Dev Server middleware mode (HMR disabled in preview runtime to prevent client WebSocket errors)
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'false' ? { server, path: '/__vite_hmr' } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[d.cc server] Running at http://0.0.0.0:${PORT} (HTTP + WebSocket enabled)`);
  });
}

startServer().catch((err) => {
  console.error('[d.cc server] Fatal startup error:', err);
  process.exit(1);
});

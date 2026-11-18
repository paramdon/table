export type UserRole = 'customer' | 'owner' | 'manager' | 'kitchen' | 'waiter' | 'superadmin';

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'new_order'
  | 'waiting_waiter'
  | 'bill_requested'
  | 'needs_cleaning';

export type OrderStatus =
  | 'received'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export type DietType = 'veg' | 'non-veg';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface PortionOption {
  id: string;
  name: string;
  priceDelta: number; // in INR
  description?: string;
}

export interface AddonOption {
  id: string;
  name: string;
  price: number; // in INR
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  hindiName?: string;
  description: string;
  price: number;
  dietType: DietType;
  difficultyLevel?: DifficultyLevel;
  image: string;
  imageUrl?: string;
  isHero?: boolean;
  isChefsChoice?: boolean;
  isPopular?: boolean;
  isBestseller?: boolean;
  isDailySpecial?: boolean;
  isJainAvailable?: boolean;
  isHalal?: boolean;
  spiceLevel?: number; // 0-3
  prepTimeMinutes: number;
  calories?: number;
  allergens?: string[];
  portions?: PortionOption[];
  addons?: AddonOption[];
  spiceChoices?: string[];
  isAvailable: boolean;
  stockStatus?: InventoryStockStatus;
  remainingCount?: number;
}

export type InventoryStockStatus = 'in_stock' | 'low_stock' | 'sold_out';

export interface LowInventoryAlert {
  itemId: string;
  restaurantId: string;
  itemName: string;
  stockStatus: InventoryStockStatus;
  isAvailable: boolean;
  remainingCount?: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  hindiName?: string;
  icon: string;
  sortOrder: number;
}

export interface SelectedCustomization {
  portion?: PortionOption;
  selectedSpice?: string;
  addons: AddonOption[];
  isJain?: boolean;
  specialNotes?: string;
  orderedBy?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  dietType: DietType;
  customization: SelectedCustomization;
  itemTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. #DCC-104
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  dinerName: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  tip: number;
  grandTotal: number;
  paymentStatus: 'pending' | 'pending_payment' | 'paid' | 'verified_by_staff';
  paymentMethod?: 'upi' | 'card' | 'cash' | 'direct_upi' | 'card_pos' | 'online_gateway';
  placedAt: number; // timestamp
  elapsedSeconds?: number;
  acceptedAt?: number;
  preparedAt?: number;
  servedAt?: number;
  paidAt?: number;
  upiReference?: string;
  customerRating?: number;
  customerFeedback?: string[];
}

export interface WaiterRequest {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  requestType:
    | 'water'
    | 'chutney_onions'
    | 'cutlery'
    | 'finger_bowl'
    | 'bill_upi'
    | 'captain'
    | 'clean_table';
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: number;
  resolvedAt?: number;
  assignedStaff?: string;
}

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  number: string;
  name: string;
  capacity: number;
  zone: string;
  status: TableStatus;
  secureToken: string;
  qrCodeUrl?: string;
  currentOrderId?: string;
  activeDinersCount: number;
  lastActivityAt: number;
}

export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  username?: string;
  role: 'owner' | 'manager' | 'kitchen' | 'waiter';
  phone: string;
  activeZone: string;
  status: 'active' | 'inactive' | 'disabled';
  permissions?: string[];
  mustChangePassword?: boolean;
  createdAt?: number;
  lastLoginAt?: number;
  registeredDevicesCount?: number;
}

export interface StaffProfile {
  id: string;
  restaurantId: string;
  name: string;
  username: string;
  phone?: string;
  role: 'owner' | 'manager' | 'kitchen' | 'waiter';
  permissions: string[];
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  passwordHash?: string;
  passwordSalt?: string;
  tempPasswordPlain?: string | null;
  activeInviteToken?: string | null;
}

export interface StaffInvitation {
  id: string;
  token: string;
  restaurantId: string;
  staffId: string;
  staffName: string;
  role: 'manager' | 'kitchen' | 'waiter';
  permissions: string[];
  expiresAt: number;
  isUsed: boolean;
  usedAt?: number;
  createdAt: number;
}

export interface RegisteredDevice {
  id: string;
  staffId: string;
  staffName: string;
  restaurantId: string;
  role: 'owner' | 'manager' | 'kitchen' | 'waiter';
  sessionToken: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  userAgent: string;
  registeredAt: number;
  lastActiveAt: number;
  status: 'active' | 'revoked';
  revokedAt?: number;
  revokedBy?: string;
}

export interface SecurityAuditLog {
  id: string;
  restaurantId: string;
  action:
    | 'DEVICE_REGISTERED'
    | 'DEVICE_REVOKED'
    | 'REVOKE_ALL_DEVICES'
    | 'STAFF_CREATED'
    | 'STAFF_UPDATED'
    | 'STAFF_DISABLED'
    | 'STAFF_ENABLED'
    | 'STAFF_DELETED'
    | 'PASSWORD_RESET'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'INVITATION_CREATED'
    | 'INVITATION_USED';
  performedBy: string;
  targetStaffName: string;
  details: string;
  timestamp: number;
}

export interface CustomerProfile {
  id: string;
  restaurantId: string;
  name: string;
  phoneNumber: string;
  phoneVerified: boolean;
  firstVisit: number;
  lastVisit: number;
  visitCount: number;
  totalOrders: number;
  totalSpent: number; // in INR
  averageOrderValue: number; // in INR
  preferredItems: Array<{ name: string; count: number } | string>;
  categoryPreferences: string[];
  dietaryPreferences?: string[];
  preferredTable?: string;
  marketingConsent: boolean;
  marketingConsentAt?: number;
  marketingConsentSource?: string;
  customerToken: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerOrderRecord {
  id: string;
  customerId: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  timestamp: number;
  createdAt?: number;
}

export interface DailyOrderTrendPoint {
  date: string;
  fullDate: string;
  orders: number;
  revenue: number;
  newDiners: number;
  returningDiners: number;
}

export interface RevenueCategoryBreakdown {
  name: string;
  revenue: number;
  ordersCount: number;
  percentage: number;
  color: string;
}

export interface RevenueDinerSegmentBreakdown {
  segment: string;
  revenue: number;
  percentage: number;
  color: string;
}

export interface OrderReadyWsAlert {
  type: 'order_ready_alert';
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  message: string;
  items?: Array<{ name: string; quantity: number }>;
  timestamp: number;
}

export interface WaiterCallWsAlert {
  type: 'waiter_call_alert';
  requestId: string;
  restaurantId: string;
  tableNumber: string;
  reason: string;
  details?: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: number;
}

export interface CustomerCrmAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  totalOrders: number;
  totalCustomerOrders?: number;
  totalRevenue: number;
  averageOrderValue: number;
  marketingOptInRate: number;
  marketingConsentCount?: number;
  topItems: Array<{ name: string; count: number }>;
  popularDishes?: Array<{ name: string; count: number }>;
  dailyTrends?: DailyOrderTrendPoint[];
  revenueByCategory?: RevenueCategoryBreakdown[];
  revenueByDinerSegment?: RevenueDinerSegmentBreakdown[];
}

export interface RestaurantTenant {
  id: string;
  name: string;
  hindiName?: string;
  slug: string;
  tagline: string;
  phone: string;
  gstin: string;
  fssaiLic: string;
  address: string;
  currency: string;
  wifiSsid: string;
  wifiPassword: string;
  logo: string;
  serviceChargePercent: number;
  gstPercent: number;
  ownerId?: string;
  ownerEmail?: string;
  status?: 'active' | 'suspended' | 'trial';
  plan?: 'flex' | 'essential' | 'professional' | 'enterprise' | 'free_trial' | 'starter' | 'growth';
  planPrice?: number;
  createdAt?: number;
  subscriptionExpiresAt?: number;
}

export interface PlatformSubscription {
  id: string;
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string;
  planName: 'Flex' | 'Essential' | 'Professional' | 'Enterprise' | 'Free Trial' | 'Starter' | 'Growth';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'annual';
  status: 'paid' | 'pending' | 'failed';
  invoiceNumber: string;
  paidAt: number;
  periodEnd: number;
}

export interface PlatformAdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  totalOwners: number;
  totalStaff: number;
  totalCustomers: number;
  totalOrders: number;
  totalPlatformRevenue: number;
  mrr: number;
  paymentHistory: PlatformSubscription[];
  restaurants: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    ownerName: string;
    phone: string;
    status: 'active' | 'suspended' | 'trial';
    plan: string;
    createdAt: number;
    staffCount: number;
    ordersCount: number;
    menuItemsCount: number;
    revenue: number;
  }>;
}

// ==================== SAAS BILLING & PAYMENT TYPES ====================

export interface SubscriptionPlanConfig {
  id: string; // 'plan_flex' | 'plan_essential' | 'plan_professional' | 'plan_enterprise'
  slug?: 'flex' | 'essential' | 'professional' | 'enterprise';
  name: string; // 'Flex' | 'Essential' | 'Professional' | 'Enterprise'
  tierRank?: number;
  priceInr: number; // 0, 1999, 4999, 9999
  priceUsd: number; // 0, 24, 59, 119
  annualDiscountPercent: number; // 0 for flex, 20 for paid tiers
  commissionPercent: number; // 3.0, 2.0, 0.75, 0.0
  targetCustomer?: string;
  description: string;
  recommended?: boolean;
  features: string[];
  restrictions?: string[];
  maxStaffAccounts?: number | null;
  maxRegisteredDevices?: number | null;
  trialDays: number;
  isPublic: boolean;
  isCustomEnterprise: boolean;
  updatedAt?: number;
}

export interface RestaurantSubscriptionRecord {
  id: string;
  restaurant_id: string;
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string;
  subscription_plan: string;
  planId: string;
  planName: string;
  billing_cycle: 'monthly' | 'yearly' | 'annual';
  billingCycle: 'monthly' | 'yearly' | 'annual';
  amount: number;
  currency: 'INR' | 'USD';
  subscription_status: 'active' | 'trial' | 'pending_payment' | 'past_due' | 'cancelled';
  status: 'active' | 'trial' | 'pending_payment' | 'past_due' | 'cancelled';
  commission_rate: number;
  commissionRate: number; // Snapshot
  subscription_start_date: number;
  subscription_end_date: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  subscription_created_at: number;
  trialEnd?: number;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: number;
  scheduledDowngradePlanId?: string | null;
  scheduledDowngradePlanName?: string | null;
  scheduledDowngradeEffectiveAt?: number | null;
  pendingUpgrade?: {
    checkoutSessionId: string;
    targetPlanId: string;
    targetPlanName: string;
    billingCycle: 'monthly' | 'yearly';
    gatewayOrderId: string;
    subtotal: number;
    prorationCredit: number;
    tax: number;
    total: number;
    createdAt: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export interface SubscriptionEventRecord {
  id: string;
  restaurantId: string;
  eventType:
    | 'SUBSCRIPTION_CREATED'
    | 'UPGRADE_INITIATED'
    | 'UPGRADE_ACTIVATED'
    | 'DOWNGRADE_SCHEDULED'
    | 'DOWNGRADE_APPLIED'
    | 'BILLING_CYCLE_CHANGED'
    | 'SUBSCRIPTION_CANCELLED'
    | 'WEBHOOK_VERIFIED'
    | 'WEBHOOK_REJECTED';
  fromPlanId?: string;
  toPlanId?: string;
  billingCycle?: string;
  amount?: number;
  status: string;
  actor: string;
  paymentTransactionId?: string;
  webhookEventId?: string;
  details: string;
  createdAt: number;
}

export interface CommissionReportSummary {
  eligibleOrderValue: number;
  eligibleOrdersCount: number;
  cancelledExcludedCount: number;
  commissionRate: number;
  grossPlatformCommission: number;
  refundAdjustments: number;
  totalPayablePlatformCommission: number;
  estimatedPaymentGatewayCharges: number;
  estimatedGstOnCommission: number;
  monthlyQrOrderVolume: number;
  monthlyQrOrderCount: number;
  estimatedMonthlyCommission: number;
}

export interface RestaurantPaymentMethodsConfig {
  restaurantId: string;
  onlineGatewayEnabled: boolean;
  onlineGatewayProvider: 'razorpay' | 'cashfree' | 'stripe';
  payAtRestaurantCashEnabled: boolean;
  payAtRestaurantUpiEnabled: boolean;
  restaurantUpiId: string; // e.g. "malhotra@icici"
  restaurantUpiName: string;
  updatedAt?: number;
}

export interface PaymentTransaction {
  id: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  amount: number; // Integer minor currency units or standard currency
  currency: string;
  paymentType: 'online_gateway' | 'pay_at_restaurant' | 'subscription_gateway';
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'direct_upi';
  gatewayProvider?: string;
  gatewayTransactionId?: string;
  gatewayOrderId?: string;
  status: 'pending' | 'success' | 'failed' | 'refunded' | 'partially_refunded';
  confirmedByStaffId?: string;
  confirmedByStaffName?: string;
  upiReference?: string;
  idempotencyKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommissionRecord {
  id: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  eligibleOrderAmount: number; // Subtotal after discounts, excluding taxes/tips/fees
  planSnapshot: string;
  commissionRateSnapshot: number; // Percentage, e.g. 3.0, 2.0, 0.75, 0.0
  commissionAmount: number;
  paymentGatewayFeeSeparate?: number;
  orderTaxSeparate?: number;
  currency: string;
  paymentMethod: string;
  paymentType: 'online_gateway' | 'pay_at_restaurant';
  status: 'unbilled' | 'invoiced' | 'paid' | 'partially_reversed' | 'reversed';
  invoiceId?: string;
  refundAdjustedAmount?: number;
  createdAt: number;
}

export interface CommissionLedgerEntry {
  id: string;
  restaurantId: string;
  type: 'order_commission' | 'commission_invoice' | 'commission_payment' | 'refund_reversal';
  referenceId: string;
  description: string;
  amount: number; // Positive increases restaurant's payable balance; Negative reduces balance
  runningBalance: number;
  createdAt: number;
}

export interface RestaurantInvoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-UDM-COM-2026-0042"
  restaurantId: string;
  restaurantName: string;
  billingPeriodStart: number;
  billingPeriodEnd: number;
  type: 'subscription' | 'commission_weekly';
  planId?: string;
  planName?: string;
  billingCycle?: string;
  currency: string;
  subtotal: number;
  prorationCredit?: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: number;
  issuedAt: number;
  paidAt?: number;
  paymentTransactionId?: string;
  itemizedOrdersCount?: number;
  notes?: string;
}

export interface SettlementRecord {
  id: string;
  restaurantId: string;
  restaurantName: string;
  totalOnlineVolume: number;
  platformCommissionDeducted: number;
  gatewayFeesDeducted: number;
  netSettlementAmount: number;
  currency: string;
  status: 'pending_approval' | 'processing' | 'settled' | 'hold';
  settlementDate?: number;
  bankReference?: string;
  createdAt: number;
}

export interface RefundRecord {
  id: string;
  restaurantId: string;
  orderId: string;
  transactionId: string;
  amount: number;
  reason: string;
  commissionReversed: number;
  processedBy: string;
  status: 'processed' | 'pending';
  createdAt: number;
}

export interface PlatformFinancialOverview {
  totalOnlinePaymentVolume: number;
  totalOfflinePaymentVolume: number;
  totalGrossFoodVolume: number;
  subscriptionRevenueCollected: number;
  commissionRevenueCollected: number;
  pendingCommissionReceivables: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  totalRefundsAndReversals: number;
  gatewayExpenses: number;
  netPlatformRevenue: number; // Subscriptions + Commission Collected - Gateway Expenses - Refunds
  settlementsPendingAmount: number;
  settlementsCompletedAmount: number;
}

export interface TrackableQrCode {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  trackingToken: string;
  label: string;
  url: string;
  scansCount: number;
  lastScannedAt?: number;
  isActive: boolean;
  createdAt: number;
}

export interface LiveTableCartActivity {
  restaurantId: string;
  tableNumber: string;
  dinerName: string;
  items: OrderItem[];
  itemCount: number;
  cartTotal: number;
  updatedAt: number;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface LoyaltyPointTransaction {
  id: string;
  restaurantId: string;
  customerKey: string;
  orderId: string;
  orderNumber: string;
  dinerName: string;
  phoneNumber?: string;
  type: 'earn' | 'redeem';
  points: number;
  orderTotal: number;
  description: string;
  timestamp: number;
}

export interface CustomerLoyaltyProfile {
  customerKey: string;
  restaurantId: string;
  name: string;
  phoneNumber?: string;
  customerToken?: string;
  pointsBalance: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  totalOrdersCount: number;
  tier: LoyaltyTier;
  lastEarnedAt?: number;
  transactions: LoyaltyPointTransaction[];
}

export type WaiterShiftStatus = 'on_duty' | 'on_break' | 'off_duty';

export interface WaiterBreakWindow {
  id: string;
  label: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'scheduled' | 'active' | 'completed';
}

export interface StaffScheduleAssignment {
  id: string;
  restaurantId: string;
  staffId: string;
  staffName: string;
  username?: string;
  role: 'waiter' | 'manager' | 'kitchen' | 'owner';
  assignedZones: string[];
  shiftStart: string; // HH:mm
  shiftEnd: string; // HH:mm
  dutyStatus: WaiterShiftStatus;
  breaks: WaiterBreakWindow[];
  notes?: string;
  updatedAt: number;
}

export interface GuestDiningReceipt {
  id: string;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName?: string;
  tableNumber: string;
  dinerName: string;
  phoneNumber?: string;
  customerToken?: string;
  items: OrderItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  tip: number;
  grandTotal: number;
  paymentStatus: 'pending' | 'pending_payment' | 'paid' | 'verified_by_staff';
  paymentMethod?: string;
  upiReference?: string;
  placedAt: number;
  paidAt?: number;
  status: OrderStatus;
}



export type PlanId = 'plan_flex' | 'plan_essential' | 'plan_professional' | 'plan_enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export type FeatureKey =
  | 'qr_ordering'
  | 'digital_menu'
  | 'kitchen_display'
  | 'waiter_display'
  | 'live_order_tracking'
  | 'table_qr_generation'
  | 'basic_crm'
  | 'basic_analytics'
  | 'basic_sales_dashboard'
  | 'basic_staff_accounts'
  | 'basic_table_management'
  | 'floor_map'
  | 'table_management'
  | 'staff_onboarding'
  | 'device_management'
  | 'custom_permissions'
  | 'customer_visit_history'
  | 'weekly_reports'
  | 'advanced_order_management'
  | 'improved_customer_analytics'
  | 'multi_floor'
  | 'banquet_management'
  | 'advanced_crm'
  | 'csv_export'
  | 'financial_exports'
  | 'inventory_insights'
  | 'api_access'
  | 'priority_support'
  | 'multi_branch'
  | 'unlimited_staff_devices'
  | 'white_label'
  | 'custom_branding'
  | 'custom_domain'
  | 'pos_integration'
  | 'erp_integration'
  | 'advanced_api_access'
  | 'dedicated_account_manager';

export interface PlanDefinition {
  id: PlanId;
  slug: 'flex' | 'essential' | 'professional' | 'enterprise';
  name: 'Flex' | 'Essential' | 'Professional' | 'Enterprise';
  tierRank: number; // 0 = Flex, 1 = Essential, 2 = Professional, 3 = Enterprise
  priceInr: number;
  priceUsd: number;
  annualDiscountPercent: number;
  commissionPercent: number;
  targetCustomer: string;
  description: string;
  recommended?: boolean;
  features: string[];
  restrictions?: string[];
  maxStaffAccounts: number | null; // null = unlimited
  maxRegisteredDevices: number | null; // null = unlimited
  trialDays: number;
  isPublic: boolean;
  isCustomEnterprise: boolean;
}

export interface FeatureMetadata {
  key: FeatureKey;
  label: string;
  description: string;
  minPlanId: PlanId;
  category:
    | 'Core Ordering'
    | 'Floor & Banquet'
    | 'Staff & Security'
    | 'CRM & Analytics'
    | 'Financials & API'
    | 'Enterprise & Support';
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'plan_flex',
    slug: 'flex',
    name: 'Flex',
    tierRank: 0,
    priceInr: 0,
    priceUsd: 0,
    annualDiscountPercent: 0,
    commissionPercent: 3.0,
    targetCustomer: 'Small cafes and restaurants starting with digital ordering.',
    description: 'Zero monthly subscription. Start QR ordering immediately with a 3% commission per eligible QR order.',
    features: [
      'Digital QR menu & unlimited categories/items',
      'Customer QR ordering & live order tracking',
      'Kitchen Display System (KDS) & Waiter Display',
      'Basic customer CRM & basic analytics',
      'Basic sales dashboard & table QR generation',
      'Basic staff accounts & floor table list',
      'Standard email & helpdesk support',
    ],
    restrictions: [
      'Basic floor/table management only',
      'No visual floor map',
      'No advanced staff device management',
      'No advanced financial exports',
      'No multi-floor or banquet management',
      'No multi-branch or white-labeling',
    ],
    maxStaffAccounts: 5,
    maxRegisteredDevices: 4,
    trialDays: 0,
    isPublic: true,
    isCustomEnterprise: false,
  },
  {
    id: 'plan_essential',
    slug: 'essential',
    name: 'Essential',
    tierRank: 1,
    priceInr: 1999,
    priceUsd: 24,
    annualDiscountPercent: 20,
    commissionPercent: 2.0,
    targetCustomer: 'Growing cafes, family restaurants and busy diners.',
    description: 'Reduced 2% commission plus visual floor map, secure staff onboarding, device revocation, and weekly reports.',
    recommended: true,
    features: [
      'Everything in Flex, plus:',
      'Visual floor map & advanced table status management',
      'Staff invitation links & temp password onboarding',
      'One-time device registration & remote logout/revocation',
      'Custom staff permissions & account management',
      'Customer visit history & returning guest recognition',
      'Weekly sales & weekly billing reports',
      'Advanced order management & improved analytics',
    ],
    maxStaffAccounts: 25,
    maxRegisteredDevices: 20,
    trialDays: 14,
    isPublic: true,
    isCustomEnterprise: false,
  },
  {
    id: 'plan_professional',
    slug: 'professional',
    name: 'Professional',
    tierRank: 2,
    priceInr: 4999,
    priceUsd: 59,
    annualDiscountPercent: 20,
    commissionPercent: 0.75,
    targetCustomer: 'High-volume restaurants, multi-floor restaurants and banquet venues.',
    description: 'Ultra-low 0.75% commission with multi-floor zones, banquet management, CRM CSV exports, and API access.',
    features: [
      'Everything in Essential, plus:',
      'Multi-floor management & multiple dining zones',
      'Banquet management & event zones',
      'Advanced customer segmentation & CRM analytics',
      'Customer database CSV export',
      'Advanced financial, zone & staff activity reports',
      'Inventory insights & API integrations',
      'Priority 24/7 telephone support',
    ],
    maxStaffAccounts: 100,
    maxRegisteredDevices: 75,
    trialDays: 14,
    isPublic: true,
    isCustomEnterprise: false,
  },
  {
    id: 'plan_enterprise',
    slug: 'enterprise',
    name: 'Enterprise',
    tierRank: 3,
    priceInr: 9999,
    priceUsd: 119,
    annualDiscountPercent: 20,
    commissionPercent: 0.0,
    targetCustomer: 'Restaurant chains, hotels, luxury resorts and large dining businesses.',
    description: '0% platform commission with multi-branch management, white-label custom domain, and custom POS/ERP integrations.',
    features: [
      'Everything in Professional, plus:',
      '0% d.cc platform commission on all QR orders',
      'Multi-branch restaurant management & brand dashboard',
      'Branch-wise analytics & centralized reporting',
      'Unlimited staff accounts & registered devices',
      'Custom domain, white-label platform & custom branding',
      'Custom POS & ERP integrations + advanced API access',
      'Dedicated account manager & custom onboarding',
    ],
    maxStaffAccounts: null,
    maxRegisteredDevices: null,
    trialDays: 30,
    isPublic: true,
    isCustomEnterprise: true,
  },
];

export const FEATURE_CATALOG: Record<FeatureKey, FeatureMetadata> = {
  // Core (Flex+)
  qr_ordering: {
    key: 'qr_ordering',
    label: 'Customer QR Ordering',
    description: 'Contactless QR code browsing and table ordering.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  digital_menu: {
    key: 'digital_menu',
    label: 'Digital QR Menu & Unlimited Items',
    description: 'Unlimited menu categories, modifiers, and dish catalog.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  kitchen_display: {
    key: 'kitchen_display',
    label: 'Kitchen Display System (KDS)',
    description: 'Real-time kitchen order tickets and prep timers.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  waiter_display: {
    key: 'waiter_display',
    label: 'Waiter Display System',
    description: 'Waiter table notifications and counter settlement tools.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  live_order_tracking: {
    key: 'live_order_tracking',
    label: 'Live Order Tracking',
    description: 'Real-time WebSocket status tracking for guests.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  table_qr_generation: {
    key: 'table_qr_generation',
    label: 'Table QR Generation',
    description: 'Generate scannable table QR stands with tracking tokens.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  basic_crm: {
    key: 'basic_crm',
    label: 'Basic Customer CRM',
    description: 'Capture guest profiles and order counts.',
    minPlanId: 'plan_flex',
    category: 'CRM & Analytics',
  },
  basic_analytics: {
    key: 'basic_analytics',
    label: 'Basic Customer Analytics',
    description: 'Summary guest metrics and daily overview.',
    minPlanId: 'plan_flex',
    category: 'CRM & Analytics',
  },
  basic_sales_dashboard: {
    key: 'basic_sales_dashboard',
    label: 'Basic Sales Dashboard',
    description: 'Daily sales totals and active table occupancy.',
    minPlanId: 'plan_flex',
    category: 'Core Ordering',
  },
  basic_staff_accounts: {
    key: 'basic_staff_accounts',
    label: 'Basic Staff Accounts',
    description: 'Essential kitchen and waiter terminal login credentials.',
    minPlanId: 'plan_flex',
    category: 'Staff & Security',
  },
  basic_table_management: {
    key: 'basic_table_management',
    label: 'Basic Floor Table List',
    description: 'Create and list restaurant tables.',
    minPlanId: 'plan_flex',
    category: 'Floor & Banquet',
  },

  // Essential+
  floor_map: {
    key: 'floor_map',
    label: 'Visual Floor Map',
    description: 'Interactive floor layout with real-time table occupancy indicators.',
    minPlanId: 'plan_essential',
    category: 'Floor & Banquet',
  },
  table_management: {
    key: 'table_management',
    label: 'Advanced Table Status Management',
    description: 'Live status transitions, turnaround tracking, and table controls.',
    minPlanId: 'plan_essential',
    category: 'Floor & Banquet',
  },
  staff_onboarding: {
    key: 'staff_onboarding',
    label: 'Staff Invitation Links & Temp Password Onboarding',
    description: '48-hour secure invite links and temporary password first-login enforcement.',
    minPlanId: 'plan_essential',
    category: 'Staff & Security',
  },
  device_management: {
    key: 'device_management',
    label: 'Staff Device Management & Remote Logout',
    description: 'One-time device registration, active session telemetry, and instant remote revocation.',
    minPlanId: 'plan_essential',
    category: 'Staff & Security',
  },
  custom_permissions: {
    key: 'custom_permissions',
    label: 'Custom Staff Permissions',
    description: 'Granular role and terminal permission controls per staff member.',
    minPlanId: 'plan_essential',
    category: 'Staff & Security',
  },
  customer_visit_history: {
    key: 'customer_visit_history',
    label: 'Customer Visit History & Returning Recognition',
    description: 'Detailed visit history timelines and returning guest recognition.',
    minPlanId: 'plan_essential',
    category: 'CRM & Analytics',
  },
  weekly_reports: {
    key: 'weekly_reports',
    label: 'Weekly Sales & Billing Reports',
    description: 'Structured weekly revenue, order velocity, and commission statements.',
    minPlanId: 'plan_essential',
    category: 'Financials & API',
  },
  advanced_order_management: {
    key: 'advanced_order_management',
    label: 'Advanced Order Management',
    description: 'Enhanced order lifecycle controls and operational filters.',
    minPlanId: 'plan_essential',
    category: 'Core Ordering',
  },
  improved_customer_analytics: {
    key: 'improved_customer_analytics',
    label: 'Improved Customer Analytics',
    description: 'Cohort breakdown and repeat visit trends.',
    minPlanId: 'plan_essential',
    category: 'CRM & Analytics',
  },

  // Professional+
  multi_floor: {
    key: 'multi_floor',
    label: 'Multi-Floor & Multiple Dining Zones',
    description: 'Manage multiple floors, rooftops, patios, and dedicated dining zones.',
    minPlanId: 'plan_professional',
    category: 'Floor & Banquet',
  },
  banquet_management: {
    key: 'banquet_management',
    label: 'Banquet & Event Management',
    description: 'Configure banquet halls, capacity blocks, and event bookings.',
    minPlanId: 'plan_professional',
    category: 'Floor & Banquet',
  },
  advanced_crm: {
    key: 'advanced_crm',
    label: 'Advanced Customer Segmentation & CRM Analytics',
    description: 'VIP, repeat, high-spend, and dormant guest segments with RFM metrics.',
    minPlanId: 'plan_professional',
    category: 'CRM & Analytics',
  },
  csv_export: {
    key: 'csv_export',
    label: 'Customer Database CSV Export',
    description: 'Download full guest directory and opt-in marketing lists as CSV.',
    minPlanId: 'plan_professional',
    category: 'CRM & Analytics',
  },
  financial_exports: {
    key: 'financial_exports',
    label: 'Advanced Financial, Zone & Staff Reports',
    description: 'Download detailed financial exports, zone performance, and staff activity reports.',
    minPlanId: 'plan_professional',
    category: 'Financials & API',
  },
  inventory_insights: {
    key: 'inventory_insights',
    label: 'Inventory Insights',
    description: 'Low-stock alerts, sold-out item impact, and menu velocity insights.',
    minPlanId: 'plan_professional',
    category: 'CRM & Analytics',
  },
  api_access: {
    key: 'api_access',
    label: 'API Integrations',
    description: 'Generate API keys and webhooks for external restaurant tooling.',
    minPlanId: 'plan_professional',
    category: 'Financials & API',
  },
  priority_support: {
    key: 'priority_support',
    label: 'Priority 24/7 Telephone Support',
    description: 'Round-the-clock priority hotline for high-volume service hours.',
    minPlanId: 'plan_professional',
    category: 'Enterprise & Support',
  },

  // Enterprise
  multi_branch: {
    key: 'multi_branch',
    label: 'Multi-Branch Restaurant Management',
    description: 'Centralized brand dashboard with branch-wise analytics across outlets.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  unlimited_staff_devices: {
    key: 'unlimited_staff_devices',
    label: 'Unlimited Staff & Registered Devices',
    description: 'No cap on staff accounts or active terminal devices.',
    minPlanId: 'plan_enterprise',
    category: 'Staff & Security',
  },
  white_label: {
    key: 'white_label',
    label: 'White-Label Platform',
    description: 'Remove d.cc platform branding across guest QR menus and receipts.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  custom_branding: {
    key: 'custom_branding',
    label: 'Custom Branding & Theme Engine',
    description: 'Brand-tailored colors, logos, and custom guest portal assets.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  custom_domain: {
    key: 'custom_domain',
    label: 'Custom Domain',
    description: 'Serve digital menus on your own domain (e.g. order.yourbrand.com).',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  pos_integration: {
    key: 'pos_integration',
    label: 'Custom POS Integration',
    description: 'Two-way sync with Petpooja, Posist, Micros, or custom POS systems.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  erp_integration: {
    key: 'erp_integration',
    label: 'Custom ERP Integration',
    description: 'Automated accounting, inventory procurement, and ERP ledger sync.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
  advanced_api_access: {
    key: 'advanced_api_access',
    label: 'Advanced API Access',
    description: 'High-rate enterprise REST & WebSocket streaming endpoints.',
    minPlanId: 'plan_enterprise',
    category: 'Financials & API',
  },
  dedicated_account_manager: {
    key: 'dedicated_account_manager',
    label: 'Dedicated Account Manager & Custom Onboarding',
    description: 'White-glove rollout, menu digitization, and SLA account lead.',
    minPlanId: 'plan_enterprise',
    category: 'Enterprise & Support',
  },
};

export interface ComparisonRow {
  label: string;
  category: string;
  flex: string | boolean;
  essential: string | boolean;
  professional: string | boolean;
  enterprise: string | boolean;
}

export const FEATURE_COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Monthly Subscription', category: 'Pricing & Commission', flex: '₹0 / mo', essential: '₹1,999 / mo', professional: '₹4,999 / mo', enterprise: '₹9,999 / mo' },
  { label: 'Commission per Eligible QR Order', category: 'Pricing & Commission', flex: '3%', essential: '2%', professional: '0.75%', enterprise: '0% (Zero Commission)' },
  { label: 'Annual Billing Discount (Real)', category: 'Pricing & Commission', flex: '—', essential: '20% off (₹19,190/yr)', professional: '20% off (₹47,990/yr)', enterprise: '20% off (₹95,990/yr)' },

  { label: 'Digital QR Menu & Unlimited Items/Categories', category: 'Core Ordering', flex: true, essential: true, professional: true, enterprise: true },
  { label: 'Customer QR Ordering & Live Order Tracking', category: 'Core Ordering', flex: true, essential: true, professional: true, enterprise: true },
  { label: 'Kitchen Display (KDS) & Waiter Display (WDS)', category: 'Core Ordering', flex: true, essential: true, professional: true, enterprise: true },
  { label: 'Table QR Generation & Basic Sales Dashboard', category: 'Core Ordering', flex: true, essential: true, professional: true, enterprise: true },

  { label: 'Floor & Table Management', category: 'Floor & Banquet', flex: 'Basic', essential: 'Visual Map + Status', professional: 'Multi-Floor + Zones', enterprise: 'Multi-Branch Floors' },
  { label: 'Visual Floor Map & Status Controls', category: 'Floor & Banquet', flex: false, essential: true, professional: true, enterprise: true },
  { label: 'Multi-Floor & Multiple Dining Zones', category: 'Floor & Banquet', flex: false, essential: false, professional: true, enterprise: true },
  { label: 'Banquet & Event Management', category: 'Floor & Banquet', flex: false, essential: false, professional: true, enterprise: true },

  { label: 'Staff Accounts Limit', category: 'Staff & Security', flex: 'Basic (Up to 5)', essential: 'Up to 25', professional: 'Up to 100', enterprise: 'Unlimited' },
  { label: 'Staff Invite Links & Temp Password Onboarding', category: 'Staff & Security', flex: false, essential: true, professional: true, enterprise: true },
  { label: 'One-Time Device Registration & Remote Logout', category: 'Staff & Security', flex: false, essential: true, professional: true, enterprise: true },
  { label: 'Individual Device Revocation & Custom Permissions', category: 'Staff & Security', flex: false, essential: true, professional: true, enterprise: true },

  { label: 'Customer CRM & Analytics', category: 'CRM & Reports', flex: 'Basic CRM', essential: 'Visit History + Weekly', professional: 'Segmentation + CSV', enterprise: 'Brand-wide CRM' },
  { label: 'Customer Visit History & Returning Recognition', category: 'CRM & Reports', flex: false, essential: true, professional: true, enterprise: true },
  { label: 'Weekly Sales & Billing Reports', category: 'CRM & Reports', flex: false, essential: true, professional: true, enterprise: true },
  { label: 'Customer Database CSV Export', category: 'CRM & Reports', flex: false, essential: false, professional: true, enterprise: true },
  { label: 'Advanced Financial, Zone & Staff Reports', category: 'CRM & Reports', flex: false, essential: false, professional: true, enterprise: true },
  { label: 'Inventory Insights', category: 'CRM & Reports', flex: false, essential: false, professional: true, enterprise: true },

  { label: 'API Integrations', category: 'Enterprise & Support', flex: false, essential: false, professional: 'Standard API', enterprise: 'Advanced API' },
  { label: 'Multi-Branch & Centralized Brand Dashboard', category: 'Enterprise & Support', flex: false, essential: false, professional: false, enterprise: true },
  { label: 'Custom Domain & White-Label Branding', category: 'Enterprise & Support', flex: false, essential: false, professional: false, enterprise: true },
  { label: 'Custom POS & ERP Integrations', category: 'Enterprise & Support', flex: false, essential: false, professional: false, enterprise: true },
  { label: 'Support Level', category: 'Enterprise & Support', flex: 'Standard', essential: 'Priority Email/Chat', professional: 'Priority 24/7 Phone', enterprise: 'Dedicated Account Mgr' },
];

export function normalizeLegacyPlanId(rawPlan?: string | null): PlanId {
  const val = String(rawPlan || '').trim().toLowerCase();
  if (!val || val === 'flex' || val === 'plan_flex' || val === 'free_trial' || val === 'free') {
    return 'plan_flex';
  }
  if (val === 'essential' || val === 'plan_essential' || val === 'starter' || val === 'plan_starter') {
    return 'plan_essential';
  }
  if (val === 'professional' || val === 'plan_professional' || val === 'growth' || val === 'plan_growth') {
    return 'plan_professional';
  }
  if (val === 'enterprise' || val === 'plan_enterprise') {
    return 'plan_enterprise';
  }
  return 'plan_flex';
}

export function getPlanDefinition(planIdOrName?: string | null): PlanDefinition {
  const id = normalizeLegacyPlanId(planIdOrName);
  return PLAN_DEFINITIONS.find((p) => p.id === id) || PLAN_DEFINITIONS[0];
}

export function getPlanTierRank(planIdOrName?: string | null): number {
  return getPlanDefinition(planIdOrName).tierRank;
}

export function hasPlanEntitlement(planIdOrName: string | undefined | null, featureKey: FeatureKey): boolean {
  const meta = FEATURE_CATALOG[featureKey];
  if (!meta) return false;
  const currentRank = getPlanTierRank(planIdOrName);
  const requiredRank = getPlanTierRank(meta.minPlanId);
  return currentRank >= requiredRank;
}

export function getPlanEntitlementMap(planIdOrName?: string | null): Record<FeatureKey, boolean> {
  const result = {} as Record<FeatureKey, boolean>;
  for (const key of Object.keys(FEATURE_CATALOG) as FeatureKey[]) {
    result[key] = hasPlanEntitlement(planIdOrName, key);
  }
  return result;
}

export function getPlanEntitlementRows() {
  const rows: Array<{
    id: string;
    planId: PlanId;
    featureKey: FeatureKey;
    enabled: boolean;
    minPlanId: PlanId;
    minPlanName: string;
    label: string;
  }> = [];

  for (const plan of PLAN_DEFINITIONS) {
    for (const key of Object.keys(FEATURE_CATALOG) as FeatureKey[]) {
      const meta = FEATURE_CATALOG[key];
      const minPlan = getPlanDefinition(meta.minPlanId);
      rows.push({
        id: `ent_${plan.id}_${key}`,
        planId: plan.id,
        featureKey: key,
        enabled: hasPlanEntitlement(plan.id, key),
        minPlanId: meta.minPlanId,
        minPlanName: minPlan.name,
        label: meta.label,
      });
    }
  }
  return rows;
}

export function getPlanPriceForCycle(
  plan: Pick<PlanDefinition, 'priceInr' | 'priceUsd' | 'annualDiscountPercent'>,
  billingCycle: BillingCycle | 'annual',
  currency: 'INR' | 'USD' = 'INR'
): number {
  const base = currency === 'USD' ? plan.priceUsd : plan.priceInr;
  if (base <= 0) return 0;
  if (billingCycle === 'yearly' || billingCycle === 'annual') {
    const discount = (plan.annualDiscountPercent || 0) / 100;
    return Math.round(base * 12 * (1 - discount));
  }
  return base;
}

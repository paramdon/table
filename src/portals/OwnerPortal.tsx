import React, { useState, useEffect, useCallback } from 'react';
import { restaurantDb, DbEvent } from '../services/db';
import { portalAuth, StaffAuthSession } from '../services/auth';
import { useRouter } from '../router/Router';
import { realtimeWs } from '../services/websocket';
import { useRealtimeSync } from '../context/RealtimeSyncContext';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { StaffLoginGate } from '../components/auth/StaffLoginGate';
import { DashboardOverview } from '../components/dcc/DashboardOverview';
import { DashboardUpgradeBanner } from '../components/dcc/DashboardUpgradeBanner';
import { FloorManagementView } from '../components/dcc/FloorManagementView';
import { MenuManagementView } from '../components/dcc/MenuManagementView';
import { QrCodeManagerView } from '../components/dcc/QrCodeManagerView';
import { StaffManagementView } from '../components/dcc/StaffManagementView';
import { CustomerCrmView } from '../components/dcc/CustomerCrmView';
import { ConsultantReportModal } from '../components/dcc/ConsultantReportModal';
import { CreateRestaurantModal } from '../components/dcc/CreateRestaurantModal';
import { OwnerBillingModule } from '../components/dcc/OwnerBillingModule';
import { ReportsAndEnterpriseView } from '../components/dcc/ReportsAndEnterpriseView';
import {
  RestaurantTenant,
  RestaurantTable,
  MenuItem,
  MenuCategory,
  Order,
  WaiterRequest,
  StaffMember,
  SubscriptionPlanConfig,
} from '../types/dcc';
import {
  Building2,
  Home,
  LayoutGrid,
  Utensils,
  QrCode,
  Users,
  Settings,
  FileText,
  Lock,
  Menu,
  X,
  HeartHandshake,
  Crown,
  CalendarClock,
  BarChart3,
  Sun,
  Moon,
  Bell,
} from 'lucide-react';

type OwnerSidebarTab =
  | 'overview'
  | 'billing'
  | 'reports'
  | 'floor'
  | 'menu'
  | 'qr'
  | 'staff'
  | 'scheduling'
  | 'crm'
  | 'settings'
  | 'consultant';

type BillingSubTab = 'overview' | 'plans' | 'commission' | 'invoices' | 'payment_methods';

function resolveBillingSubTabFromQuery(raw: string | null): BillingSubTab {
  if (
    raw === 'plans' ||
    raw === 'commission' ||
    raw === 'invoices' ||
    raw === 'payment_methods' ||
    raw === 'overview'
  ) {
    return raw;
  }
  return 'overview';
}

export const OwnerPortal: React.FC = () => {
  const { path, queryParams, navigate } = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    subscribeEvents,
    syncRestaurantOrders,
    syncRestaurantMenu,
    getMenuForRestaurant,
    getOrdersForRestaurant,
    getStaffSchedules,
  } = useRealtimeSync();

  const [session, setSession] = useState<StaffAuthSession | null>(() =>
    portalAuth.getSession('owner')
  );

  const [restaurant, setRestaurant] = useState<RestaurantTenant>(() =>
    restaurantDb.getRestaurant(session?.restaurantId)
  );
  const initialRestId = session?.restaurantId || restaurant.id;
  const [tables, setTables] = useState<RestaurantTable[]>(() =>
    restaurantDb.getTables(initialRestId)
  );
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    const dbCats = restaurantDb.getCategories(initialRestId);
    return dbCats.length > 0 ? dbCats : getMenuForRestaurant(initialRestId).categories;
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const dbItems = restaurantDb.getMenuItems(initialRestId);
    return dbItems.length > 0 ? dbItems : getMenuForRestaurant(initialRestId).menuItems;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const dbOrders = restaurantDb.getOrders(initialRestId);
    return dbOrders.length > 0 ? dbOrders : getOrdersForRestaurant(initialRestId);
  });
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>(() =>
    restaurantDb.getWaiterRequests(initialRestId)
  );
  const [staff, setStaff] = useState<StaffMember[]>(() =>
    restaurantDb.getStaff(initialRestId)
  );

  const activeRestaurantId = session?.restaurantId || restaurant.id;

  // Authoritative backend subscription & entitlement state for upgrade banner & sidebar badge
  const {
    subscription,
    effectivePlanId,
    loading: entitlementsLoading,
    refresh: refreshEntitlements,
  } = useEntitlements(activeRestaurantId, session?.sessionToken);

  const [livePlans, setLivePlans] = useState<SubscriptionPlanConfig[]>([]);
  useEffect(() => {
    fetch('/api/billing/plans')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.plans)) setLivePlans(d.plans);
      })
      .catch(() => {});
  }, []);

  // Active Sidebar Tab (synced with /owner/billing?tab=...)
  const [activeTab, setActiveTab] = useState<OwnerSidebarTab>(() =>
    path === '/owner/billing' ? 'billing' : 'overview'
  );
  const [billingInitialSubTab, setBillingInitialSubTab] = useState<BillingSubTab>(() =>
    resolveBillingSubTabFromQuery(queryParams.get('tab'))
  );
  const [selectedQrTableNumber, setSelectedQrTableNumber] = useState<string>('01');

  // Modals
  const [isConsultantModalOpen, setIsConsultantModalOpen] = useState(false);
  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // React to deep links or back/forward navigation to /owner/billing?tab=plans
  useEffect(() => {
    if (path === '/owner/billing') {
      setActiveTab('billing');
      setBillingInitialSubTab(resolveBillingSubTabFromQuery(queryParams.get('tab')));
    }
  }, [path, queryParams]);

  const handleOpenBillingPlans = useCallback(
    (subTab: BillingSubTab = 'plans') => {
      setBillingInitialSubTab(subTab);
      setActiveTab('billing');
      navigate(`/owner/billing?tab=${subTab}`);
    },
    [navigate]
  );

  const refreshWorkspaceFromServer = useCallback(async () => {
    if (!session?.restaurantId) return;
    try {
      const res = await fetch(`/api/workspace/${encodeURIComponent(session.restaurantId)}`);
      const data = await res.json();
      if (!data.success || !data.restaurant) return;

      restaurantDb.hydrateFromServer({
        restaurantId: data.restaurant.id,
        restaurant: data.restaurant,
        tables: data.tables || [],
        categories: data.categories || [],
        menuItems: data.menuItems || [],
        orders: data.orders || [],
        waiterRequests: data.waiterRequests || [],
      });

      const hydratedCats = restaurantDb.getCategories(data.restaurant.id);
      const hydratedItems = restaurantDb.getMenuItems(data.restaurant.id);
      const hydratedOrders = restaurantDb.getOrders(data.restaurant.id);

      syncRestaurantOrders(data.restaurant.id, hydratedOrders);
      syncRestaurantMenu(data.restaurant.id, hydratedCats, hydratedItems);
      setRestaurant(data.restaurant);
      setTables(restaurantDb.getTables(data.restaurant.id));
      setCategories(hydratedCats);
      setMenuItems(hydratedItems);
      setOrders(hydratedOrders);
      setWaiterRequests(restaurantDb.getWaiterRequests(data.restaurant.id));
      setStaff(restaurantDb.getStaff(data.restaurant.id));
      refreshEntitlements();
    } catch {
      // keep existing cache
    }
  }, [session?.restaurantId, syncRestaurantOrders, syncRestaurantMenu, refreshEntitlements]);

  useEffect(() => {
    if (session?.restaurantId) {
      const localRest = restaurantDb.getRestaurant(session.restaurantId);
      if (localRest && localRest.id === session.restaurantId) {
        restaurantDb.setActiveRestaurant(localRest);
        setRestaurant(localRest);
      }
      setTables(restaurantDb.getTables(session.restaurantId));
      setCategories(restaurantDb.getCategories(session.restaurantId));
      setMenuItems(restaurantDb.getMenuItems(session.restaurantId));
      setOrders(restaurantDb.getOrders(session.restaurantId));
      setWaiterRequests(restaurantDb.getWaiterRequests(session.restaurantId));
      setStaff(restaurantDb.getStaff(session.restaurantId));
    }
    refreshWorkspaceFromServer();
  }, [session?.restaurantId, refreshWorkspaceFromServer]);

  useEffect(() => {
    if (session && session.role === 'owner') {
      realtimeWs.register({
        role: 'owner',
        restaurantId: activeRestaurantId,
        staffName: session.staffName,
      });
    }
  }, [activeRestaurantId, session]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribeDb = restaurantDb.subscribe((event: DbEvent) => {
      if (event.type === 'ORDER_CREATED' || event.type === 'ORDER_STATUS_UPDATED') {
        setOrders(restaurantDb.getOrders(activeRestaurantId));
        setTables(restaurantDb.getTables(activeRestaurantId));
      } else if (event.type === 'TABLES_UPDATED') {
        setTables(restaurantDb.getTables(activeRestaurantId));
      } else if (event.type === 'MENU_UPDATED') {
        setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
        setCategories(restaurantDb.getCategories(activeRestaurantId));
      } else if (event.type === 'WAITER_REQUEST_CREATED' || event.type === 'WAITER_REQUEST_UPDATED') {
        setWaiterRequests(restaurantDb.getWaiterRequests(activeRestaurantId));
      } else if (event.type === 'RESTAURANT_UPDATED') {
        setRestaurant(restaurantDb.getRestaurant(activeRestaurantId));
      }
    });

    const unsubscribeSync = subscribeEvents((evt) => {
      if (evt.type === 'CART_UPDATED') return;
      if (evt.restaurantId === activeRestaurantId) {
        if (evt.type === 'ORDER_SYNC') {
          setOrders(restaurantDb.getOrders(activeRestaurantId));
          setTables(restaurantDb.getTables(activeRestaurantId));
        } else if (evt.type === 'TABLES_UPDATED') {
          setTables(restaurantDb.getTables(activeRestaurantId));
        } else if (evt.type === 'MENU_UPDATED') {
          setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
          setCategories(restaurantDb.getCategories(activeRestaurantId));
        }
      }
    });

    return () => {
      unsubscribeDb();
      unsubscribeSync();
    };
  }, [activeRestaurantId, subscribeEvents]);

  const handleLogout = async () => {
    await portalAuth.logout();
    setSession(null);
  };

  // If not logged in as owner, enforce login gate
  if (!session) {
    return (
      <StaffLoginGate
        role="owner"
        restaurantName={restaurant.name}
        onAuthenticated={(sess) => setSession(sess)}
      />
    );
  }

  // Strict RBAC: Staff must not access Owner Dashboard by changing the URL
  if (session.role !== 'owner') {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#27272A] border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold font-heading text-white">Owner Privilege Required</h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            You are signed in as <strong>{session.staffName}</strong> ({session.role.toUpperCase()}). You do not have administrator permissions to access the Owner Financials and Floor Administration dashboard.
          </p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => {
                window.location.href = session.role === 'kitchen' ? '/kitchen' : '/waiter';
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading"
            >
              Go to Your Assigned Portal
            </button>
            <button
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl bg-white/10 text-white text-xs font-bold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingAlertsCount =
    waiterRequests.filter((w) => w.status === 'pending').length +
    orders.filter((o) => o.status === 'received').length;

  const isEnterprise = effectivePlanId === 'plan_enterprise';

  const mainNavItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    {
      id: 'menu',
      label: 'Menu Management',
      icon: Utensils,
      badge: menuItems.filter((i) => !i.isAvailable).length,
    },
    {
      id: 'floor',
      label: 'Floor & Tables',
      icon: LayoutGrid,
      badge: tables.filter((t) => t.status !== 'available').length,
    },
    { id: 'staff', label: 'Staff Management', icon: Users, badge: staff.length },
    {
      id: 'scheduling',
      label: 'Staff Scheduling',
      icon: CalendarClock,
      badge: getStaffSchedules(activeRestaurantId).length,
    },
    { id: 'crm', label: 'Customer CRM', icon: HeartHandshake },
    { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'qr', label: 'QR Management', icon: QrCode },
  ];

  const accountNavItems = [
    {
      id: 'billing',
      label: 'Subscription & Billing',
      icon: Crown,
      upgradePill: !isEnterprise,
    },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'consultant', label: 'Consultant ROI Audit', icon: FileText },
  ];

  const handleSelectNav = (tabId: OwnerSidebarTab) => {
    if (tabId === 'consultant') {
      setIsConsultantModalOpen(true);
    } else if (tabId === 'billing') {
      handleOpenBillingPlans('overview');
    } else {
      setActiveTab(tabId);
      if (path === '/owner/billing') {
        navigate('/owner');
      }
    }
    setIsMobileSidebarOpen(false);
  };

  const ownerInitials = (session.staffName || 'RO')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B] text-[#18181B] dark:text-zinc-100 flex flex-col md:flex-row font-sans overflow-x-hidden transition-colors">
      {/* d.cc DUAL-THEME SIDEBAR */}
      <aside className="w-full md:w-64 bg-white dark:bg-[#111218] text-[#18181B] dark:text-zinc-100 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-[#E4E4E7] dark:border-white/10 z-30 transition-colors">
        {/* Sidebar Brand Header */}
        <div className="px-5 py-4 border-b border-[#F4F4F5] dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl font-black font-heading tracking-tight text-[#F76707]">
              d.cc
            </span>
            <div className="h-5 w-px bg-[#E4E4E7] dark:bg-white/10" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold font-heading text-[#18181B] dark:text-white truncate max-w-[125px]">
                {restaurant.name}
              </div>
              <div className="text-[10px] font-semibold text-[#71717A] dark:text-slate-400">
                Owner Console
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-xl bg-[#F4F4F5] dark:bg-white/10 text-[#18181B] dark:text-white"
          >
            {isMobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav
          className={`p-3 space-y-1 flex-1 overflow-y-auto ${
            isMobileSidebarOpen ? 'block' : 'hidden md:block'
          }`}
        >
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id as OwnerSidebarTab)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F76707] text-white shadow-sm shadow-orange-500/20'
                    : 'text-[#52525B] dark:text-slate-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#F4F4F5] dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tnum shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#F4F4F5] dark:bg-white/10 text-[#52525B] dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-3 border-t border-[#F4F4F5] dark:border-white/10" />

          {accountNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id as OwnerSidebarTab)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F76707] text-white shadow-sm shadow-orange-500/20'
                    : 'text-[#52525B] dark:text-slate-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#F4F4F5] dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    size={16}
                    className={
                      isActive
                        ? 'text-white shrink-0'
                        : item.id === 'billing'
                        ? 'text-[#F76707] shrink-0'
                        : 'shrink-0'
                    }
                  />
                  <span className="truncate text-left">{item.label}</span>
                </div>
                {'upgradePill' in item && item.upgradePill && !isActive && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FFF0E5] dark:bg-violet-500/20 text-[#D85800] dark:text-violet-300 shrink-0">
                    Upgrade
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User & Lock */}
        <div
          className={`p-3.5 border-t border-[#F4F4F5] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#0D0E13] ${
            isMobileSidebarOpen ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#F76707] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                {ownerInitials}
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-xs font-bold text-[#18181B] dark:text-white truncate">
                  {session.staffName}
                </div>
                <div className="text-[10px] text-[#71717A] dark:text-slate-400 truncate">
                  {session.roleTitle}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl border border-[#E4E4E7] dark:border-white/10 bg-white dark:bg-white/5 hover:bg-[#F4F4F5] dark:hover:bg-white/15 text-[#52525B] dark:text-slate-300 transition-all shrink-0"
              title="Lock Terminal"
              aria-label="Lock Terminal"
            >
              <Lock size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* OWNER CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Owner Welcome / Top Bar */}
        <header className="bg-white dark:bg-[#111218] border-b border-[#E4E4E7] dark:border-white/10 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold font-heading text-[#18181B] dark:text-white tracking-tight truncate">
              {activeTab === 'overview'
                ? `Welcome back, ${session.staffName || 'Restaurant Owner'}!`
                : restaurant.name}
            </h1>
            <p className="text-xs text-[#71717A] dark:text-slate-400 truncate">
              {activeTab === 'overview' ? (
                <>Here&apos;s what&apos;s happening with {restaurant.name} today.</>
              ) : (
                <>
                  GSTIN: <span className="font-mono text-[#18181B] dark:text-slate-200">{restaurant.gstin}</span> • FSSAI:{' '}
                  <span className="font-mono text-[#18181B] dark:text-slate-200">{restaurant.fssaiLic}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Toggle (Light / Dark Mode) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl border border-[#E4E4E7] dark:border-white/10 bg-[#FAFAFA] dark:bg-white/5 hover:bg-[#F4F4F5] dark:hover:bg-white/10 text-[#52525B] dark:text-amber-300 transition-all flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span className="hidden sm:inline text-[11px] text-[#52525B] dark:text-slate-200">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>

            {/* Live Activity Bell */}
            <button
              type="button"
              onClick={() => setActiveTab('floor')}
              title="Active table alerts & new orders"
              aria-label="Live activity alerts"
              className="relative p-2 rounded-xl border border-[#E4E4E7] dark:border-white/10 bg-[#FAFAFA] dark:bg-white/5 hover:bg-[#F4F4F5] dark:hover:bg-white/10 text-[#52525B] dark:text-slate-300 transition-all shrink-0 cursor-pointer"
            >
              <Bell size={15} />
              {pendingAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-extrabold flex items-center justify-center tnum">
                  {pendingAlertsCount > 9 ? '9+' : pendingAlertsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsRestaurantModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#18181B] hover:bg-black dark:bg-[#F76707] dark:hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Building2 size={13} />
              <span className="hidden sm:inline">{restaurant.name}</span>
              <span className="sm:hidden">Profile</span>
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT */}
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto min-w-0 space-y-5">
          {/* OWNER OVERVIEW TAB — Compact Upgrade Banner directly below Welcome/Header */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <DashboardUpgradeBanner
                restaurantId={activeRestaurantId}
                ownerIdentifier={session.staffId || session.staffName}
                effectivePlanId={effectivePlanId}
                subscription={subscription}
                livePlans={livePlans}
                loading={entitlementsLoading}
                onExplorePlans={() => handleOpenBillingPlans('plans')}
                onResolveBillingIssue={() => handleOpenBillingPlans('invoices')}
              />

              <DashboardOverview
                orders={orders}
                tables={tables}
                waiterRequests={waiterRequests}
                onNavigateTo={(view) => {
                  if (view === 'floor') setActiveTab('floor');
                  if (view === 'menu') setActiveTab('menu');
                  if (view === 'qr') setActiveTab('qr');
                  if (view === 'kds') navigate('/kitchen');
                }}
              />
            </div>
          )}

          {/* BILLING & SUBSCRIPTIONS TAB */}
          {activeTab === 'billing' && (
            <OwnerBillingModule
              restaurant={restaurant}
              ownerToken={session.sessionToken}
              initialSubTab={billingInitialSubTab}
              onRefreshRestaurant={() => {
                setRestaurant(restaurantDb.getRestaurant(activeRestaurantId));
                refreshWorkspaceFromServer();
                refreshEntitlements();
              }}
            />
          )}

          {/* REPORTS, API & ENTERPRISE TAB */}
          {activeTab === 'reports' && (
            <ReportsAndEnterpriseView
              restaurantId={activeRestaurantId}
              ownerToken={session.sessionToken}
              onOpenBillingPlans={() => handleOpenBillingPlans('plans')}
            />
          )}

          {/* FLOOR MAP & TABLES TAB */}
          {activeTab === 'floor' && (
            <FloorManagementView
              restaurantId={activeRestaurantId}
              ownerToken={session.sessionToken}
              tables={tables}
              orders={orders}
              waiterRequests={waiterRequests}
              onOpenBillingPlans={() => handleOpenBillingPlans('plans')}
              onSelectTable={(tbl) => {
                setSelectedQrTableNumber(tbl.number);
                setActiveTab('qr');
              }}
              onUpdateTableStatus={(tblId, status) => {
                restaurantDb.updateTableStatus(tblId, status);
                setTables(restaurantDb.getTables(activeRestaurantId));
              }}
              onAddTable={(tblData) => {
                restaurantDb.createTable({ ...tblData, restaurantId: activeRestaurantId });
                setTables(restaurantDb.getTables(activeRestaurantId));
              }}
              onOpenTableQr={(tbl) => {
                setSelectedQrTableNumber(tbl.number);
                setActiveTab('qr');
              }}
            />
          )}

          {/* MENU MANAGEMENT TAB */}
          {activeTab === 'menu' && (
            <MenuManagementView
              restaurantId={activeRestaurantId}
              categories={categories}
              items={menuItems}
              onToggleItemAvailability={(id) => {
                restaurantDb.toggleItemAvailability(id);
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onUpdateItemPrice={(id, price) => {
                restaurantDb.updateItemPrice(id, price);
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onAddItem={(itemData) => {
                restaurantDb.createMenuItem({ ...itemData, restaurantId: activeRestaurantId });
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onEditItem={(id, updates) => {
                restaurantDb.updateMenuItem(id, updates);
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onDeleteItem={(id) => {
                restaurantDb.deleteMenuItem(id);
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onAddCategory={(catData) => {
                restaurantDb.createCategory({ ...catData, restaurantId: activeRestaurantId });
                setCategories(restaurantDb.getCategories(activeRestaurantId));
              }}
              onEditCategory={(id, updates) => {
                restaurantDb.updateCategory(id, updates);
                setCategories(restaurantDb.getCategories(activeRestaurantId));
              }}
              onDeleteCategory={(id) => {
                restaurantDb.deleteCategory(id);
                setCategories(restaurantDb.getCategories(activeRestaurantId));
                setMenuItems(restaurantDb.getMenuItems(activeRestaurantId));
              }}
              onReorderCategories={(orderedIds) => {
                restaurantDb.reorderCategories(orderedIds, activeRestaurantId);
                setCategories(restaurantDb.getCategories(activeRestaurantId));
              }}
            />
          )}

          {/* QR CODE STANDS TAB */}
          {activeTab === 'qr' && (
            <QrCodeManagerView
              restaurant={restaurant}
              tables={tables}
              initialTableNumber={selectedQrTableNumber}
              onRegenerateTableToken={(tblId) => {
                restaurantDb.regenerateTableToken(tblId);
                setTables(restaurantDb.getTables(activeRestaurantId));
              }}
              onOpenCustomerViewForTable={(tblNum) => {
                const matched = tables.find((t) => t.number === tblNum);
                const params = new URLSearchParams({
                  restaurant: restaurant.slug || restaurant.id,
                  table: tblNum,
                  tableId: matched?.id || `tbl-${restaurant.id}-${tblNum}`,
                  view: 'customer',
                });
                if (matched?.secureToken) {
                  params.set('token', matched.secureToken);
                }
                navigate(`/customer?${params.toString()}`);
              }}
              onWorkspaceRefresh={refreshWorkspaceFromServer}
            />
          )}

          {/* STAFF MANAGEMENT & SCHEDULING TAB */}
          {(activeTab === 'staff' || activeTab === 'scheduling') && (
            <StaffManagementView
              restaurantId={restaurant.id}
              ownerToken={session.sessionToken}
              tables={tables}
              initialSubTab={activeTab === 'scheduling' ? 'scheduling' : 'directory'}
              onOpenBillingPlans={() => handleOpenBillingPlans('plans')}
            />
          )}

          {/* CUSTOMER CRM & GUESTS TAB */}
          {activeTab === 'crm' && (
            <CustomerCrmView
              restaurantId={restaurant.id}
              ownerToken={session.sessionToken}
              onOpenBillingPlans={() => handleOpenBillingPlans('plans')}
            />
          )}

          {/* RESTAURANT SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-2xl bg-white dark:bg-[#14151D] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-white/10 shadow-xs">
              <h3 className="text-base font-extrabold font-heading text-[#18181B] dark:text-white">
                Restaurant Settings &amp; Regulatory Compliance
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#FAFAFA] dark:bg-white/5 rounded-xl border border-[#E4E4E7] dark:border-white/10 flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#18181B] dark:text-white">Restaurant Name</div>
                    <div className="text-[#71717A] dark:text-slate-400 truncate">{restaurant.name}</div>
                  </div>
                  <button
                    onClick={() => setIsRestaurantModalOpen(true)}
                    className="px-3 py-1 bg-white dark:bg-white/10 border border-[#E4E4E7] dark:border-white/10 rounded-lg text-xs font-bold text-[#18181B] dark:text-white shrink-0"
                  >
                    Edit
                  </button>
                </div>

                <div className="p-3 bg-[#FAFAFA] dark:bg-white/5 rounded-xl border border-[#E4E4E7] dark:border-white/10 flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#18181B] dark:text-white">GSTIN (Goods and Services Tax)</div>
                    <div className="font-mono text-[#18181B] dark:text-slate-200 break-all">{restaurant.gstin}</div>
                  </div>
                  <span className="text-[11px] font-bold text-[#16A34A] dark:text-emerald-400 shrink-0">
                    5% (2.5% CGST + 2.5% SGST)
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAFA] dark:bg-white/5 rounded-xl border border-[#E4E4E7] dark:border-white/10 flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#18181B] dark:text-white">FSSAI License</div>
                    <div className="font-mono text-[#18181B] dark:text-slate-200 break-all">{restaurant.fssaiLic}</div>
                  </div>
                  <span className="text-[11px] font-bold text-[#16A34A] dark:text-emerald-400 shrink-0">
                    Active Verified
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAFA] dark:bg-white/5 rounded-xl border border-[#E4E4E7] dark:border-white/10 flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#18181B] dark:text-white">Guest Wi-Fi Setup</div>
                    <div className="text-[#71717A] dark:text-slate-400 break-all">
                      {restaurant.wifiSsid} (Pass: {restaurant.wifiPassword})
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#2563EB] dark:text-blue-400 shrink-0">
                    Auto-Linked on QR
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* RESTAURANT CREATION / EDIT MODAL */}
      <CreateRestaurantModal
        isOpen={isRestaurantModalOpen}
        onClose={() => setIsRestaurantModalOpen(false)}
        currentRestaurant={restaurant}
        onSaveRestaurant={(updated) => {
          restaurantDb.updateRestaurant({ ...updated, id: activeRestaurantId });
          setRestaurant(restaurantDb.getRestaurant(activeRestaurantId));
        }}
      />

      {/* STRATEGIC CONSULTANT REPORT MODAL */}
      <ConsultantReportModal
        isOpen={isConsultantModalOpen}
        onClose={() => setIsConsultantModalOpen(false)}
      />
    </div>
  );
};

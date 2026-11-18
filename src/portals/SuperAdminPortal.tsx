import React, { useState, useEffect } from 'react';
import { useRouter } from '../router/Router';
import {
  PlatformAdminStats,
  PlatformSubscription,
  SubscriptionPlanConfig,
  PlatformFinancialOverview,
} from '../types/dcc';
import {
  ShieldCheck,
  Building2,
  Users,
  UtensilsCrossed,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Lock,
  ArrowRight,
  LogOut,
  RefreshCw,
  Clock,
  Sparkles,
  Receipt,
  FileText,
  Sliders,
  Wallet,
  Check,
  Edit2,
  Layers,
  X,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const SuperAdminPortal: React.FC = () => {
  const { navigate } = useRouter();

  // Authentication State
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('urdearmenu_superadmin_token');
    }
    return null;
  });

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard Stats State
  const [stats, setStats] = useState<PlatformAdminStats | null>(null);
  const [financialOverview, setFinancialOverview] = useState<PlatformFinancialOverview | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [commissionData, setCommissionData] = useState<{ records: any[]; ledger: any[]; invoices: any[] } | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [transactionsData, setTransactionsData] = useState<{ transactions: any[]; webhooks: any[]; auditLogs: any[] } | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [activeTab, setActiveTab] = useState<'financials' | 'plans' | 'restaurants' | 'commissions' | 'subscriptions' | 'transactions' | 'settlements'>('financials');

  // Plan Edit Modal State
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanConfig | null>(null);
  const [editPriceInr, setEditPriceInr] = useState('');
  const [editPriceUsd, setEditPriceUsd] = useState('');
  const [editCommissionPercent, setEditCommissionPercent] = useState('');
  const [editTrialDays, setEditTrialDays] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Weekly Invoice Generation State
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load all admin data when authenticated
  const fetchAllAdminData = async (adminToken: string) => {
    setLoadingData(true);
    setStatsError('');
    try {
      const rawResponses = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/admin/financial-overview', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/billing/plans'),
        fetch('/api/admin/commission-statements', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/admin/settlements', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/admin/payment-transactions', { headers: { Authorization: `Bearer ${adminToken}` } }),
      ]);

      if (rawResponses[0].status === 401) {
        localStorage.removeItem('urdearmenu_superadmin_token');
        setToken(null);
        setLoginError('Your Super Admin session expired. Please sign in again.');
        return;
      }

      const [statsRes, finRes, plansRes, comRes, setRes, txRes] = await Promise.all(
        rawResponses.map((r) => r.json())
      );

      if (statsRes.success) setStats(statsRes.stats);
      if (finRes.success) setFinancialOverview(finRes.financialOverview);
      if (plansRes.success && plansRes.plans) setPlans(plansRes.plans);
      if (comRes.success) setCommissionData(comRes);
      if (setRes.success) setSettlements(setRes.settlements || []);
      if (txRes.success) setTransactionsData(txRes);
    } catch (err) {
      setStatsError('Network error connecting to platform management API.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAllAdminData(token);
    }
  }, [token]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Authentication failed. Please verify credentials.');
        setLoginLoading(false);
        return;
      }

      localStorage.setItem('urdearmenu_superadmin_token', data.token);
      setToken(data.token);
      fetchAllAdminData(data.token);
    } catch (err) {
      setLoginError('Server connection error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('urdearmenu_superadmin_token');
    setToken(null);
    setStats(null);
  };

  const handleToggleRestaurantStatus = async (restaurantId: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAllAdminData(token);
      }
    } catch (err) {
      console.warn('Error toggling status', err);
    }
  };

  // Super Admin: Save Plan Changes
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !token) return;
    setSavingPlan(true);

    try {
      const res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceInr: Number(editPriceInr),
          priceUsd: Number(editPriceUsd),
          commissionPercent: Number(editCommissionPercent),
          trialDays: Number(editTrialDays),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Plan ${editingPlan.name} updated successfully!`);
        setTimeout(() => setToastMessage(null), 4000);
        setEditingPlan(null);
        fetchAllAdminData(token);
      }
    } catch (err) {
      setToastMessage('Failed to save plan configuration.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setSavingPlan(false);
    }
  };

  // Super Admin: Trigger Weekly Invoices Generation
  const handleGenerateWeeklyInvoices = async () => {
    if (!token) return;
    setGeneratingInvoices(true);
    try {
      const res = await fetch('/api/billing/generate-weekly-invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Generated ${data.generatedCount} weekly commission invoice(s)!`);
        setTimeout(() => setToastMessage(null), 5000);
        fetchAllAdminData(token);
      }
    } catch (err) {
      setToastMessage('Failed to generate weekly invoices.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  // Super Admin: Settle Payout
  const handleSettlePayout = async (settlementId: string) => {
    if (!token) return;
    const ref = `UTR${Date.now().toString().slice(-8)}`;

    try {
      const res = await fetch(`/api/admin/settlements/${settlementId}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bankReference: ref }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Settlement marked settled with UTR ${ref}!`);
        setTimeout(() => setToastMessage(null), 4000);
        fetchAllAdminData(token);
      }
    } catch (err) {
      setToastMessage('Error updating settlement.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Unauthenticated Super Admin Login Gate
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#18181B] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-[#F76707] text-white mx-auto flex items-center justify-center shadow-lg shadow-red-600/30">
              <ShieldCheck size={26} />
            </div>
            <h2 className="text-xl font-bold font-heading text-white">
              Platform Administration
            </h2>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Super Admin privilege required. Master control for multi-tenant isolation, subscription billing, and platform financial telemetry.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#A1A1AA] block mb-1.5">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@urdearmenu.com"
                className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#A1A1AA] block mb-1.5">
                Master Security Password
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-[#F76707] hover:from-red-500 hover:to-[#EA580C] text-white font-bold font-heading text-xs shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Unlock Platform Console</span>
                </>
              )}
            </button>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#A1A1AA] font-semibold">Demo Environment Access</span>
                <button
                  type="button"
                  onClick={() => {
                    setAdminEmail('admin@urdearmenu.com');
                    setAdminPassword('admin123');
                  }}
                  className="text-[#F76707] hover:underline font-bold"
                >
                  Fill Credentials
                </button>
              </div>
              <div className="font-mono text-[10px] text-[#D4D4D8]">
                admin@urdearmenu.com • admin123
              </div>
            </div>
          </form>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#71717A]">
            <span>Production Isolation</span>
            <button
              onClick={() => navigate('/')}
              className="text-[#F76707] hover:underline flex items-center gap-1"
            >
              <span>Back to Public Site</span>
              <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredRestaurants = (stats?.restaurants || []).filter((r) => {
    if (filterStatus === 'active' && r.status !== 'active') return false;
    if (filterStatus === 'suspended' && r.status !== 'suspended') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.ownerEmail.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F5] flex flex-col font-sans overflow-x-hidden">
      {/* Super Admin Top Header */}
      <header className="bg-[#18181B] border-b border-white/10 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-[#F76707] text-white flex items-center justify-center font-bold text-xs shadow-md shrink-0">
            UDM
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm font-extrabold font-heading text-white truncate">
                Ur.Dear.Menu • Master Control
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                SUPERADMIN
              </span>
            </div>
            <p className="text-[11px] text-[#71717A] hidden sm:block truncate">
              Platform-wide financial oversight, subscription pricing, commission statements, and tenant governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => token && fetchAllAdminData(token)}
            disabled={loadingData}
            className="p-2 rounded-xl bg-white/5 text-[#A1A1AA] hover:text-white transition-colors"
            title="Refresh Platform Telemetry"
          >
            <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#A1A1AA] hover:text-white transition-colors hidden sm:block"
          >
            Public Site
          </button>
          <button
            onClick={handleLogout}
            className="py-1.5 px-3 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-400 flex items-center justify-between animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-300 hover:text-white">✕</button>
          </div>
        )}

        {/* Master Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'financials', label: 'Platform Financials', icon: DollarSign },
            { id: 'plans', label: `Pricing & Plans (${plans.length})`, icon: Sliders },
            { id: 'restaurants', label: `Restaurants (${stats?.restaurants?.length || 0})`, icon: Building2 },
            { id: 'commissions', label: 'Commission Statements', icon: TrendingUp },
            { id: 'subscriptions', label: `SaaS Subscriptions (${stats?.paymentHistory?.length || 0})`, icon: Receipt },
            { id: 'settlements', label: `Split Settlements (${settlements.length})`, icon: Wallet },
            { id: 'transactions', label: 'Gateway Audit Log', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold font-heading whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#F76707] text-white shadow-md'
                    : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border border-white/5'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: MASTER PLATFORM FINANCIALS ================= */}
        {activeTab === 'financials' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold font-heading text-white">
                  Platform Financial Overview & Monetization
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Strict accounting isolation: Restaurant food bill turnover is reported separately and is <strong>never</strong> counted as Ur.Dear.Menu platform revenue.
                </p>
              </div>

              <div className="sm:text-right shrink-0">
                <span className="text-[10px] text-[#A1A1AA] block uppercase">Net Platform Revenue</span>
                <span className="text-2xl font-black font-heading text-emerald-400 tnum">
                  {formatINR(financialOverview?.netPlatformRevenue ?? stats?.totalPlatformRevenue ?? 0)}
                </span>
              </div>
            </div>

            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Subscription Revenue */}
              <div className="p-4 rounded-2xl bg-[#18181B] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">SaaS Subscriptions</span>
                  <DollarSign size={16} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-black font-heading text-white tnum">
                  {formatINR(financialOverview?.subscriptionRevenueCollected ?? stats?.totalPlatformRevenue ?? 0)}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  MRR: {formatINR(stats?.mrr ?? 0)} from active plans
                </div>
              </div>

              {/* Commission Revenue Collected */}
              <div className="p-4 rounded-2xl bg-[#18181B] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Commission Invoiced</span>
                  <TrendingUp size={16} className="text-[#F76707]" />
                </div>
                <div className="text-2xl font-black font-heading text-[#F76707] tnum">
                  {formatINR(financialOverview?.commissionRevenueCollected ?? 0)}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  Pending: {formatINR(financialOverview?.pendingCommissionReceivables ?? 0)} unbilled
                </div>
              </div>

              {/* Online Payment Volume */}
              <div className="p-4 rounded-2xl bg-[#18181B] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Online Gateway Volume</span>
                  <CreditCard size={16} className="text-blue-400" />
                </div>
                <div className="text-2xl font-black font-heading text-white tnum">
                  {formatINR(financialOverview?.totalOnlinePaymentVolume ?? 0)}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  Estimated gateway fees: {formatINR(financialOverview?.gatewayExpenses ?? 0)}
                </div>
              </div>

              {/* Offline Counter Volume */}
              <div className="p-4 rounded-2xl bg-[#18181B] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Offline Counter Volume</span>
                  <Wallet size={16} className="text-purple-400" />
                </div>
                <div className="text-2xl font-black font-heading text-white tnum">
                  {formatINR(financialOverview?.totalOfflinePaymentVolume ?? 0)}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  Cash & Direct UPI verified by staff
                </div>
              </div>
            </div>

            {/* Reconciliation Balance Sheet */}
            <div className="bg-[#18181B] rounded-2xl border border-white/5 p-5 space-y-4">
              <h4 className="text-xs font-bold font-heading text-white uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={14} className="text-[#F76707]" />
                <span>Platform Earnings & Reconciliation Statement</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="text-[#A1A1AA] font-bold block">1. Gross Revenue Inflow</span>
                  <div className="flex justify-between">
                    <span>SaaS Subscriptions Collected:</span>
                    <span className="font-bold text-white tnum">{formatINR(financialOverview?.subscriptionRevenueCollected ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Order Commissions Settled:</span>
                    <span className="font-bold text-white tnum">{formatINR(financialOverview?.commissionRevenueCollected ?? 0)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-emerald-400">
                    <span>Gross Platform Revenue:</span>
                    <span className="tnum">{formatINR((financialOverview?.subscriptionRevenueCollected ?? 0) + (financialOverview?.commissionRevenueCollected ?? 0))}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="text-[#A1A1AA] font-bold block">2. Expenses & Reversals</span>
                  <div className="flex justify-between">
                    <span>Estimated Gateway interchange (2%):</span>
                    <span className="font-bold text-red-400 tnum">-{formatINR(financialOverview?.gatewayExpenses ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refunds & Commission Reversals:</span>
                    <span className="font-bold text-red-400 tnum">-{formatINR(financialOverview?.totalRefundsAndReversals ?? 0)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-red-400">
                    <span>Total Outflow / Adjustments:</span>
                    <span className="tnum">-{formatINR((financialOverview?.gatewayExpenses ?? 0) + (financialOverview?.totalRefundsAndReversals ?? 0))}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="text-[#A1A1AA] font-bold block">3. Pending Receivables</span>
                  <div className="flex justify-between">
                    <span>Unbilled Commission Accruals:</span>
                    <span className="font-bold text-amber-400 tnum">{formatINR(financialOverview?.pendingCommissionReceivables ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outstanding Invoices Count:</span>
                    <span className="font-bold text-white">{financialOverview?.outstandingInvoicesCount ?? 0}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-amber-400">
                    <span>Total Outstanding:</span>
                    <span className="tnum">{formatINR(financialOverview?.outstandingInvoicesAmount ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PRICING PLANS CONFIGURATOR ================= */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold font-heading text-white">
                  Subscription & Commission Plans Configurator
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Pricing and commission rates are never hardcoded. Changes apply immediately for new subscriptions and future order commissions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="bg-[#18181B] rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black font-heading text-white">{p.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {p.commissionPercent}% Comm.
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-heading text-white tnum">{formatINR(p.priceInr)}</span>
                      <span className="text-xs text-[#A1A1AA] tnum">(${p.priceUsd}/mo)</span>
                    </div>

                    <p className="text-xs text-[#71717A] leading-relaxed">{p.description}</p>

                    <div className="pt-2 border-t border-white/5 text-[11px] text-[#A1A1AA] space-y-1">
                      <div>Trial Period: <strong className="text-white">{p.trialDays} Days</strong></div>
                      <div>Annual Discount: <strong className="text-white">{p.annualDiscountPercent}%</strong></div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingPlan(p);
                      setEditPriceInr(String(p.priceInr));
                      setEditPriceUsd(String(p.priceUsd));
                      setEditCommissionPercent(String(p.commissionPercent));
                      setEditTrialDays(String(p.trialDays));
                    }}
                    className="w-full py-2 rounded-xl bg-white/10 hover:bg-[#F76707] text-white text-xs font-bold font-heading transition-all flex items-center justify-center gap-1.5"
                  >
                    <Edit2 size={13} />
                    <span>Edit Tier Pricing</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: RESTAURANT DIRECTORY ================= */}
        {activeTab === 'restaurants' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search restaurants, owners or IDs..."
                  className="w-full bg-[#18181B] border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    filterStatus === 'all' ? 'bg-white/20 text-white' : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    filterStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setFilterStatus('suspended')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    filterStatus === 'suspended' ? 'bg-red-500/20 text-red-400' : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Suspended
                </button>
              </div>
            </div>

            {filteredRestaurants.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#18181B] border border-white/5 space-y-3">
                <Building2 className="mx-auto text-[#71717A]" size={36} />
                <h3 className="text-sm font-bold text-white font-heading">No Restaurants Registered Yet</h3>
                <p className="text-xs text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
                  When restaurant owners register on the home page, their workspaces, staff, tables and subscription records will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#18181B]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#27272A]/50 text-[#A1A1AA] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Restaurant</th>
                      <th className="px-4 py-3">Owner Contact</th>
                      <th className="px-4 py-3">Plan Tier</th>
                      <th className="px-4 py-3">Orders</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[#D4D4D8]">
                    {filteredRestaurants.map((rest) => (
                      <tr key={rest.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-white font-heading">{rest.name}</div>
                          <div className="text-[10px] text-[#71717A] font-mono">{rest.id}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-white">{rest.ownerName}</div>
                          <div className="text-[10px] text-[#A1A1AA]">{rest.ownerEmail}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-white uppercase">
                            {rest.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 tnum">{rest.ordersCount} completed</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rest.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {rest.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleToggleRestaurantStatus(rest.id, rest.status)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              rest.status === 'active'
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {rest.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: COMMISSION STATEMENTS & WEEKLY INVOICES ================= */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold font-heading text-white">
                  Weekly Commission Statements & Reconciliation
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Monday to Sunday accumulation $\rightarrow$ Monday statement $\rightarrow$ Tuesday tax invoice.
                </p>
              </div>

              <button
                onClick={handleGenerateWeeklyInvoices}
                disabled={generatingInvoices}
                className="px-4 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-1.5 shadow-md transition-all shrink-0"
              >
                {generatingInvoices ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Processing Invoices...</span>
                  </>
                ) : (
                  <>
                    <Receipt size={13} />
                    <span>Generate Weekly Invoices Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Invoices List */}
            <div className="bg-[#18181B] rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 font-bold text-xs text-white">
                Dispatched Weekly Commission Invoices ({commissionData?.invoices?.length || 0})
              </div>

              {(!commissionData?.invoices || commissionData.invoices.length === 0) ? (
                <div className="p-8 text-center text-xs text-[#71717A]">
                  No weekly invoices generated yet. Click "Generate Weekly Invoices Now" to compile unbilled order commissions.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#27272A]/50 text-[#A1A1AA] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Restaurant</th>
                        <th className="px-4 py-3">Orders Count</th>
                        <th className="px-4 py-3">Commission Subtotal</th>
                        <th className="px-4 py-3">GST (18%)</th>
                        <th className="px-4 py-3">Total Payable</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[#D4D4D8]">
                      {commissionData.invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="px-4 py-3 font-mono font-bold text-[#F76707]">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3 font-bold text-white">{inv.restaurantName}</td>
                          <td className="px-4 py-3 tnum">{inv.itemizedOrdersCount || 1} orders</td>
                          <td className="px-4 py-3 font-semibold tnum">{formatINR(inv.subtotal)}</td>
                          <td className="px-4 py-3 text-[#A1A1AA] tnum">{formatINR(inv.tax)}</td>
                          <td className="px-4 py-3 font-black text-emerald-400 tnum">{formatINR(inv.total)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {inv.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: SAAS SUBSCRIPTION PAYMENTS ================= */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            {(!stats?.paymentHistory || stats.paymentHistory.length === 0) ? (
              <div className="p-12 text-center rounded-3xl bg-[#18181B] border border-white/5 space-y-3">
                <CreditCard className="mx-auto text-[#71717A]" size={36} />
                <h3 className="text-sm font-bold text-white font-heading">
                  No Subscription Payments Recorded Yet
                </h3>
                <p className="text-xs text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
                  As restaurants register under Flex, Essential (₹1,999/mo), Professional (₹4,999/mo) or Enterprise (₹9,999/mo) plans, verified subscription payments log directly into this platform revenue ledger.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#18181B]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#27272A]/50 text-[#A1A1AA] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Restaurant Workspace</th>
                      <th className="px-4 py-3">Owner Email</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[#D4D4D8]">
                    {stats.paymentHistory.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 font-mono text-[#F76707] font-bold">
                          {sub.invoiceNumber}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">
                          {sub.restaurantName}
                        </td>
                        <td className="px-4 py-3.5 text-[#A1A1AA]">
                          {sub.ownerEmail}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-white">
                            {sub.planName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-emerald-400 font-bold tnum">
                          {sub.currency === 'USD' ? `$${sub.amount}` : formatINR(sub.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-[#71717A]">
                          {new Date(sub.paidAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={10} />
                            <span>Paid</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: SPLIT SETTLEMENTS ================= */}
        {activeTab === 'settlements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold font-heading text-white">
                  Marketplace Split Settlements & Restaurant Payouts
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Approved split-settlement arrangements automatically partition payments into restaurant bank payouts and platform commission.
                </p>
              </div>
            </div>

            {settlements.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#18181B] border border-white/5 space-y-2">
                <Wallet className="mx-auto text-[#71717A]" size={36} />
                <h4 className="text-sm font-bold text-white">No Split Settlement Records Yet</h4>
                <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                  When customer online payments are captured, automatic split records will appear here for payout clearance.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#18181B]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#27272A]/50 text-[#A1A1AA] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Settlement ID</th>
                      <th className="px-4 py-3">Restaurant</th>
                      <th className="px-4 py-3">Gross Volume</th>
                      <th className="px-4 py-3">Platform Comm.</th>
                      <th className="px-4 py-3">Net Settlement</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[#D4D4D8]">
                    {settlements.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-mono text-[#F76707]">{s.id}</td>
                        <td className="px-4 py-3 font-bold text-white">{s.restaurantName}</td>
                        <td className="px-4 py-3 tnum">{formatINR(s.totalOnlineVolume)}</td>
                        <td className="px-4 py-3 text-red-400 tnum">-{formatINR(s.platformCommissionDeducted)}</td>
                        <td className="px-4 py-3 font-black text-emerald-400 tnum">{formatINR(s.netSettlementAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'settled' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.status !== 'settled' ? (
                            <button
                              onClick={() => handleSettlePayout(s.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                            >
                              Approve Payout
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#71717A] font-mono">{s.bankReference}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 7: TRANSACTIONS & WEBHOOKS ================= */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold font-heading text-white">
                Payment Transactions & Idempotent Webhook Audit Trail
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Full cryptographic verification logs, idempotency deduplication, and financial audit history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transactions List */}
              <div className="bg-[#18181B] rounded-2xl border border-white/5 p-4 space-y-3">
                <h4 className="text-xs font-bold font-heading text-white">Transactions Log</h4>
                {(!transactionsData?.transactions || transactionsData.transactions.length === 0) ? (
                  <p className="text-xs text-[#71717A]">No transactions processed yet.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                    {transactionsData.transactions.map((tx) => (
                      <div key={tx.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white font-mono">{tx.id}</span>
                          <span className="font-black text-emerald-400 tnum">{formatINR(tx.amount)}</span>
                        </div>
                        <div className="text-[11px] text-[#A1A1AA] flex justify-between">
                          <span>Order #{tx.orderNumber} • {tx.paymentType}</span>
                          <span className="uppercase text-[10px] text-[#F76707] font-bold">{tx.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Webhooks Log */}
              <div className="bg-[#18181B] rounded-2xl border border-white/5 p-4 space-y-3">
                <h4 className="text-xs font-bold font-heading text-white">Webhooks Inflow & Deduplication</h4>
                {(!transactionsData?.webhooks || transactionsData.webhooks.length === 0) ? (
                  <p className="text-xs text-[#71717A]">No incoming webhooks received yet.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                    {transactionsData.webhooks.map((wh) => (
                      <div key={wh.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white font-mono">{wh.eventId}</span>
                          <span className="text-[10px] font-bold text-emerald-400">{wh.event}</span>
                        </div>
                        <div className="text-[10px] text-[#71717A] flex justify-between">
                          <span>Processed: {new Date(wh.processedAt).toLocaleString()}</span>
                          <span className="text-emerald-400">IDEMPOTENT OK</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= EDIT PLAN MODAL ================= */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#18181B] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#F76707] uppercase">SuperAdmin Plan Editor</span>
                <h3 className="text-base font-extrabold font-heading text-white">Edit {editingPlan.name} Plan</h3>
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-[#A1A1AA] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-[#A1A1AA] block mb-1">
                  Monthly Price in India (₹ INR)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editPriceInr}
                  onChange={(e) => setEditPriceInr(e.target.value)}
                  className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A1A1AA] block mb-1">
                  Monthly Price International ($ USD)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A1A1AA] block mb-1">
                  Order Commission Rate (%)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  max="15"
                  value={editCommissionPercent}
                  onChange={(e) => setEditCommissionPercent(e.target.value)}
                  className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#A1A1AA] block mb-1">
                  Free Trial Duration (Days)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editTrialDays}
                  onChange={(e) => setEditTrialDays(e.target.value)}
                  className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-bold font-heading shadow-md"
                >
                  {savingPlan ? 'Saving Changes...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

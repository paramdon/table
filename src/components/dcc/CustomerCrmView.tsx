import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Phone,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  TrendingUp,
  Sparkles,
  Calendar,
  ChevronRight,
  X,
  Heart,
  ShoppingBag,
  Award,
  RefreshCw,
  Eye,
  Check,
  Flame,
  ArrowUpDown,
} from 'lucide-react';
import { CustomerProfile, CustomerOrderRecord, CustomerCrmAnalytics } from '../../types/dcc';
import { formatINR } from '../../utils/formatters';
import { CustomerAnalyticsDashboard } from './CustomerAnalyticsDashboard';
import {
  useEntitlements,
  buildAuthHeaders,
  parseFeatureLockedPayload,
} from '../../hooks/useEntitlements';
import { UpgradePromptModal } from './UpgradePromptModal';
import { Lock } from 'lucide-react';

interface CustomerCrmViewProps {
  restaurantId: string;
  ownerToken?: string;
  onOpenBillingPlans?: (recommendedPlanId?: string) => void;
}

export const CustomerCrmView: React.FC<CustomerCrmViewProps> = ({
  restaurantId,
  ownerToken,
  onOpenBillingPlans,
}) => {
  const { hasFeature, lockedPrompt, setLockedPrompt, triggerLockedFeature } = useEntitlements(
    restaurantId,
    ownerToken
  );
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [analytics, setAnalytics] = useState<CustomerCrmAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [marketingFilter, setMarketingFilter] = useState<'all' | 'opted_in' | 'opted_out'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'new' | 'returning'>('all');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'recent' | 'name'>('spent');

  // Customer Drawer / Modal State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<CustomerOrderRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch CRM Data
  const fetchCrmData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/owner/crm/customers', {
        headers: ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
        setAnalytics(data.analytics || null);
      } else {
        setError(data.error || 'Failed to load customer records');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching CRM records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, [restaurantId, ownerToken]);

  // Load single customer order history when selected
  const handleOpenCustomer = async (cust: CustomerProfile) => {
    setSelectedCustomerId(cust.id);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/owner/crm/customers/${cust.id}`, {
        headers: ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCustomerOrders(data.orderHistory || []);
      }
    } catch (err) {
      console.error('Failed to load customer orders:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Export to CSV (Protected by Professional+ Backend Entitlement)
  const handleExportCsv = async () => {
    try {
      const res = await fetch('/api/owner/crm/export-csv', {
        headers: buildAuthHeaders(ownerToken),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const locked = parseFeatureLockedPayload(data);
        if (locked) {
          triggerLockedFeature(locked);
          return;
        }
        setError(data.error || 'Could not export customer database.');
        return;
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urdearmenu-customers-${restaurantId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export customer CSV.');
    }
  };

  // Advanced CRM Segmentation Check
  const handleCheckSegmentation = async () => {
    try {
      const res = await fetch('/api/owner/crm/segmentation', {
        headers: buildAuthHeaders(ownerToken),
      });
      const data = await res.json();
      if (!res.ok) {
        const locked = parseFeatureLockedPayload(data);
        if (locked) {
          triggerLockedFeature(locked);
          return;
        }
      }
      if (data.success && data.segments) {
        setFrequencyFilter('returning');
      }
    } catch {
      triggerLockedFeature('advanced_crm');
    }
  };

  // Filtered & Sorted Customer List
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Search by name or phone
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (c.name || '').toLowerCase().includes(q);
          const matchPhone = (c.phoneNumber || '').includes(q);
          if (!matchName && !matchPhone) return false;
        }

        // Marketing Consent Filter
        if (marketingFilter === 'opted_in' && !c.marketingConsent) return false;
        if (marketingFilter === 'opted_out' && c.marketingConsent) return false;

        // Frequency Filter
        if (frequencyFilter === 'new' && c.visitCount > 1) return false;
        if (frequencyFilter === 'returning' && c.visitCount <= 1) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'spent') return (b.totalSpent || 0) - (a.totalSpent || 0);
        if (sortBy === 'orders') return (b.totalOrders || 0) - (a.totalOrders || 0);
        if (sortBy === 'recent') return (b.lastVisit || 0) - (a.lastVisit || 0);
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        return 0;
      });
  }, [customers, searchQuery, marketingFilter, frequencyFilter, sortBy]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  return (
    <div className="space-y-6">
      <UpgradePromptModal
        lockedError={lockedPrompt}
        onClose={() => setLockedPrompt(null)}
        onViewPlans={(planId) => onOpenBillingPlans && onOpenBillingPlans(planId)}
      />
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold font-heading text-[#18181B] tracking-tight">
              Customer CRM & Dining Intelligence
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#F76707] border border-orange-200">
              d.cc Engine
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Smart QR guest recognition, repeat diner profiles, order habits & automated CRM records
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchCrmData(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center gap-1.5 transition-all shadow-xs"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#F76707]' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleCheckSegmentation}
            className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center gap-1.5 transition-all shadow-xs"
          >
            {!hasFeature('advanced_crm') && <Lock size={12} className="text-[#F76707]" />}
            <span>VIP Segmentation</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs"
          >
            {!hasFeature('csv_export') && <Lock size={12} />}
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Diners */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">Total Diners</span>
              <Users size={14} className="text-[#F76707]" />
            </div>
            <div className="text-xl font-extrabold font-heading text-[#18181B] tnum">
              {analytics.totalCustomers}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">100% Unique Devices</div>
          </div>

          {/* Card 2: Returning Diners */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">Repeat Rate</span>
              <Award size={14} className="text-purple-600" />
            </div>
            <div className="text-xl font-extrabold font-heading text-[#18181B] tnum">
              {analytics.totalCustomers > 0
                ? `${Math.round((analytics.returningCustomers / analytics.totalCustomers) * 100)}%`
                : '0%'}
            </div>
            <div className="text-[10px] text-[#71717A] mt-1 font-medium">
              {analytics.returningCustomers} repeat / {analytics.newCustomers} new
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">Orders Tracked</span>
              <ShoppingBag size={14} className="text-blue-600" />
            </div>
            <div className="text-xl font-extrabold font-heading text-[#18181B] tnum">
              {analytics.totalOrders}
            </div>
            <div className="text-[10px] text-[#71717A] mt-1 font-medium">Synced via Smart QR</div>
          </div>

          {/* Card 4: Total Revenue */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">CRM Revenue</span>
              <CreditCard size={14} className="text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold font-heading text-emerald-700 tnum">
              {formatINR(analytics.totalRevenue)}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">Attributed to Guests</div>
          </div>

          {/* Card 5: Average Order Value */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">Average Order</span>
              <TrendingUp size={14} className="text-amber-600" />
            </div>
            <div className="text-xl font-extrabold font-heading text-[#18181B] tnum">
              {formatINR(analytics.averageOrderValue)}
            </div>
            <div className="text-[10px] text-[#71717A] mt-1 font-medium">AOV per table fire</div>
          </div>

          {/* Card 6: Marketing Opt-in */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between text-[#71717A] mb-1">
              <span className="text-[11px] font-bold">Opt-In Rate</span>
              <Heart size={14} className="text-rose-500" />
            </div>
            <div className="text-xl font-extrabold font-heading text-rose-600 tnum">
              {analytics.marketingOptInRate}%
            </div>
            <div className="text-[10px] text-[#71717A] mt-1 font-medium">
              {analytics.marketingConsentCount} opted in
            </div>
          </div>
        </div>
      )}

      {/* Popular Dishes Highlight */}
      {analytics && ((analytics.popularDishes && analytics.popularDishes.length > 0) || (analytics.topItems && analytics.topItems.length > 0)) && (
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#18181B]">
            <Flame size={16} className="text-[#F76707]" />
            <span>Top Guest Favorites:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(analytics.popularDishes || analytics.topItems || []).map((dish: { name: string; count: number }, i: number) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-xl bg-[#F4F4F5] text-xs font-bold text-[#18181B] border border-[#E4E4E7] flex items-center gap-1.5"
              >
                <span>{dish.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#18181B] text-white">
                  {dish.count} ordered
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* RECHARTS VISUAL DASHBOARD: DAILY ORDER TRENDS & REVENUE DISTRIBUTION */}
      {analytics && <CustomerAnalyticsDashboard analytics={analytics} />}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests by name or phone (+91 98765...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-medium text-[#18181B] placeholder-[#A1A1AA] focus:outline-hidden focus:border-[#F76707] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#71717A] hover:text-[#18181B]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter: Marketing Consent */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-[11px] font-bold text-[#71717A] whitespace-nowrap">
              Marketing:
            </span>
            <select
              value={marketingFilter}
              onChange={(e) => setMarketingFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden"
            >
              <option value="all">All Guests</option>
              <option value="opted_in">Opted-In Only</option>
              <option value="opted_out">No Consent</option>
            </select>
          </div>

          {/* Filter: Frequency */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-[11px] font-bold text-[#71717A] whitespace-nowrap">Status:</span>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden"
            >
              <option value="all">All Guests</option>
              <option value="returning">Repeat Visitors (2+)</option>
              <option value="new">First Time Diners</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-[11px] font-bold text-[#71717A] whitespace-nowrap">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden"
            >
              <option value="spent">Total Spent (High to Low)</option>
              <option value="orders">Order Count</option>
              <option value="recent">Most Recent Visit</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-[#71717A] flex items-center justify-between pt-1">
          <span>
            Showing <strong>{filteredCustomers.length}</strong> of{' '}
            <strong>{customers.length}</strong> guests
          </span>
          {marketingFilter === 'opted_in' && (
            <span className="text-emerald-700 font-medium">Showing marketing opt-ins only</span>
          )}
        </div>
      </div>

      {/* Customer Table List */}
      <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#71717A] space-y-2">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#F76707]" />
            <div className="text-xs font-bold">Loading guest CRM intelligence...</div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-[#71717A] space-y-2">
            <Users size={32} className="mx-auto text-[#A1A1AA]" />
            <div className="text-sm font-bold text-[#18181B]">No matching customer profiles</div>
            <div className="text-xs text-[#71717A] max-w-sm mx-auto">
              {searchQuery
                ? `No guests match "${searchQuery}". Try clearing search filters.`
                : 'Customers will automatically appear here once they place orders via the Smart QR table menu.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA] text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                  <th className="py-3 px-4">Guest Profile</th>
                  <th className="py-3 px-4">Phone & Verification</th>
                  <th className="py-3 px-4">Visits</th>
                  <th className="py-3 px-4">Lifetime Spend</th>
                  <th className="py-3 px-4">Avg Order</th>
                  <th className="py-3 px-4">Fav Table</th>
                  <th className="py-3 px-4">Marketing Opt-In</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F5] text-xs">
                {filteredCustomers.map((cust) => {
                  const isRepeat = cust.visitCount > 1;
                  const isSelected = cust.id === selectedCustomerId;

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => handleOpenCustomer(cust)}
                      className={`hover:bg-[#F9FAFB] cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-50/50' : ''
                      }`}
                    >
                      {/* Guest Profile & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#18181B] to-[#3F3F46] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {cust.name
                              ? cust.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()
                              : 'G'}
                          </div>
                          <div>
                            <div className="font-extrabold text-[#18181B] flex items-center gap-1.5">
                              <span>{cust.name || 'Anonymous Guest'}</span>
                              {isRepeat && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700">
                                  Repeat
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#71717A]">
                              First visit: {new Date(cust.firstVisit).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-[#18181B]">
                          {cust.phoneNumber || '—'}
                        </div>
                        <div className="mt-0.5">
                          {cust.phoneVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                              <ShieldCheck size={10} className="text-emerald-600" />
                              <span>Verified OTP</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.5 rounded-md">
                              Unverified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Visits */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#18181B] tnum">
                          {cust.visitCount} {cust.visitCount === 1 ? 'visit' : 'visits'}
                        </div>
                        <div className="text-[10px] text-[#71717A]">
                          {cust.totalOrders} total fires
                        </div>
                      </td>

                      {/* Lifetime Spend */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-emerald-700 font-heading tnum">
                          {formatINR(cust.totalSpent)}
                        </div>
                        <div className="text-[10px] text-[#71717A]">Lifetime bill</div>
                      </td>

                      {/* Avg Order Value */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#18181B] tnum">
                          {formatINR(cust.averageOrderValue)}
                        </div>
                      </td>

                      {/* Fav Table */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] font-bold text-[11px] text-[#18181B]">
                          Table {cust.preferredTable || '01'}
                        </span>
                      </td>

                      {/* Marketing Opt-In */}
                      <td className="py-3.5 px-4">
                        {cust.marketingConsent ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>Opted In</span>
                            </span>
                            {cust.marketingConsentAt && (
                              <div className="text-[9px] text-[#71717A]">
                                {new Date(cust.marketingConsentAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                            <XCircle size={10} className="text-[#A1A1AA]" />
                            <span>No Consent</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCustomer(cust);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[11px] font-bold text-[#18181B] inline-flex items-center gap-1 transition-all shadow-xs"
                        >
                          <Eye size={12} />
                          <span>History</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile & Order History Modal / Drawer */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#18181B] text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                  {activeCustomer.name
                    ? activeCustomer.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'G'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                      {activeCustomer.name || 'Anonymous Guest'}
                    </h3>
                    {activeCustomer.phoneVerified && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck size={11} />
                        <span>OTP Verified</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#71717A] flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{activeCustomer.phoneNumber}</span>
                    <span>•</span>
                    <span>ID: {activeCustomer.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-2 rounded-xl text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#F4F4F5] border border-[#E4E4E7]">
                  <div className="text-[10px] font-bold text-[#71717A]">Lifetime Spend</div>
                  <div className="text-base font-extrabold text-emerald-700 font-heading tnum mt-0.5">
                    {formatINR(activeCustomer.totalSpent)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#F4F4F5] border border-[#E4E4E7]">
                  <div className="text-[10px] font-bold text-[#71717A]">Visits</div>
                  <div className="text-base font-extrabold text-[#18181B] tnum mt-0.5">
                    {activeCustomer.visitCount} visits
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#F4F4F5] border border-[#E4E4E7]">
                  <div className="text-[10px] font-bold text-[#71717A]">Average Order</div>
                  <div className="text-base font-extrabold text-[#18181B] tnum mt-0.5">
                    {formatINR(activeCustomer.averageOrderValue)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#F4F4F5] border border-[#E4E4E7]">
                  <div className="text-[10px] font-bold text-[#71717A]">Preferred Table</div>
                  <div className="text-base font-extrabold text-[#18181B] font-heading mt-0.5">
                    Table {activeCustomer.preferredTable || '01'}
                  </div>
                </div>
              </div>

              {/* Marketing Consent Audit */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1.5">
                <div className="text-xs font-bold text-[#18181B] flex items-center justify-between">
                  <span>Marketing Consent Status:</span>
                  {activeCustomer.marketingConsent ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>Opted In</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-md">
                      No Consent
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  Source: <strong>{activeCustomer.marketingConsentSource || 'QR Table Checkout'}</strong>
                  {activeCustomer.marketingConsentAt && (
                    <span>
                      {' '}
                      • Timestamp: {new Date(activeCustomer.marketingConsentAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Preferred Items */}
              {activeCustomer.preferredItems && activeCustomer.preferredItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold font-heading text-[#18181B] flex items-center gap-1.5">
                    <Heart size={14} className="text-rose-500" />
                    <span>Customer's Favorite Dishes</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeCustomer.preferredItems.map((pref, i) => {
                      const itemObj = typeof pref === 'string' ? { name: pref, count: 1 } : pref;
                      return (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-xs font-bold text-[#18181B] flex items-center gap-2"
                        >
                          <span>{itemObj.name}</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-[#F76707] text-white text-[10px]">
                            {itemObj.count}x
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order History */}
              <div className="space-y-3">
                <div className="text-xs font-bold font-heading text-[#18181B] flex items-center justify-between">
                  <span>Complete Order History ({selectedCustomerOrders.length} orders)</span>
                  <span className="text-[10px] text-[#71717A] font-normal">
                    Synced with Kitchen Display & POS
                  </span>
                </div>

                {loadingDetails ? (
                  <div className="p-8 text-center text-[#71717A]">
                    <RefreshCw size={20} className="animate-spin mx-auto text-[#F76707]" />
                    <span className="text-[11px] mt-1 block">Loading order history...</span>
                  </div>
                ) : selectedCustomerOrders.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#F4F4F5] text-center text-[#71717A] text-xs">
                    No individual order slips recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedCustomerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-2xl border border-[#E4E4E7] bg-white shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold font-heading text-xs text-[#18181B]">
                              Order #{ord.orderNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[10px] font-bold text-[#52525B]">
                              Table {ord.tableNumber}
                            </span>
                          </div>
                          <div className="font-extrabold font-heading text-xs text-emerald-700 tnum">
                            {formatINR(ord.totalAmount)}
                          </div>
                        </div>

                        <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                          <Clock size={11} />
                          <span>
                            {new Date(ord.createdAt || ord.timestamp || Date.now()).toLocaleString()}
                          </span>
                        </div>

                        <div className="pt-1 border-t border-[#F4F4F5] flex flex-wrap gap-1.5">
                          {ord.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-[#FAFAFA] border border-[#E4E4E7] text-[#18181B]"
                            >
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E4E4E7] bg-[#FAFAFA] flex items-center justify-end">
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-xs font-bold hover:bg-[#27272A] transition-all"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

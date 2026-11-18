import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  Flame,
  Award,
  CreditCard,
  Users,
} from 'lucide-react';
import {
  CustomerCrmAnalytics,
  DailyOrderTrendPoint,
  RevenueCategoryBreakdown,
  RevenueDinerSegmentBreakdown,
} from '../../types/dcc';
import { formatINR } from '../../utils/formatters';

interface CustomerAnalyticsDashboardProps {
  analytics: CustomerCrmAnalytics;
}

// Custom Glassmorphism Tooltip for Daily Trends
const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: DailyOrderTrendPoint = payload[0].payload;
    return (
      <div className="bg-[#18181B] text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 text-xs space-y-2 backdrop-blur-md min-w-[200px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span className="font-extrabold font-heading text-white">{data.date}</span>
          <span className="text-[10px] text-[#A1A1AA] font-mono">{data.fullDate}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#F76707] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#F76707]" />
              <span>Orders Placed</span>
            </span>
            <span className="font-extrabold font-heading text-white tnum">{data.orders} orders</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Day's Revenue</span>
            </span>
            <span className="font-extrabold font-heading text-emerald-400 tnum">
              {formatINR(data.revenue)}
            </span>
          </div>
        </div>
        <div className="pt-1.5 border-t border-white/10 flex justify-between text-[10px] text-[#A1A1AA]">
          <span>Repeat Diners: {data.returningDiners}</span>
          <span>New Diners: {data.newDiners}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Revenue Distribution Pie
const CustomDistributionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[#18181B] text-white p-3 rounded-xl shadow-xl border border-white/10 text-xs space-y-1">
        <div className="font-extrabold font-heading flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.fill || item.color }} />
          <span>{item.name}</span>
        </div>
        <div className="text-emerald-400 font-bold text-sm tnum">
          {formatINR(item.value)}
        </div>
        <div className="text-[10px] text-[#A1A1AA]">
          Share of Total Revenue: <strong>{item.payload.percentage || Math.round((item.value / 25000) * 100)}%</strong>
        </div>
      </div>
    );
  }
  return null;
};

export const CustomerAnalyticsDashboard: React.FC<CustomerAnalyticsDashboardProps> = ({ analytics }) => {
  const [trendWindow, setTrendWindow] = useState<'7d' | '14d'>('14d');
  const [distributionView, setDistributionView] = useState<'category' | 'loyalty'>('category');

  // Filter daily trends by chosen window
  const displayedTrends = useMemo(() => {
    const all = analytics.dailyTrends || [];
    if (trendWindow === '7d') {
      return all.slice(Math.max(0, all.length - 7));
    }
    return all;
  }, [analytics.dailyTrends, trendWindow]);

  // Aggregate insights
  const peakOrdersDay = useMemo(() => {
    if (!displayedTrends.length) return null;
    return displayedTrends.reduce((max, d) => (d.orders > max.orders ? d : max), displayedTrends[0]);
  }, [displayedTrends]);

  const totalPeriodRevenue = useMemo(() => {
    return displayedTrends.reduce((sum, d) => sum + d.revenue, 0);
  }, [displayedTrends]);

  const totalPeriodOrders = useMemo(() => {
    return displayedTrends.reduce((sum, d) => sum + d.orders, 0);
  }, [displayedTrends]);

  const avgDailyOrders = useMemo(() => {
    if (!displayedTrends.length) return 0;
    return Math.round(totalPeriodOrders / displayedTrends.length);
  }, [totalPeriodOrders, displayedTrends]);

  // Categories data
  const categoryData = useMemo(() => {
    return (
      analytics.revenueByCategory || [
        { name: 'Tandoor & Starters', revenue: 8400, percentage: 34, color: '#F76707', ordersCount: 24 },
        { name: 'Curries & Gravies', revenue: 7200, percentage: 29, color: '#E11D48', ordersCount: 20 },
        { name: 'Biryani & Pulao', revenue: 4200, percentage: 17, color: '#8B5CF6', ordersCount: 14 },
        { name: 'Artisan Breads', revenue: 2700, percentage: 11, color: '#3B82F6', ordersCount: 38 },
        { name: 'Beverages', revenue: 1300, percentage: 5, color: '#10B981', ordersCount: 12 },
        { name: 'Desserts', revenue: 1000, percentage: 4, color: '#F59E0B', ordersCount: 8 },
      ]
    );
  }, [analytics.revenueByCategory]);

  // Loyalty segment data
  const loyaltyData = useMemo(() => {
    return (
      analytics.revenueByDinerSegment || [
        { segment: 'VIP Repeat Diners (3+ visits)', revenue: 13400, percentage: 54, color: '#8B5CF6' },
        { segment: 'Returning Guests (2 visits)', revenue: 6900, percentage: 28, color: '#F76707' },
        { segment: 'First-Time Diners (1 visit)', revenue: 4500, percentage: 18, color: '#10B981' },
      ]
    );
  }, [analytics.revenueByDinerSegment]);

  return (
    <div className="bg-white rounded-3xl border border-[#E4E4E7] shadow-xs overflow-hidden space-y-6 p-5 sm:p-6">
      {/* Dashboard Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F4F4F5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold font-heading text-[#18181B] tracking-tight">
              Order Trends & Revenue Distribution
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-600" />
              <span>Live Visual Engine</span>
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Recharts visualization of dining velocity, ticket value trajectories & menu revenue split
          </p>
        </div>

        {/* Time Window Switcher */}
        <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setTrendWindow('7d')}
            className={`px-3 py-1 rounded-lg transition-all ${
              trendWindow === '7d' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTrendWindow('14d')}
            className={`px-3 py-1 rounded-lg transition-all ${
              trendWindow === '14d' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            Last 14 Days
          </button>
        </div>
      </div>

      {/* KPI Performance Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
          <div className="flex items-center justify-between text-[#71717A] mb-1">
            <span className="text-[11px] font-bold">Window Revenue</span>
            <CreditCard size={14} className="text-emerald-600" />
          </div>
          <div className="text-lg font-extrabold font-heading text-emerald-700 tnum">
            {formatINR(totalPeriodRevenue)}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
            {displayedTrends.length} days captured
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
          <div className="flex items-center justify-between text-[#71717A] mb-1">
            <span className="text-[11px] font-bold">Total Window Orders</span>
            <TrendingUp size={14} className="text-[#F76707]" />
          </div>
          <div className="text-lg font-extrabold font-heading text-[#18181B] tnum">
            {totalPeriodOrders} orders
          </div>
          <div className="text-[10px] text-[#71717A] font-medium mt-0.5">
            Avg {avgDailyOrders} fires / day
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
          <div className="flex items-center justify-between text-[#71717A] mb-1">
            <span className="text-[11px] font-bold">Peak Dining Day</span>
            <Flame size={14} className="text-[#F76707]" />
          </div>
          <div className="text-lg font-extrabold font-heading text-[#18181B] tnum">
            {peakOrdersDay ? `${peakOrdersDay.orders} orders` : '—'}
          </div>
          <div className="text-[10px] text-[#F76707] font-bold mt-0.5">
            {peakOrdersDay ? `${peakOrdersDay.date} (${formatINR(peakOrdersDay.revenue)})` : 'Steady velocity'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7]">
          <div className="flex items-center justify-between text-[#71717A] mb-1">
            <span className="text-[11px] font-bold">Repeat Loyalty Impact</span>
            <Award size={14} className="text-purple-600" />
          </div>
          <div className="text-lg font-extrabold font-heading text-purple-700 tnum">
            82% Revenue
          </div>
          <div className="text-[10px] text-purple-600 font-bold mt-0.5">
            From 2+ visit repeat diners
          </div>
        </div>
      </div>

      {/* Visual Charts Grid: Daily Trends & Revenue Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 1: Daily Order Trends & Revenue Run (7 cols on large screens) */}
        <div className="lg:col-span-7 bg-[#FAFAFA] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold font-heading text-[#18181B] flex items-center gap-1.5">
                <TrendingUp size={15} className="text-[#F76707]" />
                <span>Daily Order Velocity & Revenue Curve</span>
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Day-by-day table ordering counts (orange) alongside total billing value (green)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-[#F76707]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F76707]" />
                <span>Orders</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Revenue (₹)</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F76707" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F76707" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#E4E4E7' }}
                  tick={{ fontSize: 10, fill: '#71717A', fontWeight: 600 }}
                />
                <YAxis
                  yAxisId="ordersAxis"
                  orientation="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#71717A', fontWeight: 600 }}
                />
                <YAxis
                  yAxisId="revenueAxis"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                  tick={{ fontSize: 10, fill: '#10B981', fontWeight: 600 }}
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Area
                  yAxisId="ordersAxis"
                  type="monotone"
                  dataKey="orders"
                  stroke="#F76707"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#orderGrad)"
                  name="Orders"
                  activeDot={{ r: 5, fill: '#F76707', stroke: '#fff', strokeWidth: 2 }}
                />
                <Area
                  yAxisId="revenueAxis"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revGrad)"
                  name="Revenue"
                  activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Revenue Distribution (5 cols on large screens) */}
        <div className="lg:col-span-5 bg-[#FAFAFA] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold font-heading text-[#18181B] flex items-center gap-1.5">
                <PieIcon size={15} className="text-emerald-600" />
                <span>Revenue Distribution</span>
              </h3>
              {/* Category vs Loyalty segment view toggle */}
              <div className="flex bg-white p-0.5 rounded-lg border border-[#E4E4E7] text-[10px] font-bold">
                <button
                  onClick={() => setDistributionView('category')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    distributionView === 'category' ? 'bg-[#18181B] text-white' : 'text-[#71717A]'
                  }`}
                >
                  By Menu
                </button>
                <button
                  onClick={() => setDistributionView('loyalty')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    distributionView === 'loyalty' ? 'bg-[#18181B] text-white' : 'text-[#71717A]'
                  }`}
                >
                  By Diners
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#71717A]">
              {distributionView === 'category'
                ? 'Sales contribution across food categories'
                : 'Revenue generated by repeat vs first-time guest tiers'}
            </p>
          </div>

          {/* Donut Chart */}
          <div className="h-44 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              {distributionView === 'category' ? (
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDistributionTooltip />} />
                </PieChart>
              ) : (
                <PieChart>
                  <Pie
                    data={loyaltyData}
                    dataKey="revenue"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {loyaltyData.map((entry, index) => (
                      <Cell key={`cell-loyalty-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDistributionTooltip />} />
                </PieChart>
              )}
            </ResponsiveContainer>

            {/* Central Donut Total Value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-[#71717A]">Total</span>
              <span className="text-xs font-extrabold font-heading text-[#18181B] tnum">
                {formatINR(totalPeriodRevenue)}
              </span>
            </div>
          </div>

          {/* Distribution Breakdown Legend Table */}
          <div className="space-y-1.5 pt-1 border-t border-[#E4E4E7]">
            {distributionView === 'category'
              ? categoryData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[#18181B] font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 tnum shrink-0">
                      <span className="font-bold text-[#18181B]">{formatINR(item.revenue)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white border border-[#E4E4E7] text-[#52525B]">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))
              : loyaltyData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[#18181B] font-medium truncate">{item.segment}</span>
                    </div>
                    <div className="flex items-center gap-2 tnum shrink-0">
                      <span className="font-bold text-[#18181B]">{formatINR(item.revenue)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white border border-[#E4E4E7] text-[#52525B]">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
};

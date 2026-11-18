import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  BarChart3,
  Clock,
  Table2,
  Award,
  Flame,
  MapPin,
  Star,
  Utensils,
} from 'lucide-react';
import { Order, RestaurantTable, WaiterRequest } from '../../types/dcc';
import { formatINR } from '../../utils/formatters';

interface DashboardOverviewProps {
  orders: Order[];
  tables: RestaurantTable[];
  waiterRequests?: WaiterRequest[];
  onNavigateTo: (view: any) => void;
}

interface TablePerformanceRow {
  tableId: string;
  tableNumber: string;
  tableName: string;
  zone: string;
  capacity?: number;
  status: string;
  ordersCount: number;
  paidOrdersCount: number;
  totalRevenue: number;
  paidRevenue: number;
  avgTurnaroundMinutes: number | null;
  turnaroundSampleCount: number;
  avgTicketValue: number;
}

const normalizeTableNum = (raw?: string) => {
  const clean = String(raw || '')
    .replace(/^Table\s*/i, '')
    .trim();
  if (!clean) return '';
  return /^\d+$/.test(clean) ? clean.padStart(2, '0') : clean.toLowerCase();
};

const formatTurnaroundLabel = (mins: number | null) => {
  if (mins === null) return '—';
  if (mins < 1) return '< 1 min';
  const rounded = Math.round(mins * 10) / 10;
  return `${rounded} mins`;
};

const formatRelativeOrderAge = (ts: number) => {
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
};

// Lightweight inline SVG sparkline matching the clean KPI cards in d.cc overview
const MiniSparkline: React.FC<{ values: number[]; gradientId: string; strokeColor?: string }> = ({
  values,
  gradientId,
  strokeColor = '#F76707',
}) => {
  const points = values.length >= 2 ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...points);
  const w = 180;
  const h = 44;
  const coords = points.map((v, i) => {
    const x = (i / Math.max(1, points.length - 1)) * w;
    const y = h - 4 - (v / max) * (h - 10);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });

  const linePath = coords.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = coords[i - 1];
    const cx = Math.round(((px + x) / 2) * 10) / 10;
    return `${acc} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, '');

  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  orders,
  tables,
  waiterRequests = [],
  onNavigateTo,
}) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week'>('today');
  const [tableSort, setTableSort] = useState<'revenue' | 'turnaround' | 'table'>('revenue');
  const [heatmapZoneFilter, setHeatmapZoneFilter] = useState<string>('all');

  const {
    filteredOrders,
    recentOrders,
    totalSales,
    totalOrders,
    avgOrderValue,
    cookingOrdersCount,
    completedOrdersCount,
    paidOrdersCount,
    pendingPaymentCount,
    salesDeltaPercent,
    previousPeriodHasData,
    hourlyData,
    weeklyCurve,
    peakDayPoint,
    peakBucket,
    maxSales,
    avgPrepMinutes,
    prepSampleCount,
    avgWaiterSeconds,
    waiterSampleCount,
    avgRating,
    ratingSampleCount,
    tablePerformanceRows,
    maxTableRevenue,
    topRevenueTable,
    fastestTurnaroundTable,
  } = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const yesterdayStartMs = todayStartMs - 86400000;
    const weekStartMs = now - 7 * 86400000;
    const prevWeekStartMs = now - 14 * 86400000;

    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const currentOrders = validOrders.filter((o) =>
      timeframe === 'today' ? o.placedAt >= todayStartMs : o.placedAt >= weekStartMs
    );
    const previousOrders = validOrders.filter((o) =>
      timeframe === 'today'
        ? o.placedAt >= yesterdayStartMs && o.placedAt < todayStartMs
        : o.placedAt >= prevWeekStartMs && o.placedAt < weekStartMs
    );

    const sales = currentOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
    const prevSales = previousOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
    const delta = prevSales > 0 ? Math.round(((sales - prevSales) / prevSales) * 1000) / 10 : null;

    const count = currentOrders.length;
    const aov = count > 0 ? Math.round(sales / count) : 0;
    const cooking = currentOrders.filter((o) =>
      ['received', 'accepted', 'preparing'].includes(o.status)
    ).length;
    const completed = currentOrders.filter((o) => o.status === 'served').length;
    const paid = currentOrders.filter((o) => o.paymentStatus === 'paid').length;
    const pendingPay = count - paid;

    // Recent orders slice sorted newest first
    const recent = [...validOrders]
      .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0))
      .slice(0, 5);

    // 7-day rolling revenue/order curve for Sales Overview chart
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekPoints: Array<{ label: string; sales: number; orders: number }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(todayStartMs - offset * 86400000);
      const start = d.getTime();
      const end = start + 86400000;
      const dayOrders = validOrders.filter((o) => o.placedAt >= start && o.placedAt < end);
      weekPoints.push({
        label: dayLabels[d.getDay()],
        sales: dayOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0),
        orders: dayOrders.length,
      });
    }
    const peakDay =
      weekPoints.length > 0
        ? weekPoints.reduce((best, cur) => (cur.sales > best.sales ? cur : best), weekPoints[0])
        : null;

    // Build real hourly buckets
    const bucketsMap = new Map<number, { hourNum: number; hour: string; orders: number; sales: number }>();
    const defaultHours = [12, 13, 14, 15, 19, 20, 21, 22];
    const formatHourLabel = (h: number) => {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    };

    defaultHours.forEach((h) => {
      bucketsMap.set(h, { hourNum: h, hour: formatHourLabel(h), orders: 0, sales: 0 });
    });

    currentOrders.forEach((o) => {
      const h = new Date(o.placedAt).getHours();
      const existing = bucketsMap.get(h) || {
        hourNum: h,
        hour: formatHourLabel(h),
        orders: 0,
        sales: 0,
      };
      existing.orders += 1;
      existing.sales += Number(o.grandTotal) || 0;
      bucketsMap.set(h, existing);
    });

    const buckets = Array.from(bucketsMap.values()).sort((a, b) => a.hourNum - b.hourNum);
    const maxS = Math.max(0, ...buckets.map((b) => b.sales));
    const peak = maxS > 0 ? buckets.reduce((best, cur) => (cur.sales > best.sales ? cur : best), buckets[0]) : null;

    // Real Avg Prep Time
    const prepSamples = currentOrders
      .map((o) => {
        const end = o.preparedAt || o.servedAt;
        if (!end || !o.placedAt || end < o.placedAt) return null;
        return (end - o.placedAt) / 60000;
      })
      .filter((v): v is number => v !== null);
    const avgPrep =
      prepSamples.length > 0
        ? Math.round((prepSamples.reduce((s, v) => s + v, 0) / prepSamples.length) * 10) / 10
        : null;

    // Real Waiter Response Time
    const scopedRequests = waiterRequests.filter((r) =>
      timeframe === 'today' ? r.timestamp >= todayStartMs : r.timestamp >= weekStartMs
    );
    const waiterSamples = scopedRequests
      .map((r) => {
        if (!r.resolvedAt || !r.timestamp || r.resolvedAt < r.timestamp) return null;
        return Math.round((r.resolvedAt - r.timestamp) / 1000);
      })
      .filter((v): v is number => v !== null);
    const avgWaiter =
      waiterSamples.length > 0
        ? Math.round(waiterSamples.reduce((s, v) => s + v, 0) / waiterSamples.length)
        : null;

    // Real Customer Rating
    const rated = validOrders.filter((o) => typeof o.customerRating === 'number' && o.customerRating > 0);
    const ratingAvg =
      rated.length > 0
        ? Math.round((rated.reduce((s, o) => s + (o.customerRating || 0), 0) / rated.length) * 10) / 10
        : null;

    // Table Performance breakdown per Table ID
    const tableAccumMap = new Map<
      string,
      {
        tableId: string;
        tableNumber: string;
        tableName: string;
        zone: string;
        capacity?: number;
        status: string;
        orders: Order[];
      }
    >();

    tables.forEach((t) => {
      tableAccumMap.set(t.id, {
        tableId: t.id,
        tableNumber: t.number,
        tableName: t.name || `Table ${t.number}`,
        zone: t.zone || 'Main Dining',
        capacity: t.capacity,
        status: t.status || 'available',
        orders: [],
      });
    });

    currentOrders.forEach((o) => {
      const ordNorm = normalizeTableNum(o.tableNumber);
      const matchedTable =
        tables.find((t) => t.id === o.tableId) ||
        tables.find((t) => normalizeTableNum(t.number) === ordNorm);

      if (matchedTable) {
        const entry = tableAccumMap.get(matchedTable.id);
        if (entry) entry.orders.push(o);
      } else {
        const fallbackId = o.tableId || `tbl-${ordNorm || 'unassigned'}`;
        const existing = tableAccumMap.get(fallbackId) || {
          tableId: fallbackId,
          tableNumber: o.tableNumber || '—',
          tableName: o.tableNumber ? `Table ${o.tableNumber}` : 'Unassigned Table',
          zone: 'Floor',
          status: 'available',
          orders: [],
        };
        existing.orders.push(o);
        tableAccumMap.set(fallbackId, existing);
      }
    });

    const tableRows: TablePerformanceRow[] = Array.from(tableAccumMap.values()).map((entry) => {
      const rev = entry.orders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0);
      const paidList = entry.orders.filter(
        (o) => o.paymentStatus === 'paid' || o.paymentStatus === 'verified_by_staff'
      );
      const paidRev = paidList.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0);

      const turnaroundSamples = entry.orders
        .map((o) => {
          const completionMs = Math.max(o.paidAt || 0, o.servedAt || 0) || o.preparedAt || 0;
          if (!completionMs || !o.placedAt || completionMs < o.placedAt) return null;
          return (completionMs - o.placedAt) / 60000;
        })
        .filter((v): v is number => v !== null);

      const avgTurn =
        turnaroundSamples.length > 0
          ? Math.round(
              (turnaroundSamples.reduce((s, v) => s + v, 0) / turnaroundSamples.length) * 10
            ) / 10
          : null;

      return {
        tableId: entry.tableId,
        tableNumber: entry.tableNumber,
        tableName: entry.tableName,
        zone: entry.zone,
        capacity: entry.capacity,
        status: entry.status,
        ordersCount: entry.orders.length,
        paidOrdersCount: paidList.length,
        totalRevenue: rev,
        paidRevenue: paidRev,
        avgTurnaroundMinutes: avgTurn,
        turnaroundSampleCount: turnaroundSamples.length,
        avgTicketValue: entry.orders.length > 0 ? Math.round(rev / entry.orders.length) : 0,
      };
    });

    const maxTblRev = Math.max(0, ...tableRows.map((r) => r.totalRevenue));
    const topRevTable =
      maxTblRev > 0
        ? tableRows.reduce((best, cur) => (cur.totalRevenue > best.totalRevenue ? cur : best), tableRows[0])
        : null;
    const withTurnaround = tableRows.filter((r) => r.avgTurnaroundMinutes !== null);
    const fastestTurnTable =
      withTurnaround.length > 0
        ? withTurnaround.reduce((best, cur) =>
            (cur.avgTurnaroundMinutes ?? Infinity) < (best.avgTurnaroundMinutes ?? Infinity)
              ? cur
              : best
          )
        : null;

    return {
      filteredOrders: currentOrders,
      recentOrders: recent,
      totalSales: sales,
      totalOrders: count,
      avgOrderValue: aov,
      cookingOrdersCount: cooking,
      completedOrdersCount: completed,
      paidOrdersCount: paid,
      pendingPaymentCount: pendingPay,
      salesDeltaPercent: delta,
      previousPeriodHasData: prevSales > 0,
      hourlyData: buckets,
      weeklyCurve: weekPoints,
      peakDayPoint: peakDay,
      peakBucket: peak,
      maxSales: maxS,
      avgPrepMinutes: avgPrep,
      prepSampleCount: prepSamples.length,
      avgWaiterSeconds: avgWaiter,
      waiterSampleCount: waiterSamples.length,
      avgRating: ratingAvg,
      ratingSampleCount: rated.length,
      tablePerformanceRows: tableRows,
      maxTableRevenue: maxTblRev,
      topRevenueTable: topRevTable,
      fastestTurnaroundTable: fastestTurnTable,
    };
  }, [orders, tables, waiterRequests, timeframe]);

  const sortedTableRows = useMemo(() => {
    const copy = [...tablePerformanceRows];
    if (tableSort === 'revenue') {
      return copy.sort((a, b) => b.totalRevenue - a.totalRevenue || a.tableNumber.localeCompare(b.tableNumber));
    }
    if (tableSort === 'turnaround') {
      return copy.sort((a, b) => {
        if (a.avgTurnaroundMinutes === null && b.avgTurnaroundMinutes === null) {
          return b.totalRevenue - a.totalRevenue;
        }
        if (a.avgTurnaroundMinutes === null) return 1;
        if (b.avgTurnaroundMinutes === null) return -1;
        return a.avgTurnaroundMinutes - b.avgTurnaroundMinutes;
      });
    }
    return copy.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
  }, [tablePerformanceRows, tableSort]);

  const activeTablesCount = tables.filter((t) => t.status !== 'available').length;
  const occupancyPercent = tables.length > 0 ? Math.round((activeTablesCount / tables.length) * 100) : 0;

  // Real-time Occupancy & Wait Time Heatmap computation
  const { heatmapZones, heatmapCells, heatmapCounts } = useMemo(() => {
    const nowMs = Date.now();
    const zoneSet = new Set<string>();
    const counts = {
      available: 0,
      smooth: 0,
      warm: 0,
      critical: 0,
      needs_cleaning: 0,
    };

    const cells = tables
      .slice()
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
      .map((t) => {
        const zone = (t.zone || 'Main Dining').trim();
        zoneSet.add(zone);
        const normNum = normalizeTableNum(t.number);

        const tableOrders = orders.filter((o) => {
          if (o.status === 'cancelled') return false;
          return o.tableId === t.id || normalizeTableNum(o.tableNumber) === normNum;
        });

        const openOrders = tableOrders.filter(
          (o) => o.status !== 'served' && o.paymentStatus !== 'paid'
        );

        const openCalls = waiterRequests.filter(
          (r) =>
            r.status !== 'resolved' &&
            (normalizeTableNum(r.tableNumber) === normNum || r.tableId === t.id)
        );

        const earliestActiveTs = [
          ...openOrders.map((o) => o.placedAt),
          ...openCalls.map((r) => r.timestamp),
        ].filter((ts) => typeof ts === 'number' && ts > 0);
        const liveWaitMinutes =
          earliestActiveTs.length > 0
            ? Math.max(0, Math.round((nowMs - Math.min(...earliestActiveTs)) / 60000))
            : null;

        const perfRow = tablePerformanceRows.find((r) => r.tableId === t.id);
        const avgWaitMinutes = perfRow?.avgTurnaroundMinutes ?? null;

        let heatLevel: 'available' | 'smooth' | 'warm' | 'critical' | 'needs_cleaning' = 'available';
        let heatLabel = 'Available';

        if (t.status === 'needs_cleaning') {
          heatLevel = 'needs_cleaning';
          heatLabel = 'Needs Cleaning';
        } else if (
          t.status === 'waiting_waiter' ||
          t.status === 'bill_requested' ||
          openCalls.length > 0 ||
          (liveWaitMinutes !== null && liveWaitMinutes >= 20)
        ) {
          heatLevel = 'critical';
          heatLabel =
            openCalls.length > 0 || t.status === 'waiting_waiter'
              ? 'Waiter Alert'
              : t.status === 'bill_requested'
              ? 'Bill Pending'
              : 'High Wait';
        } else if (t.status === 'new_order' || (liveWaitMinutes !== null && liveWaitMinutes >= 10)) {
          heatLevel = 'warm';
          heatLabel = liveWaitMinutes !== null && liveWaitMinutes >= 10 ? 'Elevated Wait' : 'New Order';
        } else if (t.status === 'occupied' || openOrders.length > 0) {
          heatLevel = 'smooth';
          heatLabel = 'Occupied';
        } else {
          heatLevel = 'available';
          heatLabel = 'Available';
        }

        counts[heatLevel] += 1;

        return {
          table: t,
          zone,
          heatLevel,
          heatLabel,
          liveWaitMinutes,
          avgWaitMinutes,
          activeOrdersCount: openOrders.length,
          openCallsCount: openCalls.length,
        };
      });

    return {
      heatmapZones: Array.from(zoneSet),
      heatmapCells: cells,
      heatmapCounts: counts,
    };
  }, [tables, orders, waiterRequests, tablePerformanceRows]);

  const visibleHeatmapCells = useMemo(() => {
    if (heatmapZoneFilter === 'all') return heatmapCells;
    return heatmapCells.filter((c) => c.zone === heatmapZoneFilter);
  }, [heatmapCells, heatmapZoneFilter]);

  // Smooth SVG path coordinates for Sales Overview chart
  const salesChartData = useMemo(() => {
    const pts = weeklyCurve.length > 0 ? weeklyCurve : [{ label: 'Today', sales: 0, orders: 0 }];
    const w = 520;
    const h = 150;
    const maxV = Math.max(100, ...pts.map((p) => p.sales));
    const coords = pts.map((p, idx) => {
      const x = 16 + (idx / Math.max(1, pts.length - 1)) * (w - 32);
      const y = h - 18 - (p.sales / maxV) * (h - 38);
      return {
        ...p,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    });
    const linePath = coords.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = coords[i - 1];
      const cx = Math.round(((prev.x + pt.x) / 2) * 10) / 10;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x} ${h - 14} L ${coords[0].x} ${h - 14} Z`
        : '';
    const peakIndex = coords.reduce(
      (bestIdx, pt, idx) => (pt.sales > coords[bestIdx].sales ? idx : bestIdx),
      0
    );
    return { w, h, coords, linePath, areaPath, peakIndex, hasAnySales: pts.some((p) => p.sales > 0) };
  }, [weeklyCurve]);

  const sparkOrdersSeries = weeklyCurve.map((p) => p.orders);
  const sparkSalesSeries = weeklyCurve.map((p) => p.sales);
  const sparkHourlySeries = hourlyData.map((b) => b.orders);

  return (
    <div className="space-y-5">
      {/* Period Selector Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold font-heading text-[#18181B] dark:text-white flex items-center gap-2">
            <span>Performance Overview</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
              Live Sync
            </span>
          </h2>
          <p className="text-xs text-[#71717A] dark:text-slate-400">
            Real-time orders, floor occupancy, kitchen speed &amp; table revenue
          </p>
        </div>

        <div className="flex bg-[#F4F4F5] dark:bg-[#14151D] border border-transparent dark:border-white/10 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setTimeframe('today')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeframe === 'today'
                ? 'bg-white dark:bg-[#232533] text-[#18181B] dark:text-white shadow-2xs'
                : 'text-[#71717A] dark:text-slate-400'
            }`}
          >
            Today&apos;s Service
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeframe === 'week'
                ? 'bg-white dark:bg-[#232533] text-[#18181B] dark:text-white shadow-2xs'
                : 'text-[#71717A] dark:text-slate-400'
            }`}
          >
            Last 7 Days
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards with Inline Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] dark:bg-orange-500/15 text-[#F76707] flex items-center justify-center shrink-0">
              <ShoppingBag size={17} />
            </div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tnum">
              {completedOrdersCount} served • {cookingOrdersCount} active
            </span>
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-[#18181B] dark:text-white tnum">
              {totalOrders}
            </div>
            <div className="text-xs font-medium text-[#71717A] dark:text-slate-400">
              {timeframe === 'today' ? 'Total Orders Today' : 'Total Orders (7d)'}
            </div>
          </div>
          <MiniSparkline values={sparkOrdersSeries} gradientId="kpiSparkOrders" />
        </div>

        {/* Card 2: Active Tables */}
        <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] dark:bg-amber-500/15 text-[#D97706] flex items-center justify-center shrink-0">
              <Users size={17} />
            </div>
            <span className="text-[11px] font-bold text-[#D97706] dark:text-amber-400 tnum">
              {occupancyPercent}% occupied
            </span>
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-[#18181B] dark:text-white tnum">
              {activeTablesCount} / {tables.length}
            </div>
            <div className="text-xs font-medium text-[#71717A] dark:text-slate-400">
              Active Floor Tables
            </div>
          </div>
          <MiniSparkline
            values={sparkHourlySeries}
            gradientId="kpiSparkTables"
            strokeColor="#D97706"
          />
        </div>

        {/* Card 3: Total Revenue */}
        <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] dark:bg-emerald-500/15 text-[#16A34A] flex items-center justify-center shrink-0">
              <IndianRupee size={17} />
            </div>
            {previousPeriodHasData && salesDeltaPercent !== null ? (
              <span
                className={`text-[11px] font-bold flex items-center gap-0.5 tnum ${
                  salesDeltaPercent >= 0
                    ? 'text-[#16A34A] dark:text-emerald-400'
                    : 'text-[#DC2626] dark:text-rose-400'
                }`}
              >
                {salesDeltaPercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {salesDeltaPercent >= 0 ? '+' : ''}
                {salesDeltaPercent}%
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[#71717A] dark:text-slate-400 tnum">
                AOV {formatINR(avgOrderValue)}
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-[#18181B] dark:text-white tnum">
              {formatINR(totalSales)}
            </div>
            <div className="text-xs font-medium text-[#71717A] dark:text-slate-400">
              Total Table Revenue ({paidOrdersCount}/{totalOrders} paid)
            </div>
          </div>
          <MiniSparkline
            values={sparkSalesSeries}
            gradientId="kpiSparkSales"
            strokeColor="#16A34A"
          />
        </div>

        {/* Card 4: Customer Rating / AOV */}
        <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] dark:bg-violet-500/15 text-[#F76707] dark:text-violet-400 flex items-center justify-center shrink-0">
              <Star size={17} className="fill-current" />
            </div>
            <span className="text-[11px] font-bold text-[#71717A] dark:text-slate-400 tnum">
              {ratingSampleCount > 0 ? `${ratingSampleCount} reviews` : `${pendingPaymentCount} unpaid`}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-[#18181B] dark:text-white tnum">
              {avgRating !== null ? `${avgRating} ★` : formatINR(avgOrderValue)}
            </div>
            <div className="text-xs font-medium text-[#71717A] dark:text-slate-400">
              {avgRating !== null ? 'Customer Rating' : 'Average Order Value'}
            </div>
          </div>
          <MiniSparkline
            values={sparkSalesSeries.map((v, i) => (v > 0 ? v : i * 10))}
            gradientId="kpiSparkRating"
            strokeColor="#8B5CF6"
          />
        </div>
      </div>

      {/* Sales Overview Curve + Recent Orders Feed (Inspired by Reference Light Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Sales Overview Area Curve */}
        <div className="lg:col-span-7 bg-white dark:bg-[#14151D] rounded-2xl p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold font-heading text-[#18181B] dark:text-white">
                Sales Overview
              </h3>
              <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
                <span className="text-2xl font-black font-heading text-[#18181B] dark:text-white tnum">
                  {formatINR(weeklyCurve.reduce((s, d) => s + d.sales, 0))}
                </span>
                {peakDayPoint && peakDayPoint.sales > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tnum">
                    Peak {peakDayPoint.label}: {formatINR(peakDayPoint.sales)}
                  </span>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl border border-[#E4E4E7] dark:border-white/10 bg-[#FAFAFA] dark:bg-white/5 text-[11px] font-bold text-[#52525B] dark:text-slate-300">
              Last 7 Days
            </span>
          </div>

          <div className="w-full pt-2">
            <svg
              viewBox={`0 0 ${salesChartData.w} ${salesChartData.h}`}
              className="w-full h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="salesOverviewAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F76707" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#F76707" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1="12"
                  x2={salesChartData.w - 12}
                  y1={Math.round((salesChartData.h - 14) * ratio)}
                  y2={Math.round((salesChartData.h - 14) * ratio)}
                  className="stroke-[#F4F4F5] dark:stroke-white/5"
                  strokeWidth="1"
                />
              ))}
              {salesChartData.areaPath && (
                <path d={salesChartData.areaPath} fill="url(#salesOverviewAreaGrad)" />
              )}
              {salesChartData.linePath && (
                <path
                  d={salesChartData.linePath}
                  fill="none"
                  stroke="#F76707"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
              {salesChartData.coords.map((pt, i) => {
                const isPeak = salesChartData.hasAnySales && i === salesChartData.peakIndex;
                return (
                  <g key={`${pt.label}-${i}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isPeak ? 5 : 3.5}
                      fill={isPeak ? '#F76707' : '#FFFFFF'}
                      stroke="#F76707"
                      strokeWidth="2"
                    />
                    {isPeak && (
                      <g transform={`translate(${Math.min(salesChartData.w - 72, Math.max(10, pt.x - 36))}, ${Math.max(0, pt.y - 28)})`}>
                        <rect width="74" height="20" rx="6" fill="#F76707" />
                        <text
                          x="37"
                          y="13.5"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {formatINR(pt.sales)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-between px-2 text-[11px] font-semibold text-[#71717A] dark:text-slate-400">
              {salesChartData.coords.map((pt, idx) => (
                <span key={idx}>{pt.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Recent Orders Live Feed */}
        <div className="lg:col-span-5 bg-white dark:bg-[#14151D] rounded-2xl p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-extrabold font-heading text-[#18181B] dark:text-white">
              Recent Orders
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTo('kds')}
              className="text-xs font-bold text-[#F76707] hover:underline flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-dashed border-[#E4E4E7] dark:border-white/10 space-y-1.5">
              <Utensils size={22} className="text-[#A1A1AA]" />
              <div className="text-xs font-bold text-[#18181B] dark:text-white">
                No recent orders yet
              </div>
              <p className="text-[11px] text-[#71717A] dark:text-slate-400">
                Customer QR table orders will stream here in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F4F4F5] dark:divide-white/5">
              {recentOrders.map((ord) => {
                const leadItem =
                  ord.items[0]?.name ||
                  `Table ${ord.tableNumber} Order`;
                const extraCount = ord.items.length > 1 ? ` +${ord.items.length - 1}` : '';
                const isDone = ord.status === 'served' || ord.paymentStatus === 'paid';
                return (
                  <div
                    key={ord.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] dark:bg-orange-500/15 text-[#F76707] flex items-center justify-center shrink-0">
                        <Utensils size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#18181B] dark:text-white truncate">
                          {leadItem}
                          {extraCount}
                        </div>
                        <div className="text-[11px] text-[#71717A] dark:text-slate-400 truncate">
                          Table {ord.tableNumber} • {formatRelativeOrderAge(ord.placedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold font-heading text-[#18181B] dark:text-white tnum">
                        {formatINR(ord.grandTotal)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${
                          isDone
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isDone ? 'Completed' : ord.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Visual Occupancy & Wait Time Heatmap Widget */}
      <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] dark:bg-orange-500/15 text-[#F76707] flex items-center justify-center shrink-0">
              <Flame size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold font-heading text-[#18181B] dark:text-white flex flex-wrap items-center gap-2">
                <span>Live Floor Occupancy &amp; Wait Time Heatmap</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] dark:text-emerald-400 border border-[#16A34A]/25">
                  {occupancyPercent}% Occupied
                </span>
              </h3>
              <p className="text-xs text-[#71717A] dark:text-slate-400">
                Color-coded real-time table occupancy, active wait timers &amp; historical average wait time
              </p>
            </div>
          </div>

          {heatmapZones.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setHeatmapZoneFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                  heatmapZoneFilter === 'all'
                    ? 'bg-[#18181B] dark:bg-[#F76707] text-white border-[#18181B] dark:border-[#F76707]'
                    : 'bg-[#FAFAFA] dark:bg-white/5 text-[#52525B] dark:text-slate-300 border-[#E4E4E7] dark:border-white/10 hover:border-[#F76707]'
                }`}
              >
                All Zones ({heatmapCells.length})
              </button>
              {heatmapZones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setHeatmapZoneFilter(zone)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1 cursor-pointer ${
                    heatmapZoneFilter === zone
                      ? 'bg-[#18181B] dark:bg-[#F76707] text-white border-[#18181B] dark:border-[#F76707]'
                      : 'bg-[#FAFAFA] dark:bg-white/5 text-[#52525B] dark:text-slate-300 border-[#E4E4E7] dark:border-white/10 hover:border-[#F76707]'
                  }`}
                >
                  <MapPin size={10} />
                  <span>{zone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap Color Legend Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold bg-[#FAFAFA] dark:bg-white/5 px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-white/10">
          <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Available ({heatmapCounts.available})</span>
          </span>
          <span className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>Occupied &lt;10m ({heatmapCounts.smooth})</span>
          </span>
          <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Busy 10–19m ({heatmapCounts.warm})</span>
          </span>
          <span className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span>High Wait 20m+ / Alert ({heatmapCounts.critical})</span>
          </span>
          <span className="flex items-center gap-1.5 text-violet-800 dark:text-violet-300">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
            <span>Needs Cleaning ({heatmapCounts.needs_cleaning})</span>
          </span>
        </div>

        {/* Heatmap Grid */}
        {visibleHeatmapCells.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-dashed border-[#E4E4E7] dark:border-white/10 text-center space-y-1.5">
            <Table2 size={24} className="text-[#A1A1AA] mx-auto" />
            <div className="text-xs font-bold text-[#18181B] dark:text-white">No tables to visualize</div>
            <p className="text-[11px] text-[#71717A] dark:text-slate-400">
              Add tables in Floor &amp; QR Setup to render the live occupancy heatmap.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {visibleHeatmapCells.map((cell) => {
              const palette =
                cell.heatLevel === 'critical'
                  ? {
                      card: 'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-500/40 hover:border-rose-400 text-rose-950 dark:text-rose-100',
                      dot: 'bg-rose-600',
                      badge: 'bg-rose-600 text-white',
                      wait: 'text-rose-700 dark:text-rose-300',
                      ping: true,
                    }
                  : cell.heatLevel === 'warm'
                  ? {
                      card: 'bg-amber-50 dark:bg-amber-950/35 border-amber-300 dark:border-amber-500/40 hover:border-amber-400 text-amber-950 dark:text-amber-100',
                      dot: 'bg-amber-500',
                      badge: 'bg-amber-500 text-white',
                      wait: 'text-amber-800 dark:text-amber-300',
                      ping: false,
                    }
                  : cell.heatLevel === 'smooth'
                  ? {
                      card: 'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-500/40 hover:border-blue-400 text-blue-950 dark:text-blue-100',
                      dot: 'bg-blue-600',
                      badge: 'bg-blue-600 text-white',
                      wait: 'text-blue-800 dark:text-blue-300',
                      ping: false,
                    }
                  : cell.heatLevel === 'needs_cleaning'
                  ? {
                      card: 'bg-violet-50 dark:bg-violet-950/35 border-violet-300 dark:border-violet-500/40 hover:border-violet-400 text-violet-950 dark:text-violet-100',
                      dot: 'bg-violet-600',
                      badge: 'bg-violet-600 text-white',
                      wait: 'text-violet-800 dark:text-violet-300',
                      ping: false,
                    }
                  : {
                      card: 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 text-emerald-950 dark:text-emerald-100',
                      dot: 'bg-emerald-500',
                      badge: 'bg-emerald-600 text-white',
                      wait: 'text-emerald-800 dark:text-emerald-300',
                      ping: false,
                    };

              return (
                <button
                  key={cell.table.id}
                  type="button"
                  onClick={() => onNavigateTo('floor')}
                  className={`text-left p-3 rounded-2xl border-2 transition-all space-y-2 shadow-2xs min-w-0 cursor-pointer ${palette.card}`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold font-heading truncate">
                        T{cell.table.number}
                      </div>
                      <div className="text-[10px] opacity-75 truncate">{cell.zone}</div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <span className="relative flex h-2.5 w-2.5">
                        {palette.ping && (
                          <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${palette.dot}`}
                          />
                        )}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${palette.dot}`} />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate ${palette.badge}`}>
                      {cell.heatLabel}
                    </span>
                    <span className="text-[10px] font-bold tnum opacity-80 shrink-0">
                      {cell.table.activeDinersCount ?? 0}/{cell.table.capacity}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[10px]">
                    <div>
                      <span className="opacity-70 block leading-none">Avg Wait</span>
                      <span className={`font-extrabold tnum ${palette.wait}`}>
                        {cell.avgWaitMinutes !== null ? `${cell.avgWaitMinutes}m` : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="opacity-70 block leading-none">Live</span>
                      <span className="font-extrabold tnum">
                        {cell.liveWaitMinutes !== null ? `${cell.liveWaitMinutes}m` : '—'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hourly Sales Visual Chart & KDS Speed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#14151D] rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold font-heading text-[#18181B] dark:text-white">
                Hourly Revenue Distribution
              </h3>
              <p className="text-xs text-[#71717A] dark:text-slate-400">
                Computed directly from live table orders
              </p>
            </div>
            {peakBucket && (
              <span className="text-xs font-bold text-[#F76707] bg-[#FFDBCC]/40 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full">
                Peak Hour: {peakBucket.hour} ({formatINR(peakBucket.sales)})
              </span>
            )}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="h-44 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-dashed border-[#E4E4E7] dark:border-white/10 flex flex-col items-center justify-center text-center px-4 space-y-1.5">
              <BarChart3 size={24} className="text-[#A1A1AA]" />
              <div className="text-xs font-bold text-[#18181B] dark:text-white">
                No revenue recorded for this period yet
              </div>
              <p className="text-[11px] text-[#71717A] dark:text-slate-400 max-w-sm">
                Hourly revenue bars will populate automatically as guests place QR orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <div className="h-44 min-w-[380px] flex items-end gap-2 pt-4">
                {hourlyData.map((d) => {
                  const heightPercent =
                    maxSales > 0 && d.sales > 0 ? Math.max(10, Math.round((d.sales / maxSales) * 100)) : 4;
                  return (
                    <div
                      key={d.hour}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                    >
                      <span className="text-[10px] font-bold text-[#18181B] dark:text-white opacity-0 group-hover:opacity-100 transition-opacity tnum">
                        {formatINR(d.sales)}
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-lg transition-all ${
                          d.sales > 0
                            ? 'bg-[#18181B] dark:bg-violet-500 group-hover:bg-[#F76707]'
                            : 'bg-[#F4F4F5] dark:bg-white/5'
                        }`}
                      />
                      <span className="text-[10px] font-medium text-[#71717A] dark:text-slate-400 truncate">
                        {d.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#14151D] rounded-2xl p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold font-heading text-[#18181B] dark:text-white mb-1">
              Floor Speed &amp; Kitchen Metrics
            </h3>
            <p className="text-xs text-[#71717A] dark:text-slate-400">
              Live operational telemetry
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#E4E4E7] dark:border-white/10 flex justify-between items-center">
              <div>
                <div className="font-bold text-[#18181B] dark:text-white">Avg Prep Time</div>
                <div className="text-[10px] text-[#71717A] dark:text-slate-400">
                  {prepSampleCount > 0
                    ? `Across ${prepSampleCount} prepared ${prepSampleCount === 1 ? 'order' : 'orders'}`
                    : 'Awaiting completed KDS tickets'}
                </div>
              </div>
              <span className="text-base font-extrabold text-[#16A34A] dark:text-emerald-400 font-heading tnum">
                {avgPrepMinutes !== null ? `${avgPrepMinutes} mins` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#E4E4E7] dark:border-white/10 flex justify-between items-center">
              <div>
                <div className="font-bold text-[#18181B] dark:text-white">Waiter Response Time</div>
                <div className="text-[10px] text-[#71717A] dark:text-slate-400">
                  {waiterSampleCount > 0
                    ? `Across ${waiterSampleCount} resolved ${waiterSampleCount === 1 ? 'call' : 'calls'}`
                    : 'Awaiting resolved table calls'}
                </div>
              </div>
              <span className="text-base font-extrabold text-[#2563EB] dark:text-blue-400 font-heading tnum">
                {avgWaiterSeconds !== null ? `${avgWaiterSeconds} secs` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#E4E4E7] dark:border-white/10 flex justify-between items-center">
              <div>
                <div className="font-bold text-[#18181B] dark:text-white">Customer Rating</div>
                <div className="text-[10px] text-[#71717A] dark:text-slate-400">
                  {ratingSampleCount > 0
                    ? `Based on ${ratingSampleCount} guest ${ratingSampleCount === 1 ? 'review' : 'reviews'}`
                    : 'No guest ratings yet'}
                </div>
              </div>
              <span className="text-base font-extrabold text-[#F76707] font-heading">
                {avgRating !== null ? `${avgRating} ★` : '—'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTo('kds')}
            className="w-full py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Open Kitchen Display (KDS)</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Table Performance Widget */}
      <div className="bg-white dark:bg-[#14151D] rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Table2 size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold font-heading text-[#18181B] dark:text-white flex flex-wrap items-center gap-2">
                <span>Table Performance</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F4F5] dark:bg-white/10 text-[#52525B] dark:text-slate-300 border border-[#E4E4E7] dark:border-white/10">
                  {sortedTableRows.length} {sortedTableRows.length === 1 ? 'Table' : 'Tables'}
                </span>
              </h3>
              <p className="text-xs text-[#71717A] dark:text-slate-400">
                Average turnaround time (order placed to served/settled) &amp; total revenue per Table ID
              </p>
            </div>
          </div>

          <div className="flex flex-wrap bg-[#F4F4F5] dark:bg-white/5 p-1 rounded-xl text-[11px] font-bold gap-0.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTableSort('revenue')}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                tableSort === 'revenue'
                  ? 'bg-white dark:bg-[#232533] text-[#18181B] dark:text-white shadow-2xs'
                  : 'text-[#71717A] dark:text-slate-400'
              }`}
            >
              Top Revenue
            </button>
            <button
              type="button"
              onClick={() => setTableSort('turnaround')}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                tableSort === 'turnaround'
                  ? 'bg-white dark:bg-[#232533] text-[#18181B] dark:text-white shadow-2xs'
                  : 'text-[#71717A] dark:text-slate-400'
              }`}
            >
              Turnaround
            </button>
            <button
              type="button"
              onClick={() => setTableSort('table')}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                tableSort === 'table'
                  ? 'bg-white dark:bg-[#232533] text-[#18181B] dark:text-white shadow-2xs'
                  : 'text-[#71717A] dark:text-slate-400'
              }`}
            >
              Table #
            </button>
          </div>
        </div>

        {(topRevenueTable || fastestTurnaroundTable) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {topRevenueTable && (
              <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 border border-[#16A34A]/20 dark:border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Award size={15} className="text-[#16A34A] dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-[#15803D] dark:text-emerald-400 block">
                      Highest Revenue Table
                    </span>
                    <span className="font-extrabold text-[#18181B] dark:text-white truncate block">
                      {topRevenueTable.tableName} ({topRevenueTable.tableId})
                    </span>
                  </div>
                </div>
                <span className="text-sm font-extrabold font-heading text-[#16A34A] dark:text-emerald-400 tnum shrink-0">
                  {formatINR(topRevenueTable.totalRevenue)}
                </span>
              </div>
            )}

            {fastestTurnaroundTable && (
              <div className="p-3 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#2563EB]/20 dark:border-blue-500/30 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={15} className="text-[#2563EB] dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-[#1D4ED8] dark:text-blue-400 block">
                      Fastest Avg Turnaround
                    </span>
                    <span className="font-extrabold text-[#18181B] dark:text-white truncate block">
                      {fastestTurnaroundTable.tableName} ({fastestTurnaroundTable.tableId})
                    </span>
                  </div>
                </div>
                <span className="text-sm font-extrabold font-heading text-[#2563EB] dark:text-blue-400 tnum shrink-0">
                  {formatTurnaroundLabel(fastestTurnaroundTable.avgTurnaroundMinutes)}
                </span>
              </div>
            )}
          </div>
        )}

        {sortedTableRows.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-dashed border-[#E4E4E7] dark:border-white/10 text-center space-y-2">
            <Table2 size={24} className="text-[#A1A1AA] mx-auto" />
            <div className="text-xs font-bold text-[#18181B] dark:text-white">
              No floor tables configured yet
            </div>
            <p className="text-[11px] text-[#71717A] dark:text-slate-400 max-w-sm mx-auto">
              Create tables in Floor &amp; QR Setup to track turnaround velocity and revenue per Table ID.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {sortedTableRows.map((row) => {
                const shareWidth =
                  maxTableRevenue > 0 && row.totalRevenue > 0
                    ? Math.max(8, Math.round((row.totalRevenue / maxTableRevenue) * 100))
                    : 0;
                return (
                  <div
                    key={row.tableId}
                    className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#E4E4E7] dark:border-white/10 space-y-2.5 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold font-heading text-[#18181B] dark:text-white">
                            {row.tableName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-[#E4E4E7] dark:border-white/10 font-mono text-[#52525B] dark:text-slate-300 truncate max-w-[140px]">
                            {row.tableId}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#71717A] dark:text-slate-400 block mt-0.5">
                          {row.zone} • {row.ordersCount} {row.ordersCount === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <span className="text-sm font-extrabold font-heading text-[#18181B] dark:text-white tnum shrink-0">
                        {formatINR(row.totalRevenue)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[#E4E4E7] dark:bg-white/10 overflow-hidden">
                      <div
                        style={{ width: `${shareWidth}%` }}
                        className="h-full rounded-full bg-[#F76707] transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded-xl bg-white dark:bg-[#181A24] border border-[#E4E4E7] dark:border-white/10">
                        <span className="text-[10px] text-[#71717A] dark:text-slate-400 block">Avg Turnaround</span>
                        <span className="font-extrabold text-[#2563EB] dark:text-blue-400 tnum">
                          {formatTurnaroundLabel(row.avgTurnaroundMinutes)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#181A24] border border-[#E4E4E7] dark:border-white/10">
                        <span className="text-[10px] text-[#71717A] dark:text-slate-400 block">Paid Revenue</span>
                        <span className="font-extrabold text-[#16A34A] dark:text-emerald-400 tnum">
                          {formatINR(row.paidRevenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Data Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] dark:border-white/10 text-[10px] uppercase tracking-wider text-[#71717A] dark:text-slate-400">
                    <th className="py-2.5 pr-3 font-bold">Table &amp; ID</th>
                    <th className="py-2.5 px-3 font-bold">Zone</th>
                    <th className="py-2.5 px-3 font-bold text-right">Orders</th>
                    <th className="py-2.5 px-3 font-bold text-right">Avg Turnaround</th>
                    <th className="py-2.5 px-3 font-bold text-right">Paid / Total Revenue</th>
                    <th className="py-2.5 pl-3 font-bold w-32">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5] dark:divide-white/5">
                  {sortedTableRows.map((row) => {
                    const shareWidth =
                      maxTableRevenue > 0 && row.totalRevenue > 0
                        ? Math.max(8, Math.round((row.totalRevenue / maxTableRevenue) * 100))
                        : 0;
                    return (
                      <tr key={row.tableId} className="hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold font-heading text-[#18181B] dark:text-white">
                              {row.tableName}
                            </span>
                            <code className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F4F5] dark:bg-white/10 text-[#52525B] dark:text-slate-300 font-mono">
                              {row.tableId}
                            </code>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#52525B] dark:text-slate-300">{row.zone}</td>
                        <td className="py-3 px-3 text-right font-bold text-[#18181B] dark:text-white tnum">
                          {row.ordersCount}
                          {row.ordersCount > 0 && (
                            <span className="text-[10px] text-[#71717A] dark:text-slate-400 font-normal ml-1">
                              ({row.paidOrdersCount} paid)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-extrabold tnum ${
                              row.avgTurnaroundMinutes !== null
                                ? 'text-[#2563EB] dark:text-blue-400'
                                : 'text-[#A1A1AA] dark:text-slate-500'
                            }`}
                          >
                            {formatTurnaroundLabel(row.avgTurnaroundMinutes)}
                          </span>
                          {row.turnaroundSampleCount > 0 && (
                            <span className="block text-[10px] text-[#71717A] dark:text-slate-400">
                              from {row.turnaroundSampleCount}{' '}
                              {row.turnaroundSampleCount === 1 ? 'turn' : 'turns'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-extrabold font-heading text-[#18181B] dark:text-white tnum">
                            {formatINR(row.totalRevenue)}
                          </div>
                          {row.totalRevenue > 0 && (
                            <span className="text-[10px] text-[#16A34A] dark:text-emerald-400 font-semibold tnum">
                              {formatINR(row.paidRevenue)} settled
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3">
                          <div className="w-full h-2 rounded-full bg-[#F4F4F5] dark:bg-white/10 overflow-hidden">
                            <div
                              style={{ width: `${shareWidth}%` }}
                              className="h-full rounded-full bg-[#F76707] transition-all"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

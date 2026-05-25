import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authFetch, getSocketUrl } from '../utils/api';
import { io } from 'socket.io-client';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users as UsersIcon,
  Wallet,
  Download,
  Calendar,
  Filter,
  ChefHat,
  Timer,
  Zap,
  Award,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const QUICK_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

const formatYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDMY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

const formatHourLabel = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

const shortAmount = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
};

const computeDelta = (curr, prev) => {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) {
    if (c === 0) return 0;
    return 100;
  }
  return ((c - p) / Math.abs(p)) * 100;
};

const computePrevRange = (start, end) => {
  if (!start || !end) return [null, null];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diffDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
  const prevEnd = new Date(s);
  prevEnd.setDate(s.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (diffDays - 1));
  return [formatYMD(prevStart), formatYMD(prevEnd)];
};

const getOrderItemsArray = (order) => {
  if (!order) return [];
  const items = order.items;
  if (Array.isArray(items)) return items;
  if (items && Array.isArray(items.dataValues)) return items.dataValues;
  return [];
};

const getItemField = (item, field) => {
  if (!item) return undefined;
  if (item[field] !== undefined) return item[field];
  if (item.dataValues && item.dataValues[field] !== undefined)
    return item.dataValues[field];
  return undefined;
};

const getItemName = (item) =>
  getItemField(item, 'name') ?? getItemField(item, 'itemName') ?? getItemField(item, 'title');

const getItemQuantity = (item) => {
  const q = getItemField(item, 'quantity') ?? getItemField(item, 'qty');
  const n = Number(q);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const getItemPrice = (item) => {
  const p = getItemField(item, 'price') ?? getItemField(item, 'unitPrice');
  const n = Number(p);
  return Number.isFinite(n) ? n : undefined;
};

const reportableFilter = (o) =>
  o && (o.status === 'completed' || o.status === 'delivered' || o.bill_status === 'paid');

/* ------------------------------------------------------------------ */
/*  Custom date input (styled like image 3, native picker inside)      */
/* ------------------------------------------------------------------ */

const DateInput = ({ label, value, onChange, max }) => {
  const inputRef = useRef(null);
  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch (_) {
        /* fallthrough to focus */
      }
    }
    el.focus();
    el.click();
  };
  return (
    <div>
      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        {label}
      </label>
      <button
        type="button"
        onClick={openPicker}
        className="relative w-full bg-orange-50/40 hover:bg-orange-50/70 border border-orange-200/60 rounded-2xl px-4 py-3 flex items-center justify-between text-left transition focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        <span className="text-sm font-semibold text-gray-800 tracking-wide">
          {formatDMY(value) || 'Select date'}
        </span>
        <Calendar className="w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={max}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={label}
        />
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Reports = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);

  const todayIso = useMemo(() => formatYMD(new Date()), []);

  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [activeRange, setActiveRange] = useState('today');
  const [showFilters, setShowFilters] = useState(false);

  const [ordersData, setOrdersData] = useState([]);
  const [prevOrdersData, setPrevOrdersData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  /* --------------------------- validation --------------------------- */

  const validateDateRange = useCallback((start, end) => {
    if (!start || !end) {
      setDateError('Please select both start and end dates');
      return false;
    }
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T23:59:59');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (startDateObj > todayStart) {
      setDateError("Start date cannot be greater than today's date");
      return false;
    }
    if (endDateObj > todayEnd) {
      setDateError("End date cannot be greater than today's date");
      return false;
    }
    if (startDateObj > endDateObj) {
      setDateError('End date cannot be earlier than start date');
      return false;
    }
    setDateError('');
    return true;
  }, []);

  /* --------------------------- fetch --------------------------- */

  const fetchOrdersForRange = useCallback(async (start, end) => {
    const res = await authFetch(`/api/orders?startDate=${start}&endDate=${end}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  const fetchAll = useCallback(async () => {
    if (!validateDateRange(startDate, endDate)) return;
    setIsLoading(true);
    try {
      const orders = await fetchOrdersForRange(startDate, endDate);
      setOrdersData(orders);
      const [pStart, pEnd] = computePrevRange(startDate, endDate);
      if (pStart && pEnd) {
        const prev = await fetchOrdersForRange(pStart, pEnd);
        setPrevOrdersData(prev);
      } else {
        setPrevOrdersData([]);
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
      setOrdersData([]);
      setPrevOrdersData([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, fetchOrdersForRange, validateDateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* --------------- real-time updates (live chef performance) --------------- */
  // When the user is viewing a range that includes "today", wire a socket
  // to refetch the data whenever an order moves through the kitchen flow,
  // and back it up with a 15s polling interval. For purely historical
  // ranges (end date < today) we skip this — historical data doesn't change.
  const includesToday = useMemo(() => {
    return endDate >= todayIso;
  }, [endDate, todayIso]);

  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    if (!includesToday) {
      setLiveConnected(false);
      return undefined;
    }

    let socket;
    try {
      socket = io(getSocketUrl(), { transports: ['websocket', 'polling'] });
      socket.on('connect', () => setLiveConnected(true));
      socket.on('disconnect', () => setLiveConnected(false));
      const refresh = () => fetchAll();
      socket.on('order_created', refresh);
      socket.on('order_status_updated', refresh);
      socket.on('order_deleted', refresh);
    } catch (e) {
      console.warn('Reports socket connection failed:', e?.message || e);
    }

    const pollId = setInterval(fetchAll, 15000);

    return () => {
      try {
        if (socket) {
          socket.off('order_created');
          socket.off('order_status_updated');
          socket.off('order_deleted');
          socket.disconnect();
        }
      } catch {
        /* ignore */
      }
      clearInterval(pollId);
    };
  }, [includesToday, fetchAll]);

  /* --------------------------- quick ranges --------------------------- */

  const setQuickDateRange = (range) => {
    const today = new Date();
    let start = new Date(today);
    if (range === 'today') {
      start = new Date(today);
    } else if (range === 'week') {
      start.setDate(today.getDate() - 6);
    } else if (range === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (range === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    }
    setStartDate(formatYMD(start));
    setEndDate(formatYMD(today));
    setActiveRange(range);
  };

  /* --------------------------- aggregates --------------------------- */

  const currStats = useMemo(() => buildStats(ordersData), [ordersData]);
  const prevStats = useMemo(() => buildStats(prevOrdersData), [prevOrdersData]);

  const isSingleDay = startDate === endDate;

  const revenueTrend = useMemo(() => {
    if (isSingleDay) {
      // 24 hourly buckets but rendered as friendly day-of-week look in the
      // screenshot — when single day we keep hourly intervals to look natural.
      return buildHourlySeries(ordersData);
    }
    return buildDailySeries(ordersData, startDate, endDate);
  }, [ordersData, startDate, endDate, isSingleDay]);

  const peakHours = useMemo(() => buildHourlySeries(ordersData), [ordersData]);

  const orderDistribution = useMemo(() => {
    return [
      { name: 'Dine-In', value: currStats.byType.DINE_IN, color: '#F97316' },
      { name: 'Takeaway', value: currStats.byType.TAKEAWAY, color: '#10B981' },
      { name: 'QR Order', value: currStats.byType.QR_CODE, color: '#3B82F6' },
    ].filter((d) => d.value > 0);
  }, [currStats]);

  const topItems = useMemo(() => {
    return currStats.itemMap
      .map((it) => ({ name: it.name, orders: it.qty, revenue: it.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [currStats]);

  const maxTopRevenue = topItems.length > 0 ? topItems[0].revenue : 1;

  /* --------------------------- chef performance --------------------------- */

  const chefStats = useMemo(() => buildChefStats(ordersData), [ordersData]);

  /* --------------------------- export --------------------------- */

  const handleExport = () => {
    const workbook = XLSX.utils.book_new();
    const summary = [
      { Metric: 'Start Date', Value: startDate },
      { Metric: 'End Date', Value: endDate },
      { Metric: 'Total Revenue', Value: currStats.totalSales },
      { Metric: 'Total Orders', Value: currStats.totalOrders },
      { Metric: 'Total Customers', Value: currStats.totalCustomers },
      { Metric: 'Avg Order Value', Value: currStats.avgOrderValue },
      { Metric: 'Items Sold', Value: currStats.totalItems },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Summary');

    const orderRows = (ordersData || []).map((o) => ({
      OrderId: o.id,
      Table: o.table_name,
      Type: o.type,
      Status: o.status,
      Total: o.total,
      Timestamp: o.timestamp || o.created_at,
      PaymentMethod: o.payment_method,
      ItemCount: getOrderItemsArray(o).reduce((s, it) => s + getItemQuantity(it), 0),
      ItemsSummary: getOrderItemsArray(o)
        .map((it) => `${getItemName(it) || ''} x${getItemQuantity(it)}`)
        .filter(Boolean)
        .join(', '),
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(orderRows),
      'Orders'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(topItems),
      'TopItems'
    );

    if (chefStats.chefs.length > 0) {
      const chefRows = chefStats.chefs.map((c) => ({
        Chef: c.name,
        OrdersPrepared: c.ordersPrepared,
        AvgPrepTimeMinutes: Number(c.avgPrepMin.toFixed(2)),
        FastestMinutes: c.fastestMin != null ? Number(c.fastestMin.toFixed(2)) : '',
        SlowestMinutes: c.slowestMin != null ? Number(c.slowestMin.toFixed(2)) : '',
        TotalRevenueHandled: Number(c.totalRevenue.toFixed(2)),
        ItemsCooked: c.itemsCooked,
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(chefRows),
        'ChefPerformance'
      );
    }

    XLSX.writeFile(workbook, `reports_${startDate}_to_${endDate}.xlsx`);
  };

  /* --------------------------- KPI deltas --------------------------- */

  const kpis = useMemo(() => {
    return [
      {
        id: 'revenue',
        label: 'TOTAL REVENUE',
        value: fmt(currStats.totalSales),
        delta: computeDelta(currStats.totalSales, prevStats.totalSales),
        color: 'text-orange-500',
        Icon: DollarSign,
      },
      {
        id: 'orders',
        label: 'TOTAL ORDERS',
        value: (currStats.totalOrders || 0).toLocaleString('en-IN'),
        delta: computeDelta(currStats.totalOrders, prevStats.totalOrders),
        color: 'text-blue-500',
        Icon: ShoppingCart,
      },
      {
        id: 'customers',
        label: 'TOTAL CUSTOMERS',
        value: (currStats.totalCustomers || 0).toLocaleString('en-IN'),
        delta: computeDelta(currStats.totalCustomers, prevStats.totalCustomers),
        color: 'text-emerald-500',
        Icon: UsersIcon,
      },
      {
        id: 'aov',
        label: 'AVG ORDER VALUE',
        value: fmt(currStats.avgOrderValue),
        delta: computeDelta(currStats.avgOrderValue, prevStats.avgOrderValue),
        color: 'text-orange-500',
        Icon: Wallet,
      },
    ];
  }, [currStats, prevStats, fmt]);

  /* --------------------------- render --------------------------- */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Reports &amp; Analytics
            </h1>
            {includesToday && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  liveConnected
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
                title={
                  liveConnected
                    ? 'Receiving live updates from kitchen'
                    : 'Auto-refreshing every 15 seconds'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    liveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {liveConnected ? 'Live' : 'Auto'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Comprehensive business intelligence</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-gray-200 shadow-sm rounded-full p-1 flex items-center gap-1">
            {QUICK_RANGES.map((q) => {
              const active = activeRange === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setQuickDateRange(q.id)}
                  className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/50'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${
              showFilters
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-gray-300'
            }`}
            title="Show filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 flex items-center justify-center transition shadow-sm"
            title="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Filters panel — styled per image 3 */}
      {showFilters && (
        <div className="bg-[#FFFAF3] border border-orange-100 rounded-2xl shadow-sm p-5 mb-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-orange-500" />
            <h3 className="text-base font-bold text-gray-900">Report Filters</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput
              label="Start Date"
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                setActiveRange('');
              }}
              max={todayIso}
            />
            <DateInput
              label="End Date"
              value={endDate}
              onChange={(v) => {
                setEndDate(v);
                setActiveRange('');
              }}
              max={todayIso}
            />
          </div>
          {dateError && (
            <p className="mt-3 text-xs font-semibold text-rose-500">{dateError}</p>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k, idx) => (
          <KpiCard
            key={k.id}
            label={k.label}
            value={isLoading ? '—' : k.value}
            delta={k.delta}
            color={k.color}
            Icon={k.Icon}
            delay={idx * 60}
            isLoaded={isLoaded}
          />
        ))}
      </div>

      {/* Revenue Trend + Peak Sales Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <ChartCard title="Revenue Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={revenueTrend}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => shortAmount(v)}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
                formatter={(value) => [fmt(value), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="none"
                fill="url(#revGradient)"
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#F97316"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Peak Sales Hours">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={peakHours}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => shortAmount(v)}
              />
              <RechartsTooltip
                cursor={{ fill: '#FFF7ED' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
                formatter={(value) => [fmt(value), 'Sales']}
              />
              <Bar dataKey="sales" fill="#F97316" radius={[6, 6, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Order Distribution + Top Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Order Distribution">
          {orderDistribution.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              No order data available
            </div>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderDistribution}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {orderDistribution.map((d, idx) => (
                        <Cell key={idx} fill={d.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center justify-center flex-wrap gap-4 text-xs">
                {orderDistribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    <span className="text-gray-600 font-medium">
                      {d.name}: <span className="text-gray-900 font-bold">{d.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard title="Top Selling Items">
          {topItems.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              No sales data for selected period
            </div>
          ) : (
            <div className="space-y-4">
              {topItems.map((it, idx) => {
                const pct = (it.revenue / maxTopRevenue) * 100;
                return (
                  <div
                    key={`${it.name}-${idx}`}
                    className="flex items-start gap-3"
                    style={{
                      animation: isLoaded
                        ? `slideUpFade .35s ease-out ${idx * 50}ms both`
                        : 'none',
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {it.name}
                        </p>
                        <p className="text-sm font-bold text-gray-900 shrink-0">
                          {fmt(it.revenue)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{it.orders} orders</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Chef Performance */}
      <div className="mt-4">
        <ChefPerformanceSection
          stats={chefStats}
          fmt={fmt}
          isLoaded={isLoaded}
          live={liveConnected && includesToday}
        />
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn .25s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Aggregation                                                        */
/* ------------------------------------------------------------------ */

function buildStats(orders) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  const totalOrders = safe.length;
  const totalSales = safe.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const itemMapObj = {};
  let totalItems = 0;
  const byType = { DINE_IN: 0, TAKEAWAY: 0, QR_CODE: 0 };
  const uniqueCustomers = new Set();

  safe.forEach((o) => {
    const t = String(o.type || '').toUpperCase();
    if (byType[t] !== undefined) byType[t] += 1;

    const custKey =
      o.customer_id ||
      o.customerId ||
      o.customer_phone ||
      o.customer_email ||
      `${o.table_name || 'NA'}_${o.id}`;
    uniqueCustomers.add(custKey);

    getOrderItemsArray(o).forEach((item) => {
      const name = getItemName(item) || 'Item';
      const qty = getItemQuantity(item);
      const price = getItemPrice(item);
      const lineRevenue = typeof price === 'number' ? price * qty : 0;
      totalItems += qty;
      if (!itemMapObj[name]) itemMapObj[name] = { name, qty: 0, revenue: 0 };
      itemMapObj[name].qty += qty;
      itemMapObj[name].revenue += lineRevenue;
    });
  });

  return {
    totalOrders,
    totalSales,
    avgOrderValue,
    totalItems,
    totalCustomers: uniqueCustomers.size,
    byType,
    itemMap: Object.values(itemMapObj),
  };
}

function buildHourlySeries(orders) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  const buckets = Array(24).fill(0);
  safe.forEach((o) => {
    const ts = o.timestamp || o.created_at;
    if (!ts) return;
    const hour = new Date(ts).getHours();
    if (Number.isFinite(hour)) buckets[hour] += Number(o.total) || 0;
  });
  // Show waking hours 9am-11pm as primary x-axis range like in screenshot.
  const range = [];
  for (let h = 9; h <= 23; h += 1) {
    range.push({ period: formatHourLabel(h), sales: buckets[h] });
  }
  return range;
}

function buildDailySeries(orders, start, end) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  if (!start || !end) return [];
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const result = [];
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = {};
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const iso = formatYMD(d);
    map[iso] = 0;
  }
  safe.forEach((o) => {
    const ts = o.timestamp || o.created_at;
    if (!ts) return;
    const iso = formatYMD(new Date(ts));
    if (map[iso] !== undefined) map[iso] += Number(o.total) || 0;
  });
  Object.entries(map).forEach(([iso, total]) => {
    const d = new Date(iso + 'T00:00:00');
    const label = dayShort[d.getDay()];
    result.push({ period: label, sales: total, iso });
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const KpiCard = ({ label, value, delta, color, Icon, delay, isLoaded }) => {
  const positive = delta >= 0;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      style={{ animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold tracking-wider text-gray-400">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg bg-gray-50 ${color} flex items-center justify-center`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <p className={`text-2xl sm:text-3xl font-bold ${color} leading-none`}>{value}</p>
      <div
        className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
          positive ? 'text-emerald-500' : 'text-rose-500'
        }`}
      >
        {positive ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        )}
        {positive ? '+' : ''}
        {(delta || 0).toFixed(1)}%
      </div>
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <h3 className="text-base font-bold text-gray-900 mb-3">{title}</h3>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Chef performance — aggregation                                     */
/* ------------------------------------------------------------------ */

/**
 * Given the raw orders for the selected date range, group by chef and
 * compute the metrics we want to surface on the report:
 *   - ordersPrepared (those with both preparing_at and ready_at)
 *   - inProgress     (preparing_at but no ready_at yet)
 *   - avgPrepMin     (mean of ready_at - preparing_at)
 *   - fastestMin / slowestMin
 *   - totalRevenue handled
 *   - itemsCooked
 * The fields `chef_id`, `chef_name`, `preparing_at`, `ready_at` are
 * stamped server-side when the kitchen flips an order to "preparing"
 * (and then to "ready").
 */
function buildChefStats(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const byChef = new Map();

  list.forEach((o) => {
    const chefId = o.chef_id || o.chefId || null;
    const chefName = (o.chef_name || o.chefName || '').trim();
    if (!chefName && !chefId) return; // unattributed — skip

    const key = chefId ? `id:${chefId}` : `name:${chefName.toLowerCase()}`;
    if (!byChef.has(key)) {
      byChef.set(key, {
        id: chefId,
        name: chefName || `Chef #${chefId}`,
        ordersPrepared: 0,
        inProgress: 0,
        totalRevenue: 0,
        itemsCooked: 0,
        prepDurationsMin: [],
      });
    }
    const c = byChef.get(key);

    const prep = o.preparing_at ? new Date(o.preparing_at) : null;
    const ready = o.ready_at ? new Date(o.ready_at) : null;

    if (prep && ready && ready.getTime() > prep.getTime()) {
      const mins = (ready.getTime() - prep.getTime()) / 60000;
      // Sanity bounds: ignore anything > 12h (likely a forgotten order
      // or a manual back-fill) so it doesn't skew the average.
      if (mins >= 0 && mins < 720) {
        c.prepDurationsMin.push(mins);
        c.ordersPrepared += 1;
      }
    } else if (prep && !ready) {
      c.inProgress += 1;
    }

    c.totalRevenue += Number(o.total) || 0;
    c.itemsCooked += getOrderItemsArray(o).reduce(
      (s, it) => s + getItemQuantity(it),
      0
    );
  });

  const chefs = Array.from(byChef.values()).map((c) => {
    const durations = c.prepDurationsMin;
    const sum = durations.reduce((s, n) => s + n, 0);
    const avg = durations.length > 0 ? sum / durations.length : 0;
    return {
      id: c.id,
      name: c.name,
      ordersPrepared: c.ordersPrepared,
      inProgress: c.inProgress,
      avgPrepMin: avg,
      fastestMin: durations.length > 0 ? Math.min(...durations) : null,
      slowestMin: durations.length > 0 ? Math.max(...durations) : null,
      totalRevenue: c.totalRevenue,
      itemsCooked: c.itemsCooked,
    };
  });

  // Sort: most productive first (most orders → fastest avg).
  chefs.sort((a, b) => {
    if (b.ordersPrepared !== a.ordersPrepared) {
      return b.ordersPrepared - a.ordersPrepared;
    }
    return a.avgPrepMin - b.avgPrepMin;
  });

  const completed = chefs.filter((c) => c.ordersPrepared > 0);
  const totalOrders = completed.reduce((s, c) => s + c.ordersPrepared, 0);
  const totalDurations = completed.flatMap((c) =>
    Array(c.ordersPrepared).fill(c.avgPrepMin)
  );
  const overallAvgMin =
    totalDurations.length > 0
      ? totalDurations.reduce((s, n) => s + n, 0) / totalDurations.length
      : 0;

  const fastestChef = completed
    .slice()
    .sort((a, b) => a.avgPrepMin - b.avgPrepMin)[0] || null;
  const mostProductive = completed[0] || null;

  return {
    chefs,
    totalOrders,
    overallAvgMin,
    fastestChef,
    mostProductive,
  };
}

const formatPrepTime = (mins) => {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return '—';
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  if (mins < 60) return `${mins.toFixed(1)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  return `${h}h ${m}m`;
};

/* ------------------------------------------------------------------ */
/*  Chef performance — UI                                              */
/* ------------------------------------------------------------------ */

const ChefPerformanceSection = ({ stats, fmt, isLoaded, live }) => {
  const { chefs, totalOrders, overallAvgMin, fastestChef, mostProductive } = stats;

  if (chefs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">Chef Performance</h3>
              <p className="text-xs text-gray-500">
                Prep-time analytics per kitchen staff member
              </p>
            </div>
          </div>
        </div>
        <div className="h-32 flex flex-col items-center justify-center text-center text-sm text-gray-400">
          <Timer className="w-6 h-6 mb-2 text-gray-300" />
          No chef activity in this period yet.
          <span className="text-[11px] text-gray-400 mt-1">
            Stats appear as soon as kitchen staff start moving orders to
            <span className="font-semibold"> preparing</span> and{' '}
            <span className="font-semibold">ready</span>.
          </span>
        </div>
      </div>
    );
  }

  const maxAvg = Math.max(...chefs.map((c) => c.avgPrepMin || 0), 1);
  const maxOrders = Math.max(...chefs.map((c) => c.ordersPrepared || 0), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
            <ChefHat className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Chef Performance
              {live && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">
              How long each cook took per order — lower is better
            </p>
          </div>
        </div>

        {/* Roll-up KPIs */}
        <div className="flex items-center gap-2 flex-wrap">
          <MiniStat
            Icon={Timer}
            label="Avg prep time"
            value={formatPrepTime(overallAvgMin)}
            tint="text-blue-500 bg-blue-50"
          />
          <MiniStat
            Icon={ChefHat}
            label="Orders cooked"
            value={totalOrders.toString()}
            tint="text-orange-500 bg-orange-50"
          />
          {fastestChef && (
            <MiniStat
              Icon={Zap}
              label="Fastest chef"
              value={`${fastestChef.name.split(' ')[0]} · ${formatPrepTime(
                fastestChef.avgPrepMin
              )}`}
              tint="text-emerald-500 bg-emerald-50"
            />
          )}
          {mostProductive && (
            <MiniStat
              Icon={Award}
              label="Most productive"
              value={`${mostProductive.name.split(' ')[0]} · ${mostProductive.ordersPrepared}`}
              tint="text-amber-500 bg-amber-50"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leaderboard */}
        <div className="space-y-3">
          {chefs.map((c, idx) => {
            const ordersPct = (c.ordersPrepared / maxOrders) * 100;
            const isFastest =
              fastestChef && c.name === fastestChef.name && c.ordersPrepared > 0;
            return (
              <div
                key={c.name + idx}
                className="border border-gray-100 rounded-xl p-3 hover:border-orange-200 transition"
                style={{
                  animation: isLoaded
                    ? `slideUpFade .35s ease-out ${idx * 40}ms both`
                    : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c.name}
                        {isFastest && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold tracking-wider uppercase">
                            <Zap className="w-2.5 h-2.5" />
                            Fastest
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-bold text-gray-900 shrink-0">
                        {formatPrepTime(c.avgPrepMin)}
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(6, ordersPct))}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        <span className="font-semibold text-gray-700">
                          {c.ordersPrepared}
                        </span>{' '}
                        orders ·{' '}
                        <span className="font-semibold text-gray-700">
                          {c.itemsCooked}
                        </span>{' '}
                        items
                      </span>
                      <span>
                        Fast {formatPrepTime(c.fastestMin)} · Slow{' '}
                        {formatPrepTime(c.slowestMin)}
                      </span>
                    </div>
                  </div>
                </div>
                {c.inProgress > 0 && (
                  <p className="mt-2 text-[10px] font-semibold tracking-wider uppercase text-blue-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {c.inProgress} order{c.inProgress > 1 ? 's' : ''} in progress
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Avg prep-time chart */}
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-2">
            Average prep time by chef (lower is better)
          </p>
          <ResponsiveContainer width="100%" height={Math.max(220, chefs.length * 44)}>
            <BarChart
              data={chefs.map((c) => ({
                name: c.name,
                avg: Number(c.avgPrepMin.toFixed(2)),
                orders: c.ordersPrepared,
                revenue: c.totalRevenue,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 4, bottom: 5 }}
            >
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(0)}m`}
                domain={[0, Math.ceil(maxAvg * 1.15)]}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <RechartsTooltip
                cursor={{ fill: '#FFF7ED' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
                formatter={(value, key, payload) => {
                  if (key === 'avg') return [`${value} min`, 'Avg prep'];
                  return [value, key];
                }}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload;
                  if (!row) return label;
                  return `${label} · ${row.orders} orders · ${fmt(row.revenue)}`;
                }}
              />
              <Bar dataKey="avg" fill="#F97316" radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ Icon, label, value, tint }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
    <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tint}`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span className="text-[11px] text-gray-500 font-semibold">{label}</span>
    <span className="text-xs text-gray-900 font-bold">{value}</span>
  </div>
);

export default Reports;

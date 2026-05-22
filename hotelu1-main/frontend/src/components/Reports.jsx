import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authFetch } from '../utils/api';
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Reports &amp; Analytics
          </h1>
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

export default Reports;

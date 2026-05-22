import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Wallet,
  Repeat,
  TrendingUp as TrendingUpAlt,
  Crown,
  Utensils,
  ShoppingBag,
  QrCode,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { io } from 'socket.io-client';
import { authFetch, getSocketUrl } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import DatePickerButton, {
  getTodayLocalDate,
  addDaysToIso,
  parseIsoDate,
} from './DatePickerButton';

/* =================================================================
   Helpers
   ================================================================= */

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfMonth = (d) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayKey = (d) => d.toISOString().slice(0, 10);

const itemsCount = (o) =>
  Array.isArray(o.items)
    ? o.items.reduce((a, b) => a + (Number(b.quantity || b.qty) || 0), 0)
    : 0;

const orderTime = (o) => new Date(o.timestamp || o.created_at || Date.now());

const calcDelta = (current, previous) => {
  if (previous === 0 && current === 0) return { value: '0%', trend: 'up', positive: true };
  if (previous === 0) return { value: '+100%', trend: 'up', positive: true };
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  return {
    value: `${positive ? '+' : ''}${pct.toFixed(1)}%`,
    trend: positive ? 'up' : 'down',
    positive,
  };
};

const formatHourLabel = (h) => {
  const hh = h % 24;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const dh = hh % 12 === 0 ? 12 : hh % 12;
  return `${dh} ${ampm}`;
};

/* =================================================================
   Reusable bits
   ================================================================= */

const KpiCard = ({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  sparkColor,
  sparkData,
  gradientId,
}) => {
  const positive = delta?.positive ?? true;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{value}</p>
      <div className="flex items-center gap-1 mt-2 text-xs">
        <span
          className={`flex items-center gap-0.5 font-semibold ${
            positive ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          <TrendIcon className="w-3.5 h-3.5" />
          {delta?.value || '0%'}
        </span>
        <span className="text-gray-400">vs yesterday</span>
      </div>
      <div className="-mx-3 -mb-2 mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const Section = ({ title, right, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const StatusPill = ({ status }) => {
  const s = (status || '').toLowerCase();
  const map = {
    preparing: 'bg-orange-50 text-orange-600',
    ready: 'bg-emerald-50 text-emerald-600',
    pending: 'bg-amber-50 text-amber-600',
    completed: 'bg-blue-50 text-blue-600',
    delivered: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
        map[s] || 'bg-gray-100 text-gray-600'
      }`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 align-middle" />
      {(status || 'Pending').charAt(0).toUpperCase() + (status || 'Pending').slice(1)}
    </span>
  );
};

const TYPE_ICON = { DINE_IN: Utensils, TAKEAWAY: ShoppingBag, QR_CODE: QrCode };
const TYPE_LABEL = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', QR_CODE: 'QR Order' };

/* =================================================================
   Dashboard
   ================================================================= */

const Dashboard = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // re-renders "X min ago" labels
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);
  const socketRef = useRef(null);
  const todayLocalDate = getTodayLocalDate();
  const isViewingToday = selectedDate === todayLocalDate;
  // eslint-disable-next-line
  const now = useMemo(() => parseIsoDate(selectedDate), [selectedDate, tick]);
  const viewDate = now;

  /* ---------------- data loader (date-aware, same API as before redesign) ---------------- */
  const loadData = useCallback(async () => {
    try {
      const rangeStart = addDaysToIso(selectedDate, -29);
      const res = await authFetch(
        `/api/orders?startDate=${rangeStart}&endDate=${selectedDate}`
      );
      const data = res.ok ? await res.json() : [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setOrders((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  /* ---------------- auth + reload when date changes ---------------- */
  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) {
      navigate('/login');
      return undefined;
    }
    setLoading(true);
    loadData();
    return undefined;
  }, [loadData, navigate]);

  /* ---------------- real-time wiring (today only) ---------------- */
  useEffect(() => {
    if (!isViewingToday) return undefined;

    const socket = io(getSocketUrl());
    socketRef.current = socket;
    const refresh = () => loadData();
    socket.on('order_created', refresh);
    socket.on('order_status_updated', refresh);
    socket.on('order_deleted', refresh);

    const pollInterval = setInterval(loadData, 10000);
    const tickInterval = setInterval(() => setTick((v) => v + 1), 30000);

    return () => {
      socket.off('order_created', refresh);
      socket.off('order_status_updated', refresh);
      socket.off('order_deleted', refresh);
      socket.disconnect();
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [loadData, isViewingToday]);

  /* ---------------- partition ---------------- */
  const completed = orders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );
  const liveOrders = orders.filter(
    (o) => !['completed', 'cancelled', 'delivered'].includes((o.status || '').toLowerCase())
  );

  /* ---------------- selected day / previous day partitions ---------------- */
  const yesterdayDate = new Date(viewDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const dayOrders = orders.filter((o) => sameDay(orderTime(o), viewDate));
  const prevDayOrders = orders.filter((o) => sameDay(orderTime(o), yesterdayDate));

  const dayCompleted = dayOrders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );
  const prevDayCompleted = prevDayOrders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );

  /* ---------------- aggregate metrics (selected date) ---------------- */
  const totalOrders = dayOrders.length;
  const totalSales = dayCompleted.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalItems = dayCompleted.reduce((s, o) => s + itemsCount(o), 0);
  const customers = new Set(
    dayCompleted.map((o) => o.customer_name || o.table_name || `order-${o.id}`)
  ).size;

  /* ---------------- yesterday for deltas ---------------- */
  const yOrders = prevDayOrders.length;
  const ySales = prevDayCompleted.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const yItems = prevDayCompleted.reduce((s, o) => s + itemsCount(o), 0);
  const yCustomers = new Set(
    prevDayCompleted.map((o) => o.customer_name || o.table_name || `order-${o.id}`)
  ).size;

  const ordersDelta = calcDelta(totalOrders, yOrders);
  const salesDelta = calcDelta(totalSales, ySales);
  const itemsDelta = calcDelta(totalItems, yItems);
  const custDelta = calcDelta(customers, yCustomers);

  /* ---------------- last 7 days for sales chart ---------------- */
  const last7 = useMemo(() => {
    const buckets = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(viewDate);
      d.setDate(d.getDate() - i);
      buckets[dayKey(d)] = {
        period: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: 0,
      };
    }
    completed.forEach((o) => {
      const k = dayKey(orderTime(o));
      if (buckets[k]) buckets[k].sales += Number(o.total) || 0;
    });
    return Object.values(buckets);
    // eslint-disable-next-line
  }, [completed, selectedDate, tick]);

  /* this week vs last week sales delta (rolling 7-day windows ending on selected date) */
  const thisWeekSales = useMemo(() => {
    const cutoff = new Date(viewDate);
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return completed
      .filter((o) => orderTime(o) >= cutoff && orderTime(o) <= viewDate)
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    // eslint-disable-next-line
  }, [completed, selectedDate, tick]);
  const lastWeekSales = useMemo(() => {
    const start = new Date(viewDate);
    start.setDate(start.getDate() - 13);
    start.setHours(0, 0, 0, 0);
    const end = new Date(viewDate);
    end.setDate(end.getDate() - 7);
    end.setHours(23, 59, 59, 999);
    return completed
      .filter((o) => orderTime(o) >= start && orderTime(o) <= end)
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    // eslint-disable-next-line
  }, [completed, tick]);
  const weekDelta = calcDelta(thisWeekSales, lastWeekSales);

  /* ---------------- orders by type (selected day) ---------------- */
  const byTypeRaw = dayOrders.reduce((acc, o) => {
    const k = (o.type || 'DINE_IN').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const orderTypeData = [
    { name: 'Dine-In', value: byTypeRaw.DINE_IN || 0, color: '#f97316' },
    { name: 'Takeaway', value: byTypeRaw.TAKEAWAY || 0, color: '#10b981' },
    { name: 'QR Order', value: byTypeRaw.QR_CODE || 0, color: '#3b82f6' },
  ];
  const totalTypeCount = orderTypeData.reduce((s, t) => s + t.value, 0);

  /* ---------------- top selling items (this week) ---------------- */
  const itemSalesMap = {};
  const weekCutoff = new Date(viewDate);
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  weekCutoff.setHours(0, 0, 0, 0);
  completed
    .filter((o) => orderTime(o) >= weekCutoff && orderTime(o) <= viewDate)
    .forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = it.name;
        if (!key) return;
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, revenue: 0, orders: 0 };
        const qty = Number(it.quantity || it.qty) || 1;
        itemSalesMap[key].revenue += (Number(it.price) || 0) * qty;
        itemSalesMap[key].orders += qty;
      });
    });
  const topItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxItemRevenue = Math.max(1, ...topItems.map((i) => i.revenue));

  /* ---------------- recent transactions (selected day) ---------------- */
  const recentTx = [...dayCompleted]
    .sort((a, b) => orderTime(b).getTime() - orderTime(a).getTime())
    .slice(0, 5);

  /* ---------------- peak hours (selected day) ---------------- */
  const peakHours = useMemo(() => {
    const buckets = {};
    for (let h = 9; h <= 23; h += 1) buckets[h] = 0;
    dayCompleted.forEach((o) => {
      const h = orderTime(o).getHours();
      if (buckets[h] !== undefined) buckets[h] += Number(o.total) || 0;
    });
    return Object.keys(buckets).map((h) => ({
      period: formatHourLabel(Number(h)),
      sales: Math.round(buckets[h]),
    }));
    // eslint-disable-next-line
  }, [dayCompleted, tick]);
  const peakMax = peakHours.reduce(
    (m, p) => (p.sales > m.sales ? p : m),
    { period: '', sales: 0 }
  );

  /* ---------------- sparklines (last 14 days, REAL data) ---------------- */
  const buildSpark = useCallback(
    (extract) => {
      const buckets = {};
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(viewDate);
        d.setDate(d.getDate() - i);
        buckets[dayKey(d)] = { i: 13 - i, v: 0 };
      }
      completed.forEach((o) => {
        const k = dayKey(orderTime(o));
        if (buckets[k]) buckets[k].v += extract(o);
      });
      return Object.values(buckets);
    },
    // eslint-disable-next-line
    [completed, tick]
  );

  const salesSpark = buildSpark((o) => Number(o.total) || 0);
  const ordersSpark = buildSpark(() => 1);
  const itemsSpark = buildSpark((o) => itemsCount(o));
  const custSpark = buildSpark(() => 1);

  /* ---------------- bottom KPI strip (all real) ---------------- */
  const avgOrder = dayCompleted.length ? totalSales / dayCompleted.length : 0;

  // table occupancy = distinct dine-in tables in active orders (today only)
  const activeTables = new Set(
    (isViewingToday ? liveOrders : [])
      .filter((o) => (o.type || 'DINE_IN').toUpperCase() === 'DINE_IN')
      .map((o) => o.table_name)
      .filter(Boolean)
  );

  // repeat customers: among today's completed customers, share with >1 lifetime completed order
  const customerCountMap = {};
  completed.forEach((o) => {
    const key = o.customer_name || o.table_name;
    if (!key) return;
    customerCountMap[key] = (customerCountMap[key] || 0) + 1;
  });
  const daysCustomers = new Set(
    dayCompleted.map((o) => o.customer_name || o.table_name).filter(Boolean)
  );
  let repeatCount = 0;
  daysCustomers.forEach((c) => {
    if (customerCountMap[c] >= 2) repeatCount += 1;
  });
  const repeatPct = daysCustomers.size
    ? Math.round((repeatCount / daysCustomers.size) * 100)
    : 0;

  // month growth: month of selected date vs previous month
  const thisMonthStart = startOfMonth(viewDate);
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setMilliseconds(-1);
  const thisMonthSales = completed
    .filter((o) => orderTime(o) >= thisMonthStart)
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const lastMonthSales = completed
    .filter((o) => orderTime(o) >= lastMonthStart && orderTime(o) <= lastMonthEnd)
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const monthDelta = calcDelta(thisMonthSales, lastMonthSales);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'short' });

  /* ----------------- render ----------------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* ===== Page header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isViewingToday
              ? "Welcome back! Here's what's happening today."
              : `Showing data for ${viewDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerButton value={selectedDate} onChange={setSelectedDate} />
          <button
            onClick={() => navigate('/dinein')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* ===== KPI row ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={ShoppingCart}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label="Total Orders"
          value={totalOrders}
          delta={ordersDelta}
          sparkColor="#f97316"
          sparkData={ordersSpark}
          gradientId="spark-orders"
        />
        <KpiCard
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="Total Sales"
          value={fmt(totalSales)}
          delta={salesDelta}
          sparkColor="#10b981"
          sparkData={salesSpark}
          gradientId="spark-sales"
        />
        <KpiCard
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          label="Total Items"
          value={totalItems}
          delta={itemsDelta}
          sparkColor="#f59e0b"
          sparkData={itemsSpark}
          gradientId="spark-items"
        />
        <KpiCard
          icon={Users}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          label="Total Customers"
          value={customers}
          delta={custDelta}
          sparkColor="#8b5cf6"
          sparkData={custSpark}
          gradientId="spark-customers"
        />
      </div>

      {/* ===== Row 2 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <Section
          className="lg:col-span-6"
          title="Sales Overview"
          right={
            <span className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white">
              This Week
            </span>
          }
        >
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold text-gray-900">{fmt(thisWeekSales)}</p>
            <span
              className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
                weekDelta.positive ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {weekDelta.positive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {weekDelta.value}
            </span>
            <span className="text-xs text-gray-400">vs last week</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">Total revenue</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v)}
                />
                <Tooltip
                  cursor={{ stroke: '#fed7aa', strokeWidth: 2 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                  }}
                  formatter={(v) => [fmt(v), 'Sales']}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fill="url(#salesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section className="lg:col-span-3" title="Orders by Type">
          <div className="relative h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    totalTypeCount === 0
                      ? [{ name: 'No data', value: 1, color: '#e5e7eb' }]
                      : orderTypeData
                  }
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={85}
                  stroke="none"
                >
                  {(totalTypeCount === 0
                    ? [{ name: 'No data', value: 1, color: '#e5e7eb' }]
                    : orderTypeData
                  ).map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                {totalTypeCount > 0 && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-gray-900">{totalTypeCount}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {orderTypeData.map((t) => (
              <div key={t.name} className="flex items-center gap-1.5 text-gray-600">
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                {t.name}{' '}
                <span className="text-gray-400">({t.value})</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          className="lg:col-span-3"
          title="Live Orders"
          right={
            <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
              {liveOrders.length} Active
            </span>
          }
        >
          <div className="space-y-3">
            {liveOrders.slice(0, 4).map((o, idx) => {
              const status = (o.status || 'preparing').toLowerCase();
              const minutes = Math.max(
                1,
                Math.round((Date.now() - orderTime(o).getTime()) / 60000)
              );
              const typeKey = (o.type || 'DINE_IN').toUpperCase();
              const TypeIcon = TYPE_ICON[typeKey] || Utensils;
              const typeLabel = TYPE_LABEL[typeKey] || 'Dine-In';
              const itemCt = Array.isArray(o.items) ? o.items.length : 0;
              const displayLabel = o.table_name
                ? typeKey === 'TAKEAWAY'
                  ? `Takeaway ${o.table_name}`
                  : o.table_name
                : typeLabel;
              return (
                <div
                  key={o.id || idx}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-200 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {displayLabel}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {typeLabel} • {itemCt} items
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={status} />
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> {minutes} min
                    </p>
                  </div>
                </div>
              );
            })}
            {!isViewingToday && (
              <p className="text-sm text-gray-400 text-center py-4">
                Live orders are only shown for today. Pick today in the calendar.
              </p>
            )}
            {isViewingToday && liveOrders.length === 0 && !loading && (
              <p className="text-sm text-gray-400 text-center py-4">No live orders</p>
            )}
            {isViewingToday && liveOrders.length === 0 && loading && (
              <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
            )}
          </div>
        </Section>
      </div>

      {/* ===== Row 3 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <Section
          className="lg:col-span-4"
          title="Top Selling Items"
          right={
            <span className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white">
              This Week
            </span>
          }
        >
          <div className="space-y-3">
            {topItems.map((it, idx) => (
              <div key={it.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 truncate">{it.name}</p>
                    <p className="text-sm font-bold text-gray-900">{fmt(it.revenue)}</p>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
                      style={{
                        width: `${Math.max(8, (it.revenue / maxItemRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{it.orders} sold</p>
                </div>
              </div>
            ))}
            {topItems.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            )}
          </div>
        </Section>

        <Section
          className="lg:col-span-4"
          title="Peak Sales Hours"
          right={
            <span className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white">
              {isViewingToday
                ? 'Today'
                : viewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          }
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} barCategoryGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v).replace(/\.00$/, '')}
                />
                <Tooltip
                  cursor={{ fill: '#fff7ed' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
                  formatter={(v) => [fmt(v), 'Sales']}
                />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {peakHours.map((p, idx) => (
                    <Cell
                      key={idx}
                      fill={p.period === peakMax.period && peakMax.sales > 0 ? '#f97316' : '#fdba74'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section className="lg:col-span-4" title="Recent Transactions">
          <div className="space-y-3">
            {recentTx.map((o) => {
              const mins = Math.round((Date.now() - orderTime(o).getTime()) / 60000);
              const idStr = `#ORD-${String(o.id).padStart(5, '0')}`;
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{idStr}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {o.table_name || 'Counter'} • {mins} mins ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{fmt(o.total)}</p>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                  </div>
                </div>
              );
            })}
            {recentTx.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
            )}
          </div>
        </Section>
      </div>

      {/* ===== Bottom KPI strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <BottomKpi
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="AVG ORDER VALUE"
          value={fmt(avgOrder)}
        />
        <BottomKpi
          icon={Users}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label="ACTIVE TABLES"
          value={activeTables.size}
        />
        <BottomKpi
          icon={Repeat}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          label="REPEAT CUSTOMERS"
          value={`${repeatPct}%`}
        />
        <BottomKpi
          icon={TrendingUpAlt}
          iconBg={monthDelta.positive ? 'bg-blue-50' : 'bg-rose-50'}
          iconColor={monthDelta.positive ? 'text-blue-500' : 'text-rose-500'}
          label="GROWTH THIS MONTH"
          value={`${monthDelta.positive ? '↑' : '↓'} ${monthDelta.value.replace('+', '')}`}
        />
        <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                Total Revenue ({monthLabel})
              </p>
              <p className="text-xl font-extrabold mt-0.5">{fmt(thisMonthSales)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BottomKpi = ({ icon: Icon, iconBg, iconColor, label, value }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          {label}
        </p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  </div>
);

export default Dashboard;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  Plus,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Wallet,
  Repeat,
  TrendingUp as TrendingUpAlt,
  Crown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
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
import { authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';

/* ---------------------------- helpers ---------------------------- */

const buildSparkline = (data, length = 14) => {
  if (data && data.length >= 2) return data;
  const out = [];
  let v = 30 + Math.random() * 20;
  for (let i = 0; i < length; i += 1) {
    v += (Math.random() - 0.45) * 10;
    out.push({ i, v: Math.max(5, v) });
  }
  return out;
};

const formatHourLabel = (h) => {
  const hh = h % 24;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const dh = hh % 12 === 0 ? 12 : hh % 12;
  return `${dh} ${ampm}`;
};

const buildHourlyTrend = (orders) => {
  const buckets = {};
  for (let h = 9; h <= 23; h += 1) buckets[h] = 0;
  orders.forEach((o) => {
    if (o.status !== 'completed') return;
    const t = new Date(o.timestamp || o.created_at || Date.now());
    const h = t.getHours();
    if (buckets[h] !== undefined) buckets[h] += Number(o.total) || 0;
  });
  return Object.keys(buckets).map((h) => ({
    period: formatHourLabel(Number(h)),
    sales: Math.round(buckets[h]),
  }));
};

/* ------------------------- small components ------------------------- */

const KpiCard = ({ icon: Icon, iconBg, iconColor, label, value, delta, trend, sparkColor, sparkData }) => {
  const positive = trend === 'up';
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
        <span className={`flex items-center gap-0.5 font-semibold ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {delta}
        </span>
        <span className="text-gray-400">vs yesterday</span>
      </div>
      <div className="-mx-3 -mb-2 mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill={`url(#grad-${label})`} />
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
  const map = {
    preparing: 'bg-orange-50 text-orange-600',
    ready: 'bg-emerald-50 text-emerald-600',
    pending: 'bg-amber-50 text-amber-600',
    completed: 'bg-blue-50 text-blue-600',
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 align-middle" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

/* ------------------------------ main ------------------------------ */

const Dashboard = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date(), []);
  const dateLabel = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, menuRes] = await Promise.all([
        authFetch('/api/orders'),
        authFetch('/api/menu-items'),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const menuData = menuRes.ok ? await menuRes.json() : [];
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setMenuItems(Array.isArray(menuData) ? menuData : []);
    } catch (e) {
      setOrders([]);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) navigate('/login');
    loadData();
  }, [navigate, loadData]);

  /* metrics */
  const completed = orders.filter((o) => o.status === 'completed');
  const totalOrders = orders.length;
  const totalSales = completed.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalItems = completed.reduce(
    (s, o) => s + (Array.isArray(o.items) ? o.items.reduce((a, b) => a + (b.quantity || b.qty || 0), 0) : 0),
    0
  );
  const customers = new Set(completed.map((o) => o.customer_name || o.table_name || o.id)).size;

  const liveOrders = orders.filter(
    (o) => o.status && !['completed', 'cancelled', 'delivered'].includes(o.status.toLowerCase())
  );

  /* sales overview last 7 days */
  const last7 = useMemo(() => {
    const buckets = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { period: d.toLocaleDateString('en-US', { weekday: 'short' }), sales: 0 };
    }
    completed.forEach((o) => {
      const key = new Date(o.timestamp || o.created_at || Date.now()).toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].sales += Number(o.total) || 0;
    });
    return Object.values(buckets);
  }, [completed]);

  /* orders by type */
  const byTypeRaw = completed.reduce((acc, o) => {
    const k = (o.type || 'DINE_IN').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const orderTypeData = [
    { name: 'Dine-In', value: byTypeRaw.DINE_IN || 0, color: '#f97316' },
    { name: 'Takeaway', value: byTypeRaw.TAKEAWAY || 0, color: '#10b981' },
    { name: 'QR Order', value: byTypeRaw.QR_CODE || 0, color: '#3b82f6' },
  ];
  const totalTypeCount = orderTypeData.reduce((s, t) => s + t.value, 0) || totalOrders;

  /* top selling items */
  const itemSalesMap = {};
  completed.forEach((o) => {
    (o.items || []).forEach((it) => {
      const key = it.name;
      if (!key) return;
      if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, revenue: 0, orders: 0 };
      itemSalesMap[key].revenue += (Number(it.price) || 0) * (it.quantity || it.qty || 1);
      itemSalesMap[key].orders += it.quantity || it.qty || 1;
    });
  });
  const topItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxItemRevenue = Math.max(1, ...topItems.map((i) => i.revenue));

  /* recent transactions */
  const recentTx = completed.slice(-5).reverse();

  /* peak hours */
  const peakHours = buildHourlyTrend(orders);
  const peakMax = peakHours.reduce((m, p) => (p.sales > m.sales ? p : m), { period: '', sales: 0 });

  /* spark data — last 14 days revenue/orders/items/customers */
  const buildDailyMetric = (extract) => {
    const buckets = {};
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = { i: 13 - i, v: 0 };
    }
    completed.forEach((o) => {
      const key = new Date(o.timestamp || o.created_at || Date.now()).toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].v += extract(o);
    });
    return buildSparkline(Object.values(buckets));
  };

  const salesSpark = buildDailyMetric((o) => Number(o.total) || 0);
  const ordersSpark = buildDailyMetric(() => 1);
  const itemsSpark = buildDailyMetric((o) =>
    (o.items || []).reduce((a, b) => a + (b.quantity || b.qty || 0), 0)
  );
  const custSpark = buildDailyMetric(() => 1);

  /* bottom KPI bar */
  const avgOrder = completed.length ? totalSales / completed.length : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* ===== Page header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium">
            <Calendar className="w-4 h-4 text-gray-500" />
            Today, {dateLabel}
          </button>
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
          delta="12.5%"
          trend="up"
          sparkColor="#f97316"
          sparkData={ordersSpark}
        />
        <KpiCard
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="Total Sales"
          value={fmt(totalSales)}
          delta="18.2%"
          trend="up"
          sparkColor="#10b981"
          sparkData={salesSpark}
        />
        <KpiCard
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          label="Total Items"
          value={totalItems}
          delta="5.4%"
          trend="down"
          sparkColor="#f59e0b"
          sparkData={itemsSpark}
        />
        <KpiCard
          icon={Users}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          label="Total Customers"
          value={customers}
          delta="8.7%"
          trend="up"
          sparkColor="#8b5cf6"
          sparkData={custSpark}
        />
      </div>

      {/* ===== Row 2: Sales overview + Orders by type + Live orders ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <Section
          className="lg:col-span-6"
          title="Sales Overview"
          right={
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              This Week <span className="text-gray-400">▾</span>
            </button>
          }
        >
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold text-gray-900">{fmt(totalSales)}</p>
            <span className="text-xs font-semibold text-emerald-500 inline-flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> 18.2%
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
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                <Tooltip
                  cursor={{ stroke: '#fed7aa', strokeWidth: 2 }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' }}
                  formatter={(v) => [fmt(v), 'Sales']}
                />
                <Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2.5} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section className="lg:col-span-3" title="Orders by Type">
          <div className="relative h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orderTypeData} dataKey="value" innerRadius={60} outerRadius={85} stroke="none">
                  {orderTypeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
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
                {t.name}
              </div>
            ))}
          </div>
        </Section>

        <Section
          className="lg:col-span-3"
          title="Live Orders"
          right={<span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{liveOrders.length} Active</span>}
        >
          <div className="space-y-3">
            {liveOrders.slice(0, 4).map((o, idx) => {
              const status = (o.status || 'preparing').toLowerCase();
              const minutes = Math.max(
                1,
                Math.round(
                  (Date.now() - new Date(o.timestamp || o.created_at || Date.now())) / 60000
                )
              );
              const itemCount = Array.isArray(o.items) ? o.items.length : 0;
              return (
                <div key={o.id || idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-200 transition">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">Table {o.table_name || `T${idx + 1}`}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {o.type === 'TAKEAWAY' ? 'Takeaway' : 'Dine-In'} • {itemCount} items
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
            {liveOrders.length === 0 && !loading && (
              <p className="text-sm text-gray-400 text-center py-4">No live orders</p>
            )}
          </div>
        </Section>
      </div>

      {/* ===== Row 3: Top selling + Peak hours + Recent transactions ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <Section
          className="lg:col-span-4"
          title="Top Selling Items"
          right={
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              This Week <span className="text-gray-400">▾</span>
            </button>
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
                      style={{ width: `${Math.max(8, (it.revenue / maxItemRevenue) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{it.orders} orders</p>
                </div>
              </div>
            ))}
            {topItems.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            )}
          </div>
          <button className="mt-4 text-xs font-semibold text-orange-600 hover:text-orange-700">
            View full menu report →
          </button>
        </Section>

        <Section
          className="lg:col-span-4"
          title="Peak Sales Hours"
          right={
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              Today <span className="text-gray-400">▾</span>
            </button>
          }
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} barCategoryGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v).replace(/\.00$/, '')} />
                <Tooltip
                  cursor={{ fill: '#fff7ed' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
                  formatter={(v) => [fmt(v), 'Sales']}
                />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {peakHours.map((p, idx) => (
                    <Cell key={idx} fill={p.period === peakMax.period ? '#f97316' : '#fdba74'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <button className="mt-4 text-xs font-semibold text-orange-600 hover:text-orange-700">
            View full analytics →
          </button>
        </Section>

        <Section className="lg:col-span-4" title="Recent Transactions">
          <div className="space-y-3">
            {recentTx.map((o) => {
              const mins = Math.round((Date.now() - new Date(o.timestamp || o.created_at || Date.now())) / 60000);
              const idStr = `#ORD-${String(o.id).padStart(5, '0')}`;
              return (
                <div key={o.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition">
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
          <button className="mt-3 text-xs font-semibold text-orange-600 hover:text-orange-700">
            View all transactions →
          </button>
        </Section>
      </div>

      {/* ===== Bottom KPI strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <BottomKpi
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="AVERAGE ORDER VALUE"
          value={fmt(avgOrder)}
        />
        <BottomKpi
          icon={Users}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label="TABLE OCCUPANCY"
          value="68%"
        />
        <BottomKpi
          icon={Repeat}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          label="REPEAT CUSTOMERS"
          value="42%"
        />
        <BottomKpi
          icon={TrendingUpAlt}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          label="GROWTH THIS MONTH"
          value="↑ 24.5%"
        />
        <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                Total Revenue (May)
              </p>
              <p className="text-xl font-extrabold mt-0.5">{fmt(totalSales * 3)}</p>
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
        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  </div>
);

export default Dashboard;

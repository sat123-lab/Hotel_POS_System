import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Clock,
  ChefHat,
  Bell,
  CheckCircle2,
  XCircle,
  Filter,
  Calendar,
  Download,
  ChevronRight,
  Printer,
  FileText,
  Utensils,
  ShoppingBag,
  QrCode,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders', icon: Inbox, color: 'orange' },
  { id: 'pending', label: 'Pending', icon: Clock, color: 'amber' },
  { id: 'preparing', label: 'Preparing', icon: ChefHat, color: 'orange' },
  { id: 'ready', label: 'Ready', icon: Bell, color: 'emerald' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'blue' },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'rose' },
];

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600' },
  preparing: { bg: 'bg-orange-50', text: 'text-orange-600' },
  ready: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-600' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-600' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
};

const TYPE_ICON = {
  DINE_IN: Utensils,
  TAKEAWAY: ShoppingBag,
  QR_CODE: QrCode,
};

const TYPE_LABEL = {
  DINE_IN: 'Dine-In',
  TAKEAWAY: 'Takeaway',
  QR_CODE: 'QR Order',
};

const formatId = (n) => `#ORD-${n}`;
const minsAgo = (t) =>
  Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));

const StatusPill = ({ status, dot = true }) => {
  const key = (status || '').toLowerCase();
  const c = STATUS_COLORS[key] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {(status || '').charAt(0).toUpperCase() + (status || '').slice(1)}
    </span>
  );
};

const OrdersPage = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/orders');
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) navigate('/login');
    load();
  }, [navigate, load]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === 'all') return orders;
    return orders.filter((o) => (o.status || '').toLowerCase() === activeStatus);
  }, [orders, activeStatus]);

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [orders, selectedId, filteredOrders]
  );

  const exportCSV = () => {
    const headers = ['Order', 'Date', 'Table', 'Type', 'Status', 'Total'];
    const rows = filteredOrders.map((o) => [
      formatId(o.id),
      new Date(o.timestamp || o.created_at || Date.now()).toLocaleString(),
      o.table_name || '',
      TYPE_LABEL[o.type] || o.type || '',
      o.status || '',
      o.total,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const computeTotals = (o) => {
    const items = o?.items || [];
    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || it.qty || 1), 0);
    const taxRate = (locationSettings?.taxRate ?? 0.05) / 2;
    const cgst = subtotal * taxRate;
    const sgst = subtotal * taxRate;
    return { subtotal, cgst, sgst, total: subtotal + cgst + sgst };
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track all customer orders in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm">
            <Filter className="w-4 h-4 text-gray-500" /> Filter
          </button>
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" /> Today, {dateLabel}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {STATUS_TABS.map((t) => {
          const active = activeStatus === t.id;
          const count = counts[t.id] ?? 0;
          const Icon = t.icon;
          const colorMap = {
            orange: 'bg-orange-50 text-orange-600 border-orange-200',
            amber: 'bg-amber-50 text-amber-600 border-amber-200',
            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            rose: 'bg-rose-50 text-rose-600 border-rose-200',
          };
          return (
            <button
              key={t.id}
              onClick={() => setActiveStatus(t.id)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition ${
                active
                  ? `${colorMap[t.color]} shadow-sm`
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${active ? '' : 'text-gray-400'}`} />
                <span className="text-sm font-semibold">{t.label}</span>
              </div>
              <span
                className={`text-xs font-bold min-w-[22px] h-5 px-1.5 rounded-full flex items-center justify-center ${
                  active
                    ? 'bg-white/70 text-current'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Orders list */}
        <div className="lg:col-span-7 space-y-3">
          {filteredOrders.map((o) => {
            const TypeIcon = TYPE_ICON[o.type] || Utensils;
            const itemCount = Array.isArray(o.items) ? o.items.length : 0;
            const items = Array.isArray(o.items) ? o.items : [];
            const mins = minsAgo(o.timestamp || o.created_at || Date.now());
            const time = new Date(o.timestamp || o.created_at || Date.now());
            const isSelected = selected?.id === o.id;
            const totals = computeTotals(o);
            const paid =
              o.payment_status === 'paid' || o.status === 'completed' || o.status === 'delivered';
            return (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`w-full text-left bg-white rounded-2xl border p-4 transition ${
                  isSelected ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900">
                    {formatId(o.id)}{' '}
                    <span className="font-normal text-gray-400">
                      • {time.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} •{' '}
                      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <TypeIcon className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">{o.table_name || (o.customer_name || 'Counter')}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {TYPE_LABEL[o.type] || 'Dine-In'} •{' '}
                      {o.guests ? `${o.guests} Guests` : `${itemCount} items`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {mins} min ago
                    </span>
                    <p className="text-sm font-bold text-gray-900">{fmt(o.total)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {items.slice(0, 3).map((it, idx) => (
                      <span
                        key={idx}
                        className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center -ml-1 first:ml-0 ring-2 ring-white"
                        title={it.name}
                      >
                        {(it.name || '?').charAt(0).toUpperCase()}
                      </span>
                    ))}
                    <span className="text-xs text-gray-500 ml-1">
                      {itemCount} Items{' '}
                      <span className="text-orange-600 font-semibold">View Items</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={o.status || 'preparing'} />
                    <span
                      className={`text-[10px] font-semibold ${
                        paid ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
              {loading ? 'Loading orders...' : 'No orders in this category'}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        <div className="lg:col-span-5">
          {selected ? (
            <OrderDetailPanel order={selected} fmt={fmt} totals={computeTotals(selected)} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
              Select an order to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TIMELINE_STAGES = [
  { key: 'pending', label: 'Order Received' },
  { key: 'preparing', label: 'Sent to Kitchen' },
  { key: 'preparing2', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Served / Completed' },
];

const stageReached = (orderStatus, stageKey) => {
  const order = (orderStatus || '').toLowerCase();
  const flow = ['pending', 'preparing', 'preparing2', 'ready', 'completed'];
  const idxOrder = flow.indexOf(order === 'preparing' ? 'preparing2' : order);
  const idxStage = flow.indexOf(stageKey);
  if (idxOrder === -1) return false;
  return idxStage <= idxOrder;
};

const OrderDetailPanel = ({ order, fmt, totals }) => {
  const created = new Date(order.timestamp || order.created_at || Date.now());
  const status = (order.status || 'preparing').toLowerCase();
  const paid = order.payment_status === 'paid' || ['completed', 'delivered'].includes(status);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900">Order #ORD-{order.id}</p>
          <p className="text-xs text-gray-500">
            {created.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} •{' '}
            {created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={status} />
          <span
            className={`text-[10px] font-semibold ${paid ? 'text-emerald-600' : 'text-rose-500'}`}
          >
            {paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Table</p>
          <p className="text-sm font-semibold text-gray-800">{order.table_name || 'Counter'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Guests</p>
          <p className="text-sm font-semibold text-gray-800">
            {order.guests ? `${order.guests} Guests` : '-'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Order Type</p>
          <p className="text-sm font-semibold text-gray-800">{TYPE_LABEL[order.type] || 'Dine-In'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Waiter</p>
          <p className="text-sm font-semibold text-gray-800">{order.waiter_name || '-'}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">Order Timeline</p>
        <ul className="space-y-2">
          {TIMELINE_STAGES.map((stage) => {
            const reached = stageReached(status, stage.key);
            const time = reached
              ? new Date(created.getTime() + TIMELINE_STAGES.findIndex((s) => s.key === stage.key) * 60000)
              : null;
            return (
              <li key={stage.key} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${reached ? 'bg-orange-500' : 'bg-gray-200'}`}
                />
                <span className={`flex-1 ${reached ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {stage.label}
                </span>
                <span className={`text-xs ${reached ? 'text-gray-500' : 'text-gray-300'}`}>
                  {time
                    ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : '--:-- PM'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Items */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">Order Items</p>
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-orange-500 font-bold mt-0.5">{it.quantity || it.qty || 1}x</span>
                <div className="min-w-0">
                  <p className="text-gray-800 font-medium truncate">{it.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {it.note || 'Normal • Medium Spicy'}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-800">
                {fmt((Number(it.price) || 0) * (it.quantity || it.qty || 1))}
              </p>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-gray-400 text-center py-2">No items</li>
          )}
        </ul>
      </div>

      {/* Totals */}
      <div className="mt-5 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>CGST (2.5%)</span>
          <span>{fmt(totals.cgst)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>SGST (2.5%)</span>
          <span>{fmt(totals.sgst)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <span className="font-bold text-gray-900">Total Amount</span>
          <span className="font-extrabold text-orange-500">{fmt(order.total || totals.total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
          <Printer className="w-4 h-4" /> Print Bill
        </button>
        <button className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md">
          <FileText className="w-4 h-4" /> View Bill
        </button>
      </div>
    </div>
  );
};

export default OrdersPage;

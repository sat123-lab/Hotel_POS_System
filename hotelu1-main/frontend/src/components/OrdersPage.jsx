import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { io } from 'socket.io-client';
import { authFetch, getSocketUrl } from '../utils/api';
import useCurrency from '../hooks/useCurrency';

/* =================================================================
   Constants
   ================================================================= */

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

const TYPE_ICON = { DINE_IN: Utensils, TAKEAWAY: ShoppingBag, QR_CODE: QrCode };
const TYPE_LABEL = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', QR_CODE: 'QR Order' };

const TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'All Types' },
  { id: 'DINE_IN', label: 'Dine-In' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'QR_CODE', label: 'QR Order' },
];

/* =================================================================
   Helpers
   ================================================================= */

const formatId = (n) => `#ORD-${n}`;
const orderTime = (o) => new Date(o.timestamp || o.created_at || Date.now());
const minsAgo = (t) =>
  Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const StatusPill = ({ status, dot = true }) => {
  const key = (status || '').toLowerCase();
  const c = STATUS_COLORS[key] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {(status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1)}
    </span>
  );
};

/* =================================================================
   OrdersPage
   ================================================================= */

const OrdersPage = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [todayOnly, setTodayOnly] = useState(true);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const socketRef = useRef(null);
  const typeMenuRef = useRef(null);

  /* ---------------- loader ---------------- */
  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders');
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
      setSelectedId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      // keep previous list on error
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------------- real-time wiring ---------------- */
  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) {
      navigate('/login');
      return undefined;
    }
    load();

    const socket = io(getSocketUrl());
    socketRef.current = socket;
    const refresh = () => load();
    socket.on('order_created', refresh);
    socket.on('order_status_updated', refresh);
    socket.on('order_deleted', refresh);

    const poll = setInterval(load, 8000);
    const tick = setInterval(() => setTick((v) => v + 1), 30000);
    return () => {
      socket.off('order_created', refresh);
      socket.off('order_status_updated', refresh);
      socket.off('order_deleted', refresh);
      socket.disconnect();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load, navigate]);

  /* close type menu on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) {
        setShowTypeMenu(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  /* ---------------- filtering ---------------- */
  const now = new Date();

  const visibleOrders = useMemo(() => {
    let list = orders;
    if (todayOnly) list = list.filter((o) => sameDay(orderTime(o), now));
    if (typeFilter !== 'all') {
      list = list.filter((o) => (o.type || 'DINE_IN').toUpperCase() === typeFilter);
    }
    return list;
    // eslint-disable-next-line
  }, [orders, todayOnly, typeFilter]);

  const counts = useMemo(() => {
    const c = {
      all: visibleOrders.length,
      pending: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    };
    visibleOrders.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      const key = s === 'delivered' ? 'completed' : s;
      if (c[key] !== undefined) c[key] += 1;
    });
    return c;
  }, [visibleOrders]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === 'all') return visibleOrders;
    return visibleOrders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      if (activeStatus === 'completed') return s === 'completed' || s === 'delivered';
      return s === activeStatus;
    });
  }, [visibleOrders, activeStatus]);

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [orders, selectedId, filteredOrders]
  );

  /* ---------------- helpers ---------------- */
  const exportCSV = () => {
    const headers = ['Order', 'Date', 'Table', 'Type', 'Status', 'Total'];
    const rows = filteredOrders.map((o) => [
      formatId(o.id),
      orderTime(o).toLocaleString(),
      o.table_name || '',
      TYPE_LABEL[o.type] || o.type || '',
      o.status || '',
      Number(o.total) || 0,
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
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
    const subtotal = items.reduce(
      (s, it) => s + (Number(it.price) || 0) * (it.quantity || it.qty || 1),
      0
    );
    const taxRate = (locationSettings?.taxRate ?? 0.05) / 2;
    const cgst = subtotal * taxRate;
    const sgst = subtotal * taxRate;
    return { subtotal, cgst, sgst, total: subtotal + cgst + sgst };
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const activeTypeLabel =
    TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter)?.label || 'All Types';

  /* ---------------- render ---------------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all customer orders in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative" ref={typeMenuRef}>
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition ${
                typeFilter !== 'all'
                  ? 'border-orange-200 text-orange-600 bg-orange-50'
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {activeTypeLabel}
            </button>
            {showTypeMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30">
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setTypeFilter(opt.id);
                      setShowTypeMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50/60 ${
                      typeFilter === opt.id
                        ? 'text-orange-600 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition ${
              todayOnly
                ? 'border-orange-200 text-orange-600 bg-orange-50'
                : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
            }`}
            title={todayOnly ? 'Showing today only — click for all dates' : 'Showing all dates — click for today only'}
          >
            <Calendar className="w-4 h-4" />
            {todayOnly ? `Today, ${dateLabel}` : 'All Dates'}
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
                  active ? 'bg-white/70 text-current' : 'bg-gray-100 text-gray-500'
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
            const typeKey = (o.type || 'DINE_IN').toUpperCase();
            const TypeIcon = TYPE_ICON[typeKey] || Utensils;
            const items = Array.isArray(o.items) ? o.items : [];
            const itemCount = items.length;
            const mins = minsAgo(orderTime(o));
            const time = orderTime(o);
            const isSelected = selected?.id === o.id;
            const statusLower = (o.status || '').toLowerCase();
            const paid =
              o.payment_status === 'paid' ||
              statusLower === 'completed' ||
              statusLower === 'delivered';
            return (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`w-full text-left bg-white rounded-2xl border p-4 transition ${
                  isSelected
                    ? 'border-orange-300 ring-2 ring-orange-100'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900">
                    {formatId(o.id)}{' '}
                    <span className="font-normal text-gray-400">
                      •{' '}
                      {time.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                      })}{' '}
                      •{' '}
                      {time.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <TypeIcon className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">
                        {o.table_name || o.customer_name || TYPE_LABEL[typeKey] || 'Counter'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {TYPE_LABEL[typeKey] || 'Dine-In'} • {itemCount} item
                      {itemCount !== 1 ? 's' : ''}
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
                      {itemCount} Item{itemCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={o.status || 'pending'} />
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
              {loading ? 'Loading orders...' : 'No orders match your filters'}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        <div className="lg:col-span-5">
          {selected ? (
            <OrderDetailPanel
              order={selected}
              fmt={fmt}
              totals={computeTotals(selected)}
            />
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

/* =================================================================
   Order Detail Panel
   ================================================================= */

const buildTimeline = (order) => {
  const created = orderTime(order);
  const status = (order.status || 'pending').toLowerCase();
  const flowOrder = ['pending', 'preparing', 'ready', 'completed'];
  const idx = flowOrder.indexOf(status === 'delivered' ? 'completed' : status);

  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
  const updatedAt = order.updated_at ? new Date(order.updated_at) : null;

  return [
    {
      key: 'pending',
      label: 'Order Received',
      reached: idx >= 0,
      time: created,
    },
    {
      key: 'preparing',
      label: 'Sent to Kitchen',
      reached: idx >= 1,
      time: idx >= 1 ? updatedAt || null : null,
    },
    {
      key: 'ready',
      label: 'Ready to Serve',
      reached: idx >= 2,
      time: idx >= 2 ? updatedAt || null : null,
    },
    {
      key: 'completed',
      label: 'Completed / Served',
      reached: idx >= 3,
      time: idx >= 3 ? deliveredAt || updatedAt || null : null,
    },
  ];
};

const OrderDetailPanel = ({ order, fmt, totals }) => {
  const created = orderTime(order);
  const status = (order.status || 'pending').toLowerCase();
  const paid =
    order.payment_status === 'paid' || ['completed', 'delivered'].includes(status);
  const items = Array.isArray(order.items) ? order.items : [];
  const typeKey = (order.type || 'DINE_IN').toUpperCase();
  const timeline = buildTimeline(order);

  const handlePrint = () => window.print();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900">{formatId(order.id)}</p>
          <p className="text-xs text-gray-500">
            {created.toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })}{' '}
            •{' '}
            {created.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={status} />
          <span
            className={`text-[10px] font-semibold ${
              paid ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Table / Customer
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.table_name || order.customer_name || 'Counter'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Order Type
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {TYPE_LABEL[typeKey] || 'Dine-In'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Token
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.token || `${formatId(order.id)}`}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Payment
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.payment_method || (paid ? 'Cash' : 'Pending')}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Order Timeline
        </p>
        <ul className="space-y-2">
          {timeline.map((stage) => (
            <li key={stage.key} className="flex items-center gap-3 text-sm">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stage.reached ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              />
              <span
                className={`flex-1 ${
                  stage.reached ? 'text-gray-800 font-medium' : 'text-gray-400'
                }`}
              >
                {stage.label}
              </span>
              <span
                className={`text-xs ${
                  stage.reached ? 'text-gray-500' : 'text-gray-300'
                }`}
              >
                {stage.reached && stage.time
                  ? stage.time.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '--'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Items */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Order Items
        </p>
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const qty = it.quantity || it.qty || 1;
            return (
              <li
                key={idx}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-orange-500 font-bold mt-0.5">{qty}x</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">{it.name}</p>
                    {it.note && (
                      <p className="text-[11px] text-gray-400 truncate">{it.note}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {fmt((Number(it.price) || 0) * qty)}
                </p>
              </li>
            );
          })}
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
          <span className="font-extrabold text-orange-500">
            {fmt(Number(order.total) || totals.total)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
        >
          <Printer className="w-4 h-4" /> Print Bill
        </button>
        <button
          onClick={() => {
            window.location.href = '/billing';
          }}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
        >
          <FileText className="w-4 h-4" /> View Bill
        </button>
      </div>
    </div>
  );
};

export default OrdersPage;

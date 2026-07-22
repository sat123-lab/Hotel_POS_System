import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import OrderEntryModal from './OrderEntryModal';
import { Users, Plus, X } from 'lucide-react';
import useCurrency from '../hooks/useCurrency';
import { loadBranchJson, saveBranchJson } from '../utils/branchStorage';
import { formatOrderLabel } from '../utils/orderDisplay';

/* ------------------------------------------------------------------ */
/*  Helpers & constants                                                */
/* ------------------------------------------------------------------ */

const FLOORS = [
  { id: 'all', label: 'All Floors' },
  { id: 'ground', label: 'Ground Floor' },
  { id: 'first', label: 'First Floor' },
];

const STATUS_CONFIG = {
  available: {
    label: 'FREE',
    summaryLabel: 'Free',
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100/70',
    text: 'text-emerald-700',
    bigBg: 'bg-emerald-100',
    cardRing: 'ring-1 ring-emerald-50',
    showDot: false,
  },
  occupied: {
    label: 'OCCUPIED',
    summaryLabel: 'Occupied',
    dot: 'bg-orange-500',
    badgeBg: 'bg-orange-100/70',
    text: 'text-orange-600',
    bigBg: 'bg-orange-100',
    cardRing: 'ring-1 ring-orange-50',
    showDot: true,
  },
  reserved: {
    label: 'RESERVED',
    summaryLabel: 'Reserved',
    dot: 'bg-yellow-400',
    badgeBg: 'bg-yellow-100/80',
    text: 'text-yellow-700',
    bigBg: 'bg-yellow-100',
    cardRing: 'ring-1 ring-yellow-50',
    showDot: false,
  },
  cleaning: {
    label: 'CLEANING',
    summaryLabel: 'Cleaning',
    dot: 'bg-blue-500',
    badgeBg: 'bg-blue-100/70',
    text: 'text-blue-600',
    bigBg: 'bg-blue-100',
    cardRing: 'ring-1 ring-blue-50',
    showDot: false,
  },
};

const initialTables = [
  { id: 'T1', capacity: 4, floor: 'ground', status: 'available' },
  { id: 'T2', capacity: 2, floor: 'ground', status: 'available' },
  { id: 'T3', capacity: 6, floor: 'ground', status: 'available' },
  { id: 'T4', capacity: 4, floor: 'ground', status: 'available' },
  { id: 'T5', capacity: 8, floor: 'ground', status: 'available' },
  { id: 'T6', capacity: 2, floor: 'ground', status: 'available' },
  { id: 'T7', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T8', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T9', capacity: 6, floor: 'first', status: 'available' },
  { id: 'T10', capacity: 2, floor: 'first', status: 'available' },
  { id: 'T11', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T12', capacity: 10, floor: 'first', status: 'available' },
];

const tableIdMatches = (tableId, tableName) => {
  if (!tableName) return false;
  const normalizedTableId = String(tableId).replace(/^T/i, '');
  const normalizedTableName = String(tableName).replace(/Table\s*/i, '');
  return normalizedTableId === normalizedTableName || tableId === tableName;
};

const orderHasItems = (order) => {
  if (!order) return false;
  const items = order.items || [];
  return items.length > 0;
};

const minutesSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 60000);
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DineInManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const navigate = useNavigate();

  const [tables, setTables] = useState(() =>
    loadBranchJson('dineInTables_v1', initialTables)
  );
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeFloor, setActiveFloor] = useState('all');
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTable, setNewTable] = useState({ capacity: 4, floor: 'ground' });
  const [statusPickMode, setStatusPickMode] = useState(null);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveNote, setReserveNote] = useState('');
  const [, setTick] = useState(0);

  /* ------------------------------ auth ------------------------------ */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    saveBranchJson('dineInTables_v1', tables);
  }, [tables]);

  /* ------------------------------ fetch ----------------------------- */
  const updateTableStatuses = useCallback((orders) => {
    setTables((prev) =>
      prev.map((table) => {
        const tableOrder = orders.find(
          (o) =>
            orderHasItems(o) &&
            tableIdMatches(table.id, o.table_name) &&
            o.status !== 'completed' &&
            o.bill_status !== 'paid'
        );

        if (!tableOrder) {
          if (table.manualStatus === 'reserved') {
            return { ...table, status: 'reserved' };
          }
          if (table.manualStatus === 'occupied') {
            return { ...table, status: 'occupied' };
          }
          if (table.status === 'cleaning') return table;
          return {
            ...table,
            status: 'available',
            manualStatus: null,
            reservationNote: '',
          };
        }
        if (tableOrder.status === 'delivered' && tableOrder.bill_status !== 'paid') {
          return { ...table, status: 'reserved', manualStatus: null, reservationNote: '' };
        }
        return { ...table, status: 'occupied', manualStatus: null, reservationNote: '' };
      })
    );
  }, []);

  const fetchOrdersAndSync = useCallback(async () => {
    try {
      const response = await authFetch('/api/orders?type=DINE_IN');
      if (!response.ok) {
        setActiveOrders([]);
        return;
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        setActiveOrders([]);
        return;
      }
      const filteredOrders = data.filter(
        (o) => o.status !== 'completed' && orderHasItems(o)
      );
      setActiveOrders(filteredOrders);
      updateTableStatuses(data);
    } catch (err) {
      console.error('Failed to fetch DINE_IN orders:', err);
      setActiveOrders([]);
    }
  }, [updateTableStatuses]);

  useEffect(() => {
    fetchOrdersAndSync();
    const orderInterval = setInterval(fetchOrdersAndSync, 2000);
    const timeTick = setInterval(() => setTick((v) => v + 1), 60000);
    return () => {
      clearInterval(orderInterval);
      clearInterval(timeTick);
    };
  }, [fetchOrdersAndSync]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  /* ---------------------------- handlers ---------------------------- */
  const applyManualTableStatus = (tableId, status, note = '') => {
    const tableOrder = activeOrders.find((order) =>
      tableIdMatches(tableId, order.table_name)
    );

    if (status === 'available') {
      if (tableOrder && orderHasItems(tableOrder)) {
        setNotification({
          message: 'Cannot mark free — active order on this table. Complete payment first.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 3000);
        return false;
      }
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'available', manualStatus: null, reservationNote: '' }
            : t
        )
      );
    } else if (status === 'reserved') {
      if (tableOrder && orderHasItems(tableOrder)) {
        setNotification({
          message: 'Table has an active order — cannot reserve.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 3000);
        return false;
      }
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: 'reserved',
                manualStatus: 'reserved',
                reservationNote: note.trim(),
              }
            : t
        )
      );
    } else if (status === 'occupied') {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'occupied', manualStatus: 'occupied', reservationNote: '' }
            : t
        )
      );
    } else if (status === 'cleaning') {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'cleaning', manualStatus: null, reservationNote: '' }
            : t
        )
      );
    }

    setStatusPickMode(null);
    setNotification({
      message: `Table ${tableId} marked as ${STATUS_CONFIG[status]?.summaryLabel || status}`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 2500);
    return true;
  };

  const handleSummaryClick = (status) => {
    if (statusPickMode === status) {
      setStatusPickMode(null);
      setNotification(null);
      return;
    }
    setStatusPickMode(status);
    setNotification({
      message: `Click a table to mark as ${STATUS_CONFIG[status].summaryLabel}`,
      type: 'info',
    });
  };

  const handleTableClick = (table) => {
    if (statusPickMode) {
      if (statusPickMode === 'reserved') {
        setReserveTarget(table);
        setReserveNote(table.reservationNote || '');
        setShowReserveModal(true);
        return;
      }
      applyManualTableStatus(table.id, statusPickMode);
      return;
    }
    setSelectedTable(table);
    setShowOrderModal(true);
  };

  const handleConfirmReservation = () => {
    if (!reserveTarget) return;
    applyManualTableStatus(reserveTarget.id, 'reserved', reserveNote);
    setShowReserveModal(false);
    setReserveTarget(null);
    setReserveNote('');
  };

  const handleOrderPlaced = async (placedOrder) => {
    try {
      fetchOrdersAndSync();
      setNotification({
        message: `Order for ${selectedTable.id} placed! (${formatOrderLabel(placedOrder)})`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error handling placed order:', error);
      setNotification({ message: 'Error handling order.', type: 'error' });
    }
    setShowOrderModal(false);
    setSelectedTable(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteEmptyOrder = async (order) => {
    try {
      const deleteResponse = await authFetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });
      if (!deleteResponse.ok) throw new Error('Failed to delete empty order');
      setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (error) {
      console.error('Error deleting empty order:', error);
    }
  };

  const handleMarkTableAvailable = async (tableId) => {
    try {
      const tableOrder = activeOrders.find((order) =>
        tableIdMatches(tableId, order.table_name)
      );
      if (tableOrder && tableOrder.status === 'delivered') {
        await authFetch(`/api/orders/${tableOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
      }
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'cleaning', manualStatus: null, reservationNote: '' }
            : t
        )
      );
      setNotification({ message: `Table ${tableId} is being cleaned…`, type: 'info' });
      setTimeout(() => {
        setTables((prev) =>
          prev.map((t) =>
            t.id === tableId
              ? { ...t, status: 'available', manualStatus: null, reservationNote: '' }
              : t
          )
        );
        setNotification({
          message: `Table ${tableId} is now available!`,
          type: 'success',
        });
        fetchOrdersAndSync();
        setTimeout(() => setNotification(null), 2500);
      }, 3000);
    } catch (error) {
      console.error('Error marking table available:', error);
      setNotification({ message: 'Error marking table available.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddTable = () => {
    const existingNumbers = tables
      .map((t) => parseInt(String(t.id).replace(/^T/i, ''), 10))
      .filter((n) => !Number.isNaN(n));
    const nextNum = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;
    setTables((prev) => [
      ...prev,
      {
        id: `T${nextNum}`,
        capacity: Math.max(2, Math.min(20, Number(newTable.capacity) || 4)),
        floor: newTable.floor || 'ground',
        status: 'available',
      },
    ]);
    setShowAddTable(false);
    setNewTable({ capacity: 4, floor: 'ground' });
    setNotification({ message: `Table T${nextNum} added.`, type: 'success' });
    setTimeout(() => setNotification(null), 2500);
  };

  /* ---------------------------- derived ---------------------------- */
  const summaryCounts = useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    tables.forEach((t) => {
      const s = t.status === 'waiting_payment' ? 'reserved' : t.status;
      if (s in c) c[s] += 1;
    });
    return c;
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (activeFloor === 'all') return tables;
    return tables.filter((t) => t.floor === activeFloor);
  }, [tables, activeFloor]);

  const orderForTable = useCallback(
    (tableId) =>
      activeOrders.find(
        (o) =>
          orderHasItems(o) &&
          tableIdMatches(tableId, o.table_name) &&
          o.status !== 'completed' &&
          o.bill_status !== 'paid'
      ),
    [activeOrders]
  );

  /* ----------------------------- render ----------------------------- */
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
            Table Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time occupancy and visual floor management system
          </p>
        </div>
        <button
          onClick={() => setShowAddTable(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <Plus className="w-4 h-4" />
          ADD TABLE
        </button>
      </div>

      {notification && (
        <div className="mb-3">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </div>
      )}

      {/* Summary cards — click Free / Occupied / Reserved, then click a table */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {['available', 'occupied', 'reserved', 'cleaning'].map((status, idx) => {
          const cfg = STATUS_CONFIG[status];
          const isPickActive = statusPickMode === status;
          const isInteractive = ['available', 'occupied', 'reserved'].includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => isInteractive && handleSummaryClick(status)}
              disabled={!isInteractive}
              className={`text-left bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4 transition-all ${
                isPickActive
                  ? 'border-orange-400 ring-2 ring-orange-200 shadow-md scale-[1.02]'
                  : 'border-gray-100 hover:shadow-md'
              } ${isInteractive ? 'cursor-pointer hover:border-orange-200' : 'cursor-default'}`}
              style={{
                animation: isLoaded
                  ? `slideUpFade .35s ease-out ${idx * 60}ms both`
                  : 'none',
              }}
              title={
                isInteractive
                  ? `Click, then select a table to mark as ${cfg.summaryLabel}`
                  : cfg.summaryLabel
              }
            >
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {summaryCounts[status]}
                </p>
                <p className="text-xs text-gray-500 mt-1">{cfg.summaryLabel}</p>
                {isPickActive && (
                  <p className="text-[10px] text-orange-600 font-semibold mt-1 uppercase tracking-wide">
                    Select table
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {statusPickMode && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
          <span>
            Mode: mark table as{' '}
            <strong>{STATUS_CONFIG[statusPickMode]?.summaryLabel}</strong> — click a table below
          </span>
          <button
            type="button"
            onClick={() => {
              setStatusPickMode(null);
              setNotification(null);
            }}
            className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-200 hover:bg-orange-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floor tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FLOORS.map((f) => {
          const active = activeFloor === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFloor(f.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/60 scale-[1.02]'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {filteredTables.map((table, idx) => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
          const tableOrder = orderForTable(table.id);
          const isOccupied = table.status === 'occupied';
          const isReserved = table.status === 'reserved';

          const occupiedMin =
            tableOrder && (tableOrder.created_at || tableOrder.createdAt)
              ? minutesSince(tableOrder.created_at || tableOrder.createdAt)
              : null;
          const guestsOccupied =
            isOccupied && tableOrder
              ? Math.max(
                  1,
                  Math.min(
                    table.capacity,
                    Math.ceil((tableOrder.items?.length || 1) / 1.5)
                  )
                )
              : 0;
          const orderValue = tableOrder?.total || 0;

          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (table.status !== 'available') {
                  handleMarkTableAvailable(table.id);
                }
              }}
              className={`relative text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 ${cfg.cardRing} hover:-translate-y-0.5`}
              style={{
                animation: isLoaded
                  ? `cardPop .35s ease-out ${Math.min(idx * 35, 600)}ms both`
                  : 'none',
              }}
              title={
                statusPickMode
                  ? `Mark as ${STATUS_CONFIG[statusPickMode]?.summaryLabel}`
                  : table.status !== 'available'
                    ? 'Click to add items · Right-click to mark available'
                    : 'Click to place a new order'
              }
            >
              {cfg.showDot && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100 animate-pulse-soft" />
              )}

              {/* Big square badge */}
              <div className={`mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${cfg.bigBg} flex items-center justify-center`}>
                <span className={`text-2xl sm:text-3xl font-extrabold ${cfg.text}`}>
                  {table.id}
                </span>
              </div>

              {/* Status pill */}
              <div className="flex justify-center mt-3">
                <span
                  className={`inline-flex items-center text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full ${cfg.badgeBg} ${cfg.text}`}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Footer info */}
              {isOccupied ? (
                <div className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Users className="w-3 h-3" />
                    <span className="font-semibold tracking-wide text-gray-700">
                      {guestsOccupied}/{table.capacity}
                    </span>
                    <span className="uppercase text-gray-400 ml-0.5">Guests</span>
                  </div>
                  {occupiedMin !== null && (
                    <p className="uppercase text-gray-400 tracking-wider">
                      <span className="font-semibold text-gray-700">{occupiedMin}m</span>{' '}
                      Occupied
                    </p>
                  )}
                  {orderValue > 0 && (
                    <p className="uppercase text-gray-400 tracking-wider flex items-center justify-between">
                      <span>Order Value</span>
                      <span className="font-semibold text-orange-500 normal-case">
                        {fmt(orderValue)}
                      </span>
                    </p>
                  )}
                </div>
              ) : isReserved ? (
                <div className="mt-3 space-y-1 text-[11px]">
                  {table.reservationNote ? (
                    <p className="text-center text-yellow-700 font-medium truncate px-1">
                      {table.reservationNote}
                    </p>
                  ) : (
                    <p className="text-center text-yellow-600 font-medium">Phone booking</p>
                  )}
                  <div className="flex items-center justify-center gap-1.5 text-gray-500">
                    <Users className="w-3 h-3" />
                    <span className="font-semibold tracking-wide">
                      0/{table.capacity}
                    </span>
                    <span className="uppercase text-gray-400">Guests</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                  <Users className="w-3 h-3" />
                  <span className="font-semibold tracking-wide">
                    0/{table.capacity}
                  </span>
                  <span className="uppercase text-gray-400">Guests</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Table</h3>
              <button
                onClick={() => setShowAddTable(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newTable.capacity}
                  onChange={(e) =>
                    setNewTable((p) => ({ ...p, capacity: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Floor
                </label>
                <select
                  value={newTable.floor}
                  onChange={(e) =>
                    setNewTable((p) => ({ ...p, floor: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
                >
                  <option value="ground">Ground Floor</option>
                  <option value="first">First Floor</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddTable(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTable}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation modal */}
      {showReserveModal && reserveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Reserve {reserveTarget.id}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowReserveModal(false);
                  setReserveTarget(null);
                  setReserveNote('');
                }}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Guest name / phone (optional)
            </label>
            <input
              type="text"
              value={reserveNote}
              onChange={(e) => setReserveNote(e.target.value)}
              placeholder="e.g. Raju · 9876543210"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Use Free mode and click this table again to clear a no-show reservation.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowReserveModal(false);
                  setReserveTarget(null);
                  setReserveNote('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReservation}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md"
              >
                Reserve Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Entry Modal */}
      {showOrderModal && (
        <OrderEntryModal
          table={
            editingOrder
              ? { id: editingOrder.table_name, status: 'occupied', capacity: 0 }
              : selectedTable
          }
          onClose={async () => {
            if (selectedTable?.id) {
              try {
                const res = await authFetch(
                  `/api/orders?type=DINE_IN&tableId=${encodeURIComponent(selectedTable.id)}`
                );
                if (res.ok) {
                  const tableOrders = await res.json();
                  if (Array.isArray(tableOrders)) {
                    for (const o of tableOrders) {
                      if (!orderHasItems(o)) {
                        await handleDeleteEmptyOrder(o);
                      }
                    }
                  }
                }
              } catch {
                /* non-fatal */
              }
            }
            if (editingOrder && (!editingOrder.items || editingOrder.items.length === 0)) {
              await handleDeleteEmptyOrder(editingOrder);
            }
            setShowOrderModal(false);
            setEditingOrder(null);
            setSelectedTable(null);
            fetchOrdersAndSync();
          }}
          onOrderPlaced={
            editingOrder
              ? (orderData) => {
                  setActiveOrders((prev) =>
                    prev.map((o) =>
                      o.id === editingOrder.id
                        ? { ...o, items: orderData.items, total: orderData.total }
                        : o
                    )
                  );
                  setNotification({
                    message: `Order for ${editingOrder.table_name} updated!`,
                    type: 'success',
                  });
                  setEditingOrder(null);
                  setTimeout(() => setNotification(null), 3000);
                }
              : handleOrderPlaced
          }
          locationSettings={locationSettings}
          nextOrderId={nextOrderId}
          setNextOrderId={setNextOrderId}
          orderType="DINE_IN"
          initialOrder={editingOrder}
        />
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardPop {
          from { opacity: 0; transform: translateY(10px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: .8; }
        }
        .animate-pulse-soft { animation: pulseSoft 1.8s ease-in-out infinite; }
        .animate-modal-in { animation: fadeScale .22s ease-out both; }
      `}</style>
    </div>
  );
};

export default DineInManagement;

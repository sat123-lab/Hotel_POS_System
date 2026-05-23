import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { authFetch, getAPI_URL, getSocketUrl } from '../utils/api';
import Notification from './Notification';
import QRCode from 'qrcode';
import { getUPIConfig } from '../config/upiConfig';
import {
  CheckCircle2,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  Download,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import useCurrency from '../hooks/useCurrency';
import {
  loadRestaurantInfo as loadRestaurantInfoShared,
  buildKitchenSlipHtml as buildKitchenSlipHtmlShared,
  buildCustomerReceiptHtml as buildCustomerReceiptHtmlShared,
  calculateTotals as calcReceiptTotalsShared,
  openReceiptForPrint,
} from '../utils/receiptPrint';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'paid', label: 'Paid' },
];

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Pending' },
  preparing: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Preparing' },
  ready: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Ready' },
  delivered: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Delivered' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Cancelled' },
};

const isOrderPaid = (o) => {
  const s = String(o?.status || '').toLowerCase();
  const b = String(o?.bill_status || '').toLowerCase();
  return (
    s === 'completed' ||
    s === 'paid' ||
    b === 'paid' ||
    !!o?.payment_method ||
    !!o?.paid_at
  );
};

const effectiveStatus = (o) => {
  if (isOrderPaid(o)) return 'paid';
  return String(o?.status || 'pending').toLowerCase();
};

const StatusPill = ({ status }) => {
  const key = String(status || '').toLowerCase();
  const s =
    STATUS_STYLES[key] || { bg: 'bg-gray-100', text: 'text-gray-600', label: key };
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
};

const formatTime = (d) => {
  try {
    return new Date(d).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (_) {
    return '';
  }
};

const tableShort = (name) => {
  if (!name) return '';
  return String(name).replace(/^Table\s*/i, 'T');
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const BillingPage = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);

  /* ----------------------------- state ----------------------------- */
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [, setSelectedBill] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notification, setNotification] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [manualTaxRate, setManualTaxRate] = useState(5);
  const [activeStatus, setActiveStatus] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(null);
  const [paying, setPaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const billRef = useRef(null);
  const socketRef = useRef(null);

  const taxRate = manualTaxRate / 100;

  /* --------------------------- settings --------------------------- */
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${getAPI_URL()}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setDiscountPercent(data.discountPercent ?? 0);
        setManualTaxRate(data.taxPercent ?? 5);
        localStorage.setItem('globalTaxDiscount', JSON.stringify(data));
        return;
      }
      const saved = localStorage.getItem('globalTaxDiscount');
      if (saved) {
        const parsed = JSON.parse(saved);
        setDiscountPercent(parsed.discountPercent ?? 0);
        setManualTaxRate(parsed.taxPercent ?? 5);
      }
    } catch (error) {
      const saved = localStorage.getItem('globalTaxDiscount');
      if (saved) {
        const parsed = JSON.parse(saved);
        setDiscountPercent(parsed.discountPercent ?? 0);
        setManualTaxRate(parsed.taxPercent ?? 5);
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /* --------------------------- fetch orders --------------------------- */
  const fetchAllOrders = useCallback(() => {
    authFetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        const filtered = all.filter(
          (o) => o.type !== 'TAKEAWAY' && o.table_name !== 'Takeaway'
        );
        setOrders(filtered);
      })
      .catch((err) => {
        console.error('Error fetching orders for billing:', err);
        setOrders([]);
      });
  }, []);

  useEffect(() => {
    fetchAllOrders();
    const poll = setInterval(fetchAllOrders, 3000);

    const socket = io(getSocketUrl());
    socketRef.current = socket;
    const refresh = () => fetchAllOrders();
    socket.on('order_created', refresh);
    socket.on('order_status_updated', refresh);
    socket.on('order_deleted', refresh);

    return () => {
      socket.off('order_created', refresh);
      socket.off('order_status_updated', refresh);
      socket.off('order_deleted', refresh);
      socket.disconnect();
      clearInterval(poll);
    };
  }, [fetchAllOrders]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  /* --------------------------- helpers --------------------------- */
  const calculateTotals = (
    order,
    discount = 0,
    discountTypeParam = 'percent',
    taxRateParam = null
  ) => {
    if (!order)
      return {
        subtotal: 0,
        discount: 0,
        discountAmount: 0,
        afterDiscount: 0,
        cgst: 0,
        sgst: 0,
        cgstPercent: 0,
        sgstPercent: 0,
        tax: 0,
        total: 0,
      };
    const subtotal = (order.items || []).reduce(
      (sum, item) => sum + item.price * (item.quantity || item.qty),
      0
    );
    let discountAmount = 0;
    if (discount > 0) {
      discountAmount =
        discountTypeParam === 'percent' ? subtotal * (discount / 100) : discount;
    }
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const effectiveTaxRate = taxRateParam !== null ? taxRateParam : taxRate;
    // Split GST as CGST + SGST so the on-screen total panel and the
    // printed bill use the exact same breakdown.
    const halfRate = effectiveTaxRate / 2;
    const cgst = afterDiscount * halfRate;
    const sgst = afterDiscount * halfRate;
    const tax = cgst + sgst;
    const total = afterDiscount + tax;
    return {
      subtotal,
      discount,
      discountAmount,
      afterDiscount,
      cgst,
      sgst,
      cgstPercent: halfRate * 100,
      sgstPercent: halfRate * 100,
      tax,
      total,
    };
  };

  const generateUPIQRCode = async (amount, orderId) => {
    try {
      const upiConfig = getUPIConfig();
      const upiDetails = {
        pa: upiConfig.upiId,
        pn: upiConfig.payeeName,
        am: amount.toFixed(2),
        cu: upiConfig.currency,
        tn: upiConfig.transactionNoteTemplate.replace('{orderId}', orderId),
        mc: upiConfig.merchantCategoryCode,
        tr: `ORD${orderId}${Date.now()}`,
      };
      const upiUrl = `upi://pay?${new URLSearchParams(upiDetails).toString()}`;
      return await QRCode.toDataURL(upiUrl, upiConfig.qrCodeOptions);
    } catch (error) {
      console.error('Error generating UPI QR code:', error);
      return null;
    }
  };

  const groupItemsByName = (items) => {
    const grouped = {};
    (items || []).forEach((item) => {
      const name = item.name;
      if (!grouped[name]) {
        grouped[name] = { name, quantity: 0, price: item.price, totalPrice: 0 };
      }
      const qty = item.quantity || item.qty || 1;
      grouped[name].quantity += qty;
      grouped[name].totalPrice += item.price * qty;
    });
    return Object.values(grouped);
  };

  const fetchBillForOrder = async (orderId) => {
    try {
      const response = await authFetch(`/api/orders/${orderId}/bill`);
      if (response.ok) {
        const bill = await response.json();
        setSelectedBill(bill);
        return bill;
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
    }
    return null;
  };

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    const savedSettings = localStorage.getItem('globalTaxDiscount');
    const settings = savedSettings
      ? JSON.parse(savedSettings)
      : { taxPercent: 5, discountPercent: 0 };
    setDiscountPercent(settings.discountPercent || 0);
    setDiscountType('percent');
    setManualTaxRate(settings.taxPercent || 5);

    const bill = await fetchBillForOrder(order.id);
    if (!bill) {
      const totals = calculateTotals(order, 0, 'percent');
      setSelectedBill({
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        bill_status: 'pending',
      });
    }
  };

  /* --------------------------- payment --------------------------- */
  const handleCompletePayment = async (overrideMethod) => {
    if (paying) return;
    if (!selectedOrder) {
      setNotification({
        message: 'Please select an order to process payment.',
        type: 'error',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (isOrderPaid(selectedOrder)) {
      setNotification({
        message: 'This order has already been paid.',
        type: 'info',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const method = overrideMethod || paymentMethod;
    const totals = calculateTotals(selectedOrder, discountPercent, discountType);

    setPaying(true);
    try {
      const response = await authFetch(
        `/api/orders/${selectedOrder.id}/complete-payment`,
        {
          method: 'PUT',
          body: JSON.stringify({
            payment_method: method,
            paid_amount: totals.total || selectedOrder.total,
            discount: discountPercent,
            tax_rate: taxRate,
          }),
        }
      );

      if (!response.ok) throw new Error('Payment failed');

      // Snapshot the just-paid order so we can print after the
      // local state updates (printing reads from selectedOrder).
      const paidOrder = {
        ...selectedOrder,
        status: 'completed',
        payment_method: method,
        bill_status: 'paid',
      };

      setShowPaymentModal(false);
      setSuccessAmount(totals.total || selectedOrder.total);
      setTimeout(() => setSuccessAmount(null), 1800);

      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? paidOrder : o))
      );
      setSelectedOrder(paidOrder);

      // Auto-print the bill (thermal 80mm; takeaway = kitchen
      // token + customer copy, dine-in = customer copy only). The
      // print dialog opens in a new window — the cashier can hit
      // Cancel if a paper copy isn't required.
      printBillForOrder(paidOrder, method);

      fetchAllOrders();
    } catch (error) {
      console.error('Error completing payment:', error);
      setNotification({ message: 'Error completing payment.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setPaying(false);
    }
  };

  // Internal helper that prints any specific order using the same
  // shared 80mm renderer the View Bill modal uses. Kept separate
  // from `handlePrintBill` (which prints the currently-selected
  // order) so the auto-print after payment is robust to React state
  // not having flushed yet.
  const printBillForOrder = (order, method) => {
    if (!order) return;
    const taxPercent = Number((taxRate * 100).toFixed(2));
    const totals = calcReceiptTotalsShared(order, {
      taxPercent,
      discountPercent,
      discountType,
    });
    const info = loadRestaurantInfoShared();
    const isTakeaway = String(order.type).toUpperCase() === 'TAKEAWAY';
    const paymentLabel = String(method || 'Cash').toUpperCase();
    const kitchenSlipHtml = isTakeaway
      ? buildKitchenSlipHtmlShared(order, info)
      : '';
    const customerHtml = buildCustomerReceiptHtmlShared(order, totals, info, {
      qrCodeDataUrl: '',
      paymentLabel,
    });
    openReceiptForPrint(
      `${kitchenSlipHtml}${customerHtml}`,
      `Bill #${order.id}`
    );
  };

  /* --------------------------- print ---------------------------
     The receipt rendering logic lives in utils/receiptPrint.js so
     the View Bill modal on the Orders page and the printed thermal
     slip stay in lock-step (CGST + SGST split, configured tax %,
     etc.). */
  const handlePrintBill = async () => {
    if (!selectedOrder) {
      setNotification({ message: 'No order selected to print.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const isTakeaway = String(selectedOrder.type).toUpperCase() === 'TAKEAWAY';

    // Use the shared receipt calculator so the printed bill, the
    // View Bill modal on the Orders page, and the on-screen totals
    // panel all show identical numbers — including the CGST + SGST
    // split. taxRate already reflects whatever the user saved under
    // Settings → Billing & Taxation, so this is the source of truth.
    const taxPercent = Number((taxRate * 100).toFixed(2));
    const receiptTotals = calcReceiptTotalsShared(selectedOrder, {
      taxPercent,
      discountPercent,
      discountType,
    });
    const info = loadRestaurantInfoShared();

    // Only generate the UPI QR when the bill isn't already paid.
    let qrCodeDataUrl = '';
    if (!isOrderPaid(selectedOrder) || paymentMethod === 'upi') {
      qrCodeDataUrl =
        (await generateUPIQRCode(receiptTotals.total, selectedOrder.id)) || '';
    }

    const paymentLabel =
      paymentMethod === 'cash'
        ? 'Cash'
        : paymentMethod === 'upi'
        ? 'UPI'
        : paymentMethod === 'card'
        ? 'Card'
        : String(paymentMethod || 'Cash');

    const kitchenSlipHtml = isTakeaway
      ? buildKitchenSlipHtmlShared(selectedOrder, info)
      : '';
    const customerHtml = buildCustomerReceiptHtmlShared(
      selectedOrder,
      receiptTotals,
      info,
      { qrCodeDataUrl, paymentLabel }
    );

    openReceiptForPrint(
      `${kitchenSlipHtml}${customerHtml}`,
      `Bill #${selectedOrder.id}`
    );
  };

  /* --------------------------- export csv --------------------------- */
  const handleExport = () => {
    const rows = filteredOrders.map((o) => {
      const items = (o.items || [])
        .map((it) => `${it.quantity || it.qty || 1}x ${it.name}`)
        .join(' | ');
      return [
        `#${o.id}`,
        o.table_name || '',
        STATUS_STYLES[effectiveStatus(o)]?.label || effectiveStatus(o),
        items,
        Number(o.total) || 0,
      ];
    });
    const headers = ['Order', 'Table', 'Status', 'Items', 'Total'];
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* --------------------------- derived --------------------------- */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (activeStatus === 'all') return true;
      return effectiveStatus(o) === activeStatus;
    });
  }, [orders, activeStatus]);

  const currentOrderTotals = useMemo(
    () => calculateTotals(selectedOrder, discountPercent, discountType),
    // eslint-disable-next-line
    [selectedOrder, discountPercent, discountType, manualTaxRate]
  );

  const groupedItems = useMemo(
    () => groupItemsByName(selectedOrder?.items || []),
    [selectedOrder]
  );

  const selectedStatus = selectedOrder ? effectiveStatus(selectedOrder) : null;
  const isSelectedPaid = selectedOrder ? isOrderPaid(selectedOrder) : false;

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate bills for completed orders
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] text-sm font-medium shadow-sm transition"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_TABS.map((t) => {
          const active = activeStatus === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveStatus(t.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/60 scale-[1.02]'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Notification */}
      {notification && (
        <div className="mb-3">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Orders list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Orders</h2>
            <span className="text-xs text-gray-500">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 custom-scroll">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-sm text-gray-400">No orders in this category</p>
              </div>
            ) : (
              filteredOrders.map((order, idx) => {
                const isSel = selectedOrder?.id === order.id;
                const status = effectiveStatus(order);
                const itemCount = (order.items || []).reduce(
                  (s, it) => s + (it.quantity || it.qty || 1),
                  0
                );
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left rounded-xl p-4 transition-all duration-200 border ${
                      isSel
                        ? 'bg-white border-orange-300 shadow-sm ring-2 ring-orange-100'
                        : 'bg-gray-50/70 border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
                    }`}
                    style={{
                      animation: isLoaded
                        ? `slideUpFade .35s ease-out ${idx * 30}ms both`
                        : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-bold text-gray-900">
                          #{order.id}
                        </span>
                        {order.table_name && (
                          <span className="text-xs text-gray-500">
                            Table {tableShort(order.table_name)}
                          </span>
                        )}
                      </div>
                      <StatusPill status={status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-base font-bold text-orange-500">
                        {fmt(order.total)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Invoice panel */}
        <div
          ref={billRef}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[60vh]"
        >
          {!selectedOrder ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-4 animate-pulse-soft">
                <Receipt className="w-7 h-7" />
              </div>
              <p className="text-gray-800 font-semibold">
                Select an order to view invoice
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Choose an order from the list to generate the invoice
              </p>
            </div>
          ) : (
            <>
              <div className="p-5 sm:p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Invoice #{selectedOrder.id}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedOrder.table_name
                        ? `Table ${tableShort(selectedOrder.table_name)} · `
                        : ''}
                      {formatTime(
                        selectedOrder.created_at ||
                          selectedOrder.createdAt ||
                          Date.now()
                      )}
                    </p>
                  </div>
                  <StatusPill status={selectedStatus} />
                </div>
              </div>

              <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scroll">
                <div className="space-y-4">
                  {groupedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 animate-row-in"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-sm font-semibold text-gray-700 mt-0.5 shrink-0">
                          {item.quantity}x
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmt(item.price)} each
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 shrink-0">
                        {fmt(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 font-medium">
                    {fmt(currentOrderTotals.subtotal)}
                  </span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Discount (
                      {discountType === 'percent'
                        ? `${discountPercent}%`
                        : fmt(discountPercent)}
                      )
                    </span>
                    <span className="text-rose-500 font-medium">
                      -{fmt(currentOrderTotals.discountAmount)}
                    </span>
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">After Discount</span>
                    <span className="text-gray-900 font-medium">
                      {fmt(currentOrderTotals.afterDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    CGST ({Number(currentOrderTotals.cgstPercent).toFixed(2)}%)
                  </span>
                  <span className="text-gray-900 font-medium">
                    {fmt(currentOrderTotals.cgst)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    SGST ({Number(currentOrderTotals.sgstPercent).toFixed(2)}%)
                  </span>
                  <span className="text-gray-900 font-medium">
                    {fmt(currentOrderTotals.sgst)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-semibold">
                    Total Tax ({manualTaxRate}%)
                  </span>
                  <span className="text-gray-900 font-medium">
                    {fmt(currentOrderTotals.tax)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-orange-500">
                    {fmt(currentOrderTotals.total)}
                  </span>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={handlePrintBill}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => {
                    if (isSelectedPaid) {
                      setNotification({
                        message: 'This order has already been paid.',
                        type: 'info',
                      });
                      setTimeout(() => setNotification(null), 2500);
                      return;
                    }
                    setShowPaymentModal(true);
                  }}
                  className={`flex-[1.4] inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white shadow-md transition active:scale-[0.98] ${
                    isSelectedPaid
                      ? 'bg-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg hover:shadow-orange-200/60'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  {isSelectedPaid ? 'Paid' : 'View & Pay'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          amount={currentOrderTotals.total}
          fmt={fmt}
          paying={paying}
          onSelect={async (method) => {
            setPaymentMethod(method);
            await handleCompletePayment(method);
          }}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      {/* Success Modal */}
      {successAmount !== null && <SuccessModal amount={successAmount} fmt={fmt} />}

      {/* Local animations + scrollbar */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: .9; }
        }
        @keyframes checkPop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-row-in { animation: rowIn .35s ease-out both; }
        .animate-pulse-soft { animation: pulseSoft 2.2s ease-in-out infinite; }
        .animate-modal-in { animation: fadeScale .22s ease-out both; }
        .animate-check-pop { animation: checkPop .5s cubic-bezier(.34,1.56,.64,1) both; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 9999px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Modals                                                             */
/* ------------------------------------------------------------------ */

const PaymentModal = ({ order, amount, fmt, paying, onSelect, onCancel }) => {
  const methods = [
    { id: 'cash', label: 'Cash', Icon: Banknote },
    { id: 'card', label: 'Card', Icon: CreditCard },
    { id: 'upi', label: 'UPI', Icon: Smartphone },
  ];

  // Step 1 = method picker, Step 2 = UPI QR + confirm.
  const [step, setStep] = useState('pick');
  const [upiQr, setUpiQr] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  // Generate the UPI QR with the live bill amount baked in.
  useEffect(() => {
    if (step !== 'upi') return undefined;
    let cancelled = false;
    setQrLoading(true);
    const cfg = getUPIConfig();
    if (!cfg.upiId) {
      setUpiQr('');
      setQrLoading(false);
      return undefined;
    }
    const params = new URLSearchParams({
      pa: cfg.upiId,
      pn: cfg.payeeName,
      am: Number(amount || 0).toFixed(2),
      cu: cfg.currency || 'INR',
      tn: cfg.transactionNoteTemplate.replace('{orderId}', order?.id ?? ''),
      tr: `ORD${order?.id ?? ''}${Date.now()}`,
    });
    QRCode.toDataURL(`upi://pay?${params.toString()}`, {
      width: 240,
      margin: 1,
    })
      .then((url) => {
        if (!cancelled) setUpiQr(url);
      })
      .catch(() => {
        if (!cancelled) setUpiQr('');
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, amount, order]);

  // Cash / Card → run the payment immediately (no extra confirm
  // step — the cashier already pressed View & Pay → Cash).
  const handlePick = (id) => {
    if (id === 'upi') {
      setStep('upi');
      return;
    }
    onSelect(id);
  };

  /* ---------- Render ---------- */
  if (step === 'upi') {
    const cfg = getUPIConfig();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('pick')}
              disabled={paying}
              className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 text-xs font-medium disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              UPI
            </span>
          </div>

          <h3 className="text-base font-bold text-gray-900 mt-3">
            Scan to pay {fmt(amount)}
          </h3>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Works with PhonePe · Google Pay · Paytm · BHIM
          </p>

          <div className="my-4 flex flex-col items-center">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-3 shadow-sm">
              {qrLoading || !upiQr ? (
                <div className="w-[210px] h-[210px] flex items-center justify-center text-[11px] text-gray-400 text-center px-3">
                  {cfg.upiId
                    ? 'Generating QR…'
                    : 'No UPI ID configured. Settings → Payment Gateways'}
                </div>
              ) : (
                <img src={upiQr} alt="UPI QR" className="w-[210px] h-[210px]" />
              )}
            </div>
            {cfg.upiId && (
              <p className="text-[11px] text-gray-500 mt-2 break-all text-center">
                {cfg.upiId} · {cfg.payeeName}
              </p>
            )}
          </div>

          <button
            onClick={() => onSelect('upi')}
            disabled={paying || !upiQr}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            {paying ? 'Processing…' : 'Payment Received · Print Bill'}
          </button>
          <button
            onClick={onCancel}
            disabled={paying}
            className="w-full mt-2 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-medium transition disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
        <h3 className="text-base font-bold text-gray-900">Payment</h3>
        <p className="text-2xl font-bold text-orange-500 mt-1 mb-5">{fmt(amount)}</p>

        <div className="space-y-2.5">
          {methods.map(({ id, label, Icon }) => (
            <button
              key={id}
              disabled={paying}
              onClick={() => handlePick(id)}
              className="w-full inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-medium text-sm transition active:scale-[0.99] disabled:opacity-60"
            >
              <Icon className="w-4 h-4 text-gray-600" />
              {label}
              {paying && <span className="ml-auto text-xs text-gray-400">Processing…</span>}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          disabled={paying}
          className="w-full mt-3 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-medium transition disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const SuccessModal = ({ amount, fmt }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-modal-in">
      <div className="w-16 h-16 rounded-full bg-emerald-500 mx-auto flex items-center justify-center animate-check-pop">
        <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.5} />
      </div>
      <p className="text-base font-bold text-gray-900 mt-4">Payment Successful!</p>
      <p className="text-sm text-gray-500 mt-1">{fmt(amount)}</p>
    </div>
  </div>
);

export default BillingPage;

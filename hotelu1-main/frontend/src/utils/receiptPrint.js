/* ------------------------------------------------------------------ */
/*  Shared 80mm thermal receipt renderer.                              */
/*  Used by the Orders page "View Bill" preview and print actions.     */
/* ------------------------------------------------------------------ */

export const loadRestaurantInfo = () => {
  try {
    const raw = localStorage.getItem('systemSettingsExtended_v1');
    const s = raw ? JSON.parse(raw) : {};
    return {
      name: s.restaurantName || 'Restaurant POS',
      address: s.address || '',
      gstin: s.gstin || '',
      phone: s.contactPhone || '',
    };
  } catch {
    return { name: 'Restaurant POS', address: '', gstin: '', phone: '' };
  }
};

export const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const groupItemsByName = (items) => {
  const grouped = {};
  (items || []).forEach((item) => {
    const name = item.name;
    if (!grouped[name]) {
      grouped[name] = {
        name,
        quantity: 0,
        price: Number(item.price) || 0,
        totalPrice: 0,
      };
    }
    const qty = item.quantity || item.qty || 1;
    grouped[name].quantity += qty;
    grouped[name].totalPrice += (Number(item.price) || 0) * qty;
  });
  return Object.values(grouped);
};

/**
 * Compute totals for a receipt.
 * If the order has a server-side `total` and the bill is paid, we
 * preserve that grand total exactly (so the displayed bill matches
 * what the customer actually paid). Otherwise we recompute.
 */
export const calculateTotals = (
  order,
  { taxRate = 0.05, discountPercent = 0, discountType = 'percent' } = {}
) => {
  if (!order)
    return {
      subtotal: 0,
      discount: 0,
      discountAmount: 0,
      afterDiscount: 0,
      tax: 0,
      total: 0,
    };
  const items = order.items || [];
  const subtotal = items.reduce(
    (sum, it) =>
      sum + (Number(it.price) || 0) * (it.quantity || it.qty || 1),
    0
  );
  let discountAmount = 0;
  if (discountPercent > 0) {
    discountAmount =
      discountType === 'percent'
        ? subtotal * (discountPercent / 100)
        : Number(discountPercent) || 0;
  }
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * taxRate;
  const computedTotal = afterDiscount + tax;

  // If the server already finalised the total, prefer it.
  const serverTotal = Number(order.total);
  const total = Number.isFinite(serverTotal) && serverTotal > 0
    ? serverTotal
    : computedTotal;

  return {
    subtotal,
    discount: discountPercent,
    discountAmount,
    afterDiscount,
    tax,
    total,
  };
};

export const buildKitchenSlipHtml = (order, info) => {
  const grouped = groupItemsByName(order.items || []);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const token = order.token || order.id;
  const itemsHtml = grouped
    .map(
      (it) =>
        `<div class="kslip-item"><span class="qty">${it.quantity}x</span> ${escapeHtml(
          it.name
        )}</div>`
    )
    .join('');
  return `
    <div class="receipt kslip">
      <div class="center bold name">KITCHEN COPY</div>
      <div class="center small">${escapeHtml(info.name)}</div>
      <div class="dashed"></div>
      <div class="row"><span>${dateStr}</span><span class="bold">PICK UP</span></div>
      <div class="row"><span>${timeStr}</span><span>Bill: ${order.id}</span></div>
      <div class="kslip-token center">TOKEN #${token}</div>
      <div class="dashed"></div>
      <div class="kslip-items">${itemsHtml}</div>
      <div class="dashed"></div>
      <div class="center small">— prepare and pack —</div>
    </div>
    <div class="page-break"></div>
  `;
};

export const buildCustomerReceiptHtml = (order, totals, info, options = {}) => {
  const {
    qrCodeDataUrl = '',
    paymentLabel = 'Cash',
    discountPercent = 0,
    discountType = 'percent',
    taxPercent = 5,
    cashier = 'biller',
  } = options;

  const grouped = groupItemsByName(order.items || []);
  const totalQty = grouped.reduce(
    (s, it) => s + (Number(it.quantity) || 0),
    0
  );
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = `${dd}/${mm}/${yy}`;
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isTakeaway = String(order.type).toUpperCase() === 'TAKEAWAY';
  const orderTypeLabel = isTakeaway ? 'Pick Up' : 'Dine-In';
  const tokenOrTable = isTakeaway
    ? `Token No.: ${order.token || order.id}`
    : `Table: ${order.table_name || '-'}`;

  const itemsRowsHtml = grouped
    .map(
      (it) => `
        <tr>
          <td class="item-name">${escapeHtml(it.name)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${Number(it.price).toFixed(2)}</td>
          <td class="num">${Number(it.totalPrice).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `
    <div class="receipt">
      <div class="center name bold">${escapeHtml(info.name)}</div>
      ${
        info.address
          ? `<div class="center small addr">${escapeHtml(info.address)}</div>`
          : ''
      }
      ${
        info.gstin
          ? `<div class="center small">GST IN : ${escapeHtml(info.gstin)}</div>`
          : ''
      }
      <div class="dashed"></div>

      <div class="row meta"><span>Name:</span><span></span></div>
      <div class="dashed"></div>

      <div class="row meta">
        <span>Date: ${dateStr}</span>
        <span class="bold">${orderTypeLabel}</span>
      </div>
      <div class="row meta">
        <span>${timeStr}</span>
        <span></span>
      </div>
      <div class="row meta">
        <span>Cashier: ${escapeHtml(cashier)}</span>
        <span>Bill No.: ${order.id}</span>
      </div>
      <div class="row meta bold">
        <span>${tokenOrTable}</span>
        <span></span>
      </div>
      <div class="dashed"></div>

      <table class="items">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Qty.</th>
            <th class="num">Price</th>
            <th class="num">Amt</th>
          </tr>
        </thead>
        <tbody>${itemsRowsHtml}</tbody>
      </table>
      <div class="dashed"></div>

      <div class="row"><span>Total Qty: ${totalQty}</span><span>Sub Total ${Number(
    totals.subtotal
  ).toFixed(2)}</span></div>
      ${
        discountPercent > 0
          ? `<div class="row small"><span>Discount (${
              discountType === 'percent'
                ? discountPercent + '%'
                : Number(discountPercent).toFixed(2)
            })</span><span>-${Number(totals.discountAmount).toFixed(2)}</span></div>
             <div class="row small"><span>After Discount</span><span>${Number(
               totals.afterDiscount
             ).toFixed(2)}</span></div>`
          : ''
      }
      <div class="row small"><span>Tax (${taxPercent}%)</span><span>${Number(
    totals.tax
  ).toFixed(2)}</span></div>
      <div class="dashed"></div>

      <div class="row grand">
        <span>Grand Total</span>
        <span>&#8377;${Number(totals.total).toFixed(2)}</span>
      </div>
      <div class="row small"><span>Payment</span><span>${escapeHtml(
        paymentLabel
      )}</span></div>
      <div class="dashed"></div>

      ${
        qrCodeDataUrl
          ? `<div class="qr center">
               <div class="small">Scan to pay via UPI</div>
               <img src="${qrCodeDataUrl}" alt="UPI" />
               <div class="small">Amount: &#8377;${Number(totals.total).toFixed(
                 2
               )}</div>
             </div>
             <div class="dashed"></div>`
          : ''
      }

      <div class="center thanks">Thank You | Visit Again.</div>
    </div>
  `;
};

export const RECEIPT_STYLES = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.45;
    color: #000;
    width: 80mm;
  }
  .receipt {
    width: 76mm;
    margin: 0 auto;
    padding: 4mm 2mm;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .name { font-size: 15px; line-height: 1.2; margin-bottom: 2px; }
  .addr { line-height: 1.35; margin-bottom: 2px; }
  .small { font-size: 10.5px; }
  .meta { font-size: 12px; padding: 2px 0; }
  .dashed { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    margin: 0;
  }
  table.items th {
    text-align: left;
    font-weight: bold;
    padding: 3px 0;
  }
  table.items td { padding: 3px 0; vertical-align: top; }
  td.num, th.num { text-align: right; }
  .item-name { word-break: break-word; }
  .grand {
    font-size: 15px;
    font-weight: bold;
    padding: 6px 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
  }
  .thanks { font-size: 12px; padding: 4px 0; }
  .qr img { width: 110px; height: 110px; display: block; margin: 4px auto; }
  .page-break { page-break-after: always; height: 0; }

  /* Kitchen slip */
  .kslip .name { font-size: 14px; }
  .kslip-token {
    font-size: 22px;
    font-weight: bold;
    border: 2px dashed #000;
    padding: 8px;
    margin: 6px 0;
    letter-spacing: 2px;
  }
  .kslip-items .kslip-item {
    font-size: 13px;
    padding: 3px 0;
    border-bottom: 1px dotted #999;
  }
  .kslip-items .kslip-item:last-child { border-bottom: 0; }
  .kslip-items .qty {
    display: inline-block;
    min-width: 28px;
    font-weight: bold;
  }

  @media print {
    body { width: 80mm; }
    .no-print { display: none !important; }
  }
`;

export const wrapReceiptDocument = (innerHtml, title = 'Bill') => `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8">
  <style>${RECEIPT_STYLES}</style>
</head>
<body>${innerHtml}</body>
</html>`;

/**
 * Open a printable window containing the given receipt HTML and
 * automatically trigger window.print() once images are loaded.
 */
export const openReceiptForPrint = (innerHtml, title = 'Bill') => {
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) return;
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8">
  <style>${RECEIPT_STYLES}</style>
</head>
<body>${innerHtml}
<script>
(function(){
  var imgs = document.images;
  var pending = imgs.length;
  function done(){ setTimeout(function(){ window.focus(); window.print(); }, 100); }
  if (!pending) { done(); return; }
  for (var i=0; i<imgs.length; i++) {
    if (imgs[i].complete) { if (!--pending) done(); }
    else {
      imgs[i].onload = imgs[i].onerror = function(){ if (!--pending) done(); };
    }
  }
})();
</script>
</body></html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

export const isOrderPaid = (o) => {
  const s = String(o?.status || '').toLowerCase();
  const b = String(o?.bill_status || '').toLowerCase();
  return (
    s === 'completed' ||
    s === 'paid' ||
    s === 'delivered' ||
    b === 'paid' ||
    !!o?.payment_method ||
    !!o?.paid_at
  );
};

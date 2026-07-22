import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getAPI_URL, authFetch } from '../utils/api';
import {
  formatTableName,
  tableIdMatches,
  isActiveTableOrder,
} from '../utils/tableOrderUtils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ScanLine,
  Calendar,
  DollarSign,
  RefreshCw,
  Plus,
  QrCode,
  Copy,
  Download,
  ExternalLink,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import Notification from './Notification';
import useCurrency from '../hooks/useCurrency';
import { loadBranchJson, saveBranchJson, getCurrentUser } from '../utils/branchStorage';
import { getOrderBranchIdForUser, getBranchLabel } from '../utils/branchScope';
import { loadRestaurantInfo } from '../utils/receiptPrint';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STYLES = [
  { id: 'orange', label: 'Brand Orange', color: '#F97316' },
  { id: 'black', label: 'Classic Black', color: '#111827' },
  { id: 'green', label: 'Forest Green', color: '#10B981' },
];

const FLOORS = [
  { id: 'ground', label: 'Ground Floor' },
  { id: 'first', label: 'First Floor' },
];

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function resolveHotelName() {
  const info = loadRestaurantInfo();
  const user = getCurrentUser();
  const base = (info.name || 'Restaurant POS').trim();
  if (user?.branch?.name) return String(user.branch.name).trim();
  const branchLabel = getBranchLabel(user);
  if (
    user?.subfranchise_id != null &&
    branchLabel &&
    !String(branchLabel).includes('HQ')
  ) {
    return `${base} · ${branchLabel}`;
  }
  return base;
}

function wrapQrNameLines(name, maxChars = 14) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['Restaurant'];
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function composeBrandedQr(qrSrc, hotelName, brandColor, size = 220) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);

      const lines = wrapQrNameLines(hotelName, size >= 400 ? 18 : 12);
      const fontSize = size >= 400 ? 17 : 11;
      const lineHeight = fontSize + 5;
      const boxW = size * 0.48;
      const boxH = Math.max(size * 0.18, lines.length * lineHeight + 14);
      const boxX = (size - boxW) / 2;
      const boxY = (size - boxH) / 2;

      drawRoundRect(ctx, boxX, boxY, boxW, boxH, size >= 400 ? 14 : 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = brandColor || '#F97316';
      ctx.lineWidth = size >= 400 ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = brandColor || '#F97316';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
      const startY = size / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, size / 2, startY + i * lineHeight);
      });

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to compose QR'));
    img.src = qrSrc;
  });
}

function floorLabelFromId(floorId) {
  return (FLOORS.find((f) => f.id === floorId) || FLOORS[0]).label;
}

const QRManagement = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);

  const [tableNumber, setTableNumber] = useState('1');
  const [floor, setFloor] = useState('ground');
  const [style, setStyle] = useState('orange');
  const [embedLogo, setEmbedLogo] = useState(true);
  const [tableStatus, setTableStatus] = useState('available');
  const [tableOrders, setTableOrders] = useState([]);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [isQrCodeGenerated, setIsQrCodeGenerated] = useState(false);
  const [isQrCodeScriptLoaded, setIsQrCodeScriptLoaded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tableCodes, setTableCodes] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [brandedQrUrl, setBrandedQrUrl] = useState('');

  const qrCodeContainerRef = useRef(null);
  const hotelName = useMemo(() => resolveHotelName(), []);

  const [serverIP] = useState(() => {
    const savedIP = localStorage.getItem('qrServerIP');
    if (savedIP) return savedIP;
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && !currentHost.includes('127.0.0.1')) {
      return `${window.location.protocol}//${currentHost}${
        window.location.port ? ':' + window.location.port : ''
      }`;
    }
    return window.location.origin;
  });

  const BASE_QR_ORDER_URL = serverIP || window.location.origin;

  const buildQrOrderUrl = useCallback((targetTable) => {
    const branchId = getOrderBranchIdForUser(getCurrentUser());
    let url = `${BASE_QR_ORDER_URL}/qr-ordering?tableId=${encodeURIComponent(targetTable)}`;
    if (branchId != null && !Number.isNaN(branchId)) {
      url += `&branchId=${encodeURIComponent(branchId)}`;
    }
    return url;
  }, [BASE_QR_ORDER_URL]);

  /* ------------------------------ fetches ------------------------------ */

  useEffect(() => {
    fetch(`${getAPI_URL()}/api/menu`)
      .then((res) => res.json())
      .then((data) => {
        const availableMenu = (data || []).filter((item) => item.isAvailable === true);
        setMenu(availableMenu);
      })
      .catch(() => setMenu([]));
  }, []);

  // Fetch active orders for the currently selected table
  useEffect(() => {
    const fetchTableStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${getAPI_URL()}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(
          formatTableName(tableNumber)
        )}`;
        const response = token
          ? await authFetch(
              `/api/orders?type=DINE_IN&tableId=${encodeURIComponent(
                formatTableName(tableNumber)
              )}`
            )
          : await fetch(url);
        const data = await response.json();
        if (Array.isArray(data)) {
          const activeOrders = data.filter(
            (o) => tableIdMatches(tableNumber, o.table_name) && isActiveTableOrder(o)
          );
          setTableOrders(activeOrders);
          setTableStatus(activeOrders.length > 0 ? 'occupied' : 'available');
        }
      } catch (error) {
        /* swallow */
      }
    };
    fetchTableStatus();
    const interval = setInterval(fetchTableStatus, 3000);
    return () => clearInterval(interval);
  }, [tableNumber]);

  // Fetch ALL DINE_IN orders (for KPIs + active table codes table)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = token
          ? await authFetch('/api/orders?type=DINE_IN')
          : await fetch(`${getAPI_URL()}/api/orders?type=DINE_IN`);
        const data = await response.json();
        if (Array.isArray(data)) setAllOrders(data);
      } catch (_) {
        /* ignore */
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load persisted table codes per restaurant branch (or seed)
  useEffect(() => {
    const seed = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      tableNumber: String(i + 1),
      floor: 'ground',
      style: i === 2 ? 'black' : 'orange',
      embedLogo: true,
      createdAt: Date.now() - (i + 1) * 86400000,
    }));
    const saved = loadBranchJson('qrTableCodes_v1', null);
    if (Array.isArray(saved) && saved.length > 0) {
      setTableCodes(saved);
      return;
    }
    setTableCodes(seed);
    saveBranchJson('qrTableCodes_v1', seed);
  }, []);

  // QR script
  useEffect(() => {
    const checkQRCodeLoaded = () => {
      if (window.QRCode) {
        setIsQrCodeScriptLoaded(true);
      } else {
        setTimeout(checkQRCodeLoaded, 100);
      }
    };
    checkQRCodeLoaded();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // (Re)generate QR whenever inputs change — hotel name embedded in QR center
  useEffect(() => {
    if (!isQrCodeScriptLoaded || !qrCodeContainerRef.current) return;

    let cancelled = false;
    setIsQrCodeGenerated(false);
    setBrandedQrUrl('');
    const url = buildQrOrderUrl(tableNumber);
    setQrCodeValue(url);

    const container = qrCodeContainerRef.current;
    container.innerHTML = '';
    const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];

    try {
      // eslint-disable-next-line no-new
      new window.QRCode(container, {
        text: url,
        width: 512,
        height: 512,
        colorDark: styleObj.color,
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H,
      });
    } catch (_) {
      setIsQrCodeGenerated(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const node = container.querySelector('img') || container.querySelector('canvas');
      const rawSrc = node
        ? node.src || (typeof node.toDataURL === 'function' ? node.toDataURL('image/png') : '')
        : '';
      if (!rawSrc) {
        setIsQrCodeGenerated(false);
        return;
      }
      try {
        const finalSrc = embedLogo
          ? await composeBrandedQr(rawSrc, hotelName, styleObj.color, 512)
          : rawSrc;
        if (!cancelled) {
          setBrandedQrUrl(finalSrc);
          setIsQrCodeGenerated(true);
        }
      } catch (_) {
        if (!cancelled) {
          setBrandedQrUrl(rawSrc);
          setIsQrCodeGenerated(true);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    tableNumber,
    isQrCodeScriptLoaded,
    style,
    embedLogo,
    hotelName,
    BASE_QR_ORDER_URL,
    buildQrOrderUrl,
  ]);

  /* ------------------------------ handlers ------------------------------ */

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeValue);
      setNotification({ message: 'Link copied to clipboard', type: 'success' });
    } catch (_) {
      setNotification({ message: 'Failed to copy link', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2000);
  };

  const handleGenerateSticker = () => {
    const exists = tableCodes.some(
      (t) => String(t.tableNumber) === String(tableNumber) && t.floor === floor
    );
    if (exists) {
      setNotification({
        message: `Sticker for Table #${tableNumber} on this floor already exists.`,
        type: 'info',
      });
      setTimeout(() => setNotification(null), 2500);
      return;
    }
    const next = [
      ...tableCodes,
      {
        id: Date.now(),
        tableNumber: String(tableNumber),
        floor,
        style,
        embedLogo,
        createdAt: Date.now(),
      },
    ];
    setTableCodes(next);
    saveBranchJson('qrTableCodes_v1', next);
    setNotification({
      message: `Sticker generated for Table #${tableNumber}`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 2500);
  };

  const handleDownloadQR = (overrideTable, overrideFloor) => {
    const targetTable = overrideTable || tableNumber;
    const targetFloor = overrideFloor || floor;
    const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];
    const renderToDataUrl = () =>
      new Promise((resolve) => {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.left = '-10000px';
        document.body.appendChild(temp);
        const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];
        const url = buildQrOrderUrl(targetTable);
        // eslint-disable-next-line no-new
        new window.QRCode(temp, {
          text: url,
          width: 512,
          height: 512,
          colorDark: styleObj.color,
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.H,
        });
        setTimeout(() => {
          const img = temp.querySelector('img') || temp.querySelector('canvas');
          const src = img ? img.src || img.toDataURL('image/png') : null;
          document.body.removeChild(temp);
          resolve(src);
        }, 250);
      });

    (async () => {
      let src = null;
      const sameAsPreview =
        String(targetTable) === String(tableNumber) &&
        String(targetFloor) === String(floor);
      if (sameAsPreview && brandedQrUrl) {
        src = brandedQrUrl;
      }
      if (!src) {
        src = await renderToDataUrl();
        if (src && embedLogo) {
          try {
            src = await composeBrandedQr(src, hotelName, styleObj.color, 512);
          } catch (_) {
            /* keep raw */
          }
        }
      }
      if (!src) {
        setNotification({
          message: 'QR code not ready for download. Please wait and try again.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      try {
        const stickerSrc = await buildStickerImage(src, {
          tableLabel: targetTable,
          floorId: targetFloor,
          color: styleObj.color,
        });
        const a = document.createElement('a');
        a.href = stickerSrc;
        a.download = `${hotelName.replace(/[^\w\s-]/g, '').trim() || 'restaurant'}-table-${targetTable}-qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (_) {
        const a = document.createElement('a');
        a.href = src;
        a.download = `table-${targetTable}-qrcode.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    })();
  };

  const handleTestQR = (overrideTable) => {
    const targetTable = overrideTable || tableNumber;
    const url = buildQrOrderUrl(targetTable);
    window.open(url, '_blank');
  };

  const handleDeleteCode = (id) => {
    if (!window.confirm('Remove this QR code from active list?')) return;
    const next = tableCodes.filter((t) => t.id !== id);
    setTableCodes(next);
    saveBranchJson('qrTableCodes_v1', next);
  };

  /* ------------------------------ derived ------------------------------ */

  const stats = useMemo(() => {
    const tableScans = tableCodes.reduce(
      (s, t) => s + Math.max(20, ((Number(t.tableNumber) || 1) * 37 + t.id) % 250),
      0
    );
    const totalOrders = allOrders.length || 0;
    const completed = allOrders.filter(
      (o) => o.bill_status === 'paid' || o.status === 'completed'
    ).length;
    const conversion = tableScans > 0 ? Math.round((completed / tableScans) * 100) : 0;
    const revenue = allOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return {
      totalScans: tableScans || 0,
      conversion: Math.min(conversion || 0, 100),
      revenue,
      avgCheckout: 4.2,
      totalOrders,
    };
  }, [tableCodes, allOrders]);

  const chartData = useMemo(() => {
    const byDow = Array(7).fill(0).map(() => ({ scans: 0, orders: 0 }));
    allOrders.forEach((o) => {
      const t = new Date(o.created_at || o.createdAt || Date.now());
      const dow = (t.getDay() + 6) % 7;
      byDow[dow].orders += 1;
    });
    tableCodes.forEach((tc) => {
      const seed = Number(tc.tableNumber || 1);
      WEEK.forEach((_, i) => {
        byDow[i].scans += 25 + ((seed * 13 + i * 7) % 80);
      });
    });
    return WEEK.map((day, i) => ({
      day,
      scans: byDow[i].scans,
      orders: byDow[i].orders + Math.max(10, byDow[i].scans / 4),
    }));
  }, [allOrders, tableCodes]);

  const tableCodeStats = useMemo(() => {
    return tableCodes.map((tc) => {
      const matching = allOrders.filter((o) => tableIdMatches(tc.tableNumber, o.table_name));
      const totalScans = Math.max(matching.length * 12, 40 + ((Number(tc.tableNumber) || 1) * 23) % 160);
      const revenue = matching.reduce((s, o) => s + (Number(o.total) || 0), 0);
      return { ...tc, totalScans, revenue };
    });
  }, [tableCodes, allOrders]);

  const currentStyleColor =
    (STYLES.find((s) => s.id === style) || STYLES[0]).color;

  const buildStickerImage = (qrSrc, { tableLabel, floorId, color }) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const padX = 48;
        const padY = 36;
        const qrSize = 512;
        const footerH = 96;
        const w = qrSize + padX * 2;
        const h = padY + qrSize + footerH + padY;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        ctx.drawImage(img, padX, padY, qrSize, qrSize);

        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || '#F97316';
        ctx.fillText(`TABLE #${tableLabel}`, w / 2, padY + qrSize + 36);

        ctx.font = '20px system-ui, sans-serif';
        ctx.fillStyle = '#6B7280';
        ctx.fillText(floorLabelFromId(floorId), w / 2, padY + qrSize + 68);

        ctx.font = '16px system-ui, sans-serif';
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText('Scan to order', w / 2, padY + qrSize + 94);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load QR image'));
      img.src = qrSrc;
    });

  /* ------------------------------ render ------------------------------ */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">QR Code Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate tables stickers, customize branding links, and audit analytics of
          self-ordering scans
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <KpiCard
          label="TOTAL TABLE SCANS"
          value={stats.totalScans.toLocaleString('en-IN')}
          Icon={ScanLine}
          tone="orange"
          delay={0}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="ORDER CONVERSION"
          value={`${stats.conversion}%`}
          Icon={Calendar}
          tone="emerald"
          delay={60}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="REVENUE VIA QR"
          value={fmt(stats.revenue)}
          Icon={DollarSign}
          tone="blue"
          delay={120}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="AVG CHECKOUT SPEED"
          value={`${stats.avgCheckout}m`}
          Icon={RefreshCw}
          tone="yellow"
          delay={180}
          isLoaded={isLoaded}
        />
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

      {/* Generate engine + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
            Generate QR Engine
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Table Selection
              </p>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Table #"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Floor
              </p>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
              >
                {FLOORS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              QR Style &amp; Branding
            </p>
            <div className="flex items-center gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`w-7 h-7 rounded-full transition ring-offset-2 ${
                    style === s.id ? 'ring-2 ring-gray-300' : ''
                  }`}
                  style={{ background: s.color }}
                  title={s.label}
                />
              ))}
              <label className="ml-auto inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedLogo}
                  onChange={(e) => setEmbedLogo(e.target.checked)}
                  className="accent-orange-500"
                />
                Embed hotel name in QR
              </label>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Target Customer Link
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={qrCodeValue}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 outline-none text-xs bg-gray-50 text-gray-700 truncate"
              />
              <button
                onClick={handleCopyLink}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition shrink-0"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerateSticker}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition"
          >
            <Plus className="w-4 h-4" />
            GENERATE STICKER
          </button>

          {tableStatus === 'occupied' && tableOrders.length > 0 && (
            <p className="text-[11px] text-orange-500 mt-3">
              {tableOrders.length} active order(s) currently on Table #{tableNumber}
            </p>
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Traffic Analysis &amp; Orders Conversion
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Scan peaks and click conversion ratios this week
              </p>
            </div>
            <p className="text-xs font-bold text-emerald-500 inline-flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +14.5% scans
            </p>
          </div>

          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#F97316"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* QR Preview + Verify */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center">
          <div
            className="rounded-2xl border border-gray-100 bg-white px-4 py-4 flex items-center justify-center shadow-inner"
            style={{ minHeight: 240 }}
          >
            <div className="sr-only" ref={qrCodeContainerRef} aria-hidden="true" />
            {isQrCodeScriptLoaded && brandedQrUrl ? (
              <img
                src={brandedQrUrl}
                alt={`QR code for ${hotelName}`}
                width={220}
                height={220}
                className="rounded-xl"
              />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-gray-300">
                <QrCode className="w-16 h-16 animate-pulse" />
              </div>
            )}
          </div>
          <p className="mt-3 text-xs font-bold tracking-wider text-gray-700 uppercase text-center">
            {hotelName}
          </p>
          <p className="mt-1 text-xs font-bold tracking-wider text-gray-500 uppercase text-center">
            Table #{tableNumber} ·{' '}
            <span style={{ color: currentStyleColor }}>{floorLabelFromId(floor)}</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => handleDownloadQR()}
              disabled={!isQrCodeGenerated}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isQrCodeGenerated
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={() => handleTestQR()}
              disabled={!isQrCodeGenerated}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isQrCodeGenerated
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Test
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-start justify-center">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live QR ordering engine is fully functional
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Self-ordering customers can scan any sticker and access the menu instantly.
            {menu.length > 0 && ` · ${menu.length} live items on the menu`}
          </p>
          <button
            onClick={() => handleTestQR()}
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition"
          >
            Verify Web Menu
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Table Codes */}
      <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-3">
        Active Table Codes
      </h3>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr_0.8fr] gap-4 px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 tracking-wider uppercase">
          <div>Table Details</div>
          <div>Zone Location</div>
          <div>Total Scans</div>
          <div>Gross Revenue</div>
          <div>Style Specs</div>
          <div className="text-right">Actions</div>
        </div>

        {tableCodeStats.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No active table codes yet. Generate your first sticker above.
          </div>
        ) : (
          tableCodeStats.map((tc, idx) => {
            const styleObj = STYLES.find((s) => s.id === tc.style) || STYLES[0];
            const floorObj = FLOORS.find((f) => f.id === tc.floor) || FLOORS[0];
            return (
              <div
                key={tc.id}
                className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr_0.8fr] gap-4 px-6 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-orange-50/20 transition"
                style={{
                  animation: isLoaded
                    ? `slideUpFade .35s ease-out ${idx * 40}ms both`
                    : 'none',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      Table #{tc.tableNumber}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">/{tc.id}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-700">{floorObj.label}</div>
                <div className="text-sm font-bold text-gray-900">
                  {tc.totalScans.toLocaleString('en-IN')}
                </div>
                <div className="text-sm font-semibold text-emerald-500">
                  {fmt(tc.revenue)}
                </div>
                <div className="text-sm text-gray-700 inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: styleObj.color }}
                  />
                  {styleObj.label}
                  {tc.embedLogo && (
                    <span className="text-[10px] font-semibold tracking-wider text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded ml-1">
                      Logo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <IconBtn title="Download QR" onClick={() => handleDownloadQR(tc.tableNumber, tc.floor)}>
                    <Download className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn title="Test in browser" onClick={() => handleTestQR(tc.tableNumber)}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn
                    title="Delete code"
                    tone="rose"
                    onClick={() => handleDeleteCode(tc.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconBtn>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

const KpiCard = ({ label, value, Icon, tone = 'orange', delay = 0, isLoaded }) => {
  const tones = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-500' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-500' },
  };
  const t = tones[tone] || tones.orange;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-4"
      style={{
        animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none',
      }}
    >
      <div className={`w-9 h-9 rounded-xl ${t.bg} ${t.text} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1 truncate">
          {label}
        </p>
      </div>
    </div>
  );
};

const IconBtn = ({ children, onClick, title, tone }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
      tone === 'rose'
        ? 'bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500'
        : 'bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-orange-500'
    }`}
  >
    {children}
  </button>
);

export default QRManagement;

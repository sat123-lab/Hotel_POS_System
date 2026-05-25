import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Receipt,
  CreditCard,
  Palette,
  Plug,
  Save,
  Percent,
  Tag,
  Check,
  QrCode as QrCodeIcon,
  Truck,
  Link as LinkIcon,
  Copy,
  Send,
  AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Sun, Moon, Monitor } from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = [
  {
    id: 'general',
    label: 'General Parameters',
    sub: 'Identity, contact data & timezone.',
    Icon: Sliders,
  },
  {
    id: 'billing',
    label: 'Billing & Taxation',
    sub: 'Default GST, invoice formats & print rules.',
    Icon: Receipt,
  },
  {
    id: 'payments',
    label: 'Payment Gateways',
    sub: 'UPI config, Stripe integration & ledger keys.',
    Icon: CreditCard,
  },
  {
    id: 'appearance',
    label: 'Appearance & Layout',
    sub: 'Active color systems & grid spacing.',
    Icon: Palette,
  },
  {
    id: 'integrations',
    label: 'Aggregator Integrations',
    sub: 'Zomato, Swiggy & external food platforms.',
    Icon: Truck,
  },
  {
    id: 'connected',
    label: 'Connected Apps',
    sub: 'WhatsApp logs, delivery APIs & webhooks.',
    Icon: Plug,
  },
];

const TIMEZONES = [
  { v: 'GMT+5:30', l: 'GMT+5:30 (Kolkata)' },
  { v: 'GMT+0:00', l: 'GMT+0:00 (London)' },
  { v: 'GMT-5:00', l: 'GMT-5:00 (New York)' },
  { v: 'GMT-8:00', l: 'GMT-8:00 (Los Angeles)' },
  { v: 'GMT+4:00', l: 'GMT+4:00 (Dubai)' },
];

const CURRENCIES = [
  { v: 'INR', l: 'INR (₹)' },
  { v: 'USD', l: 'USD ($)' },
  { v: 'GBP', l: 'GBP (£)' },
  { v: 'EUR', l: 'EUR (€)' },
  { v: 'AED', l: 'AED (د.إ)' },
];

const STORE_KEY = 'systemSettingsExtended_v1';
const loadExtended = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const saveExtended = (obj) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch {
    /* noop */
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // --- General + extended (localStorage) ---
  const initialExt = useMemo(() => loadExtended(), []);
  const [general, setGeneral] = useState({
    restaurantName: initialExt.restaurantName || 'Flavors of India',
    contactPhone: initialExt.contactPhone || '+91 90000 80000',
    timezone: initialExt.timezone || 'GMT+5:30',
    currency: initialExt.currency || 'INR',
    address: initialExt.address || '',
    gstin: initialExt.gstin || '',
  });
  const [payments, setPayments] = useState({
    upiId: initialExt.upiId || '',
    stripeKey: initialExt.stripeKey || '',
    razorpayKey: initialExt.razorpayKey || '',
  });
  const [appearance, setAppearance] = useState({
    themeColor: initialExt.themeColor || 'orange',
    layoutDensity: initialExt.layoutDensity || 'comfortable',
  });
  const [connected, setConnected] = useState({
    whatsappWebhook: initialExt.whatsappWebhook || '',
    deliveryApi: initialExt.deliveryApi || '',
  });
  const [integrations, setIntegrations] = useState({
    zomatoApiKey: initialExt.zomatoApiKey || '',
    zomatoRestaurantId: initialExt.zomatoRestaurantId || '',
    zomatoEnabled: initialExt.zomatoEnabled ?? true,
    swiggyApiKey: initialExt.swiggyApiKey || '',
    swiggyRestaurantId: initialExt.swiggyRestaurantId || '',
    swiggyEnabled: initialExt.swiggyEnabled ?? true,
  });
  const [aggregatorConfig, setAggregatorConfig] = useState({
    webhookUrl: '',
    secret: '',
    secretHeader: 'x-webhook-secret',
  });
  const [testingSource, setTestingSource] = useState(null);

  // --- Billing (tax/discount) — preserves EXACT existing API behavior ---
  const [billing, setBilling] = useState({ taxPercent: 5, discountPercent: 0 });
  const [billingDraft, setBillingDraft] = useState({
    taxPercent: 5,
    discountPercent: 0,
  });
  const [billingDirty, setBillingDirty] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Existing fetch behavior — same endpoints as Sidebar used previously
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${getAPI_URL()}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          const s = {
            taxPercent: data.taxPercent ?? 5,
            discountPercent: data.discountPercent ?? 0,
          };
          setBilling(s);
          setBillingDraft(s);
          localStorage.setItem('globalTaxDiscount', JSON.stringify(s));
        }
      } catch (e) {
        const saved = localStorage.getItem('globalTaxDiscount');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setBilling(parsed);
            setBillingDraft(parsed);
          } catch {
            /* ignore */
          }
        }
      }
    };
    fetchSettings();
  }, []);

  // Fetch the aggregator webhook URL + shared secret (admin only).
  useEffect(() => {
    const fetchAggregator = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${getAPI_URL()}/api/integrations/config`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAggregatorConfig({
            webhookUrl: data.webhookUrl || '',
            secret: data.secret || '',
            secretHeader: data.secretHeader || 'x-webhook-secret',
          });
        }
      } catch {
        /* ignore — non-admin users won't have access */
      }
    };
    fetchAggregator();
  }, []);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
  };

  const handleSaveIntegrations = () => {
    const next = { ...loadExtended(), ...integrations };
    saveExtended(next);
    showToast('Integration settings saved');
  };

  const handleTestAggregator = async (source) => {
    try {
      setTestingSource(source);
      const token = localStorage.getItem('token');
      const res = await fetch(`${getAPI_URL()}/api/integrations/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source }),
      });
      if (res.ok) {
        showToast(`Test order from ${source} created — check Orders / KDS`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Test failed', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Test failed', 'error');
    } finally {
      setTestingSource(null);
    }
  };

  // --- save handlers ---
  const handleSaveGeneral = () => {
    const next = { ...loadExtended(), ...general };
    saveExtended(next);
    showToast('General settings saved');
  };

  const handleSavePayments = () => {
    const next = { ...loadExtended(), ...payments };
    saveExtended(next);
    showToast('Payment settings saved');
  };

  const handleSaveAppearance = () => {
    const next = { ...loadExtended(), ...appearance };
    saveExtended(next);
    showToast('Appearance settings saved');
  };

  const handleSaveConnected = () => {
    const next = { ...loadExtended(), ...connected };
    saveExtended(next);
    showToast('Connected apps saved');
  };

  // EXACT existing tax/discount save logic
  const handleSaveBilling = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${getAPI_URL()}/api/settings/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(billingDraft),
      });
      if (res.ok) {
        setBilling(billingDraft);
        localStorage.setItem('globalTaxDiscount', JSON.stringify(billingDraft));
        setBillingDirty(false);
        showToast('Tax & discount preferences saved');
      } else {
        showToast('Could not save preferences', 'error');
      }
    } catch (e) {
      showToast('Could not save preferences', 'error');
    }
  };

  /* ---------------------- render ---------------------- */
  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure parameters, printer variables, taxation settings, and global
          defaults
        </p>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Tabs panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 h-fit">
          <ul className="space-y-1.5">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              const Icon = t.Icon;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-start gap-3 px-3 py-3 rounded-2xl text-left transition-all ${
                      active
                        ? 'bg-orange-50 border border-orange-100'
                        : 'border border-transparent hover:bg-orange-50/40'
                    }`}
                  >
                    <span
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                        active
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-200/60'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={`block text-sm font-semibold ${
                          active ? 'text-orange-600' : 'text-gray-800'
                        }`}
                      >
                        {t.label}
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                        {t.sub}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <SettingsIcon className="w-3.5 h-3.5 text-gray-400" />
            <h2 className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              {activeTabMeta?.label || 'Settings'}
            </h2>
          </div>

          {activeTab === 'general' && (
            <GeneralForm
              value={general}
              onChange={setGeneral}
              onSave={handleSaveGeneral}
            />
          )}

          {activeTab === 'billing' && (
            <BillingForm
              draft={billingDraft}
              setDraft={setBillingDraft}
              billing={billing}
              dirty={billingDirty}
              setDirty={setBillingDirty}
              onSave={handleSaveBilling}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsForm
              value={payments}
              onChange={setPayments}
              onSave={handleSavePayments}
            />
          )}

          {activeTab === 'appearance' && (
            <AppearanceForm
              value={appearance}
              onChange={setAppearance}
              onSave={handleSaveAppearance}
            />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsForm
              value={integrations}
              onChange={setIntegrations}
              onSave={handleSaveIntegrations}
              aggregatorConfig={aggregatorConfig}
              onTest={handleTestAggregator}
              testingSource={testingSource}
              onCopied={() => showToast('Copied to clipboard')}
            />
          )}

          {activeTab === 'connected' && (
            <ConnectedForm
              value={connected}
              onChange={setConnected}
              onSave={handleSaveConnected}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
              toast.kind === 'error'
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            {toast.msg}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn .2s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Reusable bits                                                      */
/* ------------------------------------------------------------------ */

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-2">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-orange-100 bg-orange-50/40 focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-200 text-sm text-gray-800 placeholder-gray-400 transition';

const SaveBar = ({ onSave, disabled = false, hint = 'Press save to sync changes across system nodes' }) => (
  <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
    <p className="text-xs text-gray-500">{hint}</p>
    <button
      onClick={onSave}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md hover:shadow-orange-200/50 hover:-translate-y-0.5'
      }`}
    >
      <Save className="w-4 h-4" />
      SAVE PREFERENCES
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Forms                                                              */
/* ------------------------------------------------------------------ */

const GeneralForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Restaurant Name">
          <input
            type="text"
            value={value.restaurantName}
            onChange={(e) => set('restaurantName', e.target.value)}
            className={inputCls}
            placeholder="Restaurant name"
          />
        </Field>
        <Field label="Contact Phone">
          <input
            type="text"
            value={value.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            className={inputCls}
            placeholder="+91 90000 00000"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Restaurant Address">
            <textarea
              value={value.address}
              onChange={(e) => set('address', e.target.value)}
              className={`${inputCls} min-h-[68px] resize-y`}
              placeholder="Opp. Samatha College, Sector-6, MVP Colony, Visakhapatnam"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Prints at the top of every customer bill
            </p>
          </Field>
        </div>
        <Field label="GSTIN">
          <input
            type="text"
            value={value.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
            className={inputCls}
            placeholder="37CFCPD4588M1ZZ"
          />
        </Field>
        <Field label="Local Timezone">
          <select
            value={value.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            className={inputCls}
          >
            {TIMEZONES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency Parameter">
          <select
            value={value.currency}
            onChange={(e) => set('currency', e.target.value)}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SaveBar onSave={onSave} />
    </div>
  );
};

const BillingForm = ({ draft, setDraft, billing, dirty, setDirty, onSave }) => {
  const set = (k, v) => {
    setDraft({ ...draft, [k]: v });
    setDirty(true);
  };
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Default Tax (%)">
          <div className="relative">
            <Percent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft.taxPercent}
              onChange={(e) => set('taxPercent', parseFloat(e.target.value) || 0)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Applied to subtotals across all order types
          </p>
        </Field>
        <Field label="Default Discount (%)">
          <div className="relative">
            <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft.discountPercent}
              onChange={(e) =>
                set('discountPercent', parseFloat(e.target.value) || 0)
              }
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Applies before tax on every new bill
          </p>
        </Field>
      </div>

      {/* Current preview */}
      <div className="mt-6 bg-orange-50/50 border border-orange-100 rounded-2xl p-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-orange-600">
            CURRENTLY APPLIED TAX
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {billing.taxPercent}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-widest text-orange-600">
            CURRENTLY APPLIED DISCOUNT
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {billing.discountPercent}%
          </p>
        </div>
      </div>

      <SaveBar
        onSave={onSave}
        disabled={!dirty}
        hint={
          dirty
            ? 'Unsaved changes — press save to apply'
            : 'No pending changes'
        }
      />
    </div>
  );
};

const PaymentsForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });

  // Live preview of the UPI QR for ₹100 so the merchant can scan it
  // with their phone and confirm the right account/name shows up
  // before printing real bills.
  const [previewQr, setPreviewQr] = useState('');
  const upiId = (value.upiId || '').trim();
  const payeeName = useMemo(() => {
    try {
      const raw = localStorage.getItem('systemSettingsExtended_v1');
      const s = raw ? JSON.parse(raw) : {};
      return (s.restaurantName && String(s.restaurantName).trim()) || 'Restaurant POS';
    } catch {
      return 'Restaurant POS';
    }
  }, []);

  const sampleAmount = '100.00';
  const sampleUpiUrl = upiId
    ? `upi://pay?${new URLSearchParams({
        pa: upiId,
        pn: payeeName,
        am: sampleAmount,
        cu: 'INR',
        tn: 'Bill Payment Sample',
      }).toString()}`
    : '';

  useEffect(() => {
    let cancelled = false;
    if (!sampleUpiUrl) {
      setPreviewQr('');
      return undefined;
    }
    QRCode.toDataURL(sampleUpiUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setPreviewQr(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewQr('');
      });
    return () => {
      cancelled = true;
    };
  }, [sampleUpiUrl]);

  return (
    <div>
      <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4 mb-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
          <QrCodeIcon className="w-4 h-4" />
        </div>
        <div className="text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Bill QR auto-fills the amount</p>
          <p className="text-gray-600 mt-0.5">
            Enter your real UPI ID below (e.g. <code className="text-xs bg-white px-1 py-0.5 rounded border">8484843035@ptsbi</code>,{' '}
            <code className="text-xs bg-white px-1 py-0.5 rounded border">name@okicici</code>,{' '}
            <code className="text-xs bg-white px-1 py-0.5 rounded border">name@ybl</code>).
            When a customer scans the bill QR with PhonePe, Google Pay, Paytm or BHIM,
            the bill amount and your account will be pre-filled automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="UPI ID">
            <input
              type="text"
              value={value.upiId}
              onChange={(e) => set('upiId', e.target.value)}
              className={inputCls}
              placeholder="yourname@upi"
            />
            <p className="text-[11px] text-gray-500 mt-1.5">
              Payee name on the QR is taken from{' '}
              <span className="font-semibold text-gray-700">{payeeName}</span>{' '}
              (Settings → General → Restaurant Name).
            </p>
          </Field>
          <Field label="Razorpay Key">
            <input
              type="text"
              value={value.razorpayKey}
              onChange={(e) => set('razorpayKey', e.target.value)}
              className={inputCls}
              placeholder="rzp_live_..."
            />
          </Field>
          <Field label="Stripe Secret Key">
            <input
              type="text"
              value={value.stripeKey}
              onChange={(e) => set('stripeKey', e.target.value)}
              className={inputCls}
              placeholder="sk_live_..."
            />
          </Field>
        </div>

        {/* Live UPI test QR */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Test QR · ₹{sampleAmount}
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1 truncate max-w-full">
            {payeeName}
          </p>
          <div className="my-3 w-[180px] h-[180px] bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
            {previewQr ? (
              <img
                src={previewQr}
                alt="UPI preview QR"
                className="w-[170px] h-[170px]"
              />
            ) : (
              <div className="text-[11px] text-gray-400 px-3">
                Enter a valid UPI ID to preview the live QR
              </div>
            )}
          </div>
          {upiId ? (
            <p className="text-[11px] text-gray-500 break-all">
              {upiId}
            </p>
          ) : null}
          <p className="text-[10px] text-gray-400 mt-2">
            Scan with any UPI app to verify
          </p>
        </div>
      </div>
      <SaveBar onSave={onSave} />
    </div>
  );
};

const COLOR_SWATCHES = [
  { id: 'orange', label: 'Orange', cls: 'bg-orange-500' },
  { id: 'blue', label: 'Blue', cls: 'bg-blue-500' },
  { id: 'emerald', label: 'Emerald', cls: 'bg-emerald-500' },
  { id: 'purple', label: 'Purple', cls: 'bg-purple-500' },
  { id: 'rose', label: 'Rose', cls: 'bg-rose-500' },
];

const AppearanceForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const THEME_OPTIONS = [
    { id: 'light', label: 'Light', Icon: Sun },
    { id: 'dark', label: 'Dark', Icon: Moon },
    { id: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <div>
      <Field label="Theme">
        <div className="flex flex-wrap items-center gap-3">
          {THEME_OPTIONS.map(({ id, label, Icon }) => {
            const active = themeMode === id;
            return (
              <button
                key={id}
                onClick={() => setThemeMode(id)}
                type="button"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                  active
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-gray-500">
          Choose Light or Dark, or let the app follow your operating system theme.
        </p>
      </Field>

      <div className="mt-6">
      <Field label="Theme Color">
        <div className="flex flex-wrap items-center gap-3">
          {COLOR_SWATCHES.map((c) => {
            const active = value.themeColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => set('themeColor', c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                  active
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full ${c.cls}`} />
                <span className="text-sm font-semibold text-gray-700">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </Field>
      </div>

      <div className="mt-6">
        <Field label="Layout Density">
          <div className="flex flex-wrap gap-2">
            {['comfortable', 'compact', 'spacious'].map((d) => {
              const active = value.layoutDensity === d;
              return (
                <button
                  key={d}
                  onClick={() => set('layoutDensity', d)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <SaveBar onSave={onSave} />
    </div>
  );
};

const ConnectedForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div>
      <div className="grid grid-cols-1 gap-5">
        <Field label="WhatsApp Webhook URL">
          <input
            type="text"
            value={value.whatsappWebhook}
            onChange={(e) => set('whatsappWebhook', e.target.value)}
            className={inputCls}
            placeholder="https://webhook.example.com/whatsapp"
          />
        </Field>
        <Field label="Delivery API Endpoint">
          <input
            type="text"
            value={value.deliveryApi}
            onChange={(e) => set('deliveryApi', e.target.value)}
            className={inputCls}
            placeholder="https://api.delivery-partner.com/orders"
          />
        </Field>
      </div>
      <SaveBar onSave={onSave} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Aggregator Integrations form (Zomato / Swiggy / external)          */
/* ------------------------------------------------------------------ */

const SOURCE_META = {
  zomato: {
    label: 'Zomato',
    color: 'rose',
    swatch: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-600',
    docsUrl: 'https://www.zomato.com/partners',
  },
  swiggy: {
    label: 'Swiggy',
    color: 'orange',
    swatch: 'bg-orange-500',
    soft: 'bg-orange-50 text-orange-600',
    docsUrl: 'https://partner.swiggy.com',
  },
};

const IntegrationsForm = ({
  value,
  onChange,
  onSave,
  aggregatorConfig,
  onTest,
  testingSource,
  onCopied,
}) => {
  const set = (k, v) => onChange({ ...value, [k]: v });

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      {/* How it works banner */}
      <div className="mb-5 p-4 rounded-2xl bg-blue-50 border border-blue-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[12px] text-blue-700 leading-relaxed">
            <p className="font-bold text-blue-800 mb-1">How aggregator orders work</p>
            <p>
              Zomato &amp; Swiggy push new orders to your restaurant via a
              webhook. Once you&apos;re onboarded as a merchant partner on either
              platform, paste the URL + secret below into their merchant
              dashboard. Every order they send arrives in your{' '}
              <span className="font-semibold">Orders / Takeaway / Kitchen Display</span>{' '}
              in real-time, exactly like an in-house order.
            </p>
            <p className="mt-1">
              Use the <span className="font-semibold">Test Order</span> buttons below
              to simulate an aggregator order right now and watch it land in your
              KDS.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <Field label="Public webhook URL">
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            readOnly
            value={aggregatorConfig.webhookUrl || 'Loading…'}
            className={inputCls + ' flex-1 font-mono text-[12px]'}
          />
          <button
            type="button"
            onClick={() => copy(aggregatorConfig.webhookUrl)}
            disabled={!aggregatorConfig.webhookUrl}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5"
            title="Copy URL"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          Paste this into the Zomato / Swiggy partner dashboard as the
          &quot;Order Webhook URL&quot;.
        </p>
      </Field>

      <div className="mt-5">
        <Field label="Webhook shared secret">
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={aggregatorConfig.secret || 'Loading…'}
              className={inputCls + ' flex-1 font-mono text-[12px]'}
            />
            <button
              type="button"
              onClick={() => copy(aggregatorConfig.secret)}
              disabled={!aggregatorConfig.secret}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5"
              title="Copy secret"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Sent as header{' '}
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[11px]">
              {aggregatorConfig.secretHeader || 'x-webhook-secret'}
            </span>{' '}
            on every request — required for auth. Set
            <span className="font-mono"> AGGREGATOR_WEBHOOK_SECRET </span>
            env var on the backend to rotate it.
          </p>
        </Field>
      </div>

      {/* Per-platform configuration */}
      {['zomato', 'swiggy'].map((src) => {
        const meta = SOURCE_META[src];
        const enabledKey = `${src}Enabled`;
        const apiKeyKey = `${src}ApiKey`;
        const restaurantIdKey = `${src}RestaurantId`;
        return (
          <div
            key={src}
            className="mt-6 p-5 rounded-2xl border border-gray-100 bg-white"
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`w-9 h-9 rounded-xl ${meta.soft} flex items-center justify-center`}
                >
                  <Truck className="w-4.5 h-4.5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{meta.label}</h4>
                  <p className="text-[11px] text-gray-500">
                    Accept orders from {meta.label} customers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!value[enabledKey]}
                    onChange={(e) => set(enabledKey, e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Enabled
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onTest(src)}
                  disabled={testingSource === src}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {testingSource === src ? (
                    <span>Sending…</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Test Order
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-gray-400 mb-1.5">
                  Restaurant ID
                </p>
                <input
                  type="text"
                  value={value[restaurantIdKey]}
                  onChange={(e) => set(restaurantIdKey, e.target.value)}
                  placeholder={`Your ${meta.label} restaurant ID`}
                  className={inputCls}
                />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-wider text-gray-400 mb-1.5">
                  API key
                </p>
                <input
                  type="password"
                  value={value[apiKeyKey]}
                  onChange={(e) => set(apiKeyKey, e.target.value)}
                  placeholder={`Issued by ${meta.label}`}
                  className={inputCls}
                />
              </div>
            </div>

            <p className="mt-3 text-[11px] text-gray-500 flex items-center gap-1.5">
              <LinkIcon className="w-3 h-3" />
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 hover:underline font-semibold"
              >
                Apply for {meta.label} Partner access
              </a>
              &nbsp;·&nbsp; required before the API key can be issued.
            </p>
          </div>
        );
      })}

      <SaveBar onSave={onSave} />
    </div>
  );
};

export default SettingsPage;

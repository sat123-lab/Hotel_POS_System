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
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';

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

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
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
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="UPI ID">
          <input
            type="text"
            value={value.upiId}
            onChange={(e) => set('upiId', e.target.value)}
            className={inputCls}
            placeholder="merchant@upi"
          />
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
  return (
    <div>
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

export default SettingsPage;

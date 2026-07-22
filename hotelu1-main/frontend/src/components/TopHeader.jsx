import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Search,
  Bell,
  Maximize2,
  HelpCircle,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Utensils,
  Receipt,
  Coffee,
  CornerDownLeft,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { formatOrderLabel } from '../utils/orderDisplay';
import { useNotifications } from '../contexts/NotificationsContext';
import ThemeToggle from './ThemeToggle';

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_TABLES = [
  { id: 'T1', capacity: 4, floor: 'Ground Floor' },
  { id: 'T2', capacity: 2, floor: 'Ground Floor' },
  { id: 'T3', capacity: 6, floor: 'Ground Floor' },
  { id: 'T4', capacity: 4, floor: 'Ground Floor' },
  { id: 'T5', capacity: 8, floor: 'Ground Floor' },
  { id: 'T6', capacity: 2, floor: 'Ground Floor' },
  { id: 'T7', capacity: 4, floor: 'First Floor' },
  { id: 'T8', capacity: 4, floor: 'First Floor' },
  { id: 'T9', capacity: 6, floor: 'First Floor' },
  { id: 'T10', capacity: 2, floor: 'First Floor' },
  { id: 'T11', capacity: 4, floor: 'First Floor' },
  { id: 'T12', capacity: 10, floor: 'First Floor' },
];

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TopHeader = ({ currentUser, handleLogout, setActiveTab }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);
  const { unreadCount } = useNotifications();
  const notificationCount = unreadCount;

  /* --------------------------- search state --------------------------- */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  /* --------------------------- click-outside + keyboard --------------------------- */
  useEffect(() => {
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target))
        setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      // Ctrl+K / Cmd+K focuses the search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* --------------------------- fetch sources --------------------------- */
  const fetchMenu = useCallback(async () => {
    try {
      const res = await authFetch('/api/menu');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMenuItems(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const today = ymd(new Date());
      const res = await authFetch(`/api/orders?startDate=${today}&endDate=${today}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      // ignore
    }
  }, []);

  // Fetch sources when search first opens, then periodically while open
  useEffect(() => {
    if (!searchOpen) return undefined;
    fetchMenu();
    fetchOrders();
    const id = setInterval(fetchOrders, 15000);
    return () => clearInterval(id);
  }, [searchOpen, fetchMenu, fetchOrders]);

  /* --------------------------- compute results --------------------------- */
  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { menu: [], orders: [], tables: [], total: 0 };

    const menuMatches = menuItems
      .filter((m) => {
        const name = String(m?.name || '').toLowerCase();
        const cat = String(m?.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      })
      .slice(0, 5)
      .map((m) => ({
        type: 'menu',
        id: `menu-${m.id}`,
        name: m.name,
        sub: `${m.category || 'Item'} · ₹${Number(m.price || 0).toFixed(2)}`,
        route: '/menu',
      }));

    const orderMatches = orders
      .filter((o) => {
        const id = String(o?.id || '').toLowerCase();
        const tn = String(o?.table_name || '').toLowerCase();
        const status = String(o?.status || '').toLowerCase();
        return (
          `#${id}`.includes(q) ||
          id.includes(q) ||
          tn.includes(q) ||
          status.includes(q)
        );
      })
      .slice(0, 5)
      .map((o) => ({
        type: 'order',
        id: `order-${o.id}`,
        name: formatOrderLabel(o),
        sub: `${o.table_name || (String(o.type).toUpperCase() === 'TAKEAWAY' ? 'Takeaway' : 'Order')} · ${o.status} · ₹${Number(o.total || 0).toFixed(2)}`,
        route: '/orders',
      }));

    const tableMatches = DEFAULT_TABLES.filter((t) => {
      const id = String(t.id).toLowerCase();
      const num = id.replace(/^t/, '');
      return id.includes(q) || `table ${num}`.includes(q) || num === q;
    })
      .slice(0, 5)
      .map((t) => ({
        type: 'table',
        id: `table-${t.id}`,
        name: `Table ${t.id.replace(/^T/, '')}`,
        sub: `${t.capacity} seats · ${t.floor}`,
        route: '/dinein',
      }));

    return {
      menu: menuMatches,
      orders: orderMatches,
      tables: tableMatches,
      total: menuMatches.length + orderMatches.length + tableMatches.length,
    };
  }, [searchQuery, menuItems, orders]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(
    () => [...results.tables, ...results.orders, ...results.menu],
    [results]
  );

  useEffect(() => {
    setSearchActiveIdx(0);
  }, [searchQuery]);

  const goToResult = (r) => {
    if (!r) return;
    setSearchOpen(false);
    setSearchQuery('');
    if (typeof setActiveTab === 'function') {
      if (r.type === 'menu') setActiveTab('menu-management');
      if (r.type === 'order') setActiveTab('orders');
      if (r.type === 'table') setActiveTab('dine-in-management');
    }
    navigate(r.route);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.min(i + 1, Math.max(0, flatResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flatResults[searchActiveIdx];
      if (r) goToResult(r);
    }
  };

  const requestFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const initials = (currentUser?.name || 'A').charAt(0).toUpperCase();
  const roleLabel =
    (currentUser?.role || 'user').charAt(0).toUpperCase() +
    (currentUser?.role || 'user').slice(1);

  /* --------------------------- render --------------------------- */
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          className="hidden lg:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-50 text-gray-700"
          aria-label="Menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-2xl" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search orders, tables, menu items..."
              className="w-full pl-11 pr-16 py-2.5 rounded-full bg-gray-50 border border-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-200"
            />
            <span className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-400 bg-white font-mono">
              Ctrl K
            </span>

            {/* Dropdown */}
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
                {searchQuery.trim() === '' ? (
                  <SearchHints onPick={(q) => setSearchQuery(q)} />
                ) : results.total === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No results for{' '}
                      <span className="font-semibold text-gray-700">"{searchQuery}"</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Try searching by order #, table name, or menu item
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto py-1.5">
                    <ResultGroup
                      title="Tables"
                      icon={Utensils}
                      items={results.tables}
                      offset={0}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <ResultGroup
                      title="Orders"
                      icon={Receipt}
                      items={results.orders}
                      offset={results.tables.length}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <ResultGroup
                      title="Menu Items"
                      icon={Coffee}
                      items={results.menu}
                      offset={results.tables.length + results.orders.length}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[11px] text-gray-400">
                      <span>
                        Use{' '}
                        <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 font-mono">
                          ↑↓
                        </kbd>{' '}
                        to navigate ·{' '}
                        <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 font-mono">
                          Enter
                        </kbd>{' '}
                        to open
                      </span>
                      <span className="text-gray-400">{results.total} results</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <button
            onClick={() => {
              if (typeof setActiveTab === 'function') setActiveTab('notifications');
              navigate('/notifications');
            }}
            className="relative w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 flex items-center justify-center"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Theme toggle — light / dark */}
          <ThemeToggle />

          <button
            onClick={requestFullScreen}
            className="hidden sm:flex w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 items-center justify-center"
            aria-label="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            className="hidden sm:flex w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 items-center justify-center"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Profile */}
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 transition"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden sm:block text-left">
                <span className="block text-sm font-semibold text-gray-800 leading-tight">
                  {currentUser?.name || 'User'}
                </span>
                <span className="block text-[11px] text-gray-500 leading-tight">
                  {roleLabel}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-orange-50/50"
                  onClick={() => {
                    setOpen(false);
                    navigate('/dashboard');
                  }}
                >
                  <UserIcon className="w-4 h-4 text-gray-400" /> Profile
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    handleLogout?.();
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const HINT_QUERIES = ['Butter Chicken', 'Table 5', 'Order #', 'Biryani'];

const SearchHints = ({ onPick }) => (
  <div className="py-3 px-4">
    <p className="text-[10px] font-bold tracking-widest text-gray-400 mb-2">
      QUICK SEARCH
    </p>
    <div className="flex flex-wrap gap-1.5">
      {HINT_QUERIES.map((h) => (
        <button
          key={h}
          onClick={() => onPick(h)}
          className="px-2.5 py-1 rounded-full bg-gray-50 hover:bg-orange-50 text-xs font-medium text-gray-600 hover:text-orange-600 transition border border-gray-100"
        >
          {h}
        </button>
      ))}
    </div>
    <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
      <CornerDownLeft className="w-3 h-3" />
      Start typing to search orders, tables, and menu items
    </p>
  </div>
);

const ResultGroup = ({ title, icon: Icon, items, offset, activeIdx, onPick }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-4 py-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <p className="text-[10px] font-bold tracking-widest text-gray-400">
          {title}
        </p>
      </div>
      <ul>
        {items.map((it, idx) => {
          const isActive = activeIdx === offset + idx;
          return (
            <li key={it.id}>
              <button
                onMouseEnter={() => {
                  /* keyboard idx unchanged on hover for predictability */
                }}
                onClick={() => onPick(it)}
                className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition ${
                  isActive ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {it.name}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{it.sub}</p>
                </div>
                {isActive && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TopHeader;

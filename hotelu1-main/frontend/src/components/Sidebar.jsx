import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  LayoutGrid,
  ClipboardList,
  Receipt,
  Utensils,
  ChefHat,
  Store,
  ChevronDown,
  HelpCircle,
  LogOut,
  Package,
  BarChart3,
  QrCode,
  Users,
  Building,
  Settings,
  Percent,
  Tag,
  Menu as MenuIcon,
  X,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';

const navIconClass = (active) =>
  `w-5 h-5 ${active ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500'}`;

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-orange-50 text-orange-600'
        : 'text-gray-600 hover:bg-orange-50/60 hover:text-orange-600'
    }`}
  >
    {active && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-orange-500" />
    )}
    <Icon className={navIconClass(active)} />
    <span className="truncate">{label}</span>
  </button>
);

const Sidebar = ({
  activeTab,
  setActiveTab,
  currentUser,
  locationSettings,
  handleLocationChange,
  handleLogout,
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ taxPercent: 5, discountPercent: 0 });
  const [draftSettings, setDraftSettings] = useState({ taxPercent: 5, discountPercent: 0 });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchUserPermissions();
  }, [currentUser]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${getAPI_URL()}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        const s = { taxPercent: data.taxPercent ?? 5, discountPercent: data.discountPercent ?? 0 };
        setGlobalSettings(s);
        setDraftSettings(s);
        localStorage.setItem('globalTaxDiscount', JSON.stringify(s));
      }
    } catch (e) {
      const saved = localStorage.getItem('globalTaxDiscount');
      if (saved) {
        const parsed = JSON.parse(saved);
        setGlobalSettings(parsed);
        setDraftSettings(parsed);
      }
    }
  };

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return setLoadingPermissions(false);
      const res = await fetch(`${getAPI_URL()}/api/my-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserPermissions(data.permissions || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSettingChange = (field, value) => {
    setDraftSettings((p) => ({ ...p, [field]: value }));
    setHasChanges(true);
  };

  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${getAPI_URL()}/api/settings/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draftSettings),
      });
      if (res.ok) {
        setGlobalSettings(draftSettings);
        localStorage.setItem('globalTaxDiscount', JSON.stringify(draftSettings));
        setHasChanges(false);
      }
    } catch (e) {
      // ignore
    }
  };

  const isSubFranchise = currentUser?.role === 'subfranchise';
  const isFranchiseOwner = currentUser?.role === 'franchise';
  const isFranchiseLogin = isSubFranchise || isFranchiseOwner;

  const hasPermission = (p) =>
    currentUser?.role === 'admin' ? true : userPermissions.includes(p);
  const hasAnyPermission = (ps) =>
    currentUser?.role === 'admin' ? true : ps.some((p) => userPermissions.includes(p));

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    const routeMap = {
      dashboard: '/dashboard',
      orders: '/orders',
      'menu-management': '/menu',
      'dine-in-management': '/dinein',
      inventory: '/inventory',
      billing: '/billing',
      reports: '/reports',
      kds: '/kitchen',
      'qr-management': '/qr-management',
      'takeaway-management': '/takeaway',
    };
    navigate(routeMap[tab] || '/dashboard');
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-orange-50 text-gray-700"
          >
            <MenuIcon size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-800">Restaurant POS</span>
          </div>
          {currentUser && (
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 flex flex-col h-screen
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Close (mobile) */}
        <div className="lg:hidden flex justify-end p-3">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-orange-50 text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 leading-tight">Restaurant POS</p>
              <p className="text-[11px] text-gray-500 leading-tight">Premium Management Sys</p>
            </div>
          </div>
        </div>

        {/* Branch selector */}
        <div className="px-4">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-orange-100 bg-orange-50/40 hover:bg-orange-50 transition">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">Restaurant 1</p>
              <p className="text-[11px] text-gray-500 leading-tight">Main Branch</p>
              <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Country selector (kept for non-franchise users) */}
        {!isFranchiseLogin && (
          <div className="px-5 mt-3">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Country</label>
            <select
              value={locationSettings?.country || 'India'}
              onChange={handleLocationChange}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
            >
              <option value="India">India</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="mt-4 flex-1 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {/* Franchise overview (franchise users) */}
            {isFranchiseLogin && (
              <li>
                <NavItem
                  icon={Building}
                  label={isSubFranchise ? 'My Franchise' : 'Franchise Overview'}
                  active={activeTab === 'franchise-dashboard'}
                  onClick={() => handleTabClick('franchise-dashboard')}
                />
              </li>
            )}

            {!isFranchiseLogin && hasPermission('view_dashboard') && (
              <li>
                <NavItem
                  icon={LayoutGrid}
                  label="Dashboard"
                  active={activeTab === 'dashboard'}
                  onClick={() => handleTabClick('dashboard')}
                />
              </li>
            )}

            {hasAnyPermission(['manage_orders', 'create_order', 'view_orders']) && (
              <li>
                <NavItem
                  icon={ClipboardList}
                  label="Orders"
                  active={activeTab === 'orders'}
                  onClick={() => handleTabClick('orders')}
                />
              </li>
            )}

            {hasAnyPermission(['view_billing', 'process_payments', 'view_bills']) && (
              <li>
                <NavItem
                  icon={Receipt}
                  label="POS Billing"
                  active={activeTab === 'billing'}
                  onClick={() => handleTabClick('billing')}
                />
              </li>
            )}

            {hasAnyPermission(['manage_orders', 'create_order', 'view_orders']) && (
              <li>
                <NavItem
                  icon={Utensils}
                  label="Table Management"
                  active={activeTab === 'dine-in-management'}
                  onClick={() => handleTabClick('dine-in-management')}
                />
              </li>
            )}

            {hasPermission('kitchen_display') && (
              <li>
                <NavItem
                  icon={ChefHat}
                  label="Kitchen Display"
                  active={activeTab === 'kds'}
                  onClick={() => handleTabClick('kds')}
                />
              </li>
            )}

            {!isFranchiseLogin &&
              hasAnyPermission(['view_menu', 'manage_menu', 'create_menu_item', 'edit_menu_item', 'delete_menu_item']) && (
                <li>
                  <NavItem
                    icon={Utensils}
                    label="Menu Management"
                    active={activeTab === 'menu-management'}
                    onClick={() => handleTabClick('menu-management')}
                  />
                </li>
              )}

            {hasPermission('view_reports') && (
              <li>
                <NavItem
                  icon={BarChart3}
                  label="Reports"
                  active={activeTab === 'reports'}
                  onClick={() => handleTabClick('reports')}
                />
              </li>
            )}

            {!isFranchiseLogin &&
              hasAnyPermission(['view_inventory', 'manage_inventory', 'edit_inventory']) && (
                <li>
                  <NavItem
                    icon={Package}
                    label="Inventory"
                    active={activeTab === 'inventory'}
                    onClick={() => handleTabClick('inventory')}
                  />
                </li>
              )}

            {!isFranchiseLogin && hasPermission('manage_qr_codes') && (
              <li>
                <NavItem
                  icon={QrCode}
                  label="QR Code Management"
                  active={activeTab === 'qr-management'}
                  onClick={() => handleTabClick('qr-management')}
                />
              </li>
            )}

            {currentUser?.role === 'admin' && (
              <li>
                <NavItem
                  icon={Users}
                  label="User Management"
                  active={activeTab === 'user-management'}
                  onClick={() => handleTabClick('user-management')}
                />
              </li>
            )}

            {currentUser?.role === 'admin' && (
              <li>
                <NavItem
                  icon={Building}
                  label="Franchise Overview"
                  active={activeTab === 'franchise-dashboard'}
                  onClick={() => handleTabClick('franchise-dashboard')}
                />
              </li>
            )}

            {hasPermission('manage_subfranchise') &&
              (currentUser?.role === 'admin' || isFranchiseOwner) && (
                <li>
                  <NavItem
                    icon={Users}
                    label="Sub-Franchises"
                    active={activeTab === 'subfranchise-management'}
                    onClick={() => handleTabClick('subfranchise-management')}
                  />
                </li>
              )}
          </ul>

          {/* Tax / Discount settings (collapsible) */}
          {!isFranchiseLogin && (
            <div className="mt-5 px-2">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 hover:text-orange-600 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Settings size={13} /> Tax & Discount
                </span>
                <span className="text-orange-500 text-xs">{showSettings ? '▲' : '▼'}</span>
              </button>
              {showSettings && (
                <div className="mt-3 space-y-2 bg-orange-50/60 p-3 rounded-xl border border-orange-100">
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-600 mb-1">
                      <Percent size={11} /> Default Tax (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draftSettings.taxPercent}
                      onChange={(e) =>
                        handleSettingChange('taxPercent', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-600 mb-1">
                      <Tag size={11} /> Default Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draftSettings.discountPercent}
                      onChange={(e) =>
                        handleSettingChange('discountPercent', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <button
                    onClick={handleUpdateSettings}
                    disabled={!hasChanges}
                    className={`w-full py-1.5 text-xs font-semibold rounded-lg transition ${
                      hasChanges
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {hasChanges ? 'Update' : 'No Changes'}
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Need help card */}
        <div className="px-4 pb-3">
          <div className="rounded-2xl bg-orange-50/60 border border-orange-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">Need Help?</p>
                <p className="text-[11px] text-gray-500 leading-tight">We are here to help you</p>
              </div>
            </div>
            <button className="w-full mt-1 py-2 text-xs font-semibold rounded-lg bg-white border border-orange-200 text-orange-600 hover:bg-orange-100/40 transition">
              Contact Support
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-1 flex items-center justify-between text-[11px] text-gray-400">
          <div>
            <p>2026 Restaurant POS</p>
            <p>All rights reserved.</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-7 h-7 rounded-full hover:bg-orange-50 text-gray-500 hover:text-orange-600 flex items-center justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

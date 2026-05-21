import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ShoppingCart, LayoutGrid, Utensils, Package, Receipt, ClipboardList, QrCode, Building, Users, UtensilsCrossed, LogOut, BarChart3, Menu, X, Percent, Tag, Settings
} from 'lucide-react';

import { getAPI_URL } from '../utils/api';

const Sidebar = ({ activeTab, setActiveTab, currentUser, locationSettings, handleLocationChange, handleLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  
  // Global Tax & Discount Settings - initialize with defaults
  const [globalSettings, setGlobalSettings] = useState({ taxPercent: 5, discountPercent: 0 });
  const [draftSettings, setDraftSettings] = useState({ taxPercent: 5, discountPercent: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings from API on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch settings from database API
  const fetchSettings = async () => {
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        const settings = {
          taxPercent: data.taxPercent ?? 5,
          discountPercent: data.discountPercent ?? 0
        };
        setGlobalSettings(settings);
        setDraftSettings(settings);
        // Also save to localStorage as backup
        localStorage.setItem('globalTaxDiscount', JSON.stringify(settings));
      } else {
        // Fallback to localStorage if API fails
        const saved = localStorage.getItem('globalTaxDiscount');
        if (saved) {
          const parsed = JSON.parse(saved);
          setGlobalSettings(parsed);
          setDraftSettings(parsed);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Fallback to localStorage
      const saved = localStorage.getItem('globalTaxDiscount');
      if (saved) {
        const parsed = JSON.parse(saved);
        setGlobalSettings(parsed);
        setDraftSettings(parsed);
      }
    }
  };

  // Handle input change (draft only, not saved yet)
  const handleSettingChange = (field, value) => {
    setDraftSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Save settings to database API when Update button clicked
  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to update settings');
        return;
      }

      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/settings/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(draftSettings)
      });

      if (response.ok) {
        setGlobalSettings(draftSettings);
        // Also save to localStorage as backup
        localStorage.setItem('globalTaxDiscount', JSON.stringify(draftSettings));
        setHasChanges(false);
        alert('Settings updated successfully!');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.message || 'Failed to update settings'));
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings. Please try again.');
    }
  };

  // Fetch user permissions on mount
  useEffect(() => {
    fetchUserPermissions();
  }, [currentUser]);

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingPermissions(false);
        return;
      }

      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/my-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const isSubFranchise = currentUser?.role === 'subfranchise';
  const isFranchiseOwner = currentUser?.role === 'franchise';
  const isFranchiseLogin = isSubFranchise || isFranchiseOwner;

  const hasPermission = (permission) => {
    if (currentUser?.role === 'admin') return true;
    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    if (currentUser?.role === 'admin') return true;
    if (!permissions || permissions.length === 0) return false;
    return permissions.some((perm) => userPermissions.includes(perm));
  };

  const showOrderNav = () =>
    hasAnyPermission([
      'manage_orders',
      'create_order',
      'view_orders',
      'view_billing',
      'process_payments',
      'kitchen_display',
    ]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Close mobile menu after selection
    
    // Only navigate for specific routes that have dedicated pages
    const routeMap = {
      'menu-management': '/menu',
      'dine-in-management': '/dinein',
      'inventory': '/inventory',
      'billing': '/billing',
      'reports': '/reports',
      'kds': '/kitchen',
      'qr-management': '/qr-management',
      'takeaway-management': '/takeaway'
    };
    
    if (routeMap[tab]) {
      navigate(routeMap[tab]);
    } else {
      // For other tabs, stay on dashboard and let activeTab control the content
      navigate('/dashboard');
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-orange-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="ml-3 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mr-2 shadow-md">
                <UtensilsCrossed className="text-white" size={16} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-800 leading-tight">Restaurant POS</h1>
                <p className="text-xs text-orange-600">Management System</p>
              </div>
            </div>
          </div>
          {currentUser && (
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-bold">{currentUser.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={toggleMobileMenu} />
      )}

      {/* Sidebar - White Background */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 
        w-72 bg-white text-gray-800
        flex flex-col px-4 py-5 border-r border-orange-100 min-h-screen shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} role="navigation" aria-label="Main navigation">

        {/* Close button for mobile */}
        <div className="lg:hidden flex justify-end mb-4">
          <button
            onClick={toggleMobileMenu}
            className="text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <UtensilsCrossed className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 mb-1 leading-tight">Restaurant POS</h1>
              <p className="text-xs font-medium text-gray-500">Premium Management System</p>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/50 backdrop-blur-sm px-3 py-2 shadow-lg">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Signed in</p>
                <p className="truncate text-sm font-semibold text-gray-800 capitalize">
                  {currentUser.name}
                  <span className="text-gray-500 font-medium"> ({currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)})</span>
                </p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{currentUser.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}

          {!isFranchiseLogin && (
          <div className="mt-4">
            <label htmlFor="country-select" className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <select
              id="country-select"
              value={locationSettings.country}
              onChange={handleLocationChange}
              className="w-full border border-orange-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 backdrop-blur-sm"
            >
              <option value="India">India</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
            </select>
          </div>
          )}

          {!isFranchiseLogin && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full text-xs font-medium text-gray-600 hover:text-orange-600 transition-colors"
            >
              <span className="flex items-center gap-1">
                <Settings size={14} />
                Tax & Discount Defaults
              </span>
              <span className="text-orange-500">{showSettings ? '▲' : '▼'}</span>
            </button>
            
            {showSettings && (
              <div className="mt-3 space-y-3 bg-orange-50/50 p-3 rounded-xl border border-orange-200">
                {/* Tax Setting */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    <Percent size={12} />
                    Default Tax (%)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draftSettings.taxPercent}
                      onChange={(e) => handleSettingChange('taxPercent', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <span className="text-sm text-gray-500 flex items-center">%</span>
                  </div>
                </div>
                
                {/* Discount Setting */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    <Tag size={12} />
                    Default Discount (%)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draftSettings.discountPercent}
                      onChange={(e) => handleSettingChange('discountPercent', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <span className="text-sm text-gray-500 flex items-center">%</span>
                  </div>
                </div>
                
                {/* Update Button */}
                <button
                  onClick={handleUpdateSettings}
                  disabled={!hasChanges}
                  className={`w-full py-2 text-sm font-semibold rounded-lg transition-all ${
                    hasChanges 
                      ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {hasChanges ? 'Update Settings' : 'No Changes'}
                </button>
                
                <p className="text-xs text-gray-400 italic">
                  Click Update to save changes
                </p>
              </div>
            )}
          </div>
          )}

        </div>

        <nav className="flex-grow overflow-y-auto overflow-x-hidden" aria-label="Sidebar menu">
          <ul className="space-y-2">
            {isFranchiseLogin && (
              <li>
                <button
                  onClick={() => handleTabClick('franchise-dashboard')}
                  aria-current={activeTab === 'franchise-dashboard' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'franchise-dashboard'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Building className={`mr-3 ${activeTab === 'franchise-dashboard' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">{isSubFranchise ? 'My Franchise' : 'Franchise Overview'}</span>
                </button>
              </li>
            )}

            {!isFranchiseLogin && hasPermission('view_dashboard') && (
              <li>
                <button
                  onClick={() => handleTabClick('dashboard')}
                  aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'dashboard'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <LayoutGrid className={`mr-3 ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Dashboard</span>
                </button>
              </li>
            )}

            {/* Reports */}
            {hasPermission('view_reports') && (
              <li>
                <button
                  onClick={() => handleTabClick('reports')}
                  aria-current={activeTab === 'reports' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'reports'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <BarChart3 className={`mr-3 ${activeTab === 'reports' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Reports</span>
                </button>
              </li>
            )}

            {/* QR Code Management */}
            {!isFranchiseLogin && hasPermission('manage_qr_codes') && (
              <li>
                <button
                  onClick={() => handleTabClick('qr-management')}
                  aria-current={activeTab === 'qr-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'qr-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <QrCode className={`mr-3 ${activeTab === 'qr-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">QR Code Management</span>
                </button>
              </li>
            )}

            {/* Dine-In Management */}
            {(!isFranchiseLogin || showOrderNav()) && hasAnyPermission(['manage_orders', 'create_order', 'view_orders']) && (
              <li>
                <button
                  onClick={() => handleTabClick('dine-in-management')}
                  aria-current={activeTab === 'dine-in-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'dine-in-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Utensils className={`mr-3 ${activeTab === 'dine-in-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Dine-In Management</span>
                </button>
              </li>
            )}

            {/* Takeaway Management */}
            {(!isFranchiseLogin || showOrderNav()) && hasAnyPermission(['manage_orders', 'create_order', 'view_orders']) && (
              <li>
                <button
                  onClick={() => handleTabClick('takeaway-management')}
                  aria-current={activeTab === 'takeaway-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'takeaway-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <ShoppingCart className={`mr-3 ${activeTab === 'takeaway-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Takeaway Management</span>
                </button>
              </li>
            )}

            {/* Inventory */}
            {!isFranchiseLogin && hasAnyPermission(['view_inventory', 'manage_inventory', 'edit_inventory']) && (
              <li>
                <button
                  onClick={() => handleTabClick('inventory')}
                  aria-current={activeTab === 'inventory' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'inventory'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Package className={`mr-3 ${activeTab === 'inventory' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Inventory</span>
                </button>
              </li>
            )}

            {/* Billing */}
            {(!isFranchiseLogin || showOrderNav()) && hasAnyPermission(['view_billing', 'process_payments', 'view_bills']) && (
              <li>
                <button
                  onClick={() => handleTabClick('billing')}
                  aria-current={activeTab === 'billing' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'billing'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Receipt className={`mr-3 ${activeTab === 'billing' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Billing</span>
                </button>
              </li>
            )}

            {/* Kitchen Display */}
            {(!isFranchiseLogin || showOrderNav()) && hasPermission('kitchen_display') && (
              <li>
                <button
                  onClick={() => handleTabClick('kds')}
                  aria-current={activeTab === 'kds' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'kds'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <ClipboardList className={`mr-3 ${activeTab === 'kds' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Kitchen Display</span>
                </button>
              </li>
            )}

            {/* Menu Management */}
            {!isFranchiseLogin && hasAnyPermission(['view_menu', 'manage_menu', 'create_menu_item', 'edit_menu_item', 'delete_menu_item']) && (
              <li>
                <button
                  onClick={() => handleTabClick('menu-management')}
                  aria-current={activeTab === 'menu-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'menu-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <UtensilsCrossed className={`mr-3 ${activeTab === 'menu-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Menu Management</span>
                </button>
              </li>
            )}

            {/* User Management - Admin only */}
            {currentUser?.role === 'admin' && (
              <li>
                <button
                  onClick={() => handleTabClick('user-management')}
                  aria-current={activeTab === 'user-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'user-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Users className={`mr-3 ${activeTab === 'user-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">User Management</span>
                </button>
              </li>
            )}

            {/* Permission Management - Admin only */}
            {currentUser?.role === 'admin' && (
              <li>
                <button
                  onClick={() => handleTabClick('permission-management')}
                  aria-current={activeTab === 'permission-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'permission-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Building className={`mr-3 ${activeTab === 'permission-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Permission Management</span>
                </button>
              </li>
            )}

            {currentUser?.role === 'admin' && (
              <li>
                <button
                  onClick={() => handleTabClick('franchise-dashboard')}
                  aria-current={activeTab === 'franchise-dashboard' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'franchise-dashboard'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Building className={`mr-3 ${activeTab === 'franchise-dashboard' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Franchise Overview</span>
                </button>
              </li>
            )}

            {hasPermission('manage_subfranchise') && (currentUser?.role === 'admin' || isFranchiseOwner) && (
              <li>
                <button
                  onClick={() => handleTabClick('subfranchise-management')}
                  aria-current={activeTab === 'subfranchise-management' ? 'page' : undefined}
                  className={`relative flex items-center flex-nowrap w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    activeTab === 'subfranchise-management'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Users className={`mr-3 ${activeTab === 'subfranchise-management' ? 'text-white' : 'text-gray-400'}`} size={18} /> <span className="truncate">Manage Sub-Franchises</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="mt-8 pt-4 border-t border-orange-100">
          <button
            onClick={() => {
              handleLogout();
            }}
            className="flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <LogOut className="mr-3 text-gray-400" size={18} /> <span className="truncate">Logout</span>
          </button>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;

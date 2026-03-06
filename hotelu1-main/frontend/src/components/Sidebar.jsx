import React, { useState } from 'react';

import {

  ShoppingCart, LayoutGrid, Utensils, Package, Receipt, ClipboardList, QrCode, Building, Users, UtensilsCrossed, LogOut, BarChart3, Menu, X

} from 'lucide-react';



const Sidebar = ({ activeTab, setActiveTab, currentUser, locationSettings, handleLocationChange, handleLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Close mobile menu after selection
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="ml-3 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-2">
                <UtensilsCrossed className="text-white" size={16} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">Restaurant POS</h1>
                <p className="text-xs text-slate-300">Management System</p>
              </div>
            </div>
          </div>
          {currentUser && (
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{currentUser.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={toggleMobileMenu} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 
        w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white 
        flex flex-col px-4 py-5 border-r border-slate-700 min-h-screen shadow-2xl
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <UtensilsCrossed className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-1 leading-tight">Restaurant POS</h1>
              <p className="text-xs font-medium text-slate-300">Premium Management System</p>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center justify-between rounded-xl border border-slate-600 bg-slate-800/50 backdrop-blur-sm px-3 py-2 shadow-lg">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">Signed in</p>
                <p className="truncate text-sm font-semibold text-white capitalize">
                  {currentUser.name}
                  <span className="text-slate-400 font-medium"> ({currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)})</span>
                </p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{currentUser.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="country-select" className="block text-xs font-medium text-slate-400 mb-1">Country</label>
            <select
              id="country-select"
              value={locationSettings.country}
              onChange={handleLocationChange}
              className="w-full border border-slate-600 rounded-xl bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 backdrop-blur-sm"
            >
              <option value="India">India</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
            </select>
          </div>

        </div>

        <nav className="flex-grow overflow-y-auto overflow-x-hidden" aria-label="Sidebar menu">
          <ul className="space-y-2">
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'franchise' || currentUser.role === 'subfranchise' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('dashboard')}
                  aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="mr-3 text-slate-400" size={18} /> <span className="truncate">Dashboard</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('reports')}
                  aria-current={activeTab === 'reports' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'reports'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <BarChart3 className="mr-3 text-slate-400" size={18} /> <span className="truncate">Reports</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'waiter' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('qr-management')}
                  aria-current={activeTab === 'qr-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'qr-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <QrCode className="mr-3 text-slate-400" size={18} /> <span className="truncate">QR Code Management</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'waiter' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('dine-in-management')}
                  aria-current={activeTab === 'dine-in-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'dine-in-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Utensils className="mr-3 text-slate-400" size={18} /> <span className="truncate">Dine-In Management</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'waiter' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('takeaway-management')}
                  aria-current={activeTab === 'takeaway-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'takeaway-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <ShoppingCart className="mr-3 text-slate-400" size={18} /> <span className="truncate">Takeaway Management</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('inventory')}
                  aria-current={activeTab === 'inventory' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'inventory'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Package className="mr-3 text-slate-400" size={18} /> <span className="truncate">Inventory</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'waiter' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('billing')}
                  aria-current={activeTab === 'billing' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'billing'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Receipt className="mr-3 text-slate-400" size={18} /> <span className="truncate">Billing</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'chef' || currentUser.role === 'manager' || currentUser.role === 'waiter') && (
              <li>
                <button
                  onClick={() => handleTabClick('kds')}
                  aria-current={activeTab === 'kds' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'kds'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <ClipboardList className="mr-3 text-slate-400" size={18} /> <span className="truncate">Kitchen Display</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'subfranchise' || currentUser.role === 'manager') && (
              <li>
                <button
                  onClick={() => handleTabClick('menu-management')}
                  aria-current={activeTab === 'menu-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'menu-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <UtensilsCrossed className="mr-3 text-slate-400" size={18} /> <span className="truncate">Menu Management</span>
                </button>
              </li>
            )}

            {currentUser && currentUser.role === 'admin' && (
              <li>
                <button
                  onClick={() => handleTabClick('user-management')}
                  aria-current={activeTab === 'user-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'user-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Users className="mr-3 text-slate-400" size={18} /> <span className="truncate">User Management</span>
                </button>
              </li>
            )}

            {currentUser && currentUser.role === 'admin' && (
              <li>
                <button
                  onClick={() => handleTabClick('permission-management')}
                  aria-current={activeTab === 'permission-management' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'permission-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Building className="mr-3 text-slate-400" size={18} /> <span className="truncate">Permission Management</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'franchise') && (
              <li>
                <button
                  onClick={() => handleTabClick('franchise-dashboard')}
                  aria-current={activeTab === 'franchise-dashboard' ? 'page' : undefined}
                  className={`relative flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'franchise-dashboard'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Building className="mr-3 text-slate-400" size={18} /> <span className="truncate">Franchise Overview</span>
                </button>
              </li>
            )}

            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'franchise') && (
              <li>
                <button
                  onClick={() => handleTabClick('subfranchise-management')}
                  aria-current={activeTab === 'subfranchise-management' ? 'page' : undefined}
                  className={`relative flex items-center flex-nowrap w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    activeTab === 'subfranchise-management'
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-blue-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Users className="mr-3 text-slate-400" size={18} /> <span className="truncate">Manage Sub-Franchises</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="mt-8 pt-4 border-t border-slate-600">
          <button
            onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <LogOut className="mr-3 text-slate-400" size={18} /> <span className="truncate">Logout</span>
          </button>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;

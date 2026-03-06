import React, { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Sidebar from './Sidebar';
import Login from './Login';
import NoAccessMessage from './NoAccessMessage';
import Dashboard from './Dashboard';
import Reports from './Reports';
import QRManagement from './QRManagement';
import DineInManagement from './DineInManagement';
import TakeawayManagement from './TakeawayManagement';
import InventoryManagement from './InventoryManagement';
import BillingPage from './BillingPage';
import KitchenDisplaySystem from './KitchenDisplaySystem';
import MenuManagement from './MenuManagement';
import QRCodeOrdering from './QRCodeOrdering';
import UserManagement from './UserManagement';
import PermissionManagementNew from './PermissionManagementNew';
import CustomerIndex from './CustomerIndex';
// IndexLogin is deprecated for /login route; use `Login` instead
import LandingPage from './LandingPage';

// API utility function
const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    if (!Array.isArray(data) && typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

const FranchiseDashboard = ({ currentUser }) => (
  <div className="p-6 bg-gray-50 min-h-screen rounded-lg shadow-inner">
    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Franchise Dashboard - {currentUser?.name}</h2>
    <div className="text-center text-gray-600">
      <p className="text-lg">Welcome, {currentUser?.name} ({currentUser?.role}).</p>
      <p>This area would show aggregated data for all sub-franchises under your management.</p>
      <p className="mt-4">
        Examples: Overall sales across all sub-franchises, performance comparisons,
        management of sub-franchise accounts, etc.
      </p>
    </div>
  </div>
);

const SubFranchiseManagement = () => (
  <div className="p-6 bg-gray-50 min-h-screen rounded-lg shadow-inner">
    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sub-Franchise Management</h2>
    <div className="text-center text-gray-600">
      <p className="text-lg">This section is for managing sub-franchise details, accessible by the main franchise or admin.</p>
      <p className="mt-4">
        Functionality could include adding/editing sub-franchise details, setting up their initial menu,
        viewing their specific reports, etc.
      </p>
      <p className="mt-4 text-red-500">
        (Note: This is a placeholder. Full CRUD operations for sub-franchises would require a backend.)
      </p>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [locationSettings, setLocationSettings] = useState({
    country: 'India',
    currencySymbol: '₹',
    taxRate: 0.05,
  });
  const [nextOrderId, setNextOrderId] = useState(6); // initial value matches mockApi
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Handle routing based on path
  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Redirect unauthenticated users visiting /dashboard to /login
  useEffect(() => {
    if (currentPath === '/dashboard' && !currentUser) {
      window.history.pushState({}, '', '/login');
      setCurrentPath('/login');
    }
    // If user exists and is on /login, redirect to dashboard
    if (currentPath === '/login' && currentUser) {
      window.history.pushState({}, '', '/dashboard');
      setCurrentPath('/dashboard');
    }
  }, [currentPath, currentUser]);

  useEffect(() => {
    // Restore user from localStorage on component mount
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('currentUser');
    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        // Set initial tab based on role
        if (user.role === 'chef') {
          setActiveTab('kds');
        } else if (user.role === 'waiter') {
          setActiveTab('dine-in-management');
        } else if (user.role === 'franchise') {
          setActiveTab('franchise-dashboard');
        } else {
          setActiveTab('dashboard');
        }
      } catch (error) {
        console.error('Failed to restore user from localStorage:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);

    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
    // Simulate geo-detection or user selection
    const detectLocation = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockCountry = 'India';
      if (mockCountry === 'India') {
        setLocationSettings({ country: 'India', currencySymbol: '₹', taxRate: 0.05 });
      } else if (mockCountry === 'US') {
        setLocationSettings({ country: 'US', currencySymbol: '$', taxRate: 0.07 });
      } else if (mockCountry === 'UK') {
        setLocationSettings({ country: 'UK', currencySymbol: '£', taxRate: 0.20 });
      }
    };
    detectLocation();
  }, []);

  const handleLogin = (user, token) => {
    // Set user and persist, then navigate to dashboard
    setCurrentUser(user);
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));

    if (user.role === 'chef') {
      setActiveTab('kds');
    } else if (user.role === 'waiter') {
      setActiveTab('dine-in-management');
    } else if (user.role === 'franchise') {
      setActiveTab('franchise-dashboard');
    } else {
      setActiveTab('dashboard');
    }

    // Navigate to dashboard route in App state (avoid dispatching popstate from Login)
    window.history.pushState({}, '', '/dashboard');
    setCurrentPath('/dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setActiveTab('dashboard');
  };

  const handleLocationChange = (e) => {
    const country = e.target.value;
    if (country === 'India') {
      setLocationSettings({ country: 'India', currencySymbol: '₹', taxRate: 0.05 });
    } else if (country === 'US') {
      setLocationSettings({ country: 'US', currencySymbol: '$', taxRate: 0.07 });
    } else if (country === 'UK') {
      setLocationSettings({ country: 'UK', currencySymbol: '£', taxRate: 0.20 });
    }
  };

  // Show loading state while checking localStorage
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Handle /login route (staff portal)
  if (currentPath === '/login') {
    return <Login onLogin={handleLogin} />;
  }

  // Handle /dashboard path explicitly; require login
  if (currentPath === '/dashboard') {
    if (!currentUser) {
      return <Login onLogin={handleLogin} />;
    }

    return (
      <div className="flex min-h-screen font-inter relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          locationSettings={locationSettings}
          handleLocationChange={handleLocationChange}
          handleLogout={handleLogout}
        />
        <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 p-4 lg:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    );
  }

  // Handle root path (/) - landing page / public index
  if (currentPath === '/') {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    const tableId = params.get('tableId');

    // Allow direct QR ordering via ?tab=qr-ordering
    if (tabFromUrl === 'qr-ordering') {
      return <QRCodeOrdering locationSettings={locationSettings} />;
    }

    // If tableId present, show QR ordering (customer view)
    if (tableId) {
      return <CustomerIndex locationSettings={locationSettings} />;
    }
    // If no tableId and not qr-ordering, show Landing Page as index
    const navigateToLogin = () => {
      window.history.pushState({}, '', '/login');
      setCurrentPath('/login');
    };

    const navigateToQR = () => {
      // Navigate to QR ordering via query param and set active tab
      window.history.pushState({}, '', '/?tab=qr-ordering');
      setCurrentPath('/');
      setActiveTab('qr-ordering');
    };

    return <LandingPage onNavigateToLogin={navigateToLogin} onNavigateToQR={navigateToQR} />;
  }

  // For all other paths, require admin login
  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get('tab');
  if (!currentUser && tabFromUrl !== 'qr-ordering') {
    return <Login onLogin={handleLogin} />;
  }

  function renderContent() {
    // Allow guest access for QR ordering
    if (activeTab === 'qr-ordering') {
      return <QRCodeOrdering locationSettings={locationSettings} />;
    }
    // For all other tabs, require a user
    if (!currentUser) return null;

    const { role } = currentUser;
    switch (activeTab) {
      case 'reports':
        return (role === 'admin' || role === 'manager') ? <Reports locationSettings={locationSettings} /> : <NoAccessMessage />;
      case 'qr-management':
        return (role === 'admin' || role === 'subfranchise' || role === 'waiter' || role === 'manager') ? <QRManagement locationSettings={locationSettings} /> : <NoAccessMessage />;
      case 'dine-in-management':
        return (role === 'admin' || role === 'subfranchise' || role === 'waiter' || role === 'manager') ? <DineInManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} /> : <NoAccessMessage />;
      case 'takeaway-management':
        return (role === 'admin' || role === 'subfranchise' || role === 'waiter' || role === 'manager') ? <TakeawayManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} /> : <NoAccessMessage />;
      case 'inventory':
        return (role === 'admin' || role === 'subfranchise' || role === 'manager') ? <InventoryManagement /> : <NoAccessMessage />;
      case 'dashboard':
        return (role === 'admin' || role === 'franchise' || role === 'subfranchise' || role === 'manager') ? <Dashboard locationSettings={locationSettings} /> : <NoAccessMessage />;
      case 'billing':
        return (role === 'admin' || role === 'subfranchise' || role === 'waiter' || role === 'manager') ? <BillingPage locationSettings={locationSettings} /> : <NoAccessMessage />;
      case 'kds':
        return (role === 'admin' || role === 'subfranchise' || role === 'chef' || role === 'manager' || role === 'waiter') ? <KitchenDisplaySystem /> : <NoAccessMessage />;
      case 'menu-management':
        return (role === 'admin' || role === 'subfranchise' || role === 'manager') ? <MenuManagement locationSettings={locationSettings} /> : <NoAccessMessage />;
      case 'user-management':
        return role === 'admin' ? <UserManagement token={localStorage.getItem('authToken')} /> : <NoAccessMessage />;
      case 'permission-management':
        return role === 'admin' ? <PermissionManagementNew token={localStorage.getItem('authToken')} /> : <NoAccessMessage />;
      case 'franchise-dashboard':
        return (role === 'admin' || role === 'franchise') ? <FranchiseDashboard currentUser={currentUser} /> : <NoAccessMessage />;
      case 'subfranchise-management':
        return (role === 'admin' || role === 'franchise') ? <SubFranchiseManagement /> : <NoAccessMessage />;
      default:
        if (role === 'chef') return <KitchenDisplaySystem />;
        if (role === 'waiter') return <DineInManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />;
        if (role === 'franchise') return <FranchiseDashboard currentUser={currentUser} />;
        return <Dashboard locationSettings={locationSettings} />;
    }
  }

  return (
    <div className="flex min-h-screen font-inter">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        locationSettings={locationSettings}
        handleLocationChange={handleLocationChange}
        handleLogout={handleLogout}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App; 

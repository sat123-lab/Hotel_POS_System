import React, { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Sidebar from './Sidebar';
import Login from './Login';
import Dashboard from './Dashboard';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import NoAccessMessage from './NoAccessMessage';
import LandingPage from './LandingPage';
import ProtectedRoute from './ProtectedRoute';
import RoleBasedRoute from './RoleBasedRoute';

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
  const [nextOrderId, setNextOrderId] = useState(6);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    // Check if we're on the login page - if so, don't restore session
    const isLoginPage = window.location.pathname === '/login';
    
    if (storedToken && storedUser && !isLoginPage) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
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
    setCurrentUser(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'chef') {
      setActiveTab('kds');
    } else if (user.role === 'waiter') {
      setActiveTab('dine-in-management');
    } else if (user.role === 'franchise') {
      setActiveTab('franchise-dashboard');
    } else {
      setActiveTab('dashboard');
    }
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveTab('dashboard');
    navigate('/login');
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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const renderContent = () => {
    if (activeTab === 'qr-ordering') {
      return <QRCodeOrdering locationSettings={locationSettings} />;
    }
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
        return role === 'admin' ? <UserManagement token={localStorage.getItem('token')} /> : <NoAccessMessage />;
      case 'permission-management':
        return role === 'admin' ? <PermissionManagementNew token={localStorage.getItem('token')} /> : <NoAccessMessage />;
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
  };

  const MenuLayout = ({ children }) => {
    if (!currentUser) {
      return <Navigate to="/login" />;
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
          {children}
        </main>
      </div>
    );
  };

  const DashboardLayout = () => {
    useEffect(() => {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!user || !token) {
        navigate('/login');
      }
    }, [navigate]);

    if (!currentUser) {
      return <Navigate to="/login" />;
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
  };

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/login" 
          element={
            localStorage.getItem('token') && localStorage.getItem('user') ? 
            <Navigate to="/dashboard" /> : 
            <Login onLogin={handleLogin} />
          } 
        />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        } />
        
        <Route path="/menu" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'subfranchise']}>
              <MenuLayout>
                <MenuManagement locationSettings={locationSettings} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/dinein" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'subfranchise', 'waiter']}>
              <MenuLayout>
                <DineInManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/inventory" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'subfranchise']}>
              <MenuLayout>
                <InventoryManagement />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/billing" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'subfranchise', 'waiter']}>
              <MenuLayout>
                <BillingPage locationSettings={locationSettings} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/reports" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager']}>
              <MenuLayout>
                <Reports locationSettings={locationSettings} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/kitchen" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'chef', 'manager', 'waiter']}>
              <MenuLayout>
                <KitchenDisplaySystem />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/qr-management" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'waiter']}>
              <MenuLayout>
                <QRManagement locationSettings={locationSettings} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/takeaway" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['admin', 'manager', 'waiter']}>
              <MenuLayout>
                <TakeawayManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
              </MenuLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App; 

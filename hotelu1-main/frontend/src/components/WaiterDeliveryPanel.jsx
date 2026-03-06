import React, { useState, useEffect } from 'react';
import Notification from './Notification';

const WaiterDeliveryPanel = ({ locationSettings }) => {
  const [readyOrders, setReadyOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchReadyOrders();
    const interval = setInterval(fetchReadyOrders, 3000); // Auto-refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchReadyOrders = () => {
    const token = localStorage.getItem('authToken');
    fetch('https://hotel-pos-system.onrender.com/api/orders?status=ready', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
      .then(res => res.json())
      .then(data => {
        const filtered = Array.isArray(data) 
          ? data.filter(o => o.type === 'DINE_IN') 
          : [];
        setReadyOrders(filtered);
      })
      .catch(err => {
        console.error('Error fetching ready orders:', err);
        setReadyOrders([]);
      });
  };

  const handleConfirmDelivery = async (orderId) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`https://hotel-pos-system.onrender.com/api/orders/${orderId}/confirm-delivery`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tax_rate: locationSettings.taxRate || 0.05 })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Remove from ready orders
      setReadyOrders(prev => prev.filter(o => o.id !== orderId));
      setSelectedOrder(null);
      setNotification({ 
        message: `Order #${orderId} delivered. Bill generated automatically.`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      setNotification({ 
        message: 'Error confirming delivery. Please try again.', 
        type: 'error' 
      });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const OrderCard = ({ order }) => {
    const prepTime = Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000);
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">Order #{order.id}</p>
            <p className="text-lg font-semibold text-slate-900">Table {order.table_name}</p>
          </div>
          <div className="px-3 py-2 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Ready
          </div>
        </div>

        {/* Time Info */}
        <p className="text-xs text-slate-500 mb-4">
          Ready for pickup • Prep time: {prepTime}m
        </p>

        {/* Order Items */}
        <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-3 text-sm">Items</h4>
          <ul className="space-y-2">
            {(order.items || []).map((item, idx) => (
              <li key={idx} className="text-gray-800 flex justify-between items-center text-sm">
                <span className="flex items-center">
                  <span className="font-semibold text-slate-900 mr-2">{item.quantity || item.qty}x</span>
                  <span className="text-slate-700">{item.name}</span>
                </span>
                <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                  {locationSettings.currencySymbol}{item.price}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 pt-3 mt-3 font-semibold text-right text-slate-900 text-base">
            Total: {locationSettings.currencySymbol}{order.total}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => handleConfirmDelivery(order.id)}
          className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        >
          Confirm delivery and close order
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Waiter Panel</h2>
        <p className="text-sm text-slate-500">
          {readyOrders.length === 0
            ? 'No orders ready for delivery'
            : `${readyOrders.length} order(s) ready for delivery`}
        </p>
      </div>

      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {/* Auto-refresh toggle */}
      <div className="mb-6 flex items-center justify-center">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600/20"
          />
          <span className="ml-2 text-slate-700 font-medium">Auto-refresh (every 3 seconds)</span>
        </label>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {readyOrders.length > 0 ? (
          readyOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        ) : (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-1">No active orders</p>
            <p className="text-xs text-slate-500">Orders will appear here when created.</p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {readyOrders.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
              <div className="text-2xl font-semibold text-slate-900">{readyOrders.length}</div>
              <div className="text-slate-500 text-xs">Orders ready</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
              <div className="text-2xl font-semibold text-slate-900">
                {locationSettings.currencySymbol}{readyOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
              </div>
              <div className="text-slate-500 text-xs">Total amount</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
              <div className="text-2xl font-semibold text-slate-900">
                {readyOrders.reduce((sum, o) => sum + (o.items || []).length, 0)}
              </div>
              <div className="text-slate-500 text-xs">Total items</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiterDeliveryPanel;

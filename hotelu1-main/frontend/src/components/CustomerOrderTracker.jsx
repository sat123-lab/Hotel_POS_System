import React, { useState, useEffect } from 'react';
import API_URL from '../utils/api';

const CustomerOrderTracker = ({ orderId, tableId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchOrderStatus();
    const interval = setInterval(fetchOrderStatus, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders?table_name=${tableId}`);
      const orders = await response.json();
      const currentOrder = orders.find(o => o.id === orderId);
      if (currentOrder) {
        setOrder(currentOrder);
      }
    } catch (error) {
      console.error('Error fetching order status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading order status...</div>;
  }

  if (!order) {
    return <div className="text-center py-8 text-gray-600">Order not found</div>;
  }

  const statusConfig = {
    pending: { color: 'bg-orange-50', textColor: 'text-orange-800', icon: '⏳', label: 'Order Received', nextStep: 'Waiting for kitchen' },
    preparing: { color: 'bg-yellow-100', textColor: 'text-yellow-800', icon: '👨‍🍳', label: 'Preparing', nextStep: 'Chef is making your food' },
    ready: { color: 'bg-green-100', textColor: 'text-green-800', icon: '✅', label: 'Ready', nextStep: 'Your order is ready for pickup!' },
    delivered: { color: 'bg-purple-100', textColor: 'text-purple-800', icon: '🚚', label: 'On the Way', nextStep: 'Your order is being delivered to your table!' },
    completed: { color: 'bg-purple-100', textColor: 'text-purple-800', icon: '🎉', label: 'Completed', nextStep: 'Thank you for your order!' }
  };

  const currentStatus = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Order Header */}
      <div className={`${currentStatus.color} ${currentStatus.textColor} rounded-lg p-6 mb-6 shadow-lg`}>
        <div className="text-center">
          <div className="text-5xl mb-2">{currentStatus.icon}</div>
          <h3 className="text-2xl font-bold mb-1">{currentStatus.label}</h3>
          <p className="text-sm opacity-90">Order #{order.id} • Table {order.table_name}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
          <span>Received</span>
          <span>Preparing</span>
          <span>Ready</span>
          <span>Delivered</span>
        </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-orange-400 h-2 rounded-full transition-all duration-300"
            style={{
              width: order.status === 'pending' ? '20%' : 
                     order.status === 'preparing' ? '45%' : 
                     order.status === 'ready' ? '75%' :
                     order.status === 'delivered' ? '95%' : '100%'
            }}
          ></div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md">
        <h4 className="font-bold text-gray-800 mb-3 text-lg">Your Order</h4>
        <div className="space-y-2">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-b-0">
              <span className="text-gray-700">
                <span className="font-semibold">{item.qty || item.quantity}x</span> {item.name}
              </span>
              <span className="text-gray-600 font-semibold">₹{(item.price * (item.qty || item.quantity)).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 mt-3 flex justify-between items-center font-bold text-lg">
          <span>Total:</span>
          <span className="text-orange-600">₹{order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Status Message */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 text-center border border-orange-200">
        <p className="text-gray-700 font-semibold mb-2">{currentStatus.nextStep}</p>
        <p className="text-sm text-gray-600">
          {order.status === 'pending' && '⏳ Your order has been received and sent to the kitchen.'}
          {order.status === 'preparing' && '👨‍🍳 Our chefs are carefully preparing your meal.'}
          {order.status === 'ready' && '✅ Your order is ready! A waiter is coming to deliver it.'}
          {order.status === 'delivered' && '🚚 Your order is on the way to your table!'}
          {order.status === 'completed' && '🎉 We hope you enjoyed your meal. Thank you!'}
        </p>
      </div>

      {/* Estimated Time */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Order placed at: {new Date(order.timestamp).toLocaleTimeString()}</p>
      </div>

      {/* Auto-refresh toggle */}
      <div className="mt-4 flex items-center justify-center">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-xs text-orange-600 hover:text-orange-800 underline"
        >
          {autoRefresh ? '🔄 Auto-refreshing' : '⏸ Auto-refresh off'}
        </button>
      </div>
    </div>
  );
};

export default CustomerOrderTracker;

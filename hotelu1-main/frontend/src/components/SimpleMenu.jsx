import React, { useState, useEffect } from 'react';
import { Utensils, CreditCard, Clock, CheckCircle, Truck } from 'lucide-react';

import { getAPI_URL } from '../utils/api';
import { calculateOrderTotals, fetchAndCacheGlobalSettings } from '../utils/orderTotals';
import {
  formatTableName,
  tableIdMatches,
  isActiveTableOrder,
  getOrderPhaseLabel,
  getOrderPhaseClass,
} from '../utils/tableOrderUtils';
import useCurrency from '../hooks/useCurrency';

const SimpleMenu = ({ tableId, branchId, onOrderPlaced, locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Starters');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);

  useEffect(() => {
    fetchMenu();
    
    // Fetch active orders for this table (public access for QR ordering)
    fetchActiveOrders();
    const orderInterval = setInterval(fetchActiveOrders, 3000);
    return () => clearInterval(orderInterval);
  }, [tableId, branchId]);

  const fetchMenu = async () => {
    try {
      const API_URL = getAPI_URL();
      // Use regular fetch for public menu access (no auth required)
      const response = await fetch(`${API_URL}/api/menu`);
      const data = await response.json();
      // Filter out items that are not available
      const availableMenu = data.filter(item => item.isAvailable === true);
      console.log('SimpleMenu - Available menu items:', availableMenu);
      setMenuItems(availableMenu);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(availableMenu.map(item => item.category))];
      setCategories(uniqueCategories);
      setSelectedCategory(uniqueCategories[0] || 'Starters');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
      setLoading(false);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const API_URL = getAPI_URL();
      const t = tableId || '1';
      let url = `${API_URL}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(formatTableName(t))}`;
      if (branchId != null && branchId !== '') {
        url += `&subfranchise_id=${encodeURIComponent(branchId)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (Array.isArray(data)) {
        const tableOrders = data.filter(
          (o) => tableIdMatches(t, o.table_name) && isActiveTableOrder(o)
        );
        setActiveOrders(tableOrders);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
    }
  };

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, qty: cartItem.qty + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateCartQuantity = (itemId, qty) => {
    if (qty <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(item =>
        item.id === itemId ? { ...item, qty } : item
      ));
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.qty), 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      alert('Please add items to your cart');
      return;
    }

    const settings = await fetchAndCacheGlobalSettings();
    const subtotal = calculateTotal();
    const totals = calculateOrderTotals(subtotal, settings);
    const orderData = {
      table_name: formatTableName(tableId),
      items: cart.map(item => ({
        menuItemId: item.id,
        name: item.name,
        quantity: item.qty,
        price: item.price
      })),
      subtotal: totals.subtotal,
      discount: totals.discountPercent,
      discountAmount: totals.discountAmount,
      taxPercent: totals.taxPercent,
      taxAmount: totals.taxAmount,
      total: totals.total,
      type: 'DINE_IN',
      ...(branchId != null && branchId !== ''
        ? { subfranchise_id: Number(branchId) }
        : {}),
    };

    try {
      const API_URL = getAPI_URL();
      // Use regular fetch for public order placement (no auth required)
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const order = await response.json();
      if (order.id) {
        setCart([]);
        setShowPayment(false);
        fetchActiveOrders(); // Refresh orders immediately
        onOrderPlaced(order);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-orange-50 border-orange-500 text-orange-900';
      case 'preparing': return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'ready': return 'bg-green-100 border-green-500 text-green-900';
      case 'delivered': return 'bg-purple-100 border-purple-500 text-purple-900';
      default: return 'bg-gray-100 border-gray-500 text-gray-900';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <Clock className="text-orange-500" />;
      case 'preparing': return <Utensils className="text-yellow-500" />;
      case 'ready': return <CheckCircle className="text-green-500" />;
      case 'delivered': return <Truck className="text-purple-500" />;
      default: return null;
    }
  };

  const filteredItems = menuItems.filter(item => item.category === selectedCategory);
  const cartTotal = calculateTotal();

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading menu...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Utensils size={24} />
          <h2 className="text-3xl font-bold">Our Menu</h2>
        </div>
        <div className="flex items-center justify-center gap-2">
          <p className="text-orange-100">Table #{tableId || '1'}</p>
          {activeOrders.length > 0 ? (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold animate-pulse">
              Occupied
            </span>
          ) : (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              Available
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Active Orders Display */}
        {activeOrders.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-300">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-red-800">Table Occupied</h3>
                <p className="text-sm text-red-600">Existing orders — add more items below</p>
              </div>
              <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                Occupied
              </span>
            </div>
            <div className="space-y-2">
              {activeOrders.map(order => (
                <div key={order.id} className={`p-3 rounded-lg border-l-4 ${getStatusColor(order.status)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-lg">Order #{order.id} {getStatusIcon(order.status)}</p>
                      {getOrderPhaseLabel(order) && (
                        <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full border ${getOrderPhaseClass(order)}`}>
                          {getOrderPhaseLabel(order)}
                        </span>
                      )}
                    </div>
                    <span className="text-right">
                      <p className="text-xs text-gray-600">Items</p>
                      <p className="font-bold text-lg">{(order.items || []).length}</p>
                    </span>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <ul className="mt-2 text-sm space-y-1">
                      {order.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between text-gray-800 border-b border-gray-100 pb-1">
                          <span>{i.quantity || i.qty}x {i.name}</span>
                          <span className="text-xs font-medium text-gray-500">{getOrderPhaseLabel(order) || order.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="mb-6 flex overflow-x-auto gap-2 pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 max-h-[70vh] overflow-y-auto px-2">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                {/* Item Image */}
                <div className="relative w-full h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50">
                      <svg className="w-12 h-12 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Veg/Non-veg indicator */}
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${item.category?.toLowerCase().includes('non-veg') ? 'bg-red-500 border-red-600' : 'bg-green-500 border-green-600'}`}>
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                </div>
                
                {/* Item Details */}
                <div className="p-3 flex-1 flex flex-col">
                  <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{item.name}</h4>
                  {item.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description}</p>}
                  <div className="mt-auto flex justify-between items-center">
                    <span className="text-lg font-bold text-orange-600">{fmt(item.price)}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold text-sm transition-colors active:scale-95"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Summary */}
        <div className="hidden md:block">
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border-2 border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-3">Your Cart ({cart.length} items)</h3>
          
          {cart.length === 0 ? (
            <p className="text-gray-600 text-center py-4">Your cart is empty. Add items to order!</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-600">{fmt(item.price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, item.qty - 1)}
                        className="bg-red-400 text-white px-2 py-1 rounded font-bold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, item.qty + 1)}
                        className="bg-green-500 text-white px-2 py-1 rounded font-bold"
                      >
                        +
                      </button>
                      <span className="font-bold text-orange-600 w-16 text-right">{fmt(item.price * item.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t-2 border-gray-300 pt-3">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold text-gray-800">Total Amount:</span>
                  <span className="text-2xl font-bold text-orange-600">{fmt(cartTotal)}</span>
                </div>

                {/* Payment Method Selection */}
                <div className="mb-4">
                  <p className="font-semibold text-gray-800 mb-2">Payment Method:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: 'Cash' },
                      { id: 'upi', label: 'UPI' },
                      { id: 'card', label: 'Card' }
                    ].map(method => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-2 rounded-lg font-bold transition-all ${
                          paymentMethod === method.id
                            ? 'bg-orange-500 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <div className="text-xs mt-1">{method.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Place Order Button */}
                <button
                  onClick={placeOrder}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-lg text-lg transition-all shadow-lg transform hover:scale-105"
                >
                  {activeOrders.length > 0 ? 'Add More — Place Order' : 'Place Order'} • {fmt(cartTotal)}
                </button>
              </div>
            </>
          )}
        </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
          <p className="text-sm text-gray-700">
            <strong>Note:</strong> Your order will be prepared by our kitchen. You'll see the status update here. Please wait for our waiter to deliver your order.
          </p>
        </div>

        {/* Floating Cart Button for Mobile */}
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowPayment(!showPayment)}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-lg transition-all transform hover:scale-110 relative"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Cart Modal */}
        {showPayment && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end">
            <div className="bg-white rounded-t-2xl w-full max-h-[70vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Your Cart ({cart.length} items)</h3>
                  <button
                    onClick={() => setShowPayment(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {cart.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">Your cart is empty. Add items to order!</p>
                ) : (
                  <>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{item.name}</p>
                            <p className="text-sm text-gray-600">{fmt(item.price)} each</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.qty - 1)}
                              className="bg-red-400 text-white px-2 py-1 rounded font-bold"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.qty + 1)}
                              className="bg-green-500 text-white px-2 py-1 rounded font-bold"
                            >
                              +
                            </button>
                            <span className="font-bold text-orange-600 w-16 text-right">{fmt(item.price * item.qty)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t-2 border-gray-300 pt-3">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xl font-bold text-gray-800">Total Amount:</span>
                        <span className="text-2xl font-bold text-orange-600">{fmt(cartTotal)}</span>
                      </div>

                      <div className="mb-4">
                        <p className="font-semibold text-gray-800 mb-2">Payment Method:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'cash', label: 'Cash' },
                            { id: 'upi', label: 'UPI' },
                            { id: 'card', label: 'Card' }
                          ].map(method => (
                            <button
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id)}
                              className={`p-2 rounded-lg font-bold transition-all ${
                                paymentMethod === method.id
                                  ? 'bg-orange-500 text-white shadow-lg'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              <div className="text-xs mt-1">{method.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={placeOrder}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-lg text-lg transition-all shadow-lg transform hover:scale-105"
                      >
                        {activeOrders.length > 0 ? 'Add More — Place Order' : 'Place Order'} • {fmt(cartTotal)}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleMenu;

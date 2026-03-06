import React, { useState, useEffect } from 'react';
import { Utensils, CreditCard, Clock, CheckCircle, Truck } from 'lucide-react';

const SimpleMenu = ({ tableId, onOrderPlaced }) => {
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
    fetchActiveOrders();
    
    // Poll for active orders every 2 seconds
    const orderInterval = setInterval(fetchActiveOrders, 2000);
    return () => clearInterval(orderInterval);
  }, [tableId]);

  const fetchMenu = async () => {
    try {
      const response = await fetch('https://hotel-pos-system.onrender.com/api/menu');
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
      const response = await fetch('https://hotel-pos-system.onrender.com/api/orders?type=DINE_IN');
      const data = await response.json();
      if (Array.isArray(data)) {
        // Filter orders for this table and exclude completed orders
        const tableOrders = data.filter(o => 
          o.table_name === (tableId || '1') && 
          o.status !== 'completed'
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

    const orderData = {
      table_name: tableId || '1',
      items: cart.map(item => ({
        menuItemId: item.id,
        name: item.name,
        quantity: item.qty,
        price: item.price
      })),
      total: calculateTotal(),
      type: 'DINE_IN'
    };

    try {
      const response = await fetch('https://hotel-pos-system.onrender.com/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <div className="flex items-center gap-2"><Utensils size={20} className="text-orange-600" /><h2 className="text-3xl font-bold mb-1">Our Menu</h2></div>
        <p className="text-orange-100">Table #{tableId || '1'}</p>
      </div>

      <div className="p-4">
        {/* Active Orders Display */}
        {activeOrders.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border-2 border-orange-200">
            <h3 className="text-xl font-bold text-orange-800 mb-3">Your Active Orders</h3>
            <div className="space-y-2">
              {activeOrders.map(order => (
                <div key={order.id} className={`p-3 rounded-lg border-l-4 ${getStatusColor(order.status)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-lg">Order #{order.id} {getStatusIcon(order.status)}</p>
                      <p className="text-sm font-semibold capitalize">Status: {order.status}</p>
                    </div>
                    <span className="text-right">
                      <p className="text-xs text-gray-600">Items</p>
                      <p className="font-bold text-lg">{(order.items || []).length}</p>
                    </span>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-semibold text-gray-700">Items: {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                    </div>
                  )}
                  {order.bill_status && order.status === 'delivered' && (
                    <p className="text-xs mt-1 font-semibold text-red-600"><CreditCard size={14} className="inline mr-1"/> Bill Status: {order.bill_status}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {filteredItems.map(item => (
              <div key={item.id} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">{item.name}</h4>
                    {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xl font-bold text-orange-600">₹{item.price}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Summary */}
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
                      <p className="text-sm text-gray-600">₹{item.price} each</p>
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
                      <span className="font-bold text-orange-600 w-16 text-right">₹{(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t-2 border-gray-300 pt-3">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold text-gray-800">Total Amount:</span>
                  <span className="text-2xl font-bold text-orange-600">₹{cartTotal.toFixed(2)}</span>
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
                  Place Order • ₹{cartTotal.toFixed(2)}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
          <p className="text-sm text-gray-700">
            <strong>Note:</strong> Your order will be prepared by our kitchen. You'll see the status update here. Please wait for our waiter to deliver your order.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleMenu;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import OrderEntryModal from './OrderEntryModal';



const TakeawayManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {

    const navigate = useNavigate();
    
    // Check authentication
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
        }
    }, [navigate]);

    const [showOrderModal, setShowOrderModal] = useState(false);

    const [activeOrders, setActiveOrders] = useState([]);

    const [notification, setNotification] = useState(null);

    const [editingOrder, setEditingOrder] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);



    useEffect(() => {

        fetchActiveOrders();

        

        // Poll for order updates every 2 seconds to get real-time status changes

        const orderInterval = setInterval(fetchActiveOrders, 2000);

        

        return () => clearInterval(orderInterval);

    }, []);



    // Staggered entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);



    const fetchActiveOrders = () => {

        authFetch('/api/orders?type=TAKEAWAY')

            .then(res => {

                if (!res.ok) {

                    console.error('Server error:', res.status, res.statusText);

                    setActiveOrders([]);

                    return Promise.reject(new Error(`HTTP ${res.status}: ${res.statusText}`));

                }

                return res.json();

            })

            .then(data => {

                if (!Array.isArray(data)) {

                    console.error('Orders response is not an array:', data);

                    setActiveOrders([]);

                    return;

                }

                // Include NOT_AVAILABLE orders so users can add more items to them

                setActiveOrders(data.filter(o => o.status !== 'completed' && o.status !== 'delivered'));

            })

            .catch(err => {

                console.error('Failed to fetch TAKEAWAY orders:', err);

                setActiveOrders([]);

            });

    };



    const handleQuickOrder = () => {

        setShowOrderModal(true);

    };



    const handleOrderPlaced = (orderData) => {

        setActiveOrders(prev => [...prev, orderData]);

        setNotification({ message: 'Takeaway order placed!', type: 'success' });

        setShowOrderModal(false);

        setTimeout(() => setNotification(null), 3000);

    };



    const getStatusColor = (status) => {

        switch(status) {

            case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';

            case 'preparing': return 'bg-amber-50 text-amber-800 border-amber-200';

            case 'ready': return 'bg-emerald-50 text-emerald-800 border-emerald-200';

            case 'NOT_AVAILABLE': return 'bg-rose-50 text-rose-800 border-rose-200';

            default: return 'bg-gray-100 text-gray-800 border-gray-300';

        }

    };



    const getStatusBadge = (status) => {

        switch(status) {

            case 'pending': return 'Pending';

            case 'preparing': return 'Preparing';

            case 'ready': return 'Ready for pickup';

            case 'NOT_AVAILABLE': return 'Not available';

            default: return status;

        }

    };



    const handleAddMoreItems = async (order) => {

        // If order is NOT_AVAILABLE, reset it first

        if (order.status === 'NOT_AVAILABLE') {

            try {

                const deleteResponse = await authFetch(`/api/orders/${order.id}`, {
                    method: 'DELETE'
                });



                if (!deleteResponse.ok) {

                    const errorData = await deleteResponse.json().catch(() => ({}));

                    throw new Error(errorData.message || 'Failed to delete old order');

                }



                const newOrderPayload = {

                    table_name: order.table_name,

                    type: 'TAKEAWAY',

                    status: 'PENDING',

                    total: 0,

                    items: []

                };



                const createResponse = await authFetch('/api/orders', {
                    method: 'POST',
                    body: JSON.stringify(newOrderPayload)
                });



                if (!createResponse.ok) {

                    const errorData = await createResponse.json().catch(() => ({}));

                    throw new Error(errorData.message || 'Failed to create new order');

                }



                const newOrder = await createResponse.json();



                setActiveOrders(prev => prev.filter(o => o.id !== order.id));

                setNotification({ message: `Order #${order.id} reset successfully`, type: 'success' });



                setEditingOrder(newOrder);

                setShowOrderModal(true);

            } catch (error) {

                console.error('Error resetting order:', error);

                setNotification({ message: `Error resetting order: ${error.message}`, type: 'error' });

            }

            setTimeout(() => setNotification(null), 3000);

            return;

        }



        // For normal orders, proceed with existing logic

        setEditingOrder(order);

        setShowOrderModal(true);

    };



    const handleRemoveItem = async (order, itemIndex) => {

        try {

            const token = localStorage.getItem('token');

            const updatedItems = order.items.filter((_, index) => index !== itemIndex);

            const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * (item.quantity || item.qty || 1)), 0);



            // If order becomes empty, first update it to have total = 0, then delete

            if (updatedItems.length === 0) {

                console.log('Order will become empty, updating to total = 0 first');

                

                // First update the order to have empty items and total = 0

                const updateResponse = await authFetch(`/api/orders/${order.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        items: [],
                        total: 0
                    })
                });



                if (!updateResponse.ok) {

                    const errorData = await updateResponse.json().catch(() => ({}));

                    console.error('Update error before delete:', errorData);

                    throw new Error(errorData.message || 'Failed to update order before deletion');

                }



                // Now delete the order

                console.log('Deleting empty order:', order.id, 'with total: 0');

                const deleteResponse = await authFetch(`/api/orders/${order.id}`, {
                    method: 'DELETE'
                });



                if (!deleteResponse.ok) {

                    const errorData = await deleteResponse.json().catch(() => ({}));

                    console.error('Delete error:', errorData);

                    throw new Error(errorData.message || 'Failed to delete empty order');

                }



                // Remove from local state

                setActiveOrders(prev => prev.filter(o => o.id !== order.id));

                setNotification({ message: 'Order removed as all items were deleted!', type: 'success' });

            } else {

                // Update order with remaining items

                console.log('Updating order:', order.id, 'with items:', updatedItems.length, 'new total:', newTotal);

                const response = await authFetch(`/api/orders/${order.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        items: updatedItems,
                        total: newTotal
                    })
                });



                if (!response.ok) {

                    const errorData = await response.json().catch(() => ({}));

                    console.error('Update error:', errorData);

                    throw new Error(errorData.message || 'Failed to remove item');

                }



                // Update local state

                setActiveOrders(prev => prev.map(o => 

                    o.id === order.id 

                        ? { ...o, items: updatedItems, total: newTotal }

                        : o

                ));

                setNotification({ message: 'Item removed successfully!', type: 'success' });

            }

            setTimeout(() => setNotification(null), 3000);

        } catch (error) {

            console.error('Error removing item:', error);

            setNotification({ message: `Error: ${error.message}`, type: 'error' });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    const handleDeleteEmptyOrder = async (order) => {

        try {

            const deleteResponse = await authFetch(`https://hotel-pos-system.onrender.com/api/orders/${order.id}`, {
                method: 'DELETE'
            });



            if (!deleteResponse.ok) {

                const errorData = await deleteResponse.json().catch(() => ({}));

                throw new Error(errorData.message || 'Failed to delete empty order');

            }



            // Remove from local state

            setActiveOrders(prev => prev.filter(o => o.id !== order.id));

            setNotification({ message: `Order #${order.id} deleted successfully!`, type: 'success' });

            setTimeout(() => setNotification(null), 3000);

        } catch (error) {

            console.error('Error deleting empty order:', error);

            setNotification({ message: `Error deleting order: ${error.message}`, type: 'error' });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    const handleMarkCompleted = async (orderId) => {

        try {

            await authFetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'completed' })
            });

            setActiveOrders(prev => prev.filter(order => order.id !== orderId));

            setNotification({ message: `Takeaway Order #${orderId} marked as completed!`, type: 'success' });

        } catch (error) {

            setNotification({ message: 'Error completing takeaway order.', type: 'error' });

        }

        setTimeout(() => setNotification(null), 3000);

    };



    return (

        <div className="p-6 bg-slate-50 min-h-screen" style={{ perspective: '1000px' }}>

            <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-1 animate-fade-in">Takeaway</h2>
                <p className="text-sm text-slate-500">Create and manage takeaway orders.</p>
            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

            <div className="flex justify-center mb-8">
                <button
                    onClick={handleQuickOrder}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 btn-3d-primary"
                >
                    Place New Takeaway Order
                </button>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-4 animate-fade-in">Active Orders</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ transformStyle: 'preserve-3d' }}>

                {activeOrders.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200 animate-slide-up">
                        <div className="mb-3">
                            <svg className="w-12 h-12 text-slate-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-700 mb-1">No active orders</p>
                        <p className="text-xs text-slate-500">Orders will appear here when created.</p>
                    </div>
                ) : (

                    activeOrders.map((order, index) => (

                        <div 
                            key={order.id} 
                            className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ease-out bg-white border-slate-200 hover:border-blue-300 hover:shadow-xl ${
                                isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                            }`}
                            style={{
                                transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                                transformStyle: 'preserve-3d',
                                transitionDelay: `${index * 100}ms`,
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateZ(15px) rotateX(-2deg) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                            }}
                        >

                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Order #{order.id}</p>
                                    <p className="text-lg font-semibold text-slate-900 mt-1">{order.table_name}</p>
                                </div>
                                <span 
                                    className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${getStatusColor(order.status)}`}
                                    style={{
                                        transform: 'translateZ(10px)',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    {getStatusBadge(order.status)}
                                </span>
                            </div>

                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3">
                                <h4 className="font-semibold text-slate-900 mb-2 text-sm">Items</h4>
                                <ul className="space-y-2">
                                    {(order.items || []).map((item, idx) => (
                                        <li key={idx} className="text-sm text-slate-700 flex justify-between items-center">
                                            <span className="flex items-center">
                                                <span className="font-semibold text-slate-900 mr-2">{item.qty || item.quantity}x</span>
                                                <span>{item.name}</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                                                    {locationSettings.currencySymbol}{item.price}
                                                </span>
                                                {order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'preparing' && (
                                                    <button
                                                        onClick={() => handleRemoveItem(order, idx)}
                                                        className="text-rose-700 hover:text-rose-800 text-xs font-semibold bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded transition-colors duration-200"
                                                        title="Remove item"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="border-t border-slate-200 pt-3 mt-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-900">Total</span>
                                    <span className="text-lg font-semibold text-slate-900">
                                        {locationSettings.currencySymbol}{(typeof order.total === 'number' && !isNaN(order.total) ? order.total : 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            

                            {/* Action buttons based on status */}

                            <div className="mt-3 space-y-2">

                                {/* Add More Items button - available for pending, ready, and NOT_AVAILABLE statuses only */}

                                {order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'preparing' && (

                                    <button
                                        onClick={() => handleAddMoreItems(order)}
                                        className="w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 btn-3d"
                                        style={{
                                            transform: 'translateZ(5px)',
                                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(8px) scale(1.05)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(5px) scale(1)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        }}
                                    >

                                        Add More Items

                                    </button>

                                )}

                                

                                {/* Status-specific action buttons */}

                                {order.status === 'ready' && (

                                    <button
                                        onClick={() => handleMarkCompleted(order.id)}
                                        className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 btn-3d-primary"
                                        style={{
                                            transform: 'translateZ(5px)',
                                            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(10px) scale(1.05)';
                                            e.currentTarget.style.boxShadow = '0 8px 12px rgba(37, 99, 235, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(5px) scale(1)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.3)';
                                        }}
                                    >

                                        Mark as delivered

                                    </button>

                                )}

                                

                                {order.status === 'pending' && (

                                    <button

                                        disabled

                                        className="w-full inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"

                                        title="Waiting for chef to start preparing"

                                    >

                                        Waiting for chef

                                    </button>

                                )}

                                

                                {order.status === 'preparing' && (

                                    <button

                                        disabled

                                        className="w-full inline-flex items-center justify-center rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 cursor-not-allowed"

                                        title="Order is being prepared"

                                    >

                                        Being prepared

                                    </button>

                                )}

                                

                                {/* Delete empty order button */}

                                {(!order.items || order.items.length === 0) && (

                                    <button
                                        onClick={() => handleDeleteEmptyOrder(order)}
                                        className="w-full inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-rose-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-rose-600/20"
                                        style={{
                                            transform: 'translateZ(5px)',
                                            boxShadow: '0 1px 3px rgba(244, 63, 94, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(10px) scale(1.05)';
                                            e.currentTarget.style.boxShadow = '0 8px 12px rgba(244, 63, 94, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateZ(5px) scale(1)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(244, 63, 94, 0.3)';
                                        }}
                                    >

                                        Delete empty order

                                    </button>

                                )}

                            </div>

                        </div>

                    ))

                )}

            </div>

            {showOrderModal && (

                <OrderEntryModal

                    table={editingOrder ? { id: 'Takeaway', status: 'available', capacity: 0 } : { id: 'Takeaway', status: 'available', capacity: 0 }}

                    onClose={() => { setShowOrderModal(false); setEditingOrder(null); }}

                    onOrderPlaced={editingOrder ? (orderData => {

                        setActiveOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, items: orderData.items, total: orderData.total } : o));

                        setNotification({ message: `Takeaway order #${editingOrder.id} updated!`, type: 'success' });

                        setEditingOrder(null);

                        setTimeout(() => setNotification(null), 3000);

                    }) : handleOrderPlaced}

                    locationSettings={locationSettings}

                    nextOrderId={nextOrderId}

                    setNextOrderId={setNextOrderId}

                    orderType="TAKEAWAY"

                    initialOrder={editingOrder}

                />

            )}

        </div>

    );

};



export default TakeawayManagement; 


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import { enrichOrderWithTotals } from '../utils/orderTotals';
import Notification from './Notification';
import OrderEntryModal from './OrderEntryModal';
import useCurrency from '../hooks/useCurrency';

const TakeawayManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {
    const { format: fmt } = useCurrency(locationSettings);

    // Thermal print styles for 80mm billing printer
    const thermalPrintStyles = `
        @media print {
            @page { size: 80mm auto; margin: 0; }
            * { 
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body { 
                margin: 0 !important; 
                padding: 0 !important;
                background: white !important;
            }
            /* Hide everything except thermal receipt */
            body > * { display: none !important; }
            .thermal-print-only { 
                display: block !important;
                position: static !important;
                left: auto !important;
                top: auto !important;
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 10px !important;
                font-family: 'Courier New', 'Consolas', monospace !important;
                font-size: 12px !important;
                line-height: 1.4 !important;
                color: black !important;
                background: white !important;
                visibility: visible !important;
            }
            .thermal-print-only * {
                visibility: visible !important;
                display: block !important;
            }
            .thermal-header {
                text-align: center !important;
                margin-bottom: 10px !important;
            }
            .thermal-title {
                font-weight: bold !important;
                font-size: 14px !important;
            }
            .thermal-token-box {
                border: 2px dashed black !important;
                padding: 15px !important;
                margin: 15px 0 !important;
                text-align: center !important;
            }
            .thermal-token-number {
                font-size: 28px !important;
                font-weight: bold !important;
                margin: 10px 0 !important;
            }
            .thermal-line {
                border-top: 1px dashed black !important;
                margin: 8px 0 !important;
                width: 100% !important;
            }
            .thermal-bold {
                font-weight: bold !important;
            }
            .thermal-item-row {
                display: flex !important;
                justify-content: space-between !important;
                margin: 5px 0 !important;
            }
            .thermal-total {
                font-size: 14px !important;
                font-weight: bold !important;
                text-align: center !important;
                margin-top: 10px !important;
            }
            .thermal-footer {
                text-align: center !important;
                margin-top: 15px !important;
                font-size: 11px !important;
            }
        }
        /* Normal screen - hide thermal receipt */
        .thermal-print-only {
            display: none;
        }
    `;

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

    // Receipt modal state for takeaway orders
    const [showReceipt, setShowReceipt] = useState(false);
    const [confirmedOrder, setConfirmedOrder] = useState(null);



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

        // Show receipt modal for takeaway orders with token
        if (orderData.token) {
            setConfirmedOrder(orderData);
            setShowReceipt(true);
        } else {
            setNotification({ message: 'Takeaway order placed!', type: 'success' });
            setTimeout(() => setNotification(null), 3000);
        }

        setShowOrderModal(false);

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

            const deleteResponse = await authFetch(`/api/orders/${order.id}`, {
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

        <div className="p-6 bg-[#FFF8F0] min-h-screen" style={{ perspective: '1000px' }}>

            {/* Thermal Print Styles - Injected for print functionality */}
            <style dangerouslySetInnerHTML={{ __html: thermalPrintStyles }} />

            {/* Header Section - Orange Theme */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-1">Takeaway Orders</h2>
                            <p className="text-orange-100 text-base">Create and manage takeaway orders</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-white text-sm font-medium">Quick Service</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

            <div className="flex justify-center mb-8">
                <button
                    onClick={handleQuickOrder}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-300 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Place New Takeaway Order
                </button>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="w-2 h-8 bg-orange-500 rounded-full mr-3"></span>
                Active Orders
            </h3>

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
                                    {/* Show token for takeaway orders */}
                                    {order.token && (
                                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                                            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-sm font-bold text-amber-800">Token: {order.token}</span>
                                        </div>
                                    )}
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
                                                    {fmt(item.price)}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="border-t border-slate-200 pt-3 mt-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-900">Total</span>
                                    <span className="text-lg font-semibold text-slate-900">
                                        {fmt(typeof order.total === 'number' && !isNaN(order.total) ? order.total : 0)}
                                    </span>
                                </div>
                            </div>

                            

                            {/* Action buttons based on status */}

                            <div className="mt-3 space-y-2">


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

            {/* Takeaway Order Receipt Modal */}
            {showReceipt && confirmedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white">Order Confirmed!</h2>
                            <p className="text-blue-100 text-sm mt-1">Your takeaway order has been placed</p>
                        </div>

                        {/* Receipt Content */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {/* Order Token - Main highlight */}
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mb-4 text-center">
                                <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Your Order Token</p>
                                <p className="text-4xl font-bold text-amber-800 tracking-wider">{confirmedOrder.token}</p>
                                <p className="text-amber-600 text-xs mt-2">Show this token when collecting your order</p>
                            </div>

                            {/* Order Details */}
                            <div className="space-y-2 mb-4 text-sm">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Order ID</span>
                                    <span className="font-semibold text-gray-900">#{confirmedOrder.id}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Date & Time</span>
                                    <span className="font-semibold text-gray-900">{new Date(confirmedOrder.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Status</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Pending
                                    </span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border-t border-gray-200 pt-3 mb-3">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Order Items</h3>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {(confirmedOrder.items || []).map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-gray-700">{item.qty || item.quantity}x {item.name}</span>
                                            <span className="font-medium text-gray-900">{fmt(item.price * (item.qty || item.quantity || 1))}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            {(() => {
                                const t = enrichOrderWithTotals(confirmedOrder);
                                
                                return (
                                    <div className="border-t border-gray-200 pt-3 space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Subtotal</span>
                                            <span className="font-medium text-gray-800">{fmt(t.subtotal)}</span>
                                        </div>
                                        {t.discountPercent > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Discount ({t.discountPercent}%)</span>
                                                <span className="font-medium text-green-600">-{fmt(t.discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Tax ({t.taxPercent}%)</span>
                                            <span className="font-medium text-gray-800">+{fmt(t.taxAmount)}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Total */}
                            <div className="border-t-2 border-gray-200 pt-3 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total Amount</span>
                                    <span className="text-2xl font-bold text-blue-600">{fmt(enrichOrderWithTotals(confirmedOrder).total)}</span>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
                                <p className="text-sm text-blue-800 text-center">
                                    <strong>Important:</strong> Please show your token <strong>{confirmedOrder.token}</strong> at the counter to collect your order.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 p-4 bg-white border-t">
                                <button
                                    onClick={() => {
                                        // Create print window with receipt content
                                        const printWindow = window.open('', '_blank', 'width=300,height=400');
                                        const receiptContent = `
                                            <html>
                                            <head>
                                                <title>Takeaway Receipt #${confirmedOrder.id}</title>
                                                <style>
                                                    @page { size: 80mm auto; margin: 0; }
                                                    body { 
                                                        font-family: 'Courier New', monospace; 
                                                        font-size: 12px; 
                                                        line-height: 1.4;
                                                        padding: 10px;
                                                        width: 80mm;
                                                        margin: 0 auto;
                                                    }
                                                    .center { text-align: center; }
                                                    .bold { font-weight: bold; }
                                                    .token-box { 
                                                        border: 2px dashed #000; 
                                                        padding: 15px; 
                                                        margin: 15px 0; 
                                                        text-align: center;
                                                    }
                                                    .token-number { font-size: 28px; font-weight: bold; }
                                                    .line { border-top: 1px dashed #000; margin: 8px 0; }
                                                    .item { display: flex; justify-content: space-between; }
                                                    .total { font-size: 14px; font-weight: bold; text-align: center; margin-top: 10px; }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="center bold">RESTAURANT POS</div>
                                                <div class="center">Takeaway Order Receipt</div>
                                                <div class="line"></div>
                                                <div>Order ID: #${confirmedOrder.id}</div>
                                                <div>Date: ${new Date(confirmedOrder.timestamp).toLocaleDateString()}</div>
                                                <div>Time: ${new Date(confirmedOrder.timestamp).toLocaleTimeString()}</div>
                                                <div class="line"></div>
                                                <div class="token-box">
                                                    <div>YOUR ORDER TOKEN</div>
                                                    <div class="token-number">${confirmedOrder.token}</div>
                                                </div>
                                                <div class="center">Show this token to collect your order</div>
                                                <div class="line"></div>
                                                <div class="bold">Items:</div>
                                                ${(confirmedOrder.items || []).map(item => `
                                                    <div class="item">
                                                        <span>${item.qty || item.quantity}x ${item.name}</span>
                                                        <span>${fmt(item.price * (item.qty || item.quantity || 1))}</span>
                                                    </div>
                                                `).join('')}
                                                <div class="line"></div>
                                                ${(() => {
                                                    const subtotal = confirmedOrder.subtotal || confirmedOrder.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0) || 0;
                                                    const discountPercent = confirmedOrder.discount || 0;
                                                    const discountAmount = confirmedOrder.discountAmount || (subtotal * discountPercent / 100);
                                                    const afterDiscount = subtotal - discountAmount;
                                                    const taxPercent = confirmedOrder.taxPercent || 5;
                                                    const taxAmount = confirmedOrder.taxAmount || (afterDiscount * taxPercent / 100);
                                                    let breakdown = `<div class="item"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>`;
                                                    if (discountPercent > 0) {
                                                        breakdown += `<div class="item"><span>Discount (${discountPercent}%)</span><span>-${fmt(discountAmount)}</span></div>`;
                                                    }
                                                    breakdown += `<div class="item"><span>Tax (${taxPercent}%)</span><span>+${fmt(taxAmount)}</span></div>`;
                                                    return breakdown;
                                                })()}
                                                <div class="line"></div>
                                                <div class="total">TOTAL: ${fmt(confirmedOrder.total)}</div>
                                                <div class="line"></div>
                                                <div class="center">Thank you for your order!</div>
                                                <div class="center">Please show token ${confirmedOrder.token} at counter</div>
                                            </body>
                                            </html>
                                        `;
                                        printWindow.document.write(receiptContent);
                                        printWindow.document.close();
                                        printWindow.focus();
                                        setTimeout(() => {
                                            printWindow.print();
                                            printWindow.close();
                                        }, 250);
                                    }}
                                    className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Print
                                </button>
                                <button
                                    onClick={() => {
                                        setShowReceipt(false);
                                        setConfirmedOrder(null);
                                    }}
                                    className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Thermal Print Receipt - Shows only when printing */}
            {showReceipt && confirmedOrder && (
                <div className="thermal-print-only">
                    <div className="thermal-header">
                        <div className="thermal-title">RESTAURANT POS</div>
                        <div>Takeaway Order Receipt</div>
                    </div>
                    <div className="thermal-line">--------------------------------</div>
                    <div>Order ID: #{confirmedOrder.id}</div>
                    <div>Date: {new Date(confirmedOrder.timestamp).toLocaleDateString()}</div>
                    <div>Time: {new Date(confirmedOrder.timestamp).toLocaleTimeString()}</div>
                    <div>Status: Pending</div>
                    <div className="thermal-line">--------------------------------</div>
                    <div className="thermal-token-box">
                        <div>YOUR ORDER TOKEN</div>
                        <div className="thermal-token-number">{confirmedOrder.token}</div>
                    </div>
                    <div>Show this token to collect your order</div>
                    <div className="thermal-line">--------------------------------</div>
                    <div className="thermal-bold">Items:</div>
                    {(confirmedOrder.items || []).map((item, idx) => (
                        <div key={idx} className="thermal-item-row">
                            <span>{item.qty || item.quantity}x {item.name}</span>
                            <span>{fmt(item.price * (item.qty || item.quantity || 1))}</span>
                        </div>
                    ))}
                    <div className="thermal-line">--------------------------------</div>
                    <div className="thermal-total">TOTAL: {fmt(confirmedOrder.total)}</div>
                    <div className="thermal-line">--------------------------------</div>
                    <div className="thermal-footer">
                        Thank you for your order!<br/>
                        Please show token {confirmedOrder.token} at counter
                    </div>
                </div>
            )}

        </div>

    );

}

export default TakeawayManagement;

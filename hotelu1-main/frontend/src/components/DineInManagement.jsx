import React, { useState, useEffect } from 'react';

import Notification from './Notification';

import OrderEntryModal from './OrderEntryModal';

import { Utensils, Clock, CheckCircle, Truck } from 'lucide-react';



const DineInManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {

    const [tables, setTables] = useState([

        { id: 'T1', status: 'available', capacity: 4 },

        { id: 'T2', status: 'available', capacity: 2 },

        { id: 'T3', status: 'available', capacity: 6 },

        { id: 'T4', status: 'available', capacity: 4 },

        { id: 'T5', status: 'available', capacity: 8 },

    ]);

    const [selectedTable, setSelectedTable] = useState(null);

    const [showOrderModal, setShowOrderModal] = useState(false);

    const [activeOrders, setActiveOrders] = useState([]);

    const [notification, setNotification] = useState(null);

    const [editingOrder, setEditingOrder] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);



    // Fetch orders and sync table statuses

    const fetchOrdersAndSync = () => {

        fetch('https://hotel-pos-system.onrender.com/api/orders?type=DINE_IN')

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

                const filteredOrders = data.filter(o => o.status !== 'completed' && o.status !== 'delivered');

                setActiveOrders(filteredOrders);

                

                // Update table statuses based on orders

                updateTableStatuses(filteredOrders);

            })

            .catch(err => {

                console.error('Failed to fetch DINE_IN orders:', err);

                setActiveOrders([]);

            });

    };



    // Update table statuses based on active orders and billing status

    const updateTableStatuses = (orders) => {

        setTables(prevTables => 

            prevTables.map(table => {

                const tableOrder = orders.find(o => o.table_name === table.id);

                

                // If no order for this table, it's available

                if (!tableOrder) {

                    return { ...table, status: 'available' };

                }



                // If order exists and not delivered yet, table is occupied

                if (tableOrder.status !== 'delivered') {

                    return { ...table, status: 'occupied' };

                }



                // If order is delivered but not paid, table is waiting for payment

                if (tableOrder.status === 'delivered' && tableOrder.bill_status !== 'paid') {

                    return { ...table, status: 'waiting_payment' };

                }



                // If order is delivered and paid, table can be cleaned

                return { ...table, status: 'occupied' };

            })

        );

    };



    // Initial fetch and setup polling

    useEffect(() => {

        fetchOrdersAndSync();

        

        // Poll for order updates every 2 seconds

        const orderInterval = setInterval(fetchOrdersAndSync, 2000);

        

        return () => clearInterval(orderInterval);

    }, []);

    // Staggered entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const getTableColor = (status) => {

        switch (status) {

            case 'occupied': return 'bg-rose-50 text-rose-800 border-rose-200';

            case 'available': return 'bg-emerald-50 text-emerald-800 border-emerald-200';

            case 'cleaning': return 'bg-amber-50 text-amber-800 border-amber-200';

            case 'waiting_payment': return 'bg-sky-50 text-sky-800 border-sky-200';

            default: return 'bg-slate-50 text-slate-700 border-slate-200';

        }

    };



    const getTableStatusLabel = (status) => {

        switch (status) {

            case 'occupied': return 'Occupied';

            case 'available': return 'Available';

            case 'cleaning': return 'Cleaning';

            case 'waiting_payment': return 'Waiting Payment';

            default: return 'Unknown';

        }

    };



    const handleTableClick = (table) => {

        setSelectedTable(table);

        setShowOrderModal(true);

    };



    const handleOrderPlaced = async (placedOrder) => {

        try {

            // The order was already created by the modal, just refresh and show notification

            fetchOrdersAndSync();

            

            setNotification({ message: `Order for ${selectedTable.id} placed! (Order #${placedOrder.id})`, type: 'success' });

        } catch (error) {

            console.error('Error handling placed order:', error);

            setNotification({ message: 'Error handling order.', type: 'error' });

        }

        setShowOrderModal(false);

        setSelectedTable(null);

        setTimeout(() => setNotification(null), 3000);

    };



    const handleAddMoreItems = async (order) => {

        // If order is NOT_AVAILABLE, reset it first

        if (order.status === 'NOT_AVAILABLE') {

            try {

                const token = localStorage.getItem('authToken');



                const deleteResponse = await fetch(`https://hotel-pos-system.onrender.com/api/orders/${order.id}`, {

                    method: 'DELETE',

                    headers: {

                        'Authorization': token ? `Bearer ${token}` : ''

                    }

                });



                if (!deleteResponse.ok) {

                    const errorData = await deleteResponse.json().catch(() => ({}));

                    throw new Error(errorData.message || 'Failed to delete old order');

                }



                const newOrderPayload = {

                    table_name: order.table_name,

                    type: 'DINE_IN',

                    status: 'PENDING',

                    total: 0,

                    items: []

                };



                const createResponse = await fetch('https://hotel-pos-system.onrender.com/api/orders', {

                    method: 'POST',

                    headers: {

                        'Content-Type': 'application/json',

                        'Authorization': token ? `Bearer ${token}` : ''

                    },

                    body: JSON.stringify(newOrderPayload)

                });



                if (!createResponse.ok) {

                    const errorData = await createResponse.json().catch(() => ({}));

                    throw new Error(errorData.message || 'Failed to create new order');

                }



                const newOrder = await createResponse.json();



                setActiveOrders(prev => prev.filter(o => o.id !== order.id));

                setNotification({ message: `Order #${order.id} reset successfully`, type: 'success' });



                const table = tables.find(t => t.id === order.table_name);

                if (table) {

                    setSelectedTable(table);

                    setEditingOrder(newOrder);

                    setShowOrderModal(true);

                }

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

            const token = localStorage.getItem('authToken');

            const updatedItems = order.items.filter((_, index) => index !== itemIndex);

            const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * (item.quantity || item.qty || 1)), 0);



            // If order becomes empty, first update it to have total = 0, then delete

            if (updatedItems.length === 0) {

                console.log('Dine-in order will become empty, updating to total = 0 first');

                

                // First update order to have empty items and total = 0

                const updateResponse = await fetch(`http://localhost:3001/api/orders/${order.id}`, {

                    method: 'PUT',

                    headers: {

                        'Content-Type': 'application/json',

                        'Authorization': token ? `Bearer ${token}` : ''

                    },

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



                // Now delete order

                console.log('Deleting empty dine-in order:', order.id, 'with total: 0');

                const deleteResponse = await fetch(`http://localhost:3001/api/orders/${order.id}`, {

                    method: 'DELETE',

                    headers: {

                        'Authorization': token ? `Bearer ${token}` : ''

                    }

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

                console.log('Updating dine-in order:', order.id, 'with items:', updatedItems.length, 'new total:', newTotal);

                const response = await fetch(`http://localhost:3001/api/orders/${order.id}`, {

                    method: 'PUT',

                    headers: {

                        'Content-Type': 'application/json',

                        'Authorization': token ? `Bearer ${token}` : ''

                    },

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

            const token = localStorage.getItem('authToken');

            

            const deleteResponse = await fetch(`http://localhost:3001/api/orders/${order.id}`, {

                method: 'DELETE',

                headers: {

                    'Authorization': token ? `Bearer ${token}` : ''

                }

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



    const handleMarkTableAvailable = async (tableId) => {

        try {

            const tableOrder = activeOrders.find(order => order.table_name === tableId);

            

            // If order was delivered, mark it as completed before cleaning

            if (tableOrder && tableOrder.status === 'delivered') {

                // Complete the order

                await fetch(`http://localhost:3001/api/orders/${tableOrder.id}`, {

                    method: 'PUT',

                    headers: { 'Content-Type': 'application/json' },

                    body: JSON.stringify({ status: 'completed' })

                });

            }

            

            // Mark table as cleaning

            setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'cleaning' } : t));

            setNotification({ message: `Table ${tableId} is being cleaned...`, type: 'info' });

            

            // After 3 seconds, mark as available

            setTimeout(() => {

                setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'available' } : t));

                setNotification({ message: `Table ${tableId} is now available!`, type: 'success' });

                

                // Refresh orders after marking table available

                fetchOrdersAndSync();

                

                setTimeout(() => setNotification(null), 3000);

            }, 3000);

        } catch (error) {

            console.error('Error marking table available:', error);

            setNotification({ message: 'Error marking table available.', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    return (

        <div className="p-6 bg-slate-50 min-h-screen" style={{ perspective: '1000px' }}>

            <div className="mb-6">

                <h2 className="text-2xl font-semibold text-slate-900 mb-1">Dine-In</h2>

                <p className="text-sm text-slate-500">

                {activeOrders.length === 0 ? 'No active orders' : `${activeOrders.length} active order(s)`}

                </p>

            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

            

            <h3 className="text-lg font-semibold text-slate-900 mb-4 animate-fade-in">Table Overview</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8" style={{ transformStyle: 'preserve-3d' }}>

                        {tables.map((table, index) => {

                    const tableOrder = activeOrders.find(o => o.table_name === table.id);

                    return (

                        <div

                            key={table.id}

                            className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ease-out bg-white border-slate-200 hover:border-blue-300 hover:shadow-xl ${
                                isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                            }`}
                            style={{
                                transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                                transformStyle: 'preserve-3d',
                                transitionDelay: `${index * 100}ms`,
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}

                            onClick={() => handleTableClick(table)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateZ(15px) rotateX(-2deg) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                            }}

                        >

                            <div className="flex items-start justify-between gap-3">

                                <div className="min-w-0">

                                    <p className="text-sm font-semibold text-slate-900">Table {table.id}</p>

                                    <p className="text-xs text-slate-500 mt-1">Capacity: {table.capacity}</p>

                                </div>

                                <span 
                                    className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${getTableColor(table.status)}`}
                                    style={{
                                        transform: 'translateZ(10px)',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                    }}
                                >

                                    {getTableStatusLabel(table.status)}

                                </span>

                            </div>

                            {activeOrders.find(o => o.table_name === table.id) && (

                                <p className="text-xs mt-3 text-slate-500 animate-pulse-slow">

                                    Order #{activeOrders.find(o => o.table_name === table.id).id} · {activeOrders.find(o => o.table_name === table.id).status}

                                </p>

                            )}

                            {table.status === 'occupied' && activeOrders.find(o => o.table_name === table.id && o.status !== 'NOT_AVAILABLE') && (

                                <button

                                        onClick={(e) => { e.stopPropagation(); handleTableClick(table); }}

                                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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

                                        + Add Items

                                    </button>

                            )}

                            {table.status === 'waiting_payment' && (

                                <button

                                    onClick={(e) => { e.stopPropagation(); handleMarkTableAvailable(table.id); }}

                                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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

                                    Mark available

                                </button>

                            )}

                        </div>

                    );

                })}

            </div>



            <h3 className="text-lg font-semibold text-slate-900 mb-4">Active Orders</h3>

            {activeOrders.length === 0 ? (

                <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">

                    <div className="mb-3"><CheckCircle size={40} className="text-emerald-600 mx-auto" /></div>

                    <p className="text-sm font-medium text-slate-700">No active orders</p>

                    <p className="text-xs text-slate-500 mt-1">Orders will appear here when created.</p>

                </div>

            ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {activeOrders.map(order => {

                        const statusColor = {

                            'pending': 'border-slate-200 bg-white',

                            'preparing': 'border-amber-200 bg-white',

                            'ready': 'border-emerald-200 bg-white',

                            'delivered': 'border-slate-200 bg-white',

                            'NOT_AVAILABLE': 'border-rose-200 bg-white'

                        }[order.status] || 'border-slate-200 bg-white';



                        const statusIcon = {

                            'pending': <Clock className="text-slate-500" size={18} />,

                            'preparing': <Utensils className="text-amber-600" size={18} />,

                            'ready': <CheckCircle className="text-emerald-600" size={18} />,

                            'delivered': <Truck className="text-slate-500" size={18} />,

                            'NOT_AVAILABLE': <Clock className="text-rose-600" size={18} />

                        }[order.status] || null;



                        return (

                            <div key={order.id} className={`bg-white p-5 rounded-xl shadow-sm border ${statusColor}`}>

                                <div className="flex justify-between items-start mb-3">

                                    <div>

                                        <p className="text-sm font-semibold text-slate-900">Order #{order.id}</p>

                                        <p className="text-lg font-semibold text-slate-900 mt-1">Table {order.table_name}</p>

                                    </div>

                                    <div>{statusIcon}</div>

                                </div>

                                <p className="text-xs text-slate-500 mb-3 capitalize">

                                    Status: 

                                    {order.status === 'NOT_AVAILABLE' ? (

                                        <span className="ml-2 bg-rose-50 text-rose-800 px-3 py-1 rounded-full text-xs font-semibold border border-rose-200">

                                            NOT AVAILABLE

                                        </span>

                                    ) : (

                                        <span className="font-bold text-gray-800"> {order.status}</span>

                                    )}

                                </p>

                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3">

                                    <h4 className="font-semibold text-slate-900 mb-2 text-sm">Items</h4>

                                    <ul className="space-y-1">

                                        {(order.items || []).map((item, idx) => (

                                            <li key={idx} className="text-sm text-gray-700 flex justify-between items-center">

                                                <span><strong>{item.qty || item.quantity}x</strong> {item.name}</span>

                                                <div className="flex items-center gap-2">

                                                    <span className="text-gray-600">{locationSettings.currencySymbol}{item.price}</span>

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

                                <p className="text-right text-sm font-semibold text-slate-900 mb-3">

                                    Total: {locationSettings.currencySymbol}{(typeof order.total === 'number' && !isNaN(order.total) ? order.total : 0).toFixed(2)}

                                </p>

                                {order.status === 'NOT_AVAILABLE' && (

                                    <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-xs mb-3">

                                        This item is currently not available in kitchen.

                                    </div>

                                )}

                                <button

                                    onClick={() => handleAddMoreItems(order)}

                                    className={`w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${

                                        order.status === 'NOT_AVAILABLE'

                                            ? 'bg-rose-600 hover:bg-rose-700 text-white'

                                            : 'bg-blue-600 hover:bg-blue-700 text-white'

                                    }`}

                                >

                                    {order.status === 'NOT_AVAILABLE' ? 'Reset and add items' : 'Add more items'}

                                </button>

                                <button

                                    onClick={(e) => { e.stopPropagation(); handleMarkTableAvailable(order.table_name); }}

                                    disabled={order.status === 'NOT_AVAILABLE'}

                                    className={`mt-3 w-full px-3 py-1 rounded-full text-sm font-semibold transition-colors ${

                                        order.status === 'NOT_AVAILABLE'

                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'

                                            : 'bg-white text-slate-900 hover:bg-slate-50 border border-slate-200'

                                    }`}

                                >

                                    Mark Available

                                </button>

                                

                                {/* Delete empty order button */}

                                {(!order.items || order.items.length === 0) && (

                                    <button

                                        onClick={() => handleDeleteEmptyOrder(order)}

                                        className="mt-3 w-full inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600/20"

                                        title="Delete empty order"

                                    >

                                        Delete empty order

                                    </button>

                                )}

                            </div>

                        );

                    })}

                </div>

            )}



            {showOrderModal && (

                <OrderEntryModal

                    table={editingOrder ? { id: editingOrder.table_name, status: 'occupied', capacity: 0 } : selectedTable}

                    onClose={() => { setShowOrderModal(false); setEditingOrder(null); setSelectedTable(null); }}

                    onOrderPlaced={editingOrder ? (orderData => {

                        setActiveOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, items: orderData.items, total: orderData.total } : o));

                        setNotification({ message: `Order for ${editingOrder.table_name} updated!`, type: 'success' });

                        setEditingOrder(null);

                        setTimeout(() => setNotification(null), 3000);

                    }) : handleOrderPlaced}

                    locationSettings={locationSettings}

                    nextOrderId={nextOrderId}

                    setNextOrderId={setNextOrderId}

                    orderType="DINE_IN"

                    initialOrder={editingOrder}

                />

            )}

        </div>

    );

};



export default DineInManagement; 


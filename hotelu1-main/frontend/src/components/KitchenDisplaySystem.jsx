import React, { useState, useEffect } from 'react';

import Notification from './Notification';

import { X } from 'lucide-react';
import { authFetch, getSocketUrl } from '../utils/api';
import { io } from 'socket.io-client';
import { getLocationSettingsForCountry } from '../utils/currency';
import useCurrency from '../hooks/useCurrency';

const KitchenDisplaySystem = ({ locationSettings: locationSettingsProp }) => {
    const locationSettings =
        locationSettingsProp ||
        getLocationSettingsForCountry(localStorage.getItem('posCountry') || 'India');
    const { format: fmt } = useCurrency(locationSettings);

    const [orders, setOrders] = useState([]);

    const [notification, setNotification] = useState(null);

    const [autoRefresh, setAutoRefresh] = useState(true);

    const [permissions, setPermissions] = useState([]);

    const [userRole, setUserRole] = useState('');
    const [socket, setSocket] = useState(null);



    useEffect(() => {

        fetchPermissions();

        fetchOrders();
        
        // Initialize socket connection
        const newSocket = io(getSocketUrl());
        setSocket(newSocket);

        // Refresh orders every 2 seconds

        const orderInterval = setInterval(fetchOrders, 2000);

        // Refresh permissions every 5 seconds to catch role/permission changes

        const permissionInterval = setInterval(fetchPermissions, 5000);

        return () => {

            clearInterval(orderInterval);

            clearInterval(permissionInterval);
            newSocket.disconnect();

        };

    }, []);



    const fetchPermissions = async () => {

        const token = localStorage.getItem('token');

        try {

            const response = await authFetch('/api/my-permissions');

            const data = await response.json();

            console.log('📦 Fetched permissions from API:', data);

            setPermissions(data.permissions || []);

            setUserRole(data.role || '');

            console.log('✅ Permissions set to:', data.permissions);

        } catch (err) {

            console.error('❌ Error fetching permissions:', err);

            // If error, allow all permissions for admin/chef roles

            const token = localStorage.getItem('token');

            if (token) {

                try {

                    const payload = JSON.parse(atob(token.split('.')[1]));

                    console.log('🔐 User from token:', payload);

                    if (payload.role === 'admin' || payload.role === 'chef') {

                        console.log('⭐ Chef/Admin role detected - granting all permissions');

                        setPermissions(['*']);

                    }

                    setUserRole(payload.role || '');

                } catch (e) {

                    console.error('Error parsing token:', e);

                }

            }

        }

    };



    const hasPermission = (permissionName) => {

        const hasWildcard = permissions.includes('*');

        const hasPermissionInList = permissions.includes(permissionName);

        const result = hasWildcard || hasPermissionInList;

        

        // If chef role specifically - grant all KDS permissions as failsafe

        if (userRole === 'chef') {

            const chefPermissions = ['mark_order_preparing', 'mark_order_ready', 'confirm_order_delivery'];

            if (chefPermissions.includes(permissionName)) {

                console.log(`✅ Chef role detected - AUTO GRANTING: ${permissionName}`);

                return true;

            }

        }

        

        console.log(`🔍 Checking permission: "${permissionName}"`);

        console.log(`   User Role: ${userRole}`);

        console.log(`   Current permissions: ${JSON.stringify(permissions)}`);

        console.log(`   Has wildcard (*): ${hasWildcard}`);

        console.log(`   Has in list: ${hasPermissionInList}`);

        console.log(`   Result: ${result}`);

        

        return result;

    };



    const fetchOrders = async () => {

        try {
            const response = await authFetch('/api/orders');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setOrders(data.filter(o => 
                o.status !== 'completed' && 
                o.status !== 'NOT_AVAILABLE' && 
                o.status !== 'delivered' &&
                o.items && 
                o.items.length > 0 // Filter out empty orders
            ));
        } catch (err) {
            console.error('Error fetching orders:', err);
            // Don't show notification for every fetch error to avoid spam
            // Only show if it's a network error or server error
            if (err.message && !err.message.includes('401')) {
                setNotification({ 
                    message: 'Error loading orders. Backend may be unavailable.', 
                    type: 'error' 
                });
                setTimeout(() => setNotification(null), 3000);
            }
        }

    };



    const handleUpdateOrderStatus = async (orderId, newStatus) => {

        // Check permission before updating

        if (newStatus === 'preparing' && !hasPermission('mark_order_preparing')) {

            setNotification({ message: 'You do not have permission to mark orders as preparing', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

            return;

        }

        if (newStatus === 'ready' && !hasPermission('mark_order_ready')) {

            setNotification({ message: 'You do not have permission to mark orders as ready', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

            return;

        }

        if (newStatus === 'completed' && !hasPermission('confirm_order_delivery')) {

            setNotification({ message: 'You do not have permission to mark orders as delivered', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

            return;

        }



        const token = localStorage.getItem('token');

        try {

            let response;

            

            // For NOT_AVAILABLE status, use the dedicated endpoint

            if (newStatus === 'NOT_AVAILABLE') {

                response = await authFetch(`/api/orders/${orderId}/not-available`, {
                    method: 'PUT',
                    body: JSON.stringify({})
                });

            } else if (newStatus === 'completed') {

                // For delivery, use the confirm-delivery endpoint which auto-generates bills

                // This will set status to 'delivered' to keep it in live orders until payment

                response = await authFetch(`/api/orders/${orderId}/confirm-delivery`, {
                    method: 'PUT',
                    body: JSON.stringify({ tax_rate: 0.05 })
                });

                // Update local status to 'delivered' to remove from KDS display

                newStatus = 'delivered';

                // Emit socket event to notify Dashboard to refresh
                if (socket) {
                    socket.emit('order_status_updated', { orderId, newStatus: 'delivered' });
                }

            } else {

                // For other status changes, use the regular update endpoint

                response = await authFetch(`/api/orders/${orderId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: newStatus })
                });

                // Emit socket event for all status updates
                if (socket && newStatus !== 'delivered') {
                    socket.emit('order_status_updated', { orderId, newStatus });
                }

            }



            if (!response.ok) {

                const errorData = await response.json();

                throw new Error(errorData.message || 'Failed to update order status');

            }



            // For NOT_AVAILABLE, remove the order from the display entirely

            if (newStatus === 'NOT_AVAILABLE') {

                setOrders(prev => prev.filter(order => order.id !== orderId));

                setNotification({ 

                    message: `Order #${orderId} marked as not available`, 

                    type: 'success' 

                });

            } else {

                setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));

                setNotification({ 

                    message: newStatus === 'delivered' 

                        ? `Order #${orderId} delivered and sent to billing` 

                        : newStatus === 'completed'

                        ? `Order #${orderId} delivered and bill generated` 

                        : `Order #${orderId} updated: ${newStatus.toUpperCase()}`, 

                    type: 'success' 

                });

            }

        } catch (error) {

            console.error('Error updating order status:', error);

            setNotification({ message: `Error: ${error.message || 'Could not update order status'}`, type: 'error' });

        }

        setTimeout(() => setNotification(null), 3000);

    };

    const handleRemoveItem = async (orderId, itemIndex, itemName) => {

        try {
            // Get the current order
            const order = orders.find(o => o.id === orderId);

            if (!order) {
                setNotification({ message: 'Order not found', type: 'error' });
                return;
            }

            // Remove the item from the items array
            const updatedItems = order.items.filter((_, index) => index !== itemIndex);
            
            // Calculate new total
            const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * (item.qty || item.quantity)), 0);

            // Update the order with the removed item
            const response = await authFetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    items: updatedItems,
                    total: newTotal
                })
            });

            if (!response.ok) {
                // Check if response is HTML (error page)
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Expected JSON but got HTML:', text.substring(0, 200));
                    throw new Error('Server error: Backend returned HTML instead of JSON');
                }
                
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to remove item');
            }

            // Update local state
            setOrders(prev => prev.map(order => 
                order.id === orderId 
                    ? { ...order, items: updatedItems, total: newTotal }
                    : order
            ));

            setNotification({ message: `${itemName} removed from order`, type: 'success' });
            setTimeout(() => setNotification(null), 3000);

        } catch (error) {
            console.error('Error removing item:', error);
            setNotification({ 
                message: `Error removing item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
            setTimeout(() => setNotification(null), 3000);
        }

    };



    const getStatusColor = (status) => {

        switch(status) {

            case 'pending': return 'bg-white border-rose-200 shadow-md';

            case 'preparing': return 'bg-white border-amber-200 shadow-md';

            case 'ready': return 'bg-white border-emerald-200 shadow-md';

            default: return 'bg-white border-gray-200 shadow-sm';

        }

    };



    const getStatusBadge = (status) => {

        switch(status) {

            case 'pending': return { icon: '⏳', label: 'PENDING', color: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white border-0 shadow-sm' };

            case 'preparing': return { icon: '🔥', label: 'PREPARING', color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm' };

            case 'ready': return { icon: '✓', label: 'READY', color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-sm' };

            default: return { icon: '', label: 'UNKNOWN', color: 'bg-gray-100 text-gray-700 border border-gray-300' };

        }

    };



    const OrderCard = ({ order, onStatusChange }) => {

        const statusBadge = getStatusBadge(order.status);

        return (

            <div className={`rounded-2xl border-2 p-5 flex flex-col justify-between h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${getStatusColor(order.status)}`}>

                <div>

                    {/* Order Header with Table and Status */}

                    <div className="flex justify-between items-start mb-4">

                        <div>

                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2a4 4 0 00-4 4v1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" />
                                    </svg>
                                </div>
                                <p className="text-xs font-bold text-orange-600">Order #{order.id}</p>
                            </div>

                            {order.parentOrderId && (

                                <p className="text-xs text-blue-500 font-medium mb-1">Additional to Order #{order.parentOrderId}</p>

                            )}

                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p className="text-lg font-bold text-gray-800">{order.table_name}</p>
                            </div>

                        </div>

                        <div className={`${statusBadge.color} px-4 py-2 rounded-xl font-bold text-center shadow-sm`}>

                            <div className="text-xs tracking-wide">{statusBadge.label}</div>

                        </div>

                    </div>



                    {/* Time Info */}

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 bg-gray-50 px-3 py-2 rounded-lg">
                        <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{new Date(order.timestamp).toLocaleTimeString()}</span>
                        <span className="text-gray-300">•</span>
                        <span>{Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000)}m ago</span>
                    </div>



                    {/* Order Items */}

                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 mb-4">

                        <h4 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Items ({order.items?.length || 0})
                        </h4>

                        <ul className="space-y-2">

                            {(order.items || []).map((item, idx) => (

                                <li key={idx} className="flex justify-between items-center text-sm bg-white rounded-lg px-3 py-2 shadow-sm">

                                    <div className="flex items-center gap-3">

                                        <button

                                            onClick={() => handleRemoveItem(order.id, idx, item.name)}

                                            className="text-red-400 hover:text-white hover:bg-red-500 transition-all duration-200 p-1.5 rounded-lg hover:shadow-md"

                                            title="Remove item (not available)"

                                        >

                                            <X size={14} />

                                        </button>

                                        <span className="text-gray-700"><span className="font-bold text-orange-600">{item.qty || item.quantity}x</span> {item.name}</span>

                                    </div>

                                    <span className="text-xs bg-gradient-to-r from-orange-100 to-orange-200 px-3 py-1.5 rounded-lg font-semibold text-orange-700">{fmt(item.price)}</span>

                                </li>

                            ))}

                        </ul>

                        <div className="border-t-2 border-orange-100 pt-3 mt-3 font-bold text-right">

                            <div className="text-xs text-gray-500 mb-1">Total Amount</div>

                            <div className="text-xl text-orange-600">{fmt(order.total)}</div>

                        </div>

                    </div>

                </div>



                {/* Action Buttons */}

                <div className="pt-4 border-t border-gray-200 space-y-3">

                    {order.status === 'pending' && (

                        <>

                            {/* Not Available button - hide for takeaway orders */}

                            {order.type !== 'TAKEAWAY' && order.table_name !== 'Takeaway' && (

                                <button

                                    onClick={() => onStatusChange(order.id, 'NOT_AVAILABLE')}

                                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"

                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Not Available

                                </button>

                            )}

                            <button

                                onClick={() => onStatusChange(order.id, 'preparing')}

                                disabled={!hasPermission('mark_order_preparing')}

                                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${

                                    hasPermission('mark_order_preparing')

                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 cursor-pointer'

                                        : 'bg-gray-300 cursor-not-allowed opacity-60'

                                }`}

                                title={!hasPermission('mark_order_preparing') ? 'No permission to mark as preparing' : ''}

                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Start Preparing

                            </button>

                        </>

                    )}

                    {order.status === 'preparing' && (

                        <button

                            onClick={() => onStatusChange(order.id, 'ready')}

                            disabled={!hasPermission('mark_order_ready')}

                            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${

                                hasPermission('mark_order_ready')

                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 cursor-pointer'

                                    : 'bg-gray-300 cursor-not-allowed opacity-60'

                            }`}

                            title={!hasPermission('mark_order_ready') ? 'No permission to mark as ready' : ''}

                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Ready

                        </button>

                    )}

                    {order.status === 'ready' && (

                        <button

                            onClick={() => onStatusChange(order.id, 'completed')}

                            disabled={!hasPermission('confirm_order_delivery')}

                            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${

                                hasPermission('confirm_order_delivery')

                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 cursor-pointer'

                                    : 'bg-gray-300 cursor-not-allowed opacity-60'

                            }`}

                            title={!hasPermission('confirm_order_delivery') ? 'No permission to confirm delivery' : ''}

                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Mark Delivered

                        </button>

                    )}

                </div>

            </div>

        );

    };



    const pendingOrders = orders.filter(o => o.status === 'pending');

    const preparingOrders = orders.filter(o => o.status === 'preparing');

    const readyOrders = orders.filter(o => o.status === 'ready');



    return (

        <div className="min-h-screen bg-[#FFF8F0] p-6">

            {/* Header Section - Orange Theme */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-8">
                <div className="px-6 py-6 text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Kitchen Display</h1>
                    <p className="text-orange-100 text-base">Manage orders in real-time • Auto-refreshing every 3 seconds</p>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className="mt-3 text-sm text-white/80 hover:text-white underline"
                    >
                        {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
                    </button>
                </div>
            </div>



            {/* 3-Column Layout */}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

                {/* NEW ORDERS - Red/Pending */}

                <div className="rounded-2xl shadow-lg overflow-hidden border-2 border-rose-200 bg-white">

                    <div className="p-5 text-center bg-gradient-to-r from-rose-500 to-rose-600 border-b-0">

                        <div className="flex items-center justify-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h2 className="text-xl font-bold text-white">New Orders</h2>
                        </div>

                        <p className="text-rose-100 text-sm font-medium">{pendingOrders.length} waiting</p>

                    </div>

                    <div className="p-4 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto bg-rose-50/30">

                        {pendingOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-rose-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>

                                <p className="text-gray-700 text-base font-semibold">All caught up!</p>

                                <p className="text-gray-500 text-sm mt-1">No pending orders</p>

                            </div>

                        ) : (

                            pendingOrders.map(order => (

                                <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />

                            ))

                        )}

                    </div>

                </div>



                {/* IN PROGRESS - Yellow/Preparing */}

                <div className="rounded-2xl shadow-lg overflow-hidden border-2 border-amber-200 bg-white">

                    <div className="p-5 text-center bg-gradient-to-r from-amber-500 to-orange-500 border-b-0">

                        <div className="flex items-center justify-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <h2 className="text-xl font-bold text-white">Preparing</h2>
                        </div>

                        <p className="text-amber-100 text-sm font-medium">{preparingOrders.length} in progress</p>

                    </div>

                    <div className="p-4 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto bg-amber-50/30">

                        {preparingOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>

                                <p className="text-gray-700 text-base font-semibold">No orders in progress</p>

                                <p className="text-gray-500 text-sm mt-1">All items are prepared</p>

                            </div>

                        ) : (

                            preparingOrders.map(order => (

                                <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />

                            ))

                        )}

                    </div>

                </div>



                {/* READY - Green/Ready */}

                <div className="rounded-2xl shadow-lg overflow-hidden border-2 border-emerald-200 bg-white">

                    <div className="p-5 text-center bg-gradient-to-r from-emerald-500 to-teal-500 border-b-0">

                        <div className="flex items-center justify-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <h2 className="text-xl font-bold text-white">Ready</h2>
                        </div>

                        <p className="text-emerald-100 text-sm font-medium">{readyOrders.length} ready</p>

                    </div>

                    <div className="p-4 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto bg-emerald-50/30">

                        {readyOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>

                                <p className="text-gray-700 text-base font-semibold">No ready orders</p>

                                <p className="text-gray-500 text-sm mt-1">Waiting for items</p>

                            </div>

                        ) : (

                            readyOrders.map(order => (

                                <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />

                            ))

                        )}

                    </div>

                </div>

            </div>



            {notification && (

                <Notification 

                    message={notification.message} 

                    type={notification.type} 

                    onClose={() => setNotification(null)} 

                />

            )}

        </div>

    );

};



export default KitchenDisplaySystem; 


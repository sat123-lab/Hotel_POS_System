import React, { useState, useEffect } from 'react';

import Notification from './Notification';

import { X } from 'lucide-react';
import { authFetch } from '../utils/api';



const KitchenDisplaySystem = () => {

    const [orders, setOrders] = useState([]);

    const [notification, setNotification] = useState(null);

    const [autoRefresh, setAutoRefresh] = useState(true);

    const [permissions, setPermissions] = useState([]);

    const [userRole, setUserRole] = useState('');



    useEffect(() => {

        fetchPermissions();

        fetchOrders();

        // Refresh orders every 2 seconds

        const orderInterval = setInterval(fetchOrders, 2000);

        // Refresh permissions every 5 seconds to catch role/permission changes

        const permissionInterval = setInterval(fetchPermissions, 5000);

        return () => {

            clearInterval(orderInterval);

            clearInterval(permissionInterval);

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

            } else {

                // For other status changes, use the regular update endpoint

                response = await authFetch(`/api/orders/${orderId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: newStatus })
                });

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

            case 'pending': return 'bg-rose-950/40 border-rose-900/40';

            case 'preparing': return 'bg-amber-950/30 border-amber-900/40';

            case 'ready': return 'bg-emerald-950/30 border-emerald-900/40';

            default: return 'bg-gray-100 border-gray-300';

        }

    };



    const getStatusBadge = (status) => {

        switch(status) {

            case 'pending': return { icon: '', label: 'PENDING', color: 'bg-rose-600/20 text-rose-200 border border-rose-900/40' };

            case 'preparing': return { icon: '', label: 'PREPARING', color: 'bg-amber-600/20 text-amber-200 border border-amber-900/40' };

            case 'ready': return { icon: '', label: 'READY', color: 'bg-emerald-600/20 text-emerald-200 border border-emerald-900/40' };

            default: return { icon: '', label: 'UNKNOWN', color: 'bg-slate-600/20 text-slate-200 border border-slate-700/40' };

        }

    };



    const OrderCard = ({ order, onStatusChange }) => {

        const statusBadge = getStatusBadge(order.status);

        return (

            <div className={`rounded-xl border p-5 flex flex-col justify-between h-full transition-colors duration-200 ${getStatusColor(order.status)}`}>

                <div>

                    {/* Order Header with Table and Status */}

                    <div className="flex justify-between items-start mb-3">

                        <div>

                            <p className="text-xs font-semibold text-slate-300">Order #{order.id}</p>

                            {order.parentOrderId && (

                                <p className="text-xs text-sky-300 font-medium">Additional to Order #{order.parentOrderId}</p>

                            )}

                            <p className="text-lg font-semibold text-white">Table <span className="text-xl text-white">{order.table_name}</span></p>

                        </div>

                        <div className={`${statusBadge.color} px-3 py-2 rounded-lg font-semibold text-center`}>

                            <div className="text-xs tracking-wide">{statusBadge.label}</div>

                        </div>

                    </div>



                    {/* Time Info */}

                    <p className="text-xs text-slate-400 mb-4">

                        {new Date(order.timestamp).toLocaleTimeString()} 

                        {' '} • {Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000)}m ago

                    </p>



                    {/* Order Items */}

                    <div className="bg-slate-900/30 border border-slate-700/40 rounded-lg p-3 mb-3">

                        <h4 className="font-semibold text-slate-200 mb-2 text-sm">Items</h4>

                        <ul className="space-y-1">

                            {(order.items || []).map((item, idx) => (

                                <li key={idx} className="text-slate-100 flex justify-between items-center text-sm">

                                    <div className="flex items-center gap-2">

                                        <button

                                            onClick={() => handleRemoveItem(order.id, idx, item.name)}

                                            className="text-red-400 hover:text-red-300 transition-colors duration-200 p-1 rounded hover:bg-red-900/20"

                                            title="Remove item (not available)"

                                        >

                                            <X size={14} />

                                        </button>

                                        <span><strong>{item.qty || item.quantity}x</strong> {item.name}</span>

                                    </div>

                                    <span className="text-xs bg-slate-800 px-2 py-1 rounded border border-slate-700/50 text-slate-200">₹{item.price}</span>

                                </li>

                            ))}

                        </ul>

                        <div className="border-t border-slate-700/40 pt-2 mt-2 font-semibold text-right text-white">

                            <div className="text-xs text-slate-400">Amount</div>

                            <div className="text-base">₹{order.total}</div>

                        </div>

                    </div>

                </div>



                {/* Action Buttons */}

                <div className="pt-3 border-t border-slate-700/40 space-y-2">

                    {order.status === 'pending' && (

                        <>

                            <button

                                onClick={() => onStatusChange(order.id, 'NOT_AVAILABLE')}

                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg shadow-sm transition-colors duration-200 cursor-pointer mb-2 focus:outline-none focus:ring-2 focus:ring-rose-600/20"

                            >

                                Not available

                            </button>

                            <button

                                onClick={() => onStatusChange(order.id, 'preparing')}

                                disabled={!hasPermission('mark_order_preparing')}

                                className={`w-full text-white font-semibold py-3 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${

                                    hasPermission('mark_order_preparing')

                                        ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer'

                                        : 'bg-gray-400 cursor-not-allowed opacity-60'

                                }`}

                                title={!hasPermission('mark_order_preparing') ? 'No permission to mark as preparing' : ''}

                            >

                                Mark preparing

                            </button>

                        </>

                    )}

                    {order.status === 'preparing' && (

                        <button

                            onClick={() => onStatusChange(order.id, 'ready')}

                            disabled={!hasPermission('mark_order_ready')}

                            className={`w-full text-white font-semibold py-3 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${

                                hasPermission('mark_order_ready')

                                    ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'

                                    : 'bg-gray-400 cursor-not-allowed opacity-60'

                            }`}

                            title={!hasPermission('mark_order_ready') ? 'No permission to mark as ready' : ''}

                        >

                            Mark ready

                        </button>

                    )}

                    {order.status === 'ready' && (

                        <button

                            onClick={() => onStatusChange(order.id, 'completed')}

                            disabled={!hasPermission('confirm_order_delivery')}

                            className={`w-full text-white font-semibold py-3 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${

                                hasPermission('confirm_order_delivery')

                                    ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'

                                    : 'bg-gray-400 cursor-not-allowed opacity-60'

                            }`}

                            title={!hasPermission('confirm_order_delivery') ? 'No permission to confirm delivery' : ''}

                        >

                            Mark delivered

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

        <div className="min-h-screen bg-slate-900 p-6">

            {/* Header */}

            <div className="mb-8 text-center">

                <h1 className="text-3xl font-semibold text-white mb-2">Kitchen Display</h1>

                <p className="text-gray-300">Manage orders in real-time • Auto-refreshing every 3 seconds</p>

                <button

                    onClick={() => setAutoRefresh(!autoRefresh)}

                    className="mt-2 text-xs text-slate-300 hover:text-white underline"

                >

                    {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}

                </button>

            </div>



            {/* 3-Column Layout */}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

                {/* NEW ORDERS - Red/Pending */}

                <div className="rounded-xl shadow-sm overflow-hidden border border-slate-700 bg-slate-800">

                    <div className="p-4 text-center border-b border-slate-700">

                        <h2 className="text-lg font-semibold text-white">New orders</h2>

                        <p className="text-slate-300 text-sm mt-1">{pendingOrders.length} waiting</p>

                    </div>

                    <div className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">

                        {pendingOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <p className="text-slate-200 text-base font-medium">All caught up</p>

                                <p className="text-slate-400 text-sm mt-2">No pending orders</p>

                            </div>

                        ) : (

                            pendingOrders.map(order => (

                                <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />

                            ))

                        )}

                    </div>

                </div>



                {/* IN PROGRESS - Yellow/Preparing */}

                <div className="rounded-xl shadow-sm overflow-hidden border border-slate-700 bg-slate-800">

                    <div className="p-4 text-center border-b border-slate-700">

                        <h2 className="text-lg font-semibold text-white">Preparing</h2>

                        <p className="text-slate-300 text-sm mt-1">{preparingOrders.length} in progress</p>

                    </div>

                    <div className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">

                        {preparingOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <p className="text-slate-200 text-base font-medium">No orders in progress</p>

                                <p className="text-slate-400 text-sm mt-2">All items are prepared</p>

                            </div>

                        ) : (

                            preparingOrders.map(order => (

                                <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />

                            ))

                        )}

                    </div>

                </div>



                {/* READY - Green/Ready */}

                <div className="rounded-xl shadow-sm overflow-hidden border border-slate-700 bg-slate-800">

                    <div className="p-4 text-center border-b border-slate-700">

                        <h2 className="text-lg font-semibold text-white">Ready</h2>

                        <p className="text-slate-300 text-sm mt-1">{readyOrders.length} ready</p>

                    </div>

                    <div className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">

                        {readyOrders.length === 0 ? (

                            <div className="text-center py-12">

                                <p className="text-slate-200 text-base font-medium">No ready orders</p>

                                <p className="text-slate-400 text-sm mt-2">Waiting for items</p>

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


import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { authFetch, getAPI_URL } from '../utils/api';
import { enrichOrderWithTotals, fetchAndCacheGlobalSettings } from '../utils/orderTotals';
import Notification from './Notification';
import useCurrency from '../hooks/useCurrency';
import { getUPIConfig } from '../config/upiConfig';
import {
  loadRestaurantInfo,
  buildKitchenSlipHtml,
  buildCustomerReceiptHtml,
  calculateTotals as calcReceiptTotals,
  loadTaxDiscountSettings,
  openReceiptForPrint,
} from '../utils/receiptPrint';
import { getOrderDisplayNumber, formatOrderLabel } from '../utils/orderDisplay';
import { appendBranchToOrderPayload } from '../utils/branchScope';
import {
  Search,
  X,
  UtensilsCrossed,
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  Check,
} from 'lucide-react';

const OrderEntryModal = ({ table, onClose, onOrderPlaced, locationSettings, nextOrderId, setNextOrderId, orderType, initialOrder }) => {
    const { format: fmt } = useCurrency(locationSettings);
    const [menu, setMenu] = useState([]);
    const [cart, setCart] = useState({});
    const [notification, setNotification] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [categories, setCategories] = useState(['All']);
    const [showReceipt, setShowReceipt] = useState(false);
    const [confirmedOrder, setConfirmedOrder] = useState(null);
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Payment modal states for takeaway orders
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [upiQrUrl, setUpiQrUrl] = useState('');

    useEffect(() => {
        console.log('OrderEntryModal: Fetching menu items...');
        fetch(`${getAPI_URL()}/api/menu`)
            .then(res => {
                console.log('OrderEntryModal: API response status:', res.status);
                return res.json();
            })
            .then(data => {
                console.log('OrderEntryModal: Raw menu data from API:', data);
                console.log('OrderEntryModal: Number of items received:', data.length);
                
                // Show all items first, then filter available ones
                const allItems = data;
                const availableMenu = data.filter(item => item.isAvailable === true);
                
                console.log('OrderEntryModal: All menu items:', allItems);
                console.log('OrderEntryModal: Available menu items after filtering:', availableMenu);
                console.log('OrderEntryModal: Available items count:', availableMenu.length);
                
                // Extract categories from menu items with smart categorization
                const uniqueCategories = ['All', ...new Set(availableMenu.map(item => {
                    // Check if item name contains 'veg' (case insensitive)
                    if (item.name && item.name.toLowerCase().includes('veg')) {
                        return 'Veg';  // Always return 'Veg' with capital V
                    }
                    // Check if description contains 'veg'
                    if (item.description && item.description.toLowerCase().includes('veg')) {
                        return 'Veg';  // Always return 'Veg' with capital V
                    }
                    // Normalize other categories to consistent casing
                    const category = item.category || 'Other';
                    if (category.toLowerCase() === 'veg') {
                        return 'Veg';  // Convert 'veg' to 'Veg'
                    }
                    return category;
                }).filter(Boolean))];
                setCategories(uniqueCategories);
                
                // Set the menu to available items
                setMenu(availableMenu);
                
                // If no available items, show a notification
                if (availableMenu.length === 0 && allItems.length > 0) {
                    setNotification({ message: 'No menu items are currently available', type: 'warning' });
                } else if (availableMenu.length > 0) {
                    setNotification({ message: `Loaded ${availableMenu.length} menu items`, type: 'success' });
                }
            })
            .catch(err => {
                console.error('OrderEntryModal: Error fetching menu:', err);
                setNotification({ message: 'Error loading menu items', type: 'error' });
            });
    }, []);

    // For "Add More Items", handle differently for Takeaway vs Dine-in
    useEffect(() => {
        if (initialOrder && initialOrder.items) {
            if (initialOrder.table_name === 'Takeaway') {
                // For Takeaway, pre-fill cart with existing items (same order)
                const prefill = {};
                initialOrder.items.forEach(item => {
                    const itemId = item.productId || item.menuItemId || item.id;
                    prefill[itemId] = {
                        ...item,
                        id: itemId,
                        productId: itemId,
                        qty: item.quantity || item.qty || 1
                    };
                });
                setCart(prefill);
                setNotification({ message: 'Takeaway order loaded - Add more items to same order', type: 'info' });
                setTimeout(() => setNotification(null), 2000);
            } else {
                // For Dine-in, start with empty cart (separate orders)
                setCart({});
                setNotification({ message: 'Cart cleared - Add only new items', type: 'info' });
                setTimeout(() => setNotification(null), 2000);
            }
        }
    }, [initialOrder]);

    const addToCart = (item) => {
        const itemId = item.id || item.productId;
        setCart(prevCart => ({
            ...prevCart,
            [itemId]: {
                ...item,
                id: itemId,
                productId: itemId,
                qty: (prevCart[itemId]?.qty || 0) + 1
            }
        }));
        setNotification({ message: `${item.name} added to cart!`, type: 'success' });
        setTimeout(() => setNotification(null), 3000);
    };

    const updateCartQty = (itemId, change) => {
        setCart(prevCart => {
            const item = prevCart[itemId];
            if (!item) return prevCart;
            
            const newQty = item.qty + change;
            if (newQty <= 0) {
                const { [itemId]: _, ...rest } = prevCart;
                return rest;
            }
            
            return {
                ...prevCart,
                [itemId]: { ...item, qty: newQty }
            };
        });
    };

    const clearCart = () => {
        setCart({});
        setNotification({ message: "Cart cleared!", type: "success" });
        setTimeout(() => setNotification(null), 3000);
    };

    // Generate the UPI QR whenever the user selects UPI as the
    // payment method on a pending takeaway order. The QR encodes the
    // exact bill total so any UPI app (PhonePe, GPay, Paytm, BHIM)
    // pre-fills the amount on scan.
    useEffect(() => {
        let cancelled = false;
        if (showPaymentModal && paymentMethod === 'upi' && pendingOrder) {
            const totals = enrichOrderWithTotals(pendingOrder);
            const cfg = getUPIConfig();
            // Only skip if the UPI ID has been wiped out completely.
            if (!cfg.upiId) {
                setUpiQrUrl('');
                return undefined;
            }
            const params = new URLSearchParams({
                pa: cfg.upiId,
                pn: cfg.payeeName,
                am: Number(totals.total || 0).toFixed(2),
                cu: cfg.currency || 'INR',
                tn: cfg.transactionNoteTemplate.replace(
                    '{orderId}',
                    pendingOrder.id || ''
                ),
                tr: `ORD${pendingOrder.id || ''}${Date.now()}`,
            });
            const upiUrl = `upi://pay?${params.toString()}`;
            QRCode.toDataURL(upiUrl, { width: 240, margin: 1 })
                .then((url) => {
                    if (!cancelled) setUpiQrUrl(url);
                })
                .catch(() => {
                    if (!cancelled) setUpiQrUrl('');
                });
        } else {
            setUpiQrUrl('');
        }
        return () => {
            cancelled = true;
        };
    }, [showPaymentModal, paymentMethod, pendingOrder]);

    // Print kitchen token + customer bill (thermal 80mm) for the
    // just-paid takeaway order. Called automatically after the
    // payment is marked complete.
    const printTakeawayBill = async (order, methodLabel) => {
        try {
            const info = loadRestaurantInfo();
            const taxDiscount = loadTaxDiscountSettings();
            const totals = calcReceiptTotals(order, taxDiscount);
            const kitchenHtml = buildKitchenSlipHtml(order, info);
            const paymentLabel = String(methodLabel || 'Cash').toUpperCase();
            // For paid takeaway bills there's no need for a UPI QR
            // on the printed slip — the customer has already paid.
            const customerHtml = buildCustomerReceiptHtml(order, totals, info, {
                qrCodeDataUrl: '',
                paymentLabel,
            });
            openReceiptForPrint(
                `${kitchenHtml}${customerHtml}`,
                `Takeaway Bill #${getOrderDisplayNumber(order)}`
            );
        } catch (e) {
            console.error('Print failed:', e);
        }
    };

    // Handle payment completion for takeaway orders
    const handlePaymentComplete = async () => {
        if (!pendingOrder) return;

        try {
            // Update order status to completed/delivered
            const response = await authFetch(`/api/orders/${pendingOrder.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'completed',
                    paymentMethod: paymentMethod,
                    paymentStatus: 'paid'
                })
            });

            if (!response.ok) {
                // If status update fails, still proceed with receipt
                console.warn('Status update failed, proceeding with receipt');
            }

            const updatedOrder = await response.json().catch(() => pendingOrder);
            const finalOrder = { ...pendingOrder, ...updatedOrder, paymentMethod };

            // Close payment modal
            setShowPaymentModal(false);
            setUpiQrUrl('');

            // Show token receipt
            setConfirmedOrder(finalOrder);
            setShowReceipt(true);

            // Call onOrderPlaced to add to active orders
            onOrderPlaced(finalOrder);

            // Auto-open the printable bill (kitchen token + customer
            // receipt). User can hit Cancel in the print dialog if
            // they don't want a paper copy.
            printTakeawayBill(finalOrder, paymentMethod);

            // Close main order modal
            onClose();

        } catch (error) {
            console.error('Payment error:', error);
            // Even if error, show receipt
            setShowPaymentModal(false);
            setUpiQrUrl('');
            setConfirmedOrder(pendingOrder);
            setShowReceipt(true);
            onOrderPlaced(pendingOrder);
            printTakeawayBill(pendingOrder, paymentMethod);
            onClose();
        }
    };

    const placeOrder = async () => {
        console.log('Current cart:', cart);
        console.log('Current menu:', menu);
        
        const orderItems = Object.values(cart).map(item => ({
            productId: item.productId || item.id,
            name: item.name,
            quantity: item.qty,
            price: item.price
        }));
        
        console.log('Order items:', orderItems);
        if (orderItems.length === 0) {
            setNotification({ message: "Cart is empty. Please add items.", type: "error" });
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        
        // Validate table information
        if (!table || !table.id) {
            setNotification({ message: "Table information is missing. Please try again.", type: "error" });
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        
        // Get global tax and discount settings
        const globalSettings = JSON.parse(localStorage.getItem('globalTaxDiscount') || '{"taxPercent": 5, "discountPercent": 0}');
        const taxPercent = globalSettings.taxPercent || 5;
        const discountPercent = globalSettings.discountPercent || 0;
        
        // Calculate subtotal, discount, tax, and total
        const subtotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
        const discountAmount = subtotal * (discountPercent / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (taxPercent / 100);
        const finalTotal = afterDiscount + taxAmount;
        
        // For existing orders, identify new items vs existing items
        let newOrder = appendBranchToOrderPayload(
          {
            table_name: table && table.id ? table.id : (orderType === 'TAKEAWAY' ? 'Takeaway' : 'Unknown'),
            items: orderItems,
            subtotal: subtotal,
            discount: discountPercent,
            discountAmount: discountAmount,
            taxPercent: taxPercent,
            taxAmount: taxAmount,
            total: finalTotal,
            type: orderType,
            timestamp: new Date().toISOString(),
          },
          (() => {
            try {
              return JSON.parse(localStorage.getItem('user') || 'null');
            } catch {
              return null;
            }
          })()
        );

        // If editing existing order, handle differently for Takeaway vs Dine-in
        if (initialOrder && initialOrder.id) {
            if (initialOrder.table_name === 'Takeaway') {
                // For Takeaway, update the existing order with all items (existing + new)
                try {
                    // Combine all items (existing + new)
                    const allItems = Object.values(cart);
                    // Calculate totals with global tax and discount for takeaway updates
                    const globalSettings = JSON.parse(localStorage.getItem('globalTaxDiscount') || '{"taxPercent": 5, "discountPercent": 0}');
                    const taxPercent = globalSettings.taxPercent || 5;
                    const discountPercent = globalSettings.discountPercent || 0;
                    
                    const newSubtotal = allItems.reduce((sum, item) => sum + (item.price * (item.quantity || item.qty || 1)), 0);
                    const newDiscountAmount = newSubtotal * (discountPercent / 100);
                    const newAfterDiscount = newSubtotal - newDiscountAmount;
                    const newTaxAmount = newAfterDiscount * (taxPercent / 100);
                    const newFinalTotal = newAfterDiscount + newTaxAmount;

                    const updateResponse = await authFetch(`/api/orders/${initialOrder.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            items: allItems,
                            subtotal: newSubtotal,
                            discount: discountPercent,
                            discountAmount: newDiscountAmount,
                            taxPercent: taxPercent,
                            taxAmount: newTaxAmount,
                            total: newFinalTotal,
                            status: 'pending'
                        })
                    });

                    if (!updateResponse.ok) {
                        throw new Error('Failed to update takeaway order');
                    }
                    
                    const updatedOrder = await updateResponse.json();
                    setCart({});
                    onOrderPlaced(updatedOrder);
                    setNotification({ message: `${formatOrderLabel(updatedOrder)} updated successfully!`, type: 'success' });
                    setTimeout(() => {
                        setNotification(null);
                        onClose();
                    }, 1500);
                    return;
                } catch (error) {
                    console.error('Error updating takeaway order:', error);
                    setNotification({ message: `Error updating takeaway order: ${error.message}`, type: 'error' });
                    setTimeout(() => setNotification(null), 3000);
                    return;
                }
            } else {
                // For Dine-in, create a new separate order instead of updating existing
                newOrder.parentOrderId = initialOrder.id;
                newOrder.status = 'pending';
            }
        } else {
            // For completely new orders
            newOrder.status = 'pending';
        }
        
        // For new orders (not additional items), proceed with normal flow
        console.log('Sending order data:', newOrder);
        try {
            const url = '/api/orders';
            const method = 'POST';

            console.log('Request URL:', url);
            console.log('Request method:', method);
            console.log('Request body:', newOrder);

            const res = await authFetch(url, {
                method,
                body: JSON.stringify(newOrder)
            });

            console.log('Response status:', res.status);
            console.log('Response ok:', res.ok);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to save order');
            }
            const placedOrder = await res.json();
            setCart({});
            
            // For takeaway orders, show payment modal first, then receipt
            if (orderType === 'TAKEAWAY') {
                await fetchAndCacheGlobalSettings();
                const enriched = enrichOrderWithTotals(placedOrder);
                setPendingOrder(enriched);
                setPaymentAmount(enriched.total || 0);
                setShowPaymentModal(true);
                // Don't call onOrderPlaced yet - wait for payment
            } else {
                // For dine-in, use original flow
                onOrderPlaced(placedOrder);
                setNotification({ message: 'Order placed successfully!', type: 'success' });
                setTimeout(() => {
                    setNotification(null);
                    onClose();
                }, 1500);
            }
        } catch (error) {
            console.error('Order placement error:', error);
            setNotification({ message: `Error placing order: ${error.message}`, type: 'error' });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const handlePlaceOrder = async () => {
        setIsSubmitting(true);
        await placeOrder();
        setIsSubmitting(false);
    };

    // Filter menu items based on category and search
    const filteredMenu = menu.filter(item => {
        // Smart categorization for filtering
        let itemCategory = item.category || 'Other';
        
        // Check if item name contains 'veg' (case insensitive)
        if (item.name && item.name.toLowerCase().includes('veg')) {
            itemCategory = 'Veg';  // Always use 'Veg' with capital V
        }
        // Check if description contains 'veg'
        else if (item.description && item.description.toLowerCase().includes('veg')) {
            itemCategory = 'Veg';  // Always use 'Veg' with capital V
        }
        // Normalize existing veg categories
        else if (itemCategory && itemCategory.toLowerCase() === 'veg') {
            itemCategory = 'Veg';  // Convert 'veg' to 'Veg'
        }
        
        const matchesCategory = selectedCategory === 'All' || itemCategory === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Category label helper
    const getDisplayCategory = (item) => {
        let displayCategory = item.category || 'Other';
        if (item.name && item.name.toLowerCase().includes('veg')) {
            displayCategory = 'Veg';
        } else if (item.description && item.description.toLowerCase().includes('veg')) {
            displayCategory = 'Veg';
        } else if (displayCategory && displayCategory.toLowerCase() === 'veg') {
            displayCategory = 'Veg';
        }
        return displayCategory;
    };

    const cartCount = Object.keys(cart).length;
    const cartItemQty = (itemId) => cart[itemId]?.qty || 0;

    // Highlight search term in text
    const highlightText = (text, searchTerm) => {
        if (!searchTerm) return text;
        
        const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
            <span>
                {parts.map((part, index) => 
                    part.toLowerCase() === searchTerm.toLowerCase() ? 
                        <span key={index} className="bg-yellow-200 font-bold text-orange-800 px-0.5 rounded">{part}</span> : 
                        part
                )}
            </span>
        );
    };

    const totalAmount = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2);

    return (
        <>
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-100">
                {/* Header */}
                <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-orange-100 bg-gradient-to-r from-orange-500 to-orange-600 flex-shrink-0">
                    <div>
                        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-orange-100">
                            {orderType === 'TAKEAWAY' ? 'Takeaway Order' : 'Dine-In Order'}
                        </p>
                        <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                            {table && table.id === 'Takeaway'
                                ? 'New Takeaway Order'
                                : table?.id
                                  ? `Table ${table.id}`
                                  : 'New Order'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-xl p-2 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
                <div className="p-4 sm:p-5 flex-grow overflow-hidden flex flex-col bg-[#F7F7F8]">
                    <div className="flex flex-col lg:flex-row gap-4 flex-grow min-h-0">
                        {/* Menu panel */}
                        <div className="flex-1 lg:flex-[3] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[calc(100vh-140px)] lg:max-h-none">
                            <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex-shrink-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                            <UtensilsCrossed className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-base sm:text-lg font-bold text-gray-900">Menu</h4>
                                            <p className="text-xs text-gray-500">{filteredMenu.length} items available</p>
                                        </div>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search dishes..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 text-sm transition-all"
                                        />
                                        {searchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-4">
                                    {categories.map((category) => {
                                        const active = selectedCategory === category;
                                        return (
                                            <button
                                                key={category}
                                                type="button"
                                                onClick={() => setSelectedCategory(category)}
                                                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                                    active
                                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/50'
                                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600'
                                                }`}
                                            >
                                                {category}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex-grow overflow-hidden min-h-0 px-4 sm:px-5 py-4">
                                {filteredMenu.length === 0 ? (
                                    <div className="h-full flex items-center justify-center py-10">
                                        <div className="text-center max-w-xs">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                                <Search className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="text-gray-700 font-semibold">
                                                {searchTerm ? `No results for "${searchTerm}"` : 'No menu items'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {searchTerm ? 'Try another search or category' : 'Check back later or pick another category'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full overflow-y-auto pr-1 -mr-1 scrollbar-thin">
                                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4">
                                            {filteredMenu.map((item) => {
                                                const displayCategory = getDisplayCategory(item);
                                                const itemId = item.id || item.productId;
                                                const inCart = cartItemQty(itemId);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`group relative flex flex-col rounded-2xl border bg-white overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                                                            inCart
                                                                ? 'border-orange-300 ring-2 ring-orange-100'
                                                                : 'border-gray-100 hover:border-orange-200'
                                                        }`}
                                                    >
                                                        <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                                                            {item.image ? (
                                                                <img
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                    <UtensilsCrossed className="w-10 h-10" />
                                                                </div>
                                                            )}
                                                            {inCart > 0 && (
                                                                <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                                                                    {inCart}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="p-3 flex flex-col flex-1">
                                                            <h5 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                                                                {highlightText(item.name, searchTerm)}
                                                            </h5>
                                                            <p className="text-[11px] text-gray-500 mt-1 mb-3">{displayCategory}</p>
                                                            <div className="mt-auto flex items-center justify-between gap-2">
                                                                <p className="text-base font-extrabold text-gray-900">
                                                                    {fmt(item.price)}
                                                                </p>
                                                                {inCart > 0 ? (
                                                                    <div className="flex items-center gap-1 bg-orange-50 rounded-xl p-0.5 border border-orange-100">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateCartQty(itemId, -1)}
                                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-orange-600 hover:bg-orange-100 transition-colors"
                                                                        >
                                                                            <Minus className="w-4 h-4" />
                                                                        </button>
                                                                        <span className="w-6 text-center text-sm font-bold text-gray-900">{inCart}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateCartQty(itemId, 1)}
                                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-orange-600 hover:bg-orange-100 transition-colors"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addToCart(item)}
                                                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-semibold shadow-sm shadow-orange-200/60 transition-all"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                        Add
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cart sidebar — desktop */}
                        <div className="hidden lg:flex w-full lg:w-[300px] flex-shrink-0 bg-white flex-col rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-orange-500" />
                                    Current Order
                                </h4>
                                {cartCount > 0 && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                                        {cartCount} {cartCount === 1 ? 'item' : 'items'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-grow overflow-hidden flex flex-col min-h-0 p-4">
                                {cartCount === 0 ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                                <ShoppingCart className="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-700">Cart is empty</p>
                                            <p className="text-xs text-gray-500 mt-1">Select items from the menu</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 flex-1 overflow-y-auto pr-1 -mr-1">
                                            {Object.values(cart).map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <h6 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h6>
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {fmt(item.price)} each
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-bold text-orange-600 shrink-0">
                                                            {fmt(item.price * item.qty)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item.id, -1)}
                                                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                                            >
                                                                <Minus className="w-3.5 h-3.5" />
                                                            </button>
                                                            <span className="w-7 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item.id, 1)}
                                                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-600">Subtotal</span>
                                                <span className="text-lg font-extrabold text-gray-900">{fmt(totalAmount)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Footer */}
                <div className="hidden md:flex px-5 py-4 border-t border-gray-100 bg-white flex-col sm:flex-row justify-between items-center flex-shrink-0 gap-3">
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Order total</p>
                        <p className="text-xl font-extrabold text-gray-900 mt-0.5">
                            {fmt(totalAmount)}{' '}
                            <span className="text-sm font-medium text-gray-500">· {cartCount} items</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={clearCart}
                            disabled={cartCount === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                cartCount === 0
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={placeOrder}
                            disabled={cartCount === 0}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                cartCount === 0
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-200/50'
                            }`}
                        >
                            <Check className="w-4 h-4" />
                            Confirm Order
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Takeaway Order Receipt Modal - Orange Theme */}
        {showReceipt && confirmedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-orange-100">
                    {/* Header - Orange */}
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white">Order Confirmed!</h2>
                        <p className="text-orange-100 text-sm mt-1">Your takeaway order has been placed</p>
                    </div>

                    {/* Receipt Content */}
                    <div className="p-6">
                        {/* Order Token - Main highlight */}
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6 text-center">
                            <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Your Order Token</p>
                            <p className="text-4xl font-bold text-amber-800 tracking-wider">{confirmedOrder.token}</p>
                            <p className="text-amber-600 text-xs mt-2">Show this token when collecting your order</p>
                        </div>

                        {/* Order Details */}
                        <div className="space-y-3 mb-6">
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
                        <div className="border-t border-gray-200 pt-4 mb-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h3>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {(confirmedOrder.items || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-700">{item.qty || item.quantity}x {item.name}</span>
                                        <span className="font-medium text-gray-900">{fmt(item.price * (item.qty || item.quantity || 1))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="border-t-2 border-gray-200 pt-4 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900">Total Amount</span>
                                <span className="text-2xl font-bold text-blue-600">{fmt(confirmedOrder.total)}</span>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-800 text-center">
                                <strong>Important:</strong> Please show your token <strong>{confirmedOrder.token}</strong> at the counter to collect your order.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    window.print();
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
                                    onClose();
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
        {/* Floating Cart Button for Mobile */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
            <button
                onClick={() => setShowMobileCart(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full p-4 shadow-xl transition-all transform hover:scale-110 relative"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {Object.keys(cart).length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {Object.keys(cart).length}
                    </span>
                )}
            </button>
        </div>

        {/* Mobile Cart Panel */}
        {showMobileCart && (
            <div className="md:hidden fixed inset-0 z-50 flex items-end">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileCart(false)} />
                <div className="relative bg-white w-full rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
                    <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Your Cart ({Object.keys(cart).length} items)
                                </h3>
                                <div className="flex items-center gap-2">
                                    {Object.keys(cart).length > 0 && (
                                        <button
                                            onClick={() => { clearCart(); setShowMobileCart(false); }}
                                            className="p-2 hover:bg-red-100 text-red-500 rounded-full transition-colors"
                                            title="Clear Cart"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowMobileCart(false)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {Object.keys(cart).length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="text-gray-600 text-lg font-medium">Your cart is empty</p>
                                    <p className="text-gray-400 text-sm mt-2">Add items to get started!</p>
                                </div>
                            ) : (
                                <>
                                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                                    {Object.values(cart).map(item => (
                                        <div key={item.id} className="flex items-center justify-between bg-orange-50 p-3 rounded-xl">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800">{item.name}</p>
                                                <p className="text-sm text-orange-600 font-medium">{fmt(item.price)} each</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateCartQty(item.id, -1)}
                                                    className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center font-bold transition-colors"
                                                >
                                                    −
                                                </button>
                                                <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                                                <button
                                                    onClick={() => updateCartQty(item.id, 1)}
                                                    className="w-8 h-8 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg flex items-center justify-center font-bold transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t-2 border-orange-100 pt-4 mt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-lg font-semibold text-gray-700">Order Summary</span>
                                    <span className="text-2xl font-bold text-orange-600">
                                        {fmt(Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0))}
                                    </span>
                                </div>

                                {/* Payment Method Selection */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {['cash', 'upi', 'card'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`p-3 rounded-xl font-bold text-sm transition-all ${
                                                paymentMethod === method
                                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {method === 'cash' ? '💵 Cash' : method === 'upi' ? '📱 UPI' : '💳 Card'}
                                        </button>
                                    ))}
                                </div>

                                {/* Place Order Button */}
                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Placing Order...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Place Order • {fmt(Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0))}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal for Takeaway Orders */}
        {showPaymentModal && pendingOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-center">
                        <h2 className="text-xl font-bold text-white">Payment</h2>
                        <p className="text-green-100 text-sm">Complete your takeaway order payment</p>
                    </div>

                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {/* Order Summary */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-800 mb-2">Order Summary</h3>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Order ID</span>
                                <span className="font-medium">#{pendingOrder.id}</span>
                            </div>
                            
                            {/* Item Details */}
                            <div className="my-3 space-y-2 border-t border-b border-gray-200 py-3">
                                {pendingOrder.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-700">{item.qty || item.quantity}x {item.name}</span>
                                        <span className="font-medium text-gray-800">{fmt((item.price || 0) * (item.qty || item.quantity || 1))}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Subtotal, Tax, Discount */}
                            {(() => {
                                const t = enrichOrderWithTotals(pendingOrder);
                                return (
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Subtotal</span>
                                            <span className="font-medium">{fmt(t.subtotal)}</span>
                                        </div>
                                        {t.discountPercent > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Discount ({t.discountPercent}%)</span>
                                                <span className="font-medium text-green-600">-{fmt(t.discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Tax ({t.taxPercent}%)</span>
                                            <span className="font-medium text-gray-800">+{fmt(t.taxAmount)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                            
                            <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-3">
                                <span className="text-lg font-bold text-gray-800">Total</span>
                                <span className="text-2xl font-bold text-green-600">{fmt(enrichOrderWithTotals(pendingOrder).total)}</span>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                        paymentMethod === 'cash' 
                                            ? 'border-green-500 bg-green-50 text-green-700' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Cash
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                        paymentMethod === 'card' 
                                            ? 'border-green-500 bg-green-50 text-green-700' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    Card
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('upi')}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                        paymentMethod === 'upi' 
                                            ? 'border-green-500 bg-green-50 text-green-700' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    UPI
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('wallet')}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                        paymentMethod === 'wallet' 
                                            ? 'border-green-500 bg-green-50 text-green-700' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Wallet
                                </button>
                            </div>
                        </div>

                        {/* UPI QR — appears the moment UPI is picked. The
                            customer scans it and the bill amount is
                            pre-filled in any UPI app. */}
                        {paymentMethod === 'upi' && (
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-2 border-emerald-200 rounded-2xl p-4 flex flex-col items-center text-center">
                                {upiQrUrl ? (
                                    <>
                                        <p className="text-sm font-bold text-emerald-700">
                                            Scan to pay {fmt(enrichOrderWithTotals(pendingOrder).total)}
                                        </p>
                                        <p className="text-[11px] text-emerald-600/80 mt-0.5">
                                            Works with PhonePe · Google Pay · Paytm · BHIM
                                        </p>
                                        <div className="my-3 bg-white border border-emerald-200 rounded-2xl p-2 shadow-sm">
                                            <img
                                                src={upiQrUrl}
                                                alt="UPI QR"
                                                className="w-[200px] h-[200px]"
                                            />
                                        </div>
                                        <p className="text-[11px] text-gray-500 break-all px-3">
                                            {getUPIConfig().upiId} · {getUPIConfig().payeeName}
                                        </p>
                                        <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                                            After the customer pays, click "Complete Payment" below.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-amber-700">
                                            UPI ID not configured
                                        </p>
                                        <p className="text-[11px] text-amber-700/80 mt-0.5 px-3">
                                            Open <span className="font-semibold">Settings → Payment Gateways</span> and
                                            enter your UPI ID (e.g. <code>name@ptsbi</code>, <code>name@okicici</code>).
                                            The QR will then appear here automatically.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setPendingOrder(null);
                                }}
                                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePaymentComplete}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
                            >
                                Complete Payment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default OrderEntryModal;

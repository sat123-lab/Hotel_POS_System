import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import API_URL from '../utils/api';
import Notification from './Notification';
import QRCode from 'qrcode';
import { getUPIConfig } from '../config/upiConfig';
import { CheckCircle, Printer, Tag, CreditCard, DollarSign, Smartphone, Globe, Utensils } from 'lucide-react';



const BillingPage = ({ locationSettings }) => {

    const [orders, setOrders] = useState([]);

    const [selectedOrder, setSelectedOrder] = useState(null);

    const [selectedBill, setSelectedBill] = useState(null);

    const [paymentMethod, setPaymentMethod] = useState('cash');

    const [notification, setNotification] = useState(null);

    const [discountPercent, setDiscountPercent] = useState(0);

    const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'fixed'

    const [manualTaxRate, setManualTaxRate] = useState(5); // Manual tax rate in percent

    const [isLoaded, setIsLoaded] = useState(false);

    const billRef = useRef(null);

    const defaultTaxRate = locationSettings.taxRate || 0.05;

    const taxRate = manualTaxRate / 100; // Convert percentage to decimal



    useEffect(() => {

        fetchDeliveredOrders();

        const interval = setInterval(fetchDeliveredOrders, 3000);

        return () => clearInterval(interval);

    }, []);

    // Staggered entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);



    const fetchDeliveredOrders = () => {
        authFetch(`${API_URL}/api/orders?status=delivered`)
            .then(res => res.json())
            .then(data => {
                const filtered = Array.isArray(data) ? data : [];
                // Filter only delivered orders - show all tables
                setOrders(filtered);
            })
            .catch(err => {
                console.error('Error fetching delivered orders:', err);
                setOrders([]);
            });
    };



    const fetchBillForOrder = async (orderId) => {
        try {
            const response = await authFetch(`${API_URL}/api/orders/${orderId}/bill`);
            if (response.ok) {
                const bill = await response.json();
                setSelectedBill(bill);
                return bill;
            }
        } catch (error) {
            console.error('Error fetching bill:', error);
        }
        return null;
    };



    const calculateTotals = (order, discount = 0, discountTypeParam = 'percent', taxRateParam = null) => {

        if (!order) return { subtotal: 0, discount: 0, discountAmount: 0, tax: 0, total: 0 };

        const subtotal = (order.items || []).reduce((sum, item) => sum + item.price * (item.quantity || item.qty), 0);

        

        // Calculate discount

        let discountAmount = 0;

        if (discount > 0) {

            if (discountTypeParam === 'percent') {

                discountAmount = subtotal * (discount / 100);

            } else {

                discountAmount = discount;

            }

        }

        

        const afterDiscount = subtotal - discountAmount;

        // Use manual tax rate if provided, otherwise use default

        const effectiveTaxRate = taxRateParam !== null ? taxRateParam : taxRate;

        const tax = afterDiscount * effectiveTaxRate;

        const total = afterDiscount + tax;

        

        return { subtotal, discount, discountAmount, tax, total, afterDiscount };

    };



    // Function to generate UPI QR code

    const generateUPIQRCode = async (amount, orderId) => {

        try {

            const upiConfig = getUPIConfig();

            

            // UPI details from configuration

            const upiDetails = {

                pa: upiConfig.upiId, // UPI ID

                pn: upiConfig.payeeName, // Payee name

                am: amount.toFixed(2), // Amount

                cu: upiConfig.currency, // Currency

                tn: upiConfig.transactionNoteTemplate.replace('{orderId}', orderId), // Transaction note

                mc: upiConfig.merchantCategoryCode, // Merchant category code

                tr: `ORD${orderId}${Date.now()}`, // Transaction reference

            };



            // Create UPI URL

            const upiUrl = `upi://pay?${new URLSearchParams(upiDetails).toString()}`;

            console.log('UPI URL:', upiUrl); // Debug log

            

            // Generate QR code with configured options

            const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, upiConfig.qrCodeOptions);

            console.log('QR Code generated:', qrCodeDataUrl ? 'Success' : 'Failed'); // Debug log

            

            return qrCodeDataUrl;

        } catch (error) {

            console.error('Error generating UPI QR code:', error);

            return null;

        }

    };



    // Function to group items by name and count quantities

    const groupItemsByName = (items) => {

        const grouped = {};

        (items || []).forEach(item => {

            const name = item.name;

            if (!grouped[name]) {

                grouped[name] = {

                    name: name,

                    quantity: 0,

                    price: item.price,

                    totalPrice: 0

                };

            }

            const qty = item.quantity || item.qty || 1;

            grouped[name].quantity += qty;

            grouped[name].totalPrice += item.price * qty;

        });

        return Object.values(grouped);

    };



    


    


    // Function to create consolidated bill for all orders from same table

    const createConsolidatedBill = () => {

        if (orders.length === 0) return null;



        const takeawayOrders = orders.filter(order => order.table_name === 'Takeaway');

        const dineInOrders = orders.filter(order => order.table_name !== 'Takeaway');



        const consolidatedBills = [];



        // Process Dine-In orders for consolidation

        if (dineInOrders.length > 0) {

            const ordersByTable = {};

            dineInOrders.forEach(order => {

                const tableName = order.table_name;

                if (!ordersByTable[tableName]) {

                    ordersByTable[tableName] = [];

                }

                ordersByTable[tableName].push(order);

            });



            Object.keys(ordersByTable).forEach(table => {

                const tableOrders = ordersByTable[table];

                const allItems = [];

                const orderIds = [];

                let grandTotal = 0;



                tableOrders.forEach(order => {

                    orderIds.push(order.id);

                    allItems.push(...(order.items || []));

                    grandTotal += order.total || 0;

                });



                consolidatedBills.push({

                    orderIds: orderIds,

                    items: groupItemsByName(allItems),

                    grandTotal: grandTotal,

                    table_name: table,

                    orderCount: tableOrders.length,

                    isConsolidated: true

                });

            });

        }



        // Add Takeaway orders as individual bills (not consolidated)

        takeawayOrders.forEach(order => {

            consolidatedBills.push({

                orderIds: [order.id],

                items: groupItemsByName(order.items || []),

                grandTotal: order.total || 0,

                table_name: order.table_name,

                orderCount: 1,

                isConsolidated: false // Mark as not consolidated

            });

        });



        // If there's only one bill (either dine-in or takeaway), return it directly

        if (consolidatedBills.length === 1) {

            return consolidatedBills[0];

        }



        // If multiple bills (can be mixed dine-in consolidated and individual takeaway)

        if (consolidatedBills.length > 1) {

            return {

                multipleTables: true,

                tables: consolidatedBills

            };

        }



        return null;

    };



    const handleSelectOrder = async (order) => {

        setSelectedOrder(order);

        setDiscountPercent(0);

        setDiscountType('percent');

        setManualTaxRate(5); // Reset to default 5%

        const bill = await fetchBillForOrder(order.id);

        if (!bill) {

            const totals = calculateTotals(order, 0, 'percent');

            setSelectedBill({

                subtotal: totals.subtotal,

                tax: totals.tax,

                total: totals.total,

                bill_status: 'pending'

            });

        }

    };



    const handleCompletePayment = async () => {

        if (!selectedOrder) {

            setNotification({ message: 'Please select an order to process payment.', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

            return;

        }



        const token = localStorage.getItem('authToken');

        try {

            if (selectedOrder.orderIds) {

                // Handle consolidated bill - complete payment for all orders

                let allSuccessful = true;

                const failedOrders = [];

                

                for (const orderId of selectedOrder.orderIds) {

                    try {

                        const response = await fetch(`${API_URL}/api/orders/${orderId}/complete-payment`, {

                            method: 'PUT',

                            headers: {

                                'Content-Type': 'application/json',

                                'Authorization': `Bearer ${token}`

                            },

                            body: JSON.stringify({ payment_method: paymentMethod })

                        });



                        if (!response.ok) {

                            throw new Error(`Failed to complete payment for Order #${orderId}`);

                        }

                    } catch (error) {

                        allSuccessful = false;

                        failedOrders.push(orderId);

                        console.error(`Error completing payment for Order #${orderId}:`, error);

                    }

                }



                if (allSuccessful) {

                    setNotification({ 

                        message: `Payment completed for ${selectedOrder.orderCount} orders (${paymentMethod}).`, 

                        type: 'success' 

                    });

                    setTimeout(() => setNotification(null), 3000);

                    

                    handlePrintBill();

                    

                    // Remove all orders from the list

                    setOrders(prev => prev.filter(o => !selectedOrder.orderIds.includes(o.id)));

                    setSelectedOrder(null);

                    setSelectedBill(null);

                    setPaymentMethod('cash');

                } else {

                    setNotification({ 

                        message: `Partial success: Failed to complete payment for orders: ${failedOrders.join(', ')}`,

                        type: 'warning' 

                    });

                }

            } else {

                // Handle single order payment (existing logic)

                const response = await fetch(`${API_URL}/api/orders/${selectedOrder.id}/complete-payment`, {

                    method: 'PUT',

                    headers: {

                        'Content-Type': 'application/json',

                        'Authorization': `Bearer ${token}`

                    },

                    body: JSON.stringify({ payment_method: paymentMethod })

                });



                if (!response.ok) {

                    throw new Error(`HTTP error! status: ${response.status}`);

                }



                setNotification({ 

                    message: `Payment completed for Order #${selectedOrder.id} (${paymentMethod}).`, 

                    type: 'success' 

                });

                setTimeout(() => setNotification(null), 3000);

                

                handlePrintBill();

                

                // Remove from orders list

                setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));

                setSelectedOrder(null);

                setSelectedBill(null);

                setPaymentMethod('cash');

            }

        } catch (error) {

            console.error('Error completing payment:', error);

            setNotification({ message: 'Error completing payment.', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    const handlePrintBill = async () => {

        if (selectedOrder) {

            // Calculate total amount for QR code

            const totals = selectedOrder.orderIds 

                ? { total: ((discountPercent > 0 ? (selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))) : (selectedOrder.grandTotal * 0.95)) * (1 + (manualTaxRate / 100))) }

                : currentOrderTotals;

            

            // Generate QR code first

            const qrCodeDataUrl = await generateUPIQRCode(totals.total, selectedOrder.orderIds ? selectedOrder.orderIds[0] : selectedOrder.id);

            

            if (!qrCodeDataUrl) {

                console.error('Failed to generate QR code');

                setNotification({ message: 'Error generating QR code for payment.', type: 'error' });

                setTimeout(() => setNotification(null), 3000);

                return;

            }

            

            console.log('QR Code Data URL length:', qrCodeDataUrl.length); // Debug log

            

            const printWindow = window.open('', '_blank');

            printWindow.document.write('<html><head><title>Print Bill</title>');

            printWindow.document.write('<link href="https://cdn.tailwindcss.com" rel="stylesheet">');

            printWindow.document.write('<style>@page { size: 80mm auto; margin: 5mm; } body { font-family: \'Courier New\', monospace; margin: 0; padding: 10px; width: 70mm; font-size: 12px; line-height: 1.2; } .bill-header { text-align: center; margin-bottom: 15px; } .bill-header h1 { font-size: 16px; font-weight: bold; margin: 5px 0; } .bill-header p { font-size: 10px; margin: 2px 0; } .bill-items { margin: 10px 0; } .bill-items table { width: 100%; border-collapse: collapse; font-size: 11px; } .bill-items th, .bill-items td { border: none; padding: 2px 0; text-align: left; } .bill-items th { font-weight: bold; border-bottom: 1px dashed #000; } .bill-summary { margin: 15px 0; } .bill-summary div { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; } .bill-summary .total { font-weight: bold; font-size: 12px; border-top: 1px solid #000; padding-top: 3px; } .qr-code { text-align: center; margin: 15px 0; padding: 5px; } .qr-code img { max-width: 120px; height: auto; } .qr-code p { font-size: 9px; margin: 2px 0; } .bill-footer { text-align: center; margin-top: 20px; font-size: 9px; color: #666; } .dashed-line { border-top: 1px dashed #000; margin: 10px 0; } @media print { body { margin: 0; padding: 5px; } .no-print { display: none; } } </style></head><body>');

            

            if (selectedOrder.orderIds) {

                // Consolidated bill

                const billContent = `

                    <div class="bill-header">

                        <h1>RESTAURANT BILL</h1>

                        <div class="dashed-line"></div>

                        ${selectedOrder.isConsolidated ? 

                            `<p>Consolidated - ${selectedOrder.orderCount} Orders</p>

                             <p>Order IDs: ${selectedOrder.orderIds.join(', ')}</p>` :

                            `<p>Takeaway Order</p>

                             <p>Order ID: ${selectedOrder.orderIds[0]}</p>`

                        }

                        <p>Table: ${selectedOrder.table_name}</p>

                        <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>

                    </div>

                    <div class="bill-items">

                        <table>

                            <thead>

                                <tr>

                                    <th>Item</th>

                                    <th style="text-align: right;">Qty</th>

                                    <th style="text-align: right;">Price</th>

                                    <th style="text-align: right;">Amt</th>

                                </tr>

                            </thead>

                            <tbody>

                                ${selectedOrder.items.map(item => `

                                    <tr>

                                        <td>${item.name}</td>

                                        <td style="text-align: right;">${item.quantity}</td>

                                        <td style="text-align: right;">${locationSettings.currencySymbol}${item.price.toFixed(2)}</td>

                                        <td style="text-align: right;">${locationSettings.currencySymbol}${item.totalPrice.toFixed(2)}</td>

                                    </tr>

                                `).join('')}

                            </tbody>

                        </table>

                    </div>

                    <div class="dashed-line"></div>

                    <div class="bill-summary">

                        <div>

                            <span>Subtotal:</span>

                            <span>${locationSettings.currencySymbol}${(selectedOrder.grandTotal * 0.95).toFixed(2)}</span>

                        </div>

                        ${discountPercent > 0 ? `

                        <div>

                            <span>Discount (${discountType === 'percent' ? discountPercent + '%' : locationSettings.currencySymbol + discountPercent}):</span>

                            <span>-${locationSettings.currencySymbol}${((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))).toFixed(2)}</span>

                        </div>

                        <div>

                            <span>After Discount:</span>

                            <span>${locationSettings.currencySymbol}${((selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95)))).toFixed(2)}</span>

                        </div>

                        ` : ''}

                        <div>

                            <span>Tax (${manualTaxRate}%):</span>

                            <span>${locationSettings.currencySymbol}${(((discountPercent > 0 ? (selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))) : (selectedOrder.grandTotal * 0.95)) * (manualTaxRate / 100))).toFixed(2)}</span>

                        </div>

                        <div class="total">

                            <span>TOTAL:</span>

                            <span>${locationSettings.currencySymbol}${totals.total.toFixed(2)}</span>

                        </div>

                    </div>

                    <div class="dashed-line"></div>

                    <div class="qr-code">

                        <p>Scan to pay via UPI:</p>

                        <img src="${qrCodeDataUrl}" alt="UPI Payment QR Code" />

                        <p>Amount: ${locationSettings.currencySymbol}${totals.total.toFixed(2)}</p>

                    </div>

                `;

                printWindow.document.write(billContent);

            } else {

                // Single order bill (existing logic)

                const totals = currentOrderTotals || calculateTotals(selectedOrder, discountPercent, discountType);

                const groupedItems = groupItemsByName(selectedOrder.items || []);

                const billContent = `

                    <div class="bill-header">

                        <h1>RESTAURANT BILL</h1>

                        <div class="dashed-line"></div>

                        <p>Order ID: ${selectedOrder.id} | Table: ${selectedOrder.table_name}</p>

                        <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>

                    </div>

                    <div class="bill-items">

                        <table>

                            <thead>

                                <tr>

                                    <th>Item</th>

                                    <th style="text-align: right;">Qty</th>

                                    <th style="text-align: right;">Price</th>

                                    <th style="text-align: right;">Amt</th>

                                </tr>

                            </thead>

                            <tbody>

                                ${groupedItems.map(item => `

                                    <tr>

                                        <td>${item.name}</td>

                                        <td style="text-align: right;">${item.quantity}</td>

                                        <td style="text-align: right;">${locationSettings.currencySymbol}${item.price.toFixed(2)}</td>

                                        <td style="text-align: right;">${locationSettings.currencySymbol}${item.totalPrice.toFixed(2)}</td>

                                    </tr>

                                `).join('')}

                            </tbody>

                        </table>

                    </div>

                    <div class="dashed-line"></div>

                    <div class="bill-summary">

                        <div>

                            <span>Subtotal:</span>

                            <span>${locationSettings.currencySymbol}${totals.subtotal.toFixed(2)}</span>

                        </div>

                        ${discountPercent > 0 ? `

                        <div>

                            <span>Discount (${discountType === 'percent' ? discountPercent + '%' : locationSettings.currencySymbol + discountPercent}):</span>

                            <span>-${locationSettings.currencySymbol}${totals.discountAmount.toFixed(2)}</span>

                        </div>

                        <div>

                            <span>After Discount:</span>

                            <span>${locationSettings.currencySymbol}${totals.afterDiscount.toFixed(2)}</span>

                        </div>

                        ` : ''}

                        <div>

                            <span>Tax (${manualTaxRate}%):</span>

                            <span>${locationSettings.currencySymbol}${totals.tax.toFixed(2)}</span>

                        </div>

                        <div class="total">

                            <span>TOTAL:</span>

                            <span>${locationSettings.currencySymbol}${totals.total.toFixed(2)}</span>

                        </div>

                        <div>

                            <span>Payment:</span>

                            <span>${paymentMethod}</span>

                        </div>

                    </div>

                    <div class="dashed-line"></div>

                    <div class="qr-code">

                        <p>Scan to pay via UPI:</p>

                        <img src="${qrCodeDataUrl}" alt="UPI Payment QR Code" />

                        <p>Amount: ${locationSettings.currencySymbol}${totals.total.toFixed(2)}</p>

                    </div>

                `;

                printWindow.document.write(billContent);

            }

            

            printWindow.document.write(`

                <div class="bill-footer">

                    <p>Thank you for your business!</p>

                </div>

            `);

            printWindow.document.write('</body></html>');

            printWindow.document.close();

            printWindow.focus();

            printWindow.print();

        } else {

            setNotification({ message: 'No order selected to print.', type: 'error' });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    const currentOrderTotals = calculateTotals(selectedOrder, discountPercent, discountType);

    const consolidatedBill = createConsolidatedBill();



    return (

        <div className="p-6 bg-gradient-to-br from-slate-50 via-emerald-50 to-blue-50 min-h-screen" style={{ perspective: '1000px' }}>

            <div className="mb-6">
                <div className="flex items-center mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-1 animate-fade-in">Billing</h2>
                        <p className="text-sm text-slate-600">
                            {orders.length === 0 
                                ? (<span className="inline-flex items-center gap-2"><CheckCircle className="text-emerald-600" size={16} />No pending bills</span>)
                                : `${orders.length} order(s) ready for payment`}
                        </p>
                    </div>
                </div>
            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-8" style={{ transformStyle: 'preserve-3d' }}>

                <div className={`bg-gradient-to-br from-white to-emerald-50/30 p-4 lg:p-8 rounded-2xl border border-emerald-200 shadow-xl backdrop-blur-sm ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '100ms',
                        boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(16, 185, 129, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateZ(10px) rotateX(-2deg) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(16, 185, 129, 0.04)';
                    }}
                >

                    <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-6">Orders</h3>

                    {orders.length === 0 ? (
                        <div className="text-center py-12 border-2 border-emerald-200 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50/50">
                            <div className="mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                    <CheckCircle size={32} className="text-white" />
                                </div>
                            </div>
                            <p className="text-lg font-bold text-slate-800 mb-2">No active orders</p>
                            <p className="text-sm text-slate-600">Orders will appear here when created.</p>
                        </div>
                    ) : (

                        <div className="divide-y divide-emerald-200">
                            {orders.map((order, index) => (
                                <div
                                    key={order.id}
                                    className={`px-4 py-4 cursor-pointer transition-all duration-300 rounded-xl ${
                                        selectedOrder?.id === order.id 
                                            ? 'bg-gradient-to-r from-emerald-100 to-blue-100 border-2 border-emerald-300 shadow-md' 
                                            : 'hover:bg-gradient-to-r from-emerald-50 to-blue-50 hover:border-emerald-200 border-2 border-transparent'
                                    }`}
                                    style={{
                                        transform: isLoaded ? 'translateZ(0)' : 'translateZ(-10px)',
                                        transformStyle: 'preserve-3d',
                                        transitionDelay: `${150 + index * 50}ms`
                                    }}
                                    onClick={() => handleSelectOrder(order)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                <span className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold">#{order.id}</span>
                                            </p>
                                            <p className="mt-2 text-xs text-slate-600 inline-flex items-center gap-2 font-medium">
                                                <Utensils size={14} className="text-emerald-600" />
                                                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">Table {order.table_name}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                                {(order.items || []).map(item => `${item.quantity || item.qty}x ${item.name}`).join(', ')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">{locationSettings.currencySymbol}{order.total.toFixed(2)}</p>
                                            <span className="inline-flex items-center gap-1 mt-2 bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-medium">
                                                <CheckCircle size={12} />
                                                Delivered
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    )}

                </div>

                <div className={`bg-gradient-to-br from-white to-blue-50/30 p-4 lg:p-8 rounded-2xl border border-blue-200 shadow-xl backdrop-blur-sm ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '200ms',
                        boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateZ(10px) rotateX(-2deg) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(59, 130, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)';
                    }}
                    ref={billRef}>

                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Invoice</h3>
                        {consolidatedBill && !consolidatedBill.multipleTables && consolidatedBill.isConsolidated && (
                            <button
                                onClick={() => setSelectedOrder(consolidatedBill)}
                                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Show consolidated bill
                            </button>
                        )}
                    </div>

                    

                    {!selectedOrder ? (
                        <div className="text-center py-12">
                            <div className="mb-6">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg animate-pulse">
                                    <Printer size={40} className="text-white" />
                                </div>
                            </div>
                            <p className="text-lg font-bold text-slate-800 mb-2">Select an order to view invoice details</p>
                            <p className="text-sm text-slate-600">Choose an order from the list to generate invoice</p>

                            {consolidatedBill && consolidatedBill.multipleTables && (
                                <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50/50 rounded-2xl border-2 border-blue-200 text-left">
                                    <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                                        Multiple tables with pending orders
                                    </p>
                                    <div className="space-y-3">
                                        {consolidatedBill.tables.map((tableBill, index) => (
                                            <div key={index} className="p-4 bg-white rounded-xl border-2 border-blue-200 hover:shadow-md transition-all duration-300">
                                                <p className="font-bold text-slate-900 text-base">
                                                    {tableBill.table_name === 'Takeaway'
                                                        ? `Takeaway - Order ID: ${tableBill.orderIds[0]}`
                                                        : `Table ${tableBill.table_name}: ${tableBill.orderCount} Orders (Consolidated)`
                                                    }
                                                </p>
                                                <div className="flex justify-between items-center mt-3">
                                                    <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                                        Total: {locationSettings.currencySymbol}{tableBill.grandTotal.toFixed(2)}
                                                    </p>
                                                    <button
                                                        onClick={() => setSelectedOrder(tableBill)}
                                                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    >
                                                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.5 8v4l-3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        View and pay
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                    ) : selectedOrder.orderIds ? (

                        // Show consolidated bill for single table

                        <div>

                            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">

                                <p className="text-xl font-bold text-gray-900">

                                    Consolidated bill - {selectedOrder.orderCount} orders

                                </p>

                                <p className="text-sm text-slate-600 mt-1">Table: {selectedOrder.table_name}</p>

                                <p className="text-gray-600 text-sm mt-1">Order IDs: {selectedOrder.orderIds.join(', ')}</p>

                            </div>

                            <div className="mb-4">

                                <h4 className="text-lg font-semibold text-gray-700 mb-3">All Items:</h4>

                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">

                                    {selectedOrder.items.map((item, index) => (

                                        <div key={index} className="flex justify-between text-gray-800">

                                            <span>{item.quantity}x {item.name}</span>

                                            <span className="font-semibold">{locationSettings.currencySymbol}{item.totalPrice.toFixed(2)}</span>

                                        </div>

                                    ))}

                                </div>

                            </div>

                            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">

                                <h4 className="text-sm font-semibold text-slate-900 mb-3 inline-flex items-center gap-2"><Tag size={16} className="text-slate-500" /> Discount</h4>

                                <div className="flex gap-4 mb-3 text-sm">

                                    <label className="flex items-center">

                                        <input

                                            type="radio"

                                            checked={discountType === 'percent'}

                                            onChange={() => setDiscountType('percent')}

                                            className="mr-2"

                                        />

                                        <span className="text-slate-700">Percentage (%)</span>

                                    </label>

                                    <label className="flex items-center">

                                        <input

                                            type="radio"

                                            checked={discountType === 'fixed'}

                                            onChange={() => setDiscountType('fixed')}

                                            className="mr-2"

                                        />

                                        <span className="text-slate-700">Fixed amount</span>

                                    </label>

                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">

                                    <input

                                        type="text"

                                        value={discountPercent > 0 ? discountPercent : ''}

                                        onChange={(e) => {

                                            const value = e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0);

                                            if (discountType === 'percent' && value > 100) {

                                                setDiscountPercent(100);

                                            } else if (discountType === 'fixed' && value > (selectedOrder.grandTotal * 0.95)) {

                                                setDiscountPercent(selectedOrder.grandTotal * 0.95);

                                            } else {

                                                setDiscountPercent(value);

                                            }

                                        }}

                                        placeholder={discountType === 'percent' ? 'Enter %' : 'Enter amount'}

                                        className="flex-1 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"

                                    />

                                    <button

                                        onClick={() => setDiscountPercent(0)}

                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 whitespace-nowrap"

                                    >

                                        Clear

                                    </button>

                                </div>

                                {discountPercent > 0 && (

                                        <p className="text-xs text-slate-500 mt-2">

                                        Discount Amount: {locationSettings.currencySymbol}{((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : 1) * (discountType === 'fixed' ? discountPercent / (selectedOrder.grandTotal * 0.95) : 1)).toFixed(2)}

                                    </p>

                                )}

                            </div>

                            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">

                                <h4 className="text-sm font-semibold text-slate-900 mb-3 inline-flex items-center gap-2"><DollarSign size={16} className="text-slate-500" /> Tax</h4>

                                <div className="flex flex-col sm:flex-row gap-2">

                                    <input

                                        type="text"

                                        value={manualTaxRate !== 5 ? manualTaxRate : ''}

                                        onChange={(e) => {

                                            const value = e.target.value === '' ? 5 : Math.max(0, parseFloat(e.target.value) || 0);

                                            if (value > 100) {

                                                setManualTaxRate(100);

                                            } else {

                                                setManualTaxRate(value);

                                            }

                                        }}

                                        placeholder="Enter tax %"

                                        className="flex-1 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"

                                    />

                                    <div className="flex items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">

                                        <span className="text-sm font-medium text-slate-600">%</span>

                                    </div>

                                    <button

                                        onClick={() => setManualTaxRate(5)}

                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20"

                                    >

                                        Reset

                                    </button>

                                </div>

                                <p className="text-xs text-slate-500 mt-2">

                                    Tax Amount: {locationSettings.currencySymbol}{((selectedOrder.grandTotal * 0.95) * (manualTaxRate / 100) / (1 + (manualTaxRate / 100))).toFixed(2)}

                                </p>

                            </div>

                            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2 text-sm">

                                <div className="flex justify-between">

                                    <span className="text-gray-700">Subtotal:</span>

                                    <span className="font-semibold text-gray-900">{locationSettings.currencySymbol}{(selectedOrder.grandTotal * 0.95).toFixed(2)}</span>

                                </div>

                                {discountPercent > 0 && (

                                    <>

                                        <div className="flex justify-between text-red-600">

                                            <span className="text-gray-700">Discount ({discountType === 'percent' ? discountPercent + '%' : locationSettings.currencySymbol + discountPercent}):</span>

                                            <span className="font-semibold">-{locationSettings.currencySymbol}{((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))).toFixed(2)}</span>

                                        </div>

                                        <div className="flex justify-between text-gray-800">

                                            <span>After Discount:</span>

                                            <span className="font-semibold">{locationSettings.currencySymbol}{((selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95)))).toFixed(2)}</span>

                                        </div>

                                    </>

                                )}

                                <div className="flex justify-between">

                                    <span className="text-gray-700">Tax ({manualTaxRate}%):</span>

                                    <span className="font-semibold text-gray-900">{locationSettings.currencySymbol}{(((discountPercent > 0 ? (selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))) : (selectedOrder.grandTotal * 0.95)) * (manualTaxRate / 100))).toFixed(2)}</span>

                                </div>

                                <div className="flex justify-between text-xl font-semibold pt-3 border-t border-slate-200">

                                    <span className="text-gray-800">Grand Total:</span>

                                    <span className="text-slate-900">{locationSettings.currencySymbol}{(((discountPercent > 0 ? (selectedOrder.grandTotal * 0.95) - ((selectedOrder.grandTotal * 0.95) * (discountType === 'percent' ? discountPercent / 100 : discountPercent / (selectedOrder.grandTotal * 0.95))) : (selectedOrder.grandTotal * 0.95)) * (1 + (manualTaxRate / 100)))).toFixed(2)}</span>

                                </div>

                            </div>

                            <div className="mt-6">

                                <h4 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-3 flex items-center">

                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm-6 0a2 2 0 11-4 0 2 2 0 014 0z" />

                                    </svg>

                                    Payment method

                                </h4>

                                <select

                                    value={paymentMethod}

                                    onChange={(e) => setPaymentMethod(e.target.value)}

                                    className="block w-full border-2 border-blue-300 rounded-xl bg-white/80 backdrop-blur-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 font-medium shadow-sm transition-all duration-300"

                                >

                                    <option value="cash">💵 Cash</option>

                                    <option value="card">💳 Card</option>

                                    <option value="upi">📱 UPI</option>

                                    <option value="online">🌐 Online Payment</option>

                                </select>

                            </div>

                            <button

                                onClick={handleCompletePayment}

                                className="w-full mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 btn-3d-primary"

                            >

                                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm-6 0a2 2 0 11-4 0 2 2 0 014 0z" />

                                </svg>

                                Complete Payment & Close Order

                            </button>

                            <button

                                onClick={handlePrintBill}

                                className="w-full mt-3 inline-flex items-center justify-center gap-3 rounded-xl border-2 border-purple-300 bg-white/80 backdrop-blur-sm px-6 py-4 text-base font-bold text-purple-700 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 btn-3d"

                            >

                                <Printer size={20} className="text-purple-600" />

                                Print Bill

                            </button>

                        </div>

                    ) : (

                        // Show single order bill (existing logic)

                        <div>
                            <div className="mb-6 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50/50 p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Order #{selectedOrder.id}</p>
                                        <p className="text-sm text-slate-600 mt-1">Table: {selectedOrder.table_name}</p>
                                        <span className="inline-flex items-center gap-2 mt-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
                                            <CheckCircle size={16} />
                                            Delivered
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">{locationSettings.currencySymbol}{selectedOrder.total.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-4 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Items
                                </h4>
                                <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl border-2 border-blue-200 p-6 space-y-3">
                                    {groupItemsByName(selectedOrder.items || []).map((item, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded-xl border border-blue-100 hover:shadow-md transition-all duration-300">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{item.quantity}x</span>
                                                <span className="font-medium text-slate-900">{item.name}</span>
                                            </div>
                                            <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow">
                                                {locationSettings.currencySymbol}{item.totalPrice.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2 text-sm">

                                <div className="flex justify-between">

                                    <span className="text-gray-700">Subtotal:</span>

                                    <span className="font-semibold text-gray-900">{locationSettings.currencySymbol}{currentOrderTotals.subtotal.toFixed(2)}</span>

                                </div>

                                {discountPercent > 0 && (

                                    <>

                                        <div className="flex justify-between text-red-600">

                                            <span className="text-gray-700">Discount ({discountType === 'percent' ? discountPercent + '%' : locationSettings.currencySymbol + discountPercent}):</span>

                                            <span className="font-semibold">-{locationSettings.currencySymbol}{currentOrderTotals.discountAmount.toFixed(2)}</span>

                                        </div>

                                        <div className="flex justify-between text-gray-800">

                                            <span>After Discount:</span>

                                            <span className="font-semibold">{locationSettings.currencySymbol}{currentOrderTotals.afterDiscount.toFixed(2)}</span>

                                        </div>

                                    </>

                                )}

                                <div className="flex justify-between">

                                    <span className="text-gray-700">Tax ({taxRate * 100}%):</span>

                                    <span className="font-semibold text-gray-900">{locationSettings.currencySymbol}{currentOrderTotals.tax.toFixed(2)}</span>

                                </div>

                                <div className="flex justify-between text-xl font-semibold pt-3 border-t border-slate-200">

                                    <span className="text-gray-800">Total:</span>

                                    <span className="text-slate-900">{locationSettings.currencySymbol}{currentOrderTotals.total.toFixed(2)}</span>

                                </div>

                            </div>

                            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">

                                <h4 className="text-sm font-semibold text-slate-900 mb-3 inline-flex items-center gap-2"><Tag size={16} className="text-slate-500" /> Discount</h4>

                                <div className="flex gap-4 mb-3 text-sm">

                                    <label className="flex items-center">

                                        <input

                                            type="radio"

                                            checked={discountType === 'percent'}

                                            onChange={() => setDiscountType('percent')}

                                            className="mr-2"

                                        />

                                        <span className="text-slate-700">Percentage (%)</span>

                                    </label>

                                    <label className="flex items-center">

                                        <input

                                            type="radio"

                                            checked={discountType === 'fixed'}

                                            onChange={() => setDiscountType('fixed')}

                                            className="mr-2"

                                        />

                                        <span className="text-slate-700">Fixed amount</span>

                                    </label>

                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">

                                    <input

                                        type="text"

                                        value={discountPercent > 0 ? discountPercent : ''}

                                        onChange={(e) => {

                                            const value = e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0);

                                            if (discountType === 'percent' && value > 100) {

                                                setDiscountPercent(100);

                                            } else if (discountType === 'fixed' && value > currentOrderTotals.subtotal) {

                                                setDiscountPercent(currentOrderTotals.subtotal);

                                            } else {

                                                setDiscountPercent(value);

                                            }

                                        }}

                                        placeholder={discountType === 'percent' ? 'Enter %' : 'Enter amount'}

                                        className="flex-1 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"

                                    />

                                    <button

                                        onClick={() => setDiscountPercent(0)}

                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20"

                                    >

                                        Clear

                                    </button>

                                </div>

                                {discountPercent > 0 && (

                                        <p className="text-xs text-slate-500 mt-2">

                                        Discount Amount: {locationSettings.currencySymbol}{currentOrderTotals.discountAmount.toFixed(2)}

                                    </p>

                                )}

                            </div>

                            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">

                                <h4 className="text-sm font-semibold text-slate-900 mb-3 inline-flex items-center gap-2"><DollarSign size={16} className="text-slate-500" /> Tax</h4>

                                <div className="flex flex-col sm:flex-row gap-2">

                                    <input

                                        type="text"

                                        value={manualTaxRate !== 5 ? manualTaxRate : ''}

                                        onChange={(e) => {

                                            const value = e.target.value === '' ? 5 : Math.max(0, parseFloat(e.target.value) || 0);

                                            if (value > 100) {

                                                setManualTaxRate(100);

                                            } else {

                                                setManualTaxRate(value);

                                            }

                                        }}

                                        placeholder="Enter tax %"

                                        className="flex-1 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"

                                    />

                                    <div className="flex items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">

                                        <span className="text-sm font-medium text-slate-600">%</span>

                                    </div>

                                    <button

                                        onClick={() => setManualTaxRate(5)}

                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20"

                                    >

                                        Reset

                                    </button>

                                </div>

                                <p className="text-xs text-slate-500 mt-2">

                                    Tax Amount: {locationSettings.currencySymbol}{currentOrderTotals.tax.toFixed(2)}

                                </p>

                            </div>

                            <div className="mt-6">

                                <h4 className="text-sm font-semibold text-slate-900 mb-2">Payment method</h4>

                                <select

                                    value={paymentMethod}

                                    onChange={(e) => setPaymentMethod(e.target.value)}

                                    className="block w-full border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"

                                >

                                    <option value="cash">Cash</option>

                                    <option value="card">Card</option>

                                    <option value="upi">UPI</option>

                                    <option value="online">Online Payment</option>

                                </select>

                            </div>

                            <button

                                onClick={handleCompletePayment}

                                className="w-full mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"

                            >

                                Complete Payment & Close Order

                            </button>

                            <button

                                onClick={handlePrintBill}

                                className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20"

                            >

                                <Printer size={16} className="text-slate-500" /> Print bill

                            </button>

                        </div>

                    )}

                </div>

                
            </div>

        </div>

    );

};



export default BillingPage; 


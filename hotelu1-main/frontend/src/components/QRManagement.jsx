import React, { useState, useEffect } from 'react';
import { getAPI_URL, authFetch } from '../utils/api';
import {
  formatTableName,
  tableIdMatches,
  isActiveTableOrder,
  getOrderPhaseLabel,
} from '../utils/tableOrderUtils';

import Notification from './Notification';
import useCurrency from '../hooks/useCurrency';

const QRManagement = ({ locationSettings }) => {
    const { format: fmt } = useCurrency(locationSettings);

    const [tableNumber, setTableNumber] = useState('1');
    const [tableStatus, setTableStatus] = useState('available'); // 'available', 'occupied'
    const [tableOrders, setTableOrders] = useState([]);

    const [qrCodeValue, setQrCodeValue] = useState('');

    const [menu, setMenu] = useState([]);

    const [testSelectedItems, setTestSelectedItems] = useState([]);

    const qrCodeContainerRef = React.useRef(null);

    const [isQrCodeGenerated, setIsQrCodeGenerated] = useState(false);

    const [notification, setNotification] = useState(null);

    const [isQrCodeScriptLoaded, setIsQrCodeScriptLoaded] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // State for server IP address (for mobile QR access)
    const [serverIP, setServerIP] = useState(() => {
        // Try to get from localStorage or default to localhost
        const savedIP = localStorage.getItem('qrServerIP');
        if (savedIP) return savedIP;
        // Extract IP from current window.location if not localhost
        const currentHost = window.location.hostname;
        if (currentHost !== 'localhost' && !currentHost.includes('127.0.0.1')) {
            return `${window.location.protocol}//${currentHost}:${window.location.port}`;
        }
        return 'http://localhost:3000';
    });



    // Use dynamic URL for both development and production

    const BASE_QR_ORDER_URL = serverIP || window.location.origin;



    useEffect(() => {

        fetch(`${getAPI_URL()}/api/menu`)

            .then(res => res.json())

            .then(data => {

                // Filter out items that are not available

                const availableMenu = data.filter(item => item.isAvailable === true);

                console.log('QRManagement - Available menu items:', availableMenu);

                setMenu(availableMenu);

            });

    }, []);

    // Fetch table status when table number changes
    useEffect(() => {
        fetchTableStatus();
        const interval = setInterval(fetchTableStatus, 3000);
        return () => clearInterval(interval);
    }, [tableNumber]);

    const fetchTableStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const url = `${getAPI_URL()}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(formatTableName(tableNumber))}`;
            const response = token
                ? await authFetch(`/api/orders?type=DINE_IN&tableId=${encodeURIComponent(formatTableName(tableNumber))}`)
                : await fetch(url);
            const data = await response.json();
            if (Array.isArray(data)) {
                const activeOrders = data.filter(
                    (o) =>
                        tableIdMatches(tableNumber, o.table_name) &&
                        isActiveTableOrder(o)
                );
                setTableOrders(activeOrders);
                setTableStatus(activeOrders.length > 0 ? 'occupied' : 'available');
            }
        } catch (error) {
            console.error('Error fetching table status:', error);
        }
    };



    // Staggered entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);


    useEffect(() => {

        const checkQRCodeLoaded = () => {

            if (window.QRCode) {

                setIsQrCodeScriptLoaded(true);

            } else {

                const timer = setTimeout(checkQRCodeLoaded, 100);

                return () => clearTimeout(timer);

            }

        };

        checkQRCodeLoaded();

    }, []);



    useEffect(() => {

        if (qrCodeContainerRef.current) {

            qrCodeContainerRef.current.innerHTML = '';

        }

        if (isQrCodeScriptLoaded && qrCodeContainerRef.current) {

            generateQrCodeValue(tableNumber);

        } else {

            setIsQrCodeGenerated(false);

        }

    }, [tableNumber, isQrCodeScriptLoaded]);



    const generateQrCodeValue = (tableNum) => {

        setIsQrCodeGenerated(false);

        // Use /qr-ordering path for direct access to ordering page

        const url = `${BASE_QR_ORDER_URL}/qr-ordering?tableId=${tableNum}`;

        setQrCodeValue(url);



        if (isQrCodeScriptLoaded && qrCodeContainerRef.current) {

            qrCodeContainerRef.current.innerHTML = '';

            try {

                // qrcodejs expects a DOM element, not a canvas

                new window.QRCode(qrCodeContainerRef.current, {

                    text: url,

                    width: 256,

                    height: 256,

                    colorDark: "#000000",

                    colorLight: "#ffffff",

                    correctLevel: window.QRCode.CorrectLevel.H

                });

                setIsQrCodeGenerated(true);

            } catch (error) {

                console.error('QR Code generation error:', error);

                setIsQrCodeGenerated(false);

                setNotification({ message: "Failed to generate QR code. Check console for details.", type: "error" });

                setTimeout(() => setNotification(null), 3000);

            }

        } else {

            console.warn("QRCode library not available or container not ready. Cannot generate QR code.");

        }

    };



    const handleTableNumberChange = (e) => {

        const num = e.target.value;

        setTableNumber(num);

    };



    const handleDownloadQR = () => {

        if (qrCodeContainerRef.current && isQrCodeGenerated) {

            const img = qrCodeContainerRef.current.querySelector('img') || qrCodeContainerRef.current.querySelector('canvas');

            if (img) {

                const url = img.src || img.toDataURL('image/png');

                const downloadLink = document.createElement('a');

                downloadLink.href = url;

                downloadLink.download = `table-${tableNumber}-qrcode.png`;

                document.body.appendChild(downloadLink);

                downloadLink.click();

                document.body.removeChild(downloadLink);

            } else {

                setNotification({ message: "QR code not ready for download. Please wait and try again.", type: "error" });

                setTimeout(() => setNotification(null), 3000);

            }

        } else {

            setNotification({ message: "QR code not ready for download. Please wait and try again.", type: "error" });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    const handleTestQR = () => {

        if (qrCodeValue && isQrCodeGenerated) {

            window.open(qrCodeValue, '_blank');

        } else {

            setNotification({ message: "QR code not generated yet. Cannot test.", type: "error" });

            setTimeout(() => setNotification(null), 3000);

        }

    };



    return (

        <div className="p-6 bg-[#FFF8F0] min-h-screen" style={{ perspective: '1000px' }}>

            {/* Header Section - Orange Theme */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
                            <p className="text-orange-100 text-base">Generate and manage QR codes for table ordering</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                <span className="text-white text-sm font-medium">Scan & Order</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ transformStyle: 'preserve-3d' }}>

                <div className={`bg-gradient-to-br from-white to-orange-50/30 p-8 rounded-2xl border border-orange-200 shadow-xl flex flex-col items-center backdrop-blur-sm ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '100ms',
                        boxShadow: '0 20px 25px -5px rgba(255, 107, 53, 0.1), 0 10px 10px -5px rgba(255, 107, 53, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateZ(10px) rotateX(-2deg) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(255, 107, 53, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(255, 107, 53, 0.1), 0 10px 10px -5px rgba(255, 107, 53, 0.04)';
                    }}
                >

                    <h2 className="text-3xl font-bold text-orange-600 mb-2">Generate QR Code</h2>

                    <div className="mb-6 w-full max-w-sm">
                        <label htmlFor="tableNumber" className="block text-sm font-semibold text-slate-700 mb-2">
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Table Number
                            </span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                id="tableNumber"
                                value={tableNumber}
                                onChange={handleTableNumberChange}
                                className="flex-1 border-2 border-blue-200 rounded-xl bg-white/80 backdrop-blur-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 font-medium shadow-sm transition-all duration-300"
                                placeholder="e.g., 1, Takeaway"
                            />
                            {/* Table Status Badge */}
                            <div className="flex items-center">
                                {tableStatus === 'occupied' ? (
                                    <span className="bg-red-500 text-white px-3 py-2 rounded-xl font-semibold text-sm animate-pulse flex items-center gap-1">
                                        <span className="w-2 h-2 bg-white rounded-full"></span>
                                        Occupied
                                    </span>
                                ) : (
                                    <span className="bg-green-500 text-white px-3 py-2 rounded-xl font-semibold text-sm flex items-center gap-1">
                                        <span className="w-2 h-2 bg-white rounded-full"></span>
                                        Available
                                    </span>
                                )}
                            </div>
                        </div>
                        {tableOrders.length > 0 && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm max-h-40 overflow-y-auto">
                                <p className="font-semibold text-red-800 mb-2">
                                    {tableOrders.length} active order(s) on this table
                                </p>
                                {tableOrders.map((o) => (
                                    <div key={o.id} className="mb-2 pb-2 border-b border-red-100 last:border-0">
                                        <p className="font-medium text-gray-900">
                                            Order #{o.id} — {getOrderPhaseLabel(o) || o.status}
                                        </p>
                                        {(o.items || []).length > 0 && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                {(o.items || [])
                                                    .map((i) => `${i.quantity || i.qty}x ${i.name}`)
                                                    .join(', ')}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-6 w-full max-w-sm">
                        <label htmlFor="serverIP" className="block text-sm font-semibold text-slate-700 mb-2">
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM16 3v4l-2-2-2 2V3M12 12h.01" />
                                </svg>
                                Server IP Address (for Mobile QR)
                            </span>
                        </label>
                        <input
                            type="text"
                            id="serverIP"
                            value={serverIP}
                            onChange={(e) => {
                                setServerIP(e.target.value);
                                localStorage.setItem('qrServerIP', e.target.value);
                                // Regenerate QR with new IP
                                setTimeout(() => generateQrCodeValue(tableNumber), 100);
                            }}
                            className="w-full border-2 border-orange-300 rounded-xl bg-white/80 backdrop-blur-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 px-4 py-3 font-medium shadow-sm transition-all duration-300"
                            placeholder="http://192.168.1.100:3000"
                        />
                        <p className="text-xs text-slate-500 mt-2">Enter your computer&apos;s IP for mobile access. Use ipconfig (Windows) or ifconfig (Mac) to find IP.</p>
                    </div>

                    <div className="bg-gradient-to-br from-white to-purple-50/50 p-6 rounded-2xl border-2 border-purple-200 shadow-lg mb-6 backdrop-blur-sm">
                        {isQrCodeScriptLoaded ? (
                            <div id="qrCodeContainer" ref={qrCodeContainerRef} style={{ width: 256, height: 256 }} className="mx-auto"></div>
                        ) : (
                            <div className="w-64 h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-600 font-medium">Loading QR generator...</p>
                                </div>
                            </div>
                        )}
                        {!qrCodeValue && isQrCodeScriptLoaded && (
                            <p className="text-slate-500 mt-4 text-center bg-blue-50 rounded-lg p-3">Enter table number to generate QR code</p>
                        )}
                        {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
                    </div>

                    <div className="flex space-x-4">
                        <button
                            onClick={handleDownloadQR}
                            disabled={!isQrCodeGenerated}
                            className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${!isQrCodeGenerated ? 'opacity-50 cursor-not-allowed' : 'btn-3d-primary'}`}
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download QR
                        </button>
                        <button
                            onClick={handleTestQR}
                            disabled={!isQrCodeGenerated}
                            className={`inline-flex items-center justify-center rounded-xl border-2 border-orange-300 bg-white/80 backdrop-blur-sm px-6 py-3 text-sm font-bold text-orange-600 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${!isQrCodeGenerated ? 'opacity-50 cursor-not-allowed' : 'btn-3d'}`}
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Test QR
                        </button>
                    </div>

                </div>

                <div className={`bg-white p-8 rounded-2xl border border-orange-100 shadow-xl ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '200ms',
                        boxShadow: '0 20px 25px -5px rgba(255, 107, 53, 0.1), 0 10px 10px -5px rgba(255, 107, 53, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateZ(10px) rotateX(-2deg) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(255, 107, 53, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(255, 107, 53, 0.1), 0 10px 10px -5px rgba(255, 107, 53, 0.04)';
                    }}
                >

                    <h3 className="text-xl font-bold text-orange-600 mb-6">Menu Preview</h3>

                    <div className="max-h-96 overflow-y-auto pr-4 space-y-1 scrollbar-thin scrollbar-thumb-orange-200 scrollbar-track-orange-50">

                        {menu.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-gray-600 font-medium">Loading menu...</p>
                            </div>
                        ) : (

                            <div>

                                {Object.entries(menu.reduce((acc, item) => {

                                    (acc[item.category] = acc[item.category] || []).push(item);

                                    return acc;

                                }, {})).map(([category, items]) => (

                                    <div key={category} className="mb-6">
                                        <h4 className="text-lg font-bold text-orange-600 mb-4 flex items-center">
                                            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {category}
                                        </h4>

                                        <div className="grid grid-cols-1 gap-3">
                                            {items.map(item => (
                                                <div key={item.id} className="flex justify-between items-start gap-4 bg-white p-4 rounded-xl border border-orange-100 hover:shadow-md transition-all duration-300 hover:scale-102">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-900 text-base">{item.name}</p>
                                                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                                                    </div>
                                                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                                        {fmt(item.price)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                    <div className="mt-8 border-t pt-6 border-gray-200">

                        <h3 className="text-lg font-semibold text-slate-900 mb-3">Selected Items</h3>

                        {testSelectedItems.length === 0 ? (

                            <p className="text-gray-500">No items selected.</p>

                        ) : (

                            <ul className="list-disc list-inside space-y-2 text-gray-700">

                                {testSelectedItems.map(item => (

                                    <li key={item.id}>{item.name} ({item.qty})</li>

                                ))}

                            </ul>

                        )}

                        <p className="text-sm text-gray-500 mt-2">

                            (This section is for conceptual testing. In a real scenario, the "Test QR" button would take you to the actual customer ordering flow.)

                        </p>

                    </div>

                </div>

            </div>

            <div className="mt-8 bg-white p-6 rounded-xl border border-orange-100 shadow-sm">

                <h3 className="text-lg font-semibold text-gray-800 mb-4">How to Use</h3>

                <ul className="list-disc list-inside space-y-2 text-gray-600">

                    <li>Select a table number to generate a unique QR code.</li>

                    <li>Customers scan the QR code to view the menu and place orders.</li>

                    <li>You can download the QR code as an SVG for printing.</li>

                    <li>The menu preview allows you to see what customers will order.</li>

                </ul>

            </div>

        </div>

    );

};



export default QRManagement; 


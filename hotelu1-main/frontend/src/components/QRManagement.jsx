import React, { useState, useEffect } from 'react';

import Notification from './Notification';



const QRManagement = ({ locationSettings }) => {

    const [tableNumber, setTableNumber] = useState('1');

    const [qrCodeValue, setQrCodeValue] = useState('');

    const [menu, setMenu] = useState([]);

    const [testSelectedItems, setTestSelectedItems] = useState([]);

    const qrCodeContainerRef = React.useRef(null);

    const [isQrCodeGenerated, setIsQrCodeGenerated] = useState(false);

    const [notification, setNotification] = useState(null);

    const [isQrCodeScriptLoaded, setIsQrCodeScriptLoaded] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);



    // Use localhost for dev, but can be changed to actual IP for production

    const BASE_QR_ORDER_URL = `${window.location.protocol}//localhost:3000`;



    useEffect(() => {

        fetch('http://localhost:3001/api/menu')

            .then(res => res.json())

            .then(data => {

                // Filter out items that are not available

                const availableMenu = data.filter(item => item.isAvailable === true);

                console.log('QRManagement - Available menu items:', availableMenu);

                setMenu(availableMenu);

            });

    }, []);



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

        // Simplified URL format - just tableId parameter

        const url = `${BASE_QR_ORDER_URL}/?tableId=${tableNum}`;

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

        <div className="p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 min-h-screen" style={{ perspective: '1000px' }}>

            <div className="mb-6">
                <div className="flex items-center mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1 animate-fade-in">QR Code Management</h2>
                        <p className="text-sm text-slate-600">Generate and manage QR codes for table ordering.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ transformStyle: 'preserve-3d' }}>

                <div className={`bg-gradient-to-br from-white to-blue-50/30 p-8 rounded-2xl border border-blue-200 shadow-xl flex flex-col items-center backdrop-blur-sm ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '100ms',
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
                >

                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">Generate QR Code</h3>

                    <div className="mb-6 w-full max-w-sm">
                        <label htmlFor="tableNumber" className="block text-sm font-semibold text-slate-700 mb-2">
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Table Number
                            </span>
                        </label>
                        <input
                            type="text"
                            id="tableNumber"
                            value={tableNumber}
                            onChange={handleTableNumberChange}
                            className="w-full border-2 border-blue-200 rounded-xl bg-white/80 backdrop-blur-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 font-medium shadow-sm transition-all duration-300"
                            placeholder="e.g., 1, Takeaway"
                        />
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
                            className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${!isQrCodeGenerated ? 'opacity-50 cursor-not-allowed' : 'btn-3d-primary'}`}
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download QR
                        </button>
                        <button
                            onClick={handleTestQR}
                            disabled={!isQrCodeGenerated}
                            className={`inline-flex items-center justify-center rounded-xl border-2 border-purple-300 bg-white/80 backdrop-blur-sm px-6 py-3 text-sm font-bold text-purple-700 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${!isQrCodeGenerated ? 'opacity-50 cursor-not-allowed' : 'btn-3d'}`}
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Test QR
                        </button>
                    </div>

                </div>

                <div className={`bg-gradient-to-br from-white to-purple-50/30 p-8 rounded-2xl border border-purple-200 shadow-xl backdrop-blur-sm ${
                    isLoaded ? 'animate-slide-up opacity-100' : 'opacity-0'
                }`}
                    style={{
                        transform: isLoaded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(5deg)',
                        transformStyle: 'preserve-3d',
                        transitionDelay: '200ms',
                        boxShadow: '0 20px 25px -5px rgba(147, 51, 234, 0.1), 0 10px 10px -5px rgba(147, 51, 234, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateZ(10px) rotateX(-2deg) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(147, 51, 234, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateZ(0) rotateX(0deg) scale(1)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.1), 0 10px 10px -5px rgba(147, 51, 234, 0.04)';
                    }}
                >

                    <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">Menu Preview</h3>

                    <div className="max-h-96 overflow-y-auto pr-4 space-y-1 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">

                        {menu.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-slate-600 font-medium">Loading menu...</p>
                            </div>
                        ) : (

                            <div>

                                {Object.entries(menu.reduce((acc, item) => {

                                    (acc[item.category] = acc[item.category] || []).push(item);

                                    return acc;

                                }, {})).map(([category, items]) => (

                                    <div key={category} className="mb-6">
                                        <h4 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 flex items-center">
                                            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {category}
                                        </h4>

                                        <div className="grid grid-cols-1 gap-3">
                                            {items.map(item => (
                                                <div key={item.id} className="flex justify-between items-start gap-4 bg-gradient-to-r from-white to-purple-50/50 p-4 rounded-xl border border-purple-200 hover:shadow-md transition-all duration-300 hover:scale-102">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-900 text-base">{item.name}</p>
                                                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                                                    </div>
                                                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                                        {locationSettings.currencySymbol}{item.price.toFixed(2)}
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

            <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">

                <h3 className="text-lg font-semibold text-slate-900 mb-4">How to Use</h3>

                <ul className="list-disc list-inside space-y-2 text-gray-700">

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


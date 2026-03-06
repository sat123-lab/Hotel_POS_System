import React, { useState, useEffect } from 'react';
import SimpleMenu from './SimpleMenu';
import CustomerOrderTracker from './CustomerOrderTracker';
import Notification from './Notification';

const QRCodeOrdering = ({ locationSettings, onOrderPlacedWithId, tableId: propTableId }) => {
    const [tableId, setTableId] = useState('Unknown Table/Takeaway');
    const [currentOrderId, setCurrentOrderId] = useState(null);
    const [notification, setNotification] = useState(null);
    const [showTracker, setShowTracker] = useState(false);

    useEffect(() => {
        // Get tableId from props first, then URL
        if (propTableId) {
            setTableId(propTableId);
        } else {
            const params = new URLSearchParams(window.location.search);
            const idFromUrl = params.get('tableId');
            if (idFromUrl) {
                setTableId(idFromUrl);
            }
        }
    }, [propTableId]);

    const handleOrderPlaced = (order) => {
        setCurrentOrderId(order.id);
        setShowTracker(true);
        setNotification({
            message: `✅ Order #${order.id} placed successfully! Total: ₹${order.total}`,
            type: 'success',
            duration: 5000
        });
        if (onOrderPlacedWithId) {
            onOrderPlacedWithId(order.id);
        }
    };

    const handleNewOrder = () => {
        setCurrentOrderId(null);
        setShowTracker(false);
        setNotification(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
            {notification && (
                <Notification 
                    message={notification.message} 
                    type={notification.type} 
                    onClose={() => setNotification(null)} 
                    duration={notification.duration}
                />
            )}
            
            {showTracker && currentOrderId ? (
                <div className="max-w-2xl mx-auto py-8">
                    <CustomerOrderTracker orderId={currentOrderId} tableId={tableId} />
                    
                    <div className="text-center mt-8">
                        <button
                            onClick={handleNewOrder}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-lg text-lg"
                        >
                            + Place Another Order
                        </button>
                    </div>
                </div>
            ) : (
                <SimpleMenu 
                    tableId={tableId}
                    onOrderPlaced={handleOrderPlaced}
                />
            )}
        </div>
    );
};

export default QRCodeOrdering; 

// UPI Payment Configuration
// Update these values with your actual UPI details

export const UPI_CONFIG = {
    // Your UPI ID (e.g., yourname@upi, yourname@ybl, yourname@okicici)
    upiId: 'restaurant@upi',
    
    // Your business/restaurant name
    payeeName: 'Restaurant POS',
    
    // Merchant category code (5944 is for restaurants)
    merchantCategoryCode: '5944',
    
    // Currency code
    currency: 'INR',
    
    // Default transaction note template
    transactionNoteTemplate: 'Bill Payment for Order #{orderId}',
    
    // QR Code styling options
    qrCodeOptions: {
        width: 200,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }
};

// Helper function to get UPI configuration
export const getUPIConfig = () => {
    return UPI_CONFIG;
};

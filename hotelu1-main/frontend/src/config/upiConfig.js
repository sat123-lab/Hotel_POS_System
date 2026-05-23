// UPI Payment Configuration
//
// At runtime we read the merchant's UPI ID and payee name from the
// user's saved Settings (Settings → Payments → "UPI ID" and
// Settings → General → "Restaurant Name"). This way every printed
// or on-screen QR code is generated against the actual merchant UPI
// account, and any UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.)
// will auto-fill the bill amount when the QR is scanned.

// Default merchant UPI account for this deployment. The bill QR will
// pre-fill the bill amount against this account on every UPI app
// (PhonePe, Google Pay, Paytm, BHIM) right out of the box.
//
// The merchant can always override these values from
// Settings → Payment Gateways and Settings → General → Restaurant
// Name; if the user hasn't entered anything, the values below are
// used.
const FALLBACK_UPI_CONFIG = {
    upiId: '8484843035@ptsbi',
    payeeName: 'Marisetti Ravi Manikanth',
    merchantCategoryCode: '5944',
    currency: 'INR',
    transactionNoteTemplate: 'Bill Payment for Order #{orderId}',
    qrCodeOptions: {
        width: 220,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    },
};

const readSavedSettings = () => {
    try {
        const raw = localStorage.getItem('systemSettingsExtended_v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

// Helper to read the live UPI configuration. Always pulls the latest
// values from localStorage so that updates in Settings take effect
// immediately without a page reload.
export const getUPIConfig = () => {
    const saved = readSavedSettings();
    const upiId = (saved.upiId && String(saved.upiId).trim()) || FALLBACK_UPI_CONFIG.upiId;
    const payeeName =
        (saved.restaurantName && String(saved.restaurantName).trim()) ||
        FALLBACK_UPI_CONFIG.payeeName;

    return {
        ...FALLBACK_UPI_CONFIG,
        upiId,
        payeeName,
    };
};

// Backwards-compat export for any existing import sites.
export const UPI_CONFIG = FALLBACK_UPI_CONFIG;

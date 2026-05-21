/**
 * Menu & order amounts in DB are stored in INR (base).
 * Country selector converts for display only.
 */

export const BASE_CURRENCY = "INR";

/** 1 INR → target currency (approximate; update as needed) */
export const COUNTRY_CURRENCY = {
  India: {
    country: "India",
    currencySymbol: "₹",
    currencyCode: "INR",
    rateFromINR: 1,
    taxRate: 0.05,
  },
  US: {
    country: "US",
    currencySymbol: "$",
    currencyCode: "USD",
    rateFromINR: 1 / 83,
    taxRate: 0.07,
  },
  UK: {
    country: "UK",
    currencySymbol: "£",
    currencyCode: "GBP",
    rateFromINR: 1 / 105,
    taxRate: 0.2,
  },
};

export function getLocationSettingsForCountry(country) {
  return { ...(COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY.India) };
}

/** Convert amount stored in INR to selected country currency */
export function convertFromINR(amountINR, country = "India") {
  const cfg = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY.India;
  return (Number(amountINR) || 0) * cfg.rateFromINR;
}

export function formatCurrency(amountINR, locationSettings) {
  const country = locationSettings?.country || "India";
  const cfg = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY.India;
  const value = convertFromINR(amountINR, country);
  return `${cfg.currencySymbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

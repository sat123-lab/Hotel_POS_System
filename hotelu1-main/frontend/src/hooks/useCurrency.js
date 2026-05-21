import { useMemo } from "react";
import {
  convertFromINR,
  formatCurrency,
  COUNTRY_CURRENCY,
} from "../utils/currency";

export function useCurrency(locationSettings) {
  return useMemo(() => {
    const country = locationSettings?.country || "India";
    const cfg = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY.India;
    return {
      country,
      symbol: cfg.currencySymbol,
      code: cfg.currencyCode,
      taxRate: locationSettings?.taxRate ?? cfg.taxRate,
      /** Display formatted price (amount in INR base) */
      format: (amountINR) => formatCurrency(amountINR, locationSettings),
      /** Numeric value in selected currency */
      convert: (amountINR) => convertFromINR(amountINR, country),
    };
  }, [
    locationSettings?.country,
    locationSettings?.currencySymbol,
    locationSettings?.taxRate,
  ]);
}

export default useCurrency;

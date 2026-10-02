// lib/utils/format.ts
// Currency, number, date formatters for Indian locale

/**
 * Format a number as Indian Rupees (INR).
 * e.g. 63500 → "₹63,500"
 */
export function formatINR(amount: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a number with Indian comma grouping.
 * e.g. 1234567 → "12,34,567"
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a date string to a readable Indian date.
 * e.g. "2024-10-15" → "15 Oct 2024"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date string to short month-day format.
 * e.g. "2024-10-15" → "15 Oct"
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format NDVI as a percentage of vegetation health.
 * NDVI ranges from -1 to 1; crop range typically 0.2–0.9
 */
export function formatNDVI(ndvi: number): string {
  return ndvi.toFixed(2);
}

/**
 * Format hectares with appropriate label.
 */
export function formatHectares(ha: number): string {
  return `${formatNumber(ha, 2)} ha`;
}

/**
 * Format quintals with unit.
 */
export function formatQuintals(q: number): string {
  return `${formatNumber(q, 1)} qtl`;
}

/**
 * Returns a human-readable price change string.
 * e.g. 5.2 → "+5.2%", -3.1 → "-3.1%"
 */
export function formatPriceChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

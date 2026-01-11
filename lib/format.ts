/**
 * Number formatting helpers with null safety
 */

/**
 * Formats a number to a specified number of decimal places
 * Returns "—" if value is null or NaN
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return "—";
  }
  return value.toFixed(decimals);
}

/**
 * Formats a number as an integer (no decimals)
 */
export function formatInteger(value: number | null | undefined): string {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return "—";
  }
  return Math.round(value).toString();
}

/**
 * Formats a percentage value
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats a date/time string to a readable format
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) {
    return "—";
  }
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

/**
 * Gets a human-readable provider name
 */
export function formatProvider(provider: string | null | undefined): string {
  if (!provider || provider === "none") {
    return "Unknown";
  }
  const providerMap: Record<string, string> = {
    openfoodfacts: "Open Food Facts",
    usda_fdc: "USDA FoodData Central",
  };
  return providerMap[provider] || provider;
}

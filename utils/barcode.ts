import { BarcodeNormalization } from '@/types/nutrition';

/**
 * Normalizes a barcode string and generates candidate variations for lookup.
 * 
 * Rules:
 * - Trim whitespace and keep digits only
 * - If 13 digits and starts with '0', also try the 12-digit version (UPC-A)
 * - If 12 digits, also try a 13-digit version with leading zero (EAN-13)
 * - Valid lengths: 8, 12, 13, 14 (but prioritize 12/13 for this demo)
 */
export function normalizeBarcode(raw: string): BarcodeNormalization | null {
  // Clean: trim and keep digits only
  const cleaned = raw.trim().replace(/\D/g, '');
  
  if (!cleaned) {
    return null;
  }

  const length = cleaned.length;
  
  // Accept valid GTIN lengths (8, 12, 13, 14)
  if (![8, 12, 13, 14].includes(length)) {
    return null;
  }

  const candidates: string[] = [cleaned];

  // If 13 digits and starts with '0', add 12-digit version (UPC-A)
  if (length === 13 && cleaned.startsWith('0')) {
    const upcA = cleaned.substring(1);
    if (!candidates.includes(upcA)) {
      candidates.push(upcA);
    }
  }

  // If 12 digits, add 13-digit version with leading zero (EAN-13)
  if (length === 12) {
    const ean13 = `0${cleaned}`;
    if (!candidates.includes(ean13)) {
      candidates.push(ean13);
    }
  }

  return {
    normalized: cleaned,
    candidates: [...new Set(candidates)], // Remove duplicates
  };
}

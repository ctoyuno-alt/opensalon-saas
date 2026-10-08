/**
 * Helper functions for SMS formatting, templating, and segment counting.
 */

/**
 * Strips non-digit characters from a phone number.
 */
export function cleanPhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  // If user entered +0... or 0... for landline/mobile, strip leading zeros
  digits = digits.replace(/^0+/, "");
  return digits;
}

/**
 * Formats a phone number to standard E.164 (+[country][national]) format for Twilio.
 */
export function formatToE164(raw: string, defaultCountryCode = "91"): string {
  const digits = cleanPhone(raw);
  if (!digits) return "";

  // If 10 digits (e.g., standard Indian mobile), prepend defaultCountryCode
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  // If already includes country code, prepend '+'
  if (!raw.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

/**
 * Formats an Indian mobile number to 10 digits for Indian SMS Gateways (Fast2SMS / MSG91).
 */
export function formatTo10Digits(raw: string): string {
  let digits = cleanPhone(raw);
  // If it's a 12-digit number starting with 91, strip 91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.substring(2);
  }
  return digits;
}

/**
 * Interpolates variables in a template string formatted like {{variable_name}}.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = variables[key];
    if (val === undefined || val === null) {
      return "";
    }
    return String(val);
  });
}

/**
 * Standard GSM 7-bit basic character set regex.
 */
const GSM_7_REGEX = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

/**
 * Calculates character count and SMS segments for GSM-7 or Unicode SMS.
 */
export function calculateSmsSegments(text: string): {
  chars: number;
  segments: number;
  isUnicode: boolean;
  maxPerSegment: number;
} {
  const chars = text ? text.length : 0;
  if (chars === 0) {
    return { chars: 0, segments: 1, isUnicode: false, maxPerSegment: 160 };
  }

  const isUnicode = !GSM_7_REGEX.test(text);

  if (!isUnicode) {
    // GSM-7
    if (chars <= 160) {
      return { chars, segments: 1, isUnicode: false, maxPerSegment: 160 };
    }
    const segments = Math.ceil(chars / 153);
    return { chars, segments, isUnicode: false, maxPerSegment: 153 };
  } else {
    // Unicode
    if (chars <= 70) {
      return { chars, segments: 1, isUnicode: true, maxPerSegment: 70 };
    }
    const segments = Math.ceil(chars / 67);
    return { chars, segments, isUnicode: true, maxPerSegment: 67 };
  }
}

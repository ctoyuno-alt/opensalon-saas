export function cleanPhone(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
  cleaned = cleaned.replace(/^0+/, "");
  return cleaned;
}

export function createWaMeUrl(phone: string, text: string): string {
  const digits = cleanPhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

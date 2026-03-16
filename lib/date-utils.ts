/**
 * Returns a YYYY-MM-DD date string in the device's local timezone.
 * Use instead of new Date().toISOString().slice(0, 10) which is always UTC.
 */
export function localDateStr(d: Date = new Date()): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

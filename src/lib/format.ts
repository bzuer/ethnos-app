export function formatNumber(value: number, locale: string): string {
  return Number.isFinite(value) ? value.toLocaleString(locale) : '0';
}

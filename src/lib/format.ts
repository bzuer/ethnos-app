export function formatNumber(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  try {
    return n.toLocaleString('pt-BR');
  } catch {
    return String(n);
  }
}

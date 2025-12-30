export function showNotification(message: string, kind: 'success' | 'error' | 'info' = 'info', durationMs = 2000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = `temporary-message temporary-message-${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => { el.classList.add('fade-out'); }, Math.max(0, durationMs - 300));
  window.setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, durationMs);
}


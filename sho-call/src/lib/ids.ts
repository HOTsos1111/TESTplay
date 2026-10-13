// Per-tab client id: identifies which console holds Director control.
function rand(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

let cached: string | null = null;
export function clientId(): string {
  if (cached) return cached;
  try {
    cached = sessionStorage.getItem('sc-client-id');
    if (!cached) {
      cached = `tab-${rand()}`;
      sessionStorage.setItem('sc-client-id', cached);
    }
  } catch {
    cached = `tab-${rand()}`;
  }
  return cached;
}

export const requestKey = () => `req-${rand()}`;

export function localId(prefix: string): string {
  return `${prefix}_${rand().replace(/-/g, '').slice(0, 14)}`;
}

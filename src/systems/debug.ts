/**
 * Debug switches from the URL (development and automated checks only):
 *   ?debug=1  draw hitboxes
 *   ?god=1    ignore damage and bounce out of pits (for scripted browser runs)
 * Test hooks expose read-only state on window.__HH__ for browser checks.
 */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const debugFlags = {
  hitboxes: params.get('debug') === '1',
  god: params.get('god') === '1',
};

type Hook = () => unknown;
const hooks: Record<string, Hook> = {};

export function registerTestHook(name: string, fn: Hook | null): void {
  if (fn) hooks[name] = fn;
  else delete hooks[name];
  if (typeof window !== 'undefined') {
    (window as unknown as { __HH__?: Record<string, Hook> }).__HH__ = hooks;
  }
}

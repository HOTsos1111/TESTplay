// Dark/light mode, per device. Dark is the default; the choice is stored in
// localStorage and applied as <html data-theme="...">.
import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'sc-theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: Theme = read();

export function applyTheme(t: Theme = current) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f3f5f9' : '#0b0a08');
}

export function setTheme(t: Theme) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: applies to this page only */
  }
  applyTheme(t);
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  return [t, setTheme];
}

// Personal view preferences, stored per device/browser. They never change what
// anyone else sees, and nothing here is relied on for synchronisation.
import { useCallback, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

export function usePrefs<T extends object>(key: string, defaults: T): [T, (patch: Partial<T>) => void] {
  const fullKey = `sc-prefs:${key}`;
  const [value, setValue] = useState<T>(() => read(fullKey, defaults));
  const update = useCallback(
    (patch: Partial<T>) =>
      setValue((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(fullKey, JSON.stringify(next));
        } catch {
          /* storage unavailable: preference lasts for this page only */
        }
        return next;
      }),
    [fullKey],
  );
  return [value, update];
}

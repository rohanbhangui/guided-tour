import type { TourRecord, TourStorage } from './types';

export function memoryStorage(): TourStorage {
  const map = new Map<string, TourRecord>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

export interface LocalStorageAdapterOptions {
  /** Default 'guided-tour'. */
  prefix?: string;
}

/**
 * Persists tour records in `localStorage` under `${prefix}:${key}`.
 * Falls back to memory when `localStorage` is unavailable (private mode, blocked, SSR).
 */
export function localStorageAdapter({ prefix = 'guided-tour' }: LocalStorageAdapterOptions = {}): TourStorage {
  const fallback = memoryStorage();
  const full = (key: string) => `${prefix}:${key}`;

  return {
    get(key) {
      try {
        const raw = window.localStorage.getItem(full(key));
        return raw ? (JSON.parse(raw) as TourRecord) : null;
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(full(key), JSON.stringify(value));
      } catch {
        fallback.set(key, value);
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(full(key));
      } catch {
        fallback.remove(key);
      }
    },
  };
}

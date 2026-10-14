import type { StepOptions } from './types';

/* ------------------------------ Tour state store ------------------------------ */

export interface TourState {
  status: 'idle' | 'active';
  tourId: string | null;
  stepId: string | null;
  stepIndex: number;
  totalSteps: number;
  /** Resolved target for the active step; null for centered steps. */
  target: HTMLElement | null;
  /** Bumped when the active step's options change, so the UI re-reads them. */
  revision: number;
}

export const idleState: TourState = {
  status: 'idle',
  tourId: null,
  stepId: null,
  stepIndex: 0,
  totalSteps: 0,
  target: null,
  revision: 0,
};

export interface Store<T> {
  get(): T;
  set(partial: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(partial) {
      state = { ...state, ...partial };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/* ------------------------------- Step registry -------------------------------- */
// Mutable on purpose: registering steps must never trigger React re-renders.

export interface RegistryEntry {
  owner: symbol;
  el: HTMLElement | null;
  options: StepOptions;
}

export const registryKey = (tourId: string, stepId: string) => `${tourId}\u0000${stepId}`;

export class StepRegistry {
  private map = new Map<string, RegistryEntry>();
  private listeners = new Set<(key: string) => void>();

  get(key: string): RegistryEntry | undefined {
    return this.map.get(key);
  }

  /** Register or update. Returns false if another owner already holds a live element for this key. */
  upsert(key: string, owner: symbol, patch: Partial<Omit<RegistryEntry, 'owner'>>): boolean {
    const existing = this.map.get(key);
    const conflict = !!existing && existing.owner !== owner && !!existing.el && !!patch.el;
    const base = existing && existing.owner === owner ? existing : { owner, el: null, options: {} };
    this.map.set(key, { ...base, ...patch, owner });
    this.emit(key);
    return !conflict;
  }

  remove(key: string, owner: symbol) {
    if (this.map.get(key)?.owner === owner) {
      this.map.delete(key);
      this.emit(key);
    }
  }

  subscribe(listener: (key: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(key: string) {
    this.listeners.forEach((l) => l(key));
  }
}

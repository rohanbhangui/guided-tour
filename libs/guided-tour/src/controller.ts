import { warn } from './dev';
import { StepRegistry, createStore, idleState, registryKey, type TourState } from './store';
import type {
  AdvanceOn,
  ConfigStep,
  KeyboardOptions,
  StepContext,
  StepOptions,
  StepIdOf,
  StepTarget,
  TourDefinition,
  TourLifecycleContext,
  TourOptions,
  TourRecord,
  TourStorage,
} from './types';

export type ResolvedTourOptions = Required<Omit<TourOptions, 'keyboard' | 'width'>> & {
  keyboard: Required<KeyboardOptions>;
  width?: number | string;
};

export const DEFAULT_TOUR_OPTIONS: ResolvedTourOptions = {
  progress: 'counter',
  maxDots: 5,
  showClose: true,
  showPrev: true,
  dismissOnOverlayClick: false,
  overlay: true,
  highlight: true,
  keyboard: { enabled: true, arrows: true, escape: 'hold', escapeHoldMs: 500 },
  missingTarget: 'skip',
  waitTimeout: 3000,
};

export interface ControllerConfig {
  storage: TourStorage;
  defaults?: TourOptions;
  disabled?: boolean;
}

export interface StartOptions<Id extends string = string> {
  /** Step index or id to start at. */
  step?: number | Id;
}

export interface StopOptions {
  /** Record the tour as dismissed so it won't auto-start again. Default true. */
  persist?: boolean;
}

export interface ResetOptions {
  /** Start the tour right after clearing it (single tour only). */
  restart?: boolean;
}

/** Tours are passed as their definition objects, never id strings, so typos fail to compile. */
export interface TourActions {
  /** Start a tour (even if already seen). `step` is checked against the tour's step ids. */
  start<T extends TourDefinition<any>>(tour: T, options?: StartOptions<StepIdOf<T>>): Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
  stop(options?: StopOptions): void;
  /** Clear a tour's record so it shows again. No tour: clear all registered tours. */
  reset(tour?: TourDefinition<any>, options?: ResetOptions): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  next(): void;
  prev(): void;
  goTo(step: number | string): void;
  /** `next()`, but only if `step` of `tour` is the step showing. Use it to finish `advanceOn: 'manual'` steps. */
  advance<T extends TourDefinition<any>>(tour: T, step: StepIdOf<T>): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  hasSeen(tour: TourDefinition<any>): boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const OPTION_KEYS = [
  'progress',
  'maxDots',
  'width',
  'showClose',
  'showPrev',
  'dismissOnOverlayClick',
  'overlay',
  'highlight',
  'missingTarget',
  'waitTimeout',
] as const satisfies readonly (keyof TourOptions)[];

const defined = <T extends object>(o: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

const storageKey = (tour: TourDefinition) => `${tour.id}:v${tour.version ?? 1}`;
const stepIdOf = (entry: string | ConfigStep) => (typeof entry === 'string' ? entry : entry.id);

function resolveTarget(target: StepTarget): HTMLElement | null {
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target);
  if (typeof target === 'function') return target();
  return target.current;
}

/** Connected and rendered (not inside `display: none`). */
function visible(el: HTMLElement | null | undefined): HTMLElement | null {
  if (!el || !el.isConnected) return null;
  if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return null;
  return el;
}

/**
 * Framework-agnostic tour engine. The React layer is a thin binding over this:
 * steps register into `registry`, UI subscribes to `store`.
 */
export class TourController {
  readonly store = createStore<TourState>(idleState);
  readonly registry = new StepRegistry();
  readonly actions: TourActions;

  config: ControllerConfig;
  private tours = new Map<string, TourDefinition>();
  private records = new Map<string, TourRecord | null>();
  private lastInline = new Map<string, StepOptions>();
  private activeTour: TourDefinition | null = null;
  private loaded = false;
  private token = 0;
  private shownCount = 0;
  private attemptedAuto = new Set<string>();
  private autoTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingAuto: string | null = null;
  private unsubRegistry: (() => void) | undefined;

  constructor(config: ControllerConfig) {
    this.config = config;
    this.actions = {
      start: (tour, o) => this.start(tour.id, o),
      stop: (o) => this.stop(o),
      reset: (tour, o) => this.reset(tour?.id, o),
      next: () => this.next(),
      prev: () => this.prev(),
      goTo: (s) => this.goTo(s),
      advance: (tour, step) => this.advanceFrom(tour.id, step),
      hasSeen: (tour) => this.hasSeen(tour.id),
    };
  }

  /* ------------------------------- lifecycle ------------------------------- */

  async init() {
    this.unsubRegistry = this.registry.subscribe((key) => this.onRegistryChange(key));
    if (!this.loaded) {
      await this.loadRecords([...this.tours.values()]);
      this.loaded = true;
    }
    this.scheduleAutoStart();
  }

  dispose() {
    this.unsubRegistry?.();
    this.cancelAutoStart();
    this.token++;
    this.activeTour = null;
    this.store.set(idleState);
  }

  setTours(tours: readonly TourDefinition<string>[]) {
    const next = new Map<string, TourDefinition>();
    for (const tour of tours) {
      if (next.has(tour.id)) warn(`Duplicate tour id "${tour.id}". Tour ids must be unique.`);
      next.set(tour.id, tour);
    }
    const added = [...next.values()].filter((t) => !this.records.has(storageKey(t)));
    this.tours = next;
    if (this.loaded && added.length) {
      void this.loadRecords(added).then(() => this.scheduleAutoStart());
    }
  }

  getTour(id: string | null) {
    return id ? this.tours.get(id) : undefined;
  }

  /** Library defaults < provider `defaults` < tour definition. */
  getTourOptions(tour: TourDefinition): ResolvedTourOptions {
    const d = this.config.defaults ?? {};
    const resolved = { ...DEFAULT_TOUR_OPTIONS } as Record<string, unknown>;
    for (const key of OPTION_KEYS) {
      const value = tour[key] ?? d[key];
      if (value !== undefined) resolved[key] = value;
    }
    resolved.keyboard = { ...DEFAULT_TOUR_OPTIONS.keyboard, ...defined(d.keyboard), ...defined(tour.keyboard) };
    return resolved as ResolvedTourOptions;
  }

  /** Config step merged with its inline counterpart (inline wins). */
  getStepOptions(tourId: string, stepId: string): StepOptions & { target?: StepTarget } {
    const tour = this.tours.get(tourId);
    const entry = tour?.steps.find((s) => stepIdOf(s) === stepId);
    const config = entry && typeof entry === 'object' ? entry : {};
    const key = registryKey(tourId, stepId);
    const inline = this.registry.get(key)?.options ?? this.lastInline.get(key) ?? {};
    return { ...config, ...inline };
  }

  /* -------------------------------- actions -------------------------------- */

  hasSeen(tourId: string) {
    const tour = this.tours.get(tourId);
    return !!tour && !!this.records.get(storageKey(tour));
  }

  async start(tourId: string, { step = 0 }: StartOptions = {}) {
    if (this.config.disabled) return;
    const tour = this.tours.get(tourId);
    if (!tour) return warn(`start(): no tour registered with id "${tourId}".`);
    this.cancelAutoStart();
    if (this.activeTour) this.finish('dismissed', false, true);

    this.activeTour = tour;
    this.shownCount = 0;
    tour.onStart?.(this.lifecycle(0, null));
    await this.show(this.indexOf(tour, step), 1);
  }

  stop({ persist = true }: StopOptions = {}) {
    if (this.activeTour) this.finish('dismissed', persist);
  }

  reset(tourId?: string, { restart = false }: ResetOptions = {}) {
    const ids = tourId ? [tourId] : [...this.tours.keys()];
    if (this.activeTour && ids.includes(this.activeTour.id)) this.finish('dismissed', false);
    for (const id of ids) {
      const tour = this.tours.get(id);
      if (!tour) {
        warn(`reset(): no tour registered with id "${id}".`);
        continue;
      }
      const key = storageKey(tour);
      this.records.set(key, null);
      void this.config.storage.remove(key);
      this.attemptedAuto.delete(id);
    }
    if (restart && tourId) void this.start(tourId);
  }

  next() {
    const s = this.store.get();
    if (this.activeTour && s.status === 'active') void this.show(s.stepIndex + 1, 1);
  }

  prev() {
    const s = this.store.get();
    if (this.activeTour && s.status === 'active' && s.stepIndex > 0) void this.show(s.stepIndex - 1, -1);
  }

  goTo(step: number | string) {
    if (!this.activeTour) return;
    const index = this.indexOf(this.activeTour, step);
    void this.show(index, index >= this.store.get().stepIndex ? 1 : -1);
  }

  /** Advance only if this exact step is showing, so a stale or unrelated call can't skip a step. */
  advanceFrom(tourId: string, stepId: string) {
    const s = this.store.get();
    if (s.status === 'active' && s.tourId === tourId && s.stepId === stepId) this.next();
  }

  /** How the active step advances. A 'click' step with no target falls back to 'next' so it can't get stuck. */
  activeAdvanceOn(): AdvanceOn {
    const s = this.store.get();
    if (s.status !== 'active' || !s.tourId || !s.stepId) return 'next';
    const declared = this.getStepOptions(s.tourId, s.stepId).advanceOn ?? 'next';
    return declared === 'click' && !s.target ? 'next' : declared;
  }

  /** Tour UI navigation (dots) can't jump past an action step the user hasn't done. */
  canGoTo(index: number) {
    const s = this.store.get();
    const tour = this.activeTour;
    if (!tour || s.status !== 'active' || index < 0 || index >= tour.steps.length) return false;
    if (index <= s.stepIndex) return true;
    if (this.activeAdvanceOn() !== 'next') return false;
    for (let i = s.stepIndex + 1; i < index; i++) {
      if ((this.getStepOptions(tour.id, stepIdOf(tour.steps[i]!)).advanceOn ?? 'next') !== 'next') return false;
    }
    return true;
  }

  /* ------------------------------- internals ------------------------------- */

  private indexOf(tour: TourDefinition, step: number | string) {
    if (typeof step === 'number') return step;
    const i = tour.steps.findIndex((s) => stepIdOf(s) === step);
    if (i < 0) warn(`Tour "${tour.id}" has no step "${step}".`);
    return Math.max(i, 0);
  }

  private lifecycle(stepIndex: number, stepId: string | null): TourLifecycleContext {
    const tour = this.activeTour!;
    return { tourId: tour.id, stepIndex, stepId, totalSteps: tour.steps.length };
  }

  private async show(index: number, dir: 1 | -1): Promise<void> {
    const tour = this.activeTour;
    if (!tour) return;
    const token = ++this.token;

    if (index >= tour.steps.length) return this.finish('completed', this.shownCount > 0);
    if (index < 0) return;

    const entry = tour.steps[index]!;
    const stepId = stepIdOf(entry);
    const config = typeof entry === 'object' ? entry : undefined;
    const key = registryKey(tour.id, stepId);
    const ctx: StepContext = { tourId: tour.id, stepId, stepIndex: index, totalSteps: tour.steps.length };
    const opts = this.getTourOptions(tour);

    const onBeforeShow = config?.onBeforeShow ?? this.registry.get(key)?.options.onBeforeShow;
    if (onBeforeShow) {
      try {
        await onBeforeShow(ctx);
      } catch (err) {
        warn(`onBeforeShow for step "${stepId}" threw: ${String(err)}`);
      }
      if (token !== this.token) return;
    }

    const selfContained = config?.content !== undefined;
    const lookup = selfContained
      ? config!.target
        ? () => visible(resolveTarget(config!.target!))
        : null
      : () => visible(this.registry.get(key)?.el);

    let target = lookup ? await this.waitFor(lookup, opts.waitTimeout, token) : null;
    if (token !== this.token) return;

    if (lookup && !target) {
      const hasContent = selfContained || !!this.registry.get(key);
      if (opts.missingTarget === 'center' && hasContent) {
        target = null;
      } else {
        warn(
          selfContained
            ? `Target for step "${stepId}" in tour "${tour.id}" not found; skipping.`
            : `Step "${stepId}" in tour "${tour.id}" is not mounted (no <Step id="${stepId}">); skipping.`,
        );
        return this.show(index + dir, dir);
      }
    }

    this.shownCount++;
    this.store.set({
      status: 'active',
      tourId: tour.id,
      stepId,
      stepIndex: index,
      totalSteps: tour.steps.length,
      target,
    });
    tour.onStepChange?.(this.lifecycle(index, stepId));
    this.getStepOptions(tour.id, stepId).onAfterShow?.(ctx);
  }

  private waitFor(check: () => HTMLElement | null, timeout: number, token: number): Promise<HTMLElement | null> {
    const found = check();
    if (found || timeout <= 0) return Promise.resolve(found);
    return new Promise((resolve) => {
      const done = (value: HTMLElement | null) => {
        clearInterval(interval);
        clearTimeout(timer);
        unsub();
        resolve(value);
      };
      const tick = () => {
        if (token !== this.token) return done(null);
        const el = check();
        if (el) done(el);
      };
      const interval = setInterval(tick, 50);
      const timer = setTimeout(() => done(null), timeout);
      const unsub = this.registry.subscribe(tick);
    });
  }

  private finish(status: TourRecord['status'], persist: boolean, silent = false) {
    const tour = this.activeTour;
    if (!tour) return;
    const s = this.store.get();
    this.token++;
    this.activeTour = null;

    if (persist) {
      const key = storageKey(tour);
      const record: TourRecord = { status, step: s.stepIndex, updatedAt: new Date().toISOString() };
      this.records.set(key, record);
      void this.config.storage.set(key, record);
    }
    this.store.set(idleState);

    if (!silent) {
      const ctx = { tourId: tour.id, stepIndex: s.stepIndex, stepId: s.stepId, totalSteps: tour.steps.length };
      (status === 'completed' ? tour.onComplete : tour.onDismiss)?.(ctx);
      this.scheduleAutoStart();
    }
  }

  private async loadRecords(tours: TourDefinition[]) {
    await Promise.all(
      tours.map(async (tour) => {
        const key = storageKey(tour);
        try {
          this.records.set(key, await this.config.storage.get(key));
        } catch {
          this.records.set(key, null);
        }
      }),
    );
  }

  /** Idempotent: safe to call repeatedly (StrictMode re-runs effects). */
  private scheduleAutoStart() {
    if (!this.loaded || this.config.disabled || this.activeTour || this.pendingAuto) return;
    for (const tour of this.tours.values()) {
      if (!tour.autoStart || this.attemptedAuto.has(tour.id) || this.hasSeen(tour.id)) continue;
      const run = () => {
        this.pendingAuto = null;
        this.attemptedAuto.add(tour.id);
        if (!this.activeTour) void this.start(tour.id);
      };
      if (tour.autoStartDelay) {
        this.pendingAuto = tour.id;
        this.autoTimer = setTimeout(run, tour.autoStartDelay);
      } else run();
      return;
    }
  }

  private cancelAutoStart() {
    clearTimeout(this.autoTimer);
    this.pendingAuto = null;
  }

  private onRegistryChange(key: string) {
    const entry = this.registry.get(key);
    if (entry) this.lastInline.set(key, entry.options);

    const s = this.store.get();
    if (s.status !== 'active' || !s.tourId || !s.stepId || key !== registryKey(s.tourId, s.stepId)) return;
    // Inline step (re)mounted or unmounted while active: follow its element.
    const config = this.getTour(s.tourId)?.steps[s.stepIndex];
    if (typeof config === 'object' && config.content !== undefined) return;
    const el = visible(entry?.el) ?? null;
    if (el !== s.target) this.store.set({ target: el });
  }
}

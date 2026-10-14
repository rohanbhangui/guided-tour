import type { ComponentType, ReactNode, RefObject } from 'react';

/* ---------------------------------- Positioning ---------------------------------- */

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';

export type PlacementPreset =
  | Side
  | `${Side}-start`
  | `${Side}-end`
  /** Pick the side with the most room. */
  | 'auto'
  /** Centered in the viewport. Default for steps without a target. */
  | 'center';

/** A number is px. `%` is relative to the reference box (width for x, height for y). */
export type Length = number | `${number}px` | `${number}%`;

/** Beside the target, like the presets but with tunable offsets. */
export interface AnchoredPlacement {
  side: Side;
  align?: Align;
  /** Gap between target and popover. Default 12. */
  offset?: Length;
  /** Nudge along the edge (+ = toward end). Default 0. */
  shift?: Length;
  /** Flip to the opposite side if out of view. Default true. */
  flip?: boolean;
}

/** CSS-style insets, as if the reference box were `position: relative`. */
export interface InsetPlacement {
  top?: Length;
  right?: Length;
  bottom?: Length;
  left?: Length;
  relativeTo?: 'target' | 'viewport';
}

export type Placement = PlacementPreset | AnchoredPlacement | InsetPlacement;

/* ------------------------------------- Steps ------------------------------------- */

export type StepTarget =
  | string
  | RefObject<HTMLElement | null>
  | (() => HTMLElement | null);

export interface StepContext {
  tourId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
}

/** Options shared by inline and config steps. */
export interface StepOptions {
  title?: ReactNode;
  content?: ReactNode;
  placement?: Placement;
  /** Cut a hole in the overlay around the target. Default true when the step has a target. */
  spotlight?: boolean;
  /** Darken the rest of the page. Overrides the tour setting. */
  overlay?: boolean;
  /** Glowing ring around the target's edge. Overrides the tour setting. */
  highlight?: boolean;
  /** Popover width for this step (number = px, or any CSS length). Overrides the tour setting. */
  width?: number | string;
  /** px around the target. Default 8. */
  spotlightPadding?: number;
  /** px. Default 6. */
  spotlightRadius?: number;
  /** Allow clicking the highlighted element. Default false. */
  interactive?: boolean;
  /** Default true. */
  scrollIntoView?: boolean | ScrollIntoViewOptions;
  showPrev?: boolean;
  showClose?: boolean;
  nextLabel?: ReactNode;
  prevLabel?: ReactNode;
  onBeforeShow?: (ctx: StepContext) => void | Promise<void>;
  onAfterShow?: (ctx: StepContext) => void;
}

/**
 * A step defined in the tour definition.
 * - With `content`: a self-contained step (optionally with a `target`).
 * - Without `content`: merged with the inline step of the same id
 *   (useful for an `onBeforeShow` that must run before the inline step mounts).
 */
export interface ConfigStep<Id extends string = string> extends StepOptions {
  id: Id;
  target?: StepTarget;
}

export type StepEntry<Id extends string = string> = Id | ConfigStep<Id>;

/* ------------------------------------- Tours ------------------------------------- */

export type ProgressStyle = 'dots' | 'counter' | 'both' | 'none';

export interface KeyboardOptions {
  /** Default true. */
  enabled?: boolean;
  /** ←/→ navigate, Enter advances. Default true. */
  arrows?: boolean;
  /** Default 'hold'. */
  escape?: 'tap' | 'hold' | false;
  /** Default 500. */
  escapeHoldMs?: number;
}

export interface TourOptions {
  /** Default 'counter'. */
  progress?: ProgressStyle;
  /**
   * Popover width (number = px, or any CSS length like '28rem').
   * Default: content-sized up to `--gt-popover-width` (360px). Never wider than the viewport.
   */
  width?: number | string;
  /** Past this many steps, dots become a sliding window. Default 5. */
  maxDots?: number;
  /** Default true. */
  showClose?: boolean;
  /** Default true (always hidden on the first step). */
  showPrev?: boolean;
  /** Default false. */
  dismissOnOverlayClick?: boolean;
  keyboard?: KeyboardOptions;
  /**
   * Darken the page behind the popover. Default true.
   * With `false`, the page stays fully clickable (popover-only mode).
   */
  overlay?: boolean;
  /** Glowing ring around the target's edge. Default true. Style via `--gt-ring-*` CSS variables. */
  highlight?: boolean;
  /** What to do when a step's target can't be found after `waitTimeout`. Default 'skip'. */
  missingTarget?: 'skip' | 'center';
  /** How long to wait for a step's target to appear, in ms. Default 3000. */
  waitTimeout?: number;
}

export interface TourLifecycleContext {
  tourId: string;
  stepIndex: number;
  stepId: string | null;
  totalSteps: number;
}

export interface TourDefinition<Id extends string = string> extends TourOptions {
  /** Unique across the app. Also used for the storage key. */
  id: string;
  /** Bump to re-show the tour to everyone. Default 1. */
  version?: number;
  steps: readonly StepEntry<Id>[];
  /** Start on mount if not already seen. Default false. */
  autoStart?: boolean;
  /** ms. Default 0. */
  autoStartDelay?: number;
  onStart?: (ctx: TourLifecycleContext) => void;
  onStepChange?: (ctx: TourLifecycleContext) => void;
  onComplete?: (ctx: TourLifecycleContext) => void;
  onDismiss?: (ctx: TourLifecycleContext) => void;
}

/** Extracts the step id union from a tour definition. */
export type StepIdOf<T> = T extends TourDefinition<infer Id> ? Id : string;

/* ------------------------------------ Storage ------------------------------------ */

export interface TourRecord {
  status: 'completed' | 'dismissed';
  step: number;
  updatedAt: string;
}

export interface TourStorage {
  get(key: string): TourRecord | null | Promise<TourRecord | null>;
  set(key: string, value: TourRecord): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

/* -------------------------------------- UI --------------------------------------- */

export interface TourLabels {
  next?: ReactNode;
  prev?: ReactNode;
  done?: ReactNode;
  close?: string;
  stepCounter?: (current: number, total: number) => ReactNode;
  goToStep?: (step: number) => string;
}

export interface TourClassNames {
  overlay?: string;
  ring?: string;
  floating?: string;
  popover?: string;
  header?: string;
  title?: string;
  content?: string;
  footer?: string;
  progress?: string;
  dots?: string;
  dot?: string;
  counter?: string;
  button?: string;
  primaryButton?: string;
  close?: string;
  arrow?: string;
}

export interface PopoverProps {
  tourId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  title?: ReactNode;
  content?: ReactNode;
  progress: ProgressStyle;
  maxDots: number;
  showClose: boolean;
  showPrev: boolean;
  nextLabel: ReactNode;
  prevLabel: ReactNode;
  labels: Required<TourLabels>;
  classNames: TourClassNames;
  /** Ids to wire up `aria-labelledby` / `aria-describedby`. */
  titleId: string;
  contentId: string;
  /** True while Escape is being held down. */
  escapeHolding: boolean;
  escapeHoldMs: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  close: () => void;
}

export interface TourComponents {
  Popover?: ComponentType<PopoverProps>;
}

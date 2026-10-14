import {
  arrow,
  autoPlacement,
  computePosition,
  flip,
  offset,
  shift,
  type Middleware,
  type Placement as FloatingPlacement,
} from '@floating-ui/dom';
import type { InsetPlacement, Length, Placement, Side } from './types';

const VIEWPORT_MARGIN = 8;

export type PlacementMode =
  | { kind: 'center' }
  | {
      kind: 'anchored';
      placement: FloatingPlacement | 'auto';
      offset: Length;
      shift: Length;
      flip: boolean;
    }
  | { kind: 'inset'; inset: InsetPlacement; relativeTo: 'target' | 'viewport' };

export function toPx(len: Length | undefined, base: number): number {
  if (len === undefined) return 0;
  if (typeof len === 'number') return len;
  const n = parseFloat(len);
  return len.endsWith('%') ? (n / 100) * base : n;
}

export function normalizePlacement(placement: Placement | undefined, hasTarget: boolean): PlacementMode {
  if (placement === 'center' || (!hasTarget && (placement === undefined || typeof placement === 'string'))) {
    return { kind: 'center' };
  }
  if (placement === undefined || typeof placement === 'string') {
    return { kind: 'anchored', placement: placement ?? 'auto', offset: 12, shift: 0, flip: true };
  }
  if ('side' in placement) {
    const align = placement.align ?? 'center';
    return {
      kind: 'anchored',
      placement: (align === 'center' ? placement.side : `${placement.side}-${align}`) as FloatingPlacement,
      offset: placement.offset ?? 12,
      shift: placement.shift ?? 0,
      flip: placement.flip ?? true,
    };
  }
  return {
    kind: 'inset',
    inset: placement,
    relativeTo: hasTarget ? (placement.relativeTo ?? 'target') : 'viewport',
  };
}

export interface PositionResult {
  x: number;
  y: number;
  side?: Side;
  arrow?: { x?: number; y?: number };
}

const viewportRect = () => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

const clamp = (value: number, size: number, viewport: number) =>
  Math.min(Math.max(value, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewport - size - VIEWPORT_MARGIN));

/** Inset placement is plain arithmetic on the measured rect. No styles touch the target. */
function computeInset(mode: Extract<PlacementMode, { kind: 'inset' }>, target: HTMLElement | null, floating: HTMLElement): PositionResult {
  const ref = mode.relativeTo === 'target' && target ? target.getBoundingClientRect() : viewportRect();
  const { width: w, height: h } = floating.getBoundingClientRect();
  const { top, right, bottom, left } = mode.inset;

  let x = ref.left + (ref.width - w) / 2;
  if (left !== undefined) x = ref.left + toPx(left, ref.width);
  else if (right !== undefined) x = ref.left + ref.width - toPx(right, ref.width) - w;

  let y = ref.top + (ref.height - h) / 2;
  if (top !== undefined) y = ref.top + toPx(top, ref.height);
  else if (bottom !== undefined) y = ref.top + ref.height - toPx(bottom, ref.height) - h;

  return { x: clamp(x, w, window.innerWidth), y: clamp(y, h, window.innerHeight) };
}

export async function computeFloatingPosition(
  mode: PlacementMode,
  target: HTMLElement | null,
  floating: HTMLElement,
  arrowEl: HTMLElement | null,
): Promise<PositionResult | null> {
  if (mode.kind === 'center') return null;
  if (mode.kind === 'inset' || !target) {
    return computeInset(mode.kind === 'inset' ? mode : { kind: 'inset', inset: {}, relativeTo: 'viewport' }, target, floating);
  }

  const rect = target.getBoundingClientRect();
  const isVertical = (side: string) => side.startsWith('top') || side.startsWith('bottom');
  const main = isVertical(mode.placement) ? rect.height : rect.width;
  const cross = isVertical(mode.placement) ? rect.width : rect.height;

  const middleware: Middleware[] = [
    offset({ mainAxis: toPx(mode.offset, main), crossAxis: toPx(mode.shift, cross) }),
    mode.placement === 'auto'
      ? autoPlacement({ padding: VIEWPORT_MARGIN })
      : mode.flip
        ? // If neither the side nor its opposite fits (small screens), try the perpendicular sides.
          flip({ padding: VIEWPORT_MARGIN, fallbackAxisSideDirection: 'end' })
        : undefined,
    // crossAxis: also clamp along the main axis so the popover never leaves the viewport,
    // even if that means overlapping a target that's bigger than the screen.
    shift({ padding: VIEWPORT_MARGIN, crossAxis: true }),
    arrowEl ? arrow({ element: arrowEl, padding: 10 }) : undefined,
  ].filter((m): m is Middleware => !!m);

  const { x, y, placement, middlewareData } = await computePosition(target, floating, {
    strategy: 'fixed',
    placement: mode.placement === 'auto' ? 'bottom' : mode.placement,
    middleware,
  });

  return { x, y, side: placement.split('-')[0] as Side, arrow: middlewareData.arrow };
}

/** SVG path for a full-viewport rect with a rounded-rect hole (fill-rule: evenodd). */
export function spotlightPath(
  hole: { x: number; y: number; width: number; height: number; radius: number } | null,
): string {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const outer = `M0 0H${W}V${H}H0Z`;
  if (!hole) return outer;
  const { x, y, width: w, height: h } = hole;
  const r = Math.min(hole.radius, w / 2, h / 2);
  return (
    `${outer}M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}` +
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

import { autoUpdate } from '@floating-ui/dom';
import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import type { TourController } from '../controller';
import type { UIConfig } from '../context';
import { computeFloatingPosition, normalizePlacement, spotlightPath } from '../position';
import { warn } from '../dev';
import { registryKey, type TourState } from '../store';
import type { PopoverProps, Side, TourLabels } from '../types';
import { DefaultPopover, cx } from './Popover';

export const DEFAULT_LABELS: Required<TourLabels> = {
  next: 'Next',
  prev: 'Back',
  done: 'Done',
  close: 'Close tour',
  stepCounter: (current, total) => `${current} of ${total}`,
  goToStep: (step) => `Go to step ${step}`,
};

const STATIC_SIDE: Record<Side, Side> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function trapFocus(e: KeyboardEvent, container: HTMLElement) {
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!first || !last) return e.preventDefault();
  if (!container.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && (active === first || active === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

interface TourLayerProps {
  controller: TourController;
  ui: UIConfig;
  state: TourState;
}

/** Everything the tour renders while active. Mounted in a portal only while a tour runs. */
export function TourLayer({ controller, ui, state }: TourLayerProps) {
  const tourId = state.tourId!;
  const stepId = state.stepId!;
  const tour = controller.getTour(tourId)!;
  const target = state.target;

  // Re-render when the active inline step's props change (live content). Only this layer re-renders.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const key = registryKey(tourId, stepId);
  useLayoutEffect(() => controller.registry.subscribe((k) => k === key && rerender()), [controller, key]);

  const step = controller.getStepOptions(tourId, stepId);
  const opts = controller.getTourOptions(tour);
  const labels = { ...DEFAULT_LABELS, ...ui.labels };
  const classNames = ui.classNames ?? {};
  const Popover = ui.components?.Popover ?? DefaultPopover;

  const mode = normalizePlacement(step.placement, !!target);
  const placementKey = JSON.stringify(step.placement ?? null);
  const overlay = step.overlay ?? opts.overlay;
  const highlight = !!target && (step.highlight ?? opts.highlight);
  const spotlight = !!target && step.spotlight !== false;
  const padding = step.spotlightPadding ?? 8;
  const radius = step.spotlightRadius ?? 6;
  const advanceOn = controller.activeAdvanceOn();
  const interactive = advanceOn === 'click' || (step.interactive ?? advanceOn === 'manual');
  const width = step.width ?? opts.width;
  const widthCss = typeof width === 'number' ? `${width}px` : width;

  const layerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  const titleId = useId();
  const contentId = useId();

  /* Positioning: written straight to the DOM on scroll/resize, no React re-renders per frame. */
  useLayoutEffect(() => {
    const floating = floatingRef.current!;
    const path = pathRef.current!;
    let cancelled = false;

    const update = async () => {
      let box = null;
      if (target) {
        const r = target.getBoundingClientRect();
        box = { x: r.left - padding, y: r.top - padding, width: r.width + padding * 2, height: r.height + padding * 2, radius };
      }
      path.setAttribute('d', spotlightPath(spotlight ? box : null));
      const place = (el: HTMLElement | null, show: boolean) => {
        if (!el) return;
        el.style.display = show && box ? 'block' : 'none';
        if (show && box) {
          Object.assign(el.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
        }
      };
      place(blockerRef.current, true);
      place(ringRef.current, highlight);

      const pos = await computeFloatingPosition(mode, target, floating, arrowRef.current);
      if (cancelled) return;
      floating.style.left = pos ? `${pos.x}px` : '';
      floating.style.top = pos ? `${pos.y}px` : '';
      if (pos?.side) floating.dataset.side = pos.side;
      else delete floating.dataset.side;
      const arrowEl = arrowRef.current;
      if (arrowEl && pos?.side && pos.arrow) {
        Object.assign(arrowEl.style, {
          left: pos.arrow.x != null ? `${pos.arrow.x}px` : '',
          top: pos.arrow.y != null ? `${pos.arrow.y}px` : '',
          right: '',
          bottom: '',
          [STATIC_SIDE[pos.side]]: '-6px',
        });
      }
      if (!positioned.current) {
        positioned.current = true;
        floating.style.visibility = 'visible';
        // Hidden elements can't take focus, so the first step focuses here, once visible.
        floating.focus({ preventScroll: true });
      }
    };

    let stop: () => void;
    if (target) {
      stop = autoUpdate(target, floating, () => void update());
    } else {
      void update();
      const onResize = () => void update();
      window.addEventListener('resize', onResize);
      stop = () => window.removeEventListener('resize', onResize);
    }
    return () => {
      cancelled = true;
      stop();
    };
    // `mode` is derived from placementKey + target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, stepId, placementKey, spotlight, highlight, padding, radius]);

  /* Step change: animate the move, scroll target into view, move focus into the popover. */
  useLayoutEffect(() => {
    const layer = layerRef.current!;
    layer.dataset.animating = '';
    const t = setTimeout(() => delete layer.dataset.animating, 350);

    if (target && step.scrollIntoView !== false) {
      const r = target.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) {
        target.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          ...(typeof step.scrollIntoView === 'object' ? step.scrollIntoView : {}),
        });
      }
    }
    if (positioned.current) floatingRef.current?.focus({ preventScroll: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, target]);

  /* Action steps: clicking the target advances. */
  useEffect(() => {
    if (step.advanceOn === 'click' && !target) {
      warn(`Step "${stepId}" uses advanceOn: 'click' but has no target; falling back to the Next button.`);
    }
    if (advanceOn !== 'click' || !target) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Deferred so the app's own click handler (React's, at the root) runs first.
    const onClick = () => {
      timer = setTimeout(() => controller.advanceFrom(tourId, stepId));
    };
    target.addEventListener('click', onClick);
    return () => {
      target.removeEventListener('click', onClick);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, tourId, stepId, target, advanceOn]);

  /* Keyboard: listeners exist only while a tour is active. */
  const [escapeHolding, setEscapeHolding] = useState(false);
  const latest = useRef({ keyboard: opts.keyboard, interactive, advanceOn });
  latest.current = { keyboard: opts.keyboard, interactive, advanceOn };

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHold = () => {
      if (!holdTimer) return;
      clearTimeout(holdTimer);
      holdTimer = undefined;
      setEscapeHolding(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const { keyboard: kb, interactive, advanceOn } = latest.current;
      if (!kb.enabled) return;
      switch (e.key) {
        case 'Escape':
          if (kb.escape === false) return;
          e.preventDefault();
          e.stopPropagation();
          if (kb.escape === 'tap') return controller.stop();
          if (!e.repeat && !holdTimer) {
            setEscapeHolding(true);
            holdTimer = setTimeout(() => {
              holdTimer = undefined;
              setEscapeHolding(false);
              controller.stop();
            }, kb.escapeHoldMs);
          }
          return;
        case 'ArrowRight':
        case 'ArrowLeft':
          if (!kb.arrows || isEditable(e.target)) return;
          e.preventDefault();
          if (e.key === 'ArrowLeft') return controller.prev();
          return advanceOn === 'next' && controller.next();
        case 'Enter':
          if (kb.arrows && advanceOn === 'next' && e.target === floatingRef.current) {
            e.preventDefault();
            controller.next();
          }
          return;
        case 'Tab':
          if (!interactive && floatingRef.current) trapFocus(e, floatingRef.current);
          return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => e.key === 'Escape' && cancelHold();

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', cancelHold);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', cancelHold);
      clearTimeout(holdTimer);
    };
  }, [controller]);

  const isFirst = state.stepIndex === 0;
  const isLast = state.stepIndex === state.totalSteps - 1;
  const popoverProps: PopoverProps = {
    tourId,
    stepId,
    stepIndex: state.stepIndex,
    totalSteps: state.totalSteps,
    isFirst,
    isLast,
    title: step.title,
    content: step.content,
    progress: opts.progress,
    maxDots: opts.maxDots,
    showClose: step.showClose ?? opts.showClose,
    showPrev: step.showPrev ?? opts.showPrev,
    nextLabel: step.nextLabel ?? (isLast ? labels.done : labels.next),
    prevLabel: step.prevLabel ?? labels.prev,
    labels,
    classNames,
    titleId,
    contentId,
    advanceOn,
    canGoTo: (i) => controller.canGoTo(i),
    escapeHolding,
    escapeHoldMs: opts.keyboard.escapeHoldMs,
    next: () => advanceOn === 'next' && controller.next(),
    prev: controller.actions.prev,
    goTo: (i) => controller.canGoTo(i) && controller.goTo(i),
    close: () => controller.stop(),
  };

  return (
    <div ref={layerRef} className="gt-layer">
      <svg className={cx('gt-overlay', classNames.overlay)} data-hidden={!overlay || undefined} aria-hidden="true">
        <path
          ref={pathRef}
          fillRule="evenodd"
          onClick={opts.dismissOnOverlayClick ? () => controller.stop() : undefined}
        />
      </svg>
      {!interactive && <div ref={blockerRef} className="gt-blocker" />}
      {highlight && (
        <div
          ref={ringRef}
          className={cx('gt-ring', classNames.ring)}
          style={{ '--gt-ring-radius': `${radius}px` } as CSSProperties}
          aria-hidden="true"
        />
      )}
      <div
        ref={floatingRef}
        className={cx('gt-floating', mode.kind === 'center' && 'gt-floating--center', classNames.floating)}
        role="dialog"
        aria-modal={!interactive}
        aria-labelledby={step.title ? titleId : undefined}
        aria-label={step.title ? undefined : 'Tour'}
        aria-describedby={contentId}
        tabIndex={-1}
        style={{
          ...(widthCss && { width: widthCss, maxWidth: 'calc(100vw - 16px)' }),
          ...(!positioned.current && { visibility: 'hidden' }),
        }}
      >
        <Popover {...popoverProps} />
        {mode.kind === 'anchored' && target && <div ref={arrowRef} className={cx('gt-arrow', classNames.arrow)} />}
      </div>
    </div>
  );
}

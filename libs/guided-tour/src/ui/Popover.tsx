import type { CSSProperties } from 'react';
import type { PopoverProps } from '../types';

export const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function CloseButton({ labels, classNames, close, escapeHolding, escapeHoldMs }: PopoverProps) {
  return (
    <button
      type="button"
      className={cx('gt-close', classNames.close)}
      aria-label={labels.close}
      onClick={close}
      data-holding={escapeHolding || undefined}
      style={{ '--gt-hold-ms': `${escapeHoldMs}ms` } as CSSProperties}
    >
      <svg className="gt-close-ring" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12.5" pathLength={100} />
      </svg>
      <svg className="gt-close-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

// Keep in sync with .gt-dot / .gt-dots-track in styles.css.
const DOT = 8;
const DOT_ACTIVE = 20;
const DOT_GAP = 6;

/**
 * Carousel-style dots: past `maxDots`, show a sliding window around the current step.
 * Edge dots shrink when more steps exist beyond them.
 */
function Dots({ stepIndex, totalSteps, maxDots, labels, classNames, goTo, canGoTo }: PopoverProps) {
  const visible = Math.max(3, Math.min(maxDots, totalSteps));
  const start = Math.min(Math.max(stepIndex - Math.floor(visible / 2), 0), totalSteps - visible);
  const end = start + visible - 1;
  const width = (visible - 1) * (DOT + DOT_GAP) + DOT_ACTIVE;

  const sizeOf = (i: number) => {
    if (i < start || i > end) return 'hidden';
    const fromEdge = Math.min(start > 0 ? i - start : Infinity, end < totalSteps - 1 ? end - i : Infinity);
    return fromEdge === 0 ? 'sm' : fromEdge === 1 && visible > 4 ? 'md' : undefined;
  };

  return (
    <div className={cx('gt-dots', classNames.dots)} style={{ width }}>
      <div className="gt-dots-track" style={{ transform: `translateX(${-start * (DOT + DOT_GAP)}px)` }}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const size = sizeOf(i);
          return (
            <button
              key={i}
              type="button"
              className={cx('gt-dot', classNames.dot)}
              data-size={size}
              tabIndex={size === 'hidden' ? -1 : undefined}
              aria-hidden={size === 'hidden' || undefined}
              aria-label={labels.goToStep(i + 1)}
              aria-current={i === stepIndex ? 'step' : undefined}
              disabled={!canGoTo(i)}
              onClick={() => goTo(i)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Progress(props: PopoverProps) {
  const { progress, stepIndex, totalSteps, labels, classNames } = props;
  if (progress === 'none') return <span />;
  const showDots = progress === 'dots' || progress === 'both';
  const showCounter = progress === 'counter' || progress === 'both';
  return (
    <div className={cx('gt-progress', classNames.progress)}>
      {showDots && <Dots {...props} />}
      {showCounter && (
        <span className={cx('gt-counter', classNames.counter)} aria-live="polite">
          {labels.stepCounter(stepIndex + 1, totalSteps)}
        </span>
      )}
    </div>
  );
}

export function DefaultPopover(props: PopoverProps) {
  const { title, content, classNames, showClose, showPrev, isFirst, prev, next, prevLabel, nextLabel, titleId, contentId, advanceOn } =
    props;
  return (
    <div className={cx('gt-popover', classNames.popover)}>
      {(title || showClose) && (
        <div className={cx('gt-header', classNames.header)}>
          {title ? (
            <h2 id={titleId} className={cx('gt-title', classNames.title)}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {showClose && <CloseButton {...props} />}
        </div>
      )}
      <div id={contentId} className={cx('gt-content', classNames.content)}>
        {content}
      </div>
      <div className={cx('gt-footer', classNames.footer)}>
        <Progress {...props} />
        <div className="gt-actions">
          {showPrev && !isFirst && (
            <button type="button" className={cx('gt-button', classNames.button)} onClick={prev}>
              {prevLabel}
            </button>
          )}
          <button
            type="button"
            className={cx('gt-button', 'gt-button--primary', classNames.button, classNames.primaryButton)}
            disabled={advanceOn !== 'next'}
            onClick={next}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

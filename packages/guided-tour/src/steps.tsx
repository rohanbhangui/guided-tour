import {
  Fragment,
  cloneElement,
  createElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  version as reactVersion,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from 'react';
import { useInternal } from './context';
import { isDev, warn } from './dev';
import { registryKey } from './store';
import type { StepOptions, TourDefinition } from './types';

/** Combine refs into one callback ref. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}

const IS_REACT_19 = Number(reactVersion.split('.')[0]) >= 19;

/** The ref already on an element. React 19 moved it to props.ref. */
function elementRef(element: ReactElement): Ref<unknown> | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return IS_REACT_19 ? (element.props as any).ref : (element as any).ref;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTour = TourDefinition<any>;
type IdOf<T> = T extends TourDefinition<infer Id> ? Id : string;

/**
 * Register an inline step and get a ref callback for its target element.
 * Registration is a mutable write; it never re-renders anything.
 */
export function useTourStep<T extends AnyTour | string>(
  tour: T,
  id: NoInfer<IdOf<T>>,
  options: StepOptions = {},
): RefCallback<HTMLElement> {
  const { controller } = useInternal('useTourStep');
  const tourId = typeof tour === 'string' ? tour : tour.id;
  const key = registryKey(tourId, id);
  const [owner] = useState(() => Symbol(key));

  // Every render: keep content live (cheap Map write).
  useLayoutEffect(() => {
    controller.registry.upsert(key, owner, { options });
  });
  useLayoutEffect(() => () => controller.registry.remove(key, owner), [controller, key, owner]);

  return useCallback(
    (el: HTMLElement | null) => {
      const ok = controller.registry.upsert(key, owner, { el });
      if (!ok) warn(`Step "${id}" of tour "${tourId}" is rendered more than once; the latest one wins.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, key, owner],
  );
}

export interface TourStepOwnProps<Id extends string> extends StepOptions {
  id: Id;
  children: ReactNode;
  /**
   * Render a wrapper element and measure that instead of the child.
   * Only needed when the child can't take a ref.
   */
  wrapper?: 'div' | 'span';
}

export interface TourStepProps<T extends AnyTour | string> extends TourStepOwnProps<NoInfer<IdOf<T>>> {
  tour: T;
}

/** Marks its child as the target of a tour step. Adds no DOM of its own. */
export function TourStep<T extends AnyTour | string>({ tour, id, children, wrapper, ...options }: TourStepProps<T>) {
  const ref = useTourStep(tour, id, options);
  const { controller } = useInternal('TourStep');
  const canMerge = !wrapper && isValidElement(children) && children.type !== Fragment;
  const childRef = canMerge ? elementRef(children) : undefined;
  const merged = useMemo(() => mergeRefs(childRef, ref), [childRef, ref]);

  useEffect(() => {
    if (!isDev || wrapper) return;
    const key = registryKey(typeof tour === 'string' ? tour : tour.id, id);
    if (!controller.registry.get(key)?.el) {
      warn(
        `<Step id="${id}"> didn't receive a DOM element. Its child must accept a ref ` +
          `(DOM element, forwardRef, or any component on React 19). Otherwise pass wrapper="div".`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canMerge) return createElement(wrapper ?? 'div', { ref }, children);
  return cloneElement(children as ReactElement<{ ref?: Ref<unknown> }>, { ref: merged });
}

/** A `<Step>` bound to one tour, with step ids typed against it. */
export function useTourSteps<T extends AnyTour>(tour: T) {
  const tourId = tour.id;
  const Step = useMemo(() => {
    function BoundStep(props: TourStepOwnProps<IdOf<T>>) {
      return <TourStep<string> tour={tourId} {...props} />;
    }
    BoundStep.displayName = `Step(${tourId})`;
    return BoundStep;
  }, [tourId]);
  return { Step };
}

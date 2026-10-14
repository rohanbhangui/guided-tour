import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TourController } from './controller';
import { InternalContext, useInternal, type InternalContextValue, type UIConfig } from './context';
import { localStorageAdapter } from './storage';
import type { TourClassNames, TourComponents, TourDefinition, TourLabels, TourOptions, TourStorage } from './types';
import { TourLayer } from './ui/TourLayer';

export interface TourProviderProps {
  // `any` so tours with narrowed step-id unions are accepted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tours: readonly TourDefinition<any>[];
  /** Default: `localStorageAdapter()`. */
  storage?: TourStorage;
  /** Tour options applied to every tour (a tour's own options win). */
  defaults?: TourOptions;
  labels?: TourLabels;
  classNames?: TourClassNames;
  components?: TourComponents;
  /** Kill switch: no tour will start. */
  disabled?: boolean;
  /** Where the overlay + popover render. Default `document.body`. */
  portalContainer?: HTMLElement | null;
  children?: ReactNode;
}

export function TourProvider({
  tours,
  storage,
  defaults,
  labels,
  classNames,
  components,
  disabled,
  portalContainer,
  children,
}: TourProviderProps) {
  const [controller] = useState(
    () => new TourController({ storage: storage ?? localStorageAdapter(), defaults, disabled }),
  );
  controller.config = { storage: controller.config.storage, defaults, disabled };

  const ui = useRef<UIConfig>({});
  ui.current = { labels, classNames, components, portalContainer };

  useLayoutEffect(() => controller.setTours(tours), [controller, tours]);
  useLayoutEffect(() => {
    void controller.init();
    return () => controller.dispose();
  }, [controller]);

  // Stable forever, so consumers of the context never re-render because of the provider.
  const value = useMemo<InternalContextValue>(() => ({ controller, ui }), [controller]);

  return (
    <InternalContext.Provider value={value}>
      {children}
      <TourRoot />
    </InternalContext.Provider>
  );
}

/** Renders nothing (no DOM at all) until a tour is active. */
function TourRoot() {
  const { controller, ui } = useInternal('TourRoot');
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.get, controller.store.get);
  const active = state.status === 'active';
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const el = document.createElement('div');
    el.className = 'gt-root';
    (ui.current.portalContainer ?? document.body).appendChild(el);
    setContainer(el);
    return () => {
      el.remove();
      setContainer(null);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [active, ui]);

  if (!active || !container) return null;
  return createPortal(<TourLayer controller={controller} ui={ui.current} state={state} />, container);
}

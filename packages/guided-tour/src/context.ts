import { createContext, useContext, type RefObject } from 'react';
import type { TourController } from './controller';
import type { TourClassNames, TourComponents, TourLabels } from './types';

export interface UIConfig {
  labels?: TourLabels;
  classNames?: TourClassNames;
  components?: TourComponents;
  portalContainer?: HTMLElement | null;
}

export interface InternalContextValue {
  controller: TourController;
  ui: RefObject<UIConfig>;
}

export const InternalContext = createContext<InternalContextValue | null>(null);

export function useInternal(hook: string): InternalContextValue {
  const ctx = useContext(InternalContext);
  if (!ctx) throw new Error(`[guided-tour] ${hook} must be used inside <TourProvider>.`);
  return ctx;
}

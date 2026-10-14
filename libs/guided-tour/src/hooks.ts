import { useMemo, useSyncExternalStore } from 'react';
import type { TourActions } from './controller';
import { useInternal } from './context';
import type { StepOptions } from './types';

/** Actions only. Never re-renders because of tour state. */
export function useTourActions(): TourActions {
  return useInternal('useTourActions').controller.actions;
}

/** Actions + active-tour state. Re-renders when the tour starts, stops or changes step. */
export function useTour() {
  const { controller } = useInternal('useTour');
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.get, controller.store.get);
  const { tourId, stepIndex, totalSteps, status } = state;
  return useMemo(
    () => ({
      ...controller.actions,
      activeTourId: tourId,
      stepIndex,
      totalSteps,
      isActive: status === 'active',
    }),
    [controller, tourId, stepIndex, totalSteps, status],
  );
}

export interface ActiveStep {
  tourId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  target: HTMLElement | null;
  options: StepOptions;
}

/** For headless UIs: the active step, or null. */
export function useActiveStep(): ActiveStep | null {
  const { controller } = useInternal('useActiveStep');
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.get, controller.store.get);
  return useMemo(() => {
    if (state.status !== 'active' || !state.tourId || !state.stepId) return null;
    return {
      tourId: state.tourId,
      stepId: state.stepId,
      stepIndex: state.stepIndex,
      totalSteps: state.totalSteps,
      target: state.target,
      options: controller.getStepOptions(state.tourId, state.stepId),
    };
  }, [controller, state]);
}

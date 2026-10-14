import { warn } from './dev';
import type { StepEntry, TourDefinition } from './types';

type IdOfEntry<E> = E extends string ? E : E extends { id: infer I extends string } ? I : never;

/**
 * Identity helper: infers the step-id union (from both string and object entries)
 * for typed `<Step id>`, and validates the definition in development.
 */
export function defineTour<const S extends readonly StepEntry[]>(
  tour: Omit<TourDefinition, 'steps'> & { steps: S },
): TourDefinition<IdOfEntry<S[number]>> {
  const seen = new Set<string>();
  for (const entry of tour.steps) {
    const id = typeof entry === 'string' ? entry : entry.id;
    if (seen.has(id)) warn(`Tour "${tour.id}" lists step "${id}" more than once.`);
    seen.add(id);
  }
  return tour as unknown as TourDefinition<IdOfEntry<S[number]>>;
}

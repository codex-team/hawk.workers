import type { EventAddons, EventDataAccepted } from '@hawk.so/types';
import { diff } from '@n1ru4l/json-patch-plus';
import type { RepetitionDelta } from '../../types/group-worker-task';

/**
 * Calculate delta between original event and repetition
 *
 * @param originalEvent - first event
 * @param repetition - one of remaining events
 * @returns delta {RepetitionDelta}
 */
export function computeDelta(originalEvent: EventDataAccepted<EventAddons>, repetition: EventDataAccepted<EventAddons>): RepetitionDelta {
  const delta = diff({
    left: originalEvent,
    right: repetition,
  });

  return delta;
}

import { CatcherMessageAccepted, CatcherMessagePayload } from '@hawk.so/types';

/**
 * Format of task for Default Event Worker
 */
export interface DefaultEventWorkerTask extends CatcherMessageAccepted<'errors/default'> {
  /**
   * Language-specific payload
   */
  payload: CatcherMessagePayload<'errors/default'>;

  /**
   * Unix timestamp of the event
   */
  timestamp: number;
}

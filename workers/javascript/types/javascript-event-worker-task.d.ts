import { CatcherMessageAccepted, CatcherMessagePayload } from '@hawk.so/types';

/**
 * Format of task for JavaScript Event Worker
 */
export interface JavaScriptEventWorkerTask extends CatcherMessageAccepted<'errors/javascript'> {
  /**
   * Language-specific payload
   */
  payload: CatcherMessagePayload<'errors/javascript'>;

  /**
   * Unix timestamp of the event
   */
  timestamp: number;
}

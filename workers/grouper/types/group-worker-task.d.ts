import type { CatcherMessageAccepted, CatcherMessagePayload, CatcherMessageType } from '@hawk.so/types';
import type { WorkerTask } from '../../../lib/types/worker-task';
import type { Delta } from '@n1ru4l/json-patch-plus';

/**
 * Language-workers adds tasks for Group Worker in this format.
 * Group Worker gets this tasks (events from language-workers) and saves it to the DB
 */
export interface GroupWorkerTask<CatcherType extends CatcherMessageType> extends WorkerTask, CatcherMessageAccepted<CatcherType> {
  /**
   * Project where error was occurred
   */
  projectId: string;

  /**
   * What type of event we've accept
   */
  catcherType: CatcherType;

  /**
   * Payload of the event that should be grouped
   */
  payload: CatcherMessagePayload<CatcherType>;

  /**
   * Unix timestamp of the event
   */
  timestamp: number;
}

/**
 * Delta of the original event and the repetition
 */
export type RepetitionDelta = Delta | undefined;

import { CatcherMessageAccepted, CatcherMessagePayload, ErrorsCatcherType } from '@hawk.so/types';

/**
 * Default Event Worker can process events with all types except 'errors/javascript'
 * because it is handled by JavaScript Event Worker.
 */
export type DefaultCatcherMessageType = Exclude<ErrorsCatcherType, 'errors/javascript'>

/**
 * Format of task for Default Event Worker
 */
export interface DefaultEventWorkerTask extends CatcherMessageAccepted<DefaultCatcherMessageType> {}

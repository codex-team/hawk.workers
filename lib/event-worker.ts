import { Worker } from './worker';

/**
 * Defines a Worker that handles events from Catcher.
 * Used to extract Project Id from Integration Token and to provide some common methods.
 *
 * catherTypes -> 'error/*'
 */
export abstract class EventWorker extends Worker {
}

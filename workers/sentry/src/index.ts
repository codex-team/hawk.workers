import * as pkg from '../package.json';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';
import { DefaultEventWorkerTask } from '../../default/types/default-event-worker-task';
import WorkerNames from '../../../lib/workerNames.js';
import { Envelope, EnvelopeItem, EventEnvelope, EventItem, parseEnvelope } from '@sentry/core';
import { Worker } from '../../../lib/worker';
import { composeBacktrace, composeContext, composeTitle, composeUserData } from './utils/converter';
import { b64decode } from './utils/base64';
/**
 * Worker for handling Sentry events
 */
export default class SentryEventWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public type: string = pkg.workerType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: SentryEventWorkerTask): Promise<void> {
    /**
     * Define  event type
     *
     * @todo Rename to external/sentry because it is not a Hawk event
     */
    this.type = 'errors/sentry';

    try {
      const rawEvent = b64decode(event.payload.envelope);

      console.log('event', event.payload.envelope);
      console.log('parsed', rawEvent);

      const envelope = parseEnvelope(rawEvent);

      this.logger.debug(JSON.stringify(envelope));

      const [headers, items] = envelope;

      for (const item of items) {
        await this.handleEnvelopeItem(headers, item, event.projectId);
      }

      this.logger.debug('All envelope items processed successfully.');
    } catch (error) {
      this.logger.error('Error handling Sentry event task:', error);
      throw error;
    }
  }

  /**
   * Process the envelope item
   *
   * @param envelopeHeaders - The whole envelope headers
   * @param item - Sentry item
   * @param projectId - Sentry project ID
   */
  private async handleEnvelopeItem(envelopeHeaders: Envelope[0], item: EnvelopeItem, projectId: string): Promise<void> {
    try {
      const [ itemHeader ] = item;

      /**
       * Skip non-event items
       */
      if (itemHeader.type !== 'event') {
        return;
      }

      const hawkEvent = this.transformToHawkFormat(envelopeHeaders as EventEnvelope[0], item as EventItem, projectId);

      await this.addTask(WorkerNames.DEFAULT, hawkEvent as DefaultEventWorkerTask);
    } catch (error) {
      this.logger.error('Error handling envelope item:', JSON.stringify(item), error);
      throw error;
    }
  }

  /**
   * Transform a Sentry event into a Hawk-compatible structure
   *
   * @param envelopeHeader - Sentry envelope header
   * @param eventItem - Sentry event item
   * @param projectId - Hawk project ID
   */
  private transformToHawkFormat(
    envelopeHeader: EventEnvelope[0],
    eventItem: EventItem,
    projectId: string
  ): DefaultEventWorkerTask {
    /* eslint-disable @typescript-eslint/naming-convention */
    const { sent_at, trace } = envelopeHeader;

    /**
     * Delete public_key from trace
     */
    if (trace) {
      delete trace.public_key;
    }

    /**
     * convert sent_at from ISO 8601 to Unix timestamp
     */
    const msInSecond = 1000;
    const sentAtUnix = Math.floor(new Date(sent_at).getTime() / msInSecond);
    /* eslint-enable @typescript-eslint/naming-convention */

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const [_eventHeaders, eventPayload] = eventItem;

    const backtrace = composeBacktrace(eventPayload);
    const context = composeContext(eventPayload);
    const user = composeUserData(eventPayload);

    return {
      projectId, // Public key is used as hawk project ID
      catcherType: 'errors/sentry',
      payload: {
        title: composeTitle(eventPayload),
        type: eventPayload.level || 'error',
        timestamp: sentAtUnix,
        backtrace,
        release: trace?.release || undefined,
        context,
        catcherVersion: pkg.version,
        user,
      },
    };
  }
}

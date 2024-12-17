import * as pkg from '../package.json';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';
import { DefaultEventWorkerTask } from '../../default/types/default-event-worker-task';
import WorkerNames from '../../../lib/workerNames.js';
import { Envelope, EnvelopeItem, EventEnvelope, EventItem, parseEnvelope } from '@sentry/core';
import { Worker } from '../../../lib/worker';
import { composeAddons, composeBacktrace, composeContext, composeTitle, composeUserData } from './utils/converter';
import { b64decode } from './utils/base64';
import { DecodedEventData, EventAddons } from '@hawk.so/types';
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
      const envelope = parseEnvelope(rawEvent);

      const [headers, items] = envelope;

      for (const item of items) {
        await this.handleEnvelopeItem(headers, item, event.projectId);
      }
    } catch (error) {
      this.logger.error(`Error handling Sentry event task:`, error);
      this.logger.info('👇 Here is the problematic event:');
      this.logger.json(event);
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
      const [itemHeader, itemPayload] = item;

      if (!itemPayload) {
        throw new Error('Item payload is missing');
      }

      /**
       * Skip non-event items
       */
      if (itemHeader.type !== 'event') {
        return;
      }

      const hawkEvent = this.transformToHawkFormat(envelopeHeaders as EventEnvelope[0], item as EventItem, projectId);

      await this.addTask(WorkerNames.DEFAULT, hawkEvent as DefaultEventWorkerTask);
    } catch (error) {
      this.logger.error('Error handling envelope item:', error);
      this.logger.info('👇 Here is the problematic item:');
      this.logger.json(item);
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
     * convert sent_at from ISO 8601 to Unix timestamp
     */
    const msInSecond = 1000;
    const sentAtUnix = Math.floor(new Date(sent_at).getTime() / msInSecond);
    /* eslint-enable @typescript-eslint/naming-convention */

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const [_eventHeaders, eventPayload] = eventItem;

    const title = composeTitle(eventPayload);
    const backtrace = composeBacktrace(eventPayload);
    const context = composeContext(eventPayload);
    const user = composeUserData(eventPayload);
    const addons = composeAddons(eventPayload);

    const event: DecodedEventData<EventAddons> = {
      title,
      type: eventPayload.level || 'error',
      timestamp: sentAtUnix,
      catcherVersion: pkg.version,
    };

    if (backtrace) {
      event.backtrace = backtrace;
    }

    if (context) {
      event.context = context;
    }

    if (user) {
      event.user = user;
    }

    if (addons) {
      event.addons = addons;
    }

    /**
     * Event release is the release of the individual event
     * while trace release is the release of the whole envelope (all items
     */
    if (eventPayload.release || trace?.release) {
      event.release = eventPayload.release || trace?.release;
    }

    return {
      projectId, // Public key is used as hawk project ID
      catcherType: 'errors/sentry',
      payload: event,
    };
  }
}

import * as pkg from '../package.json';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';
import { DefaultEventWorkerTask } from '../../default/types/default-event-worker-task';
import WorkerNames from '../../../lib/workerNames.js';
import { Envelope, EnvelopeItem, EventEnvelope, EventItem, parseEnvelope } from '@sentry/core';
import { Worker } from '../../../lib/worker';
import { composeAddons, composeBacktrace, composeContext, composeTitle, composeUserData } from './utils/converter';
import { b64decode } from './utils/base64';
import { CatcherMessagePayload } from '@hawk.so/types';
import { TextDecoder } from 'util';
import { JavaScriptEventWorkerTask } from '../../javascript/types/javascript-event-worker-task';
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
     */
    this.type = 'external/sentry';

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
      const payloadHasSDK = typeof itemPayload === 'object' && 'sdk' in itemPayload;
      
      /**
       * @todo react-native could be added if we support source-map sending for Metro bundler
       */
      const sentryJsSDK = ['browser', 'react', 'vue', 'angular', 'capacirtor', 'electron'];
      
      const isJsSDK = payloadHasSDK && sentryJsSDK.includes(itemPayload.sdk.name)
      
      const hawkEvent = this.transformToHawkFormat(envelopeHeaders as EventEnvelope[0], item as EventItem, projectId, isJsSDK);

      /**
       * If we have release attached to the event
       */
      if (isJsSDK) {
        await this.addTask(WorkerNames.JAVASCRIPT, hawkEvent as JavaScriptEventWorkerTask);
      } else {
        await this.addTask(WorkerNames.DEFAULT, hawkEvent as DefaultEventWorkerTask);
      }

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
    projectId: string,
    isJsSDK: boolean,
  ): DefaultEventWorkerTask | JavaScriptEventWorkerTask {
    /* eslint-disable @typescript-eslint/naming-convention */
    const { sent_at, trace } = envelopeHeader;

    /**
     * convert sent_at from ISO 8601 to Unix timestamp
     */
    const msInSecond = 1000;
    const sentAtUnix = Math.floor(new Date(sent_at).getTime() / msInSecond);
    /* eslint-enable @typescript-eslint/naming-convention */

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    let [_eventHeaders, eventPayload] = eventItem;

    /**
     * Sometimes Sentry parses the itemPayload as a Uint8Array
     * (https://github.com/getsentry/sentry-javascript/blob/develop/packages/core/src/utils-hoist/envelope.ts#L173)
     *
     * We need to decode it to JSON
     */
    if (eventPayload instanceof Uint8Array) {
      const textDecoder = new TextDecoder();

      eventPayload = JSON.parse(textDecoder.decode(eventPayload as Uint8Array));
    }

    const title = composeTitle(eventPayload);
    const backtrace = composeBacktrace(eventPayload);
    const context = composeContext(eventPayload);
    const user = composeUserData(eventPayload);
    const addons = composeAddons(eventPayload);

    const event: CatcherMessagePayload<'errors/default' | 'errors/javascript'> = {
      title,
      type: eventPayload.level || 'error',
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
      event.addons.sentry = addons;
    }

    /**
     * Event release is the release of the individual event
     * while trace release is the release of the whole envelope (all items
     */
    if (eventPayload.release || trace?.release) {
      event.release = eventPayload.release || trace?.release;
    }

    return isJsSDK ? {
      projectId,
      catcherType: 'errors/javascript',
      payload: event as CatcherMessagePayload<'errors/javascript'>,
      timestamp: sentAtUnix,
    } : {
      projectId,  
      catcherType: 'errors/default',
      payload: event as CatcherMessagePayload<'errors/default'>,
      timestamp: sentAtUnix,
    };
  }
}

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

      // Filter out replay_recording items before parsing to prevent crashes
      const filteredRawEvent = this.filterOutBinaryItems(rawEvent);

      const envelope = parseEnvelope(filteredRawEvent);

      const [headers, items] = envelope;

      if (items.length === 0) {
        this.logger.warn('Received envelope with no items');
        return;
      }

      let processedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        const result = await this.handleEnvelopeItem(headers, item, event.projectId);
        if (result === 'processed') {
          processedCount++;
        } else if (result === 'skipped') {
          skippedCount++;
        }
      }

      this.logger.verbose(`Processed ${processedCount} events, skipped ${skippedCount} non-event items from envelope`);
    } catch (error) {
      this.logger.error(`Error handling Sentry event task:`, error);
      this.logger.info('👇 Here is the problematic event:');
      this.logger.json(event);
      throw error;
    }
  }

  /**
   * Filter out binary items that crash parseEnvelope
   * Also filters out all Sentry Replay events (replay_event and replay_recording)
   */
  private filterOutBinaryItems(rawEvent: string): string {
    const lines = rawEvent.split('\n');
    const filteredLines = [];
    let isInReplayBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Keep envelope header (first line)
      if (i === 0) {
        filteredLines.push(line);
        continue;
      }

      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      try {
        // Try to parse as JSON to check if it's a header
        const parsed = JSON.parse(line);

        // Check if this is a replay event type
        if (parsed.type === 'replay_recording' || parsed.type === 'replay_event') {
          // Mark that we're in a replay block and skip this line
          isInReplayBlock = true;
          continue;
        }

        // If we're in a replay block, check if this is still part of it
        if (isInReplayBlock) {
          // Check if this line is part of replay data (segment_id, length, etc.)
          if ('segment_id' in parsed || ('length' in parsed && parsed.type !== 'event') || 'replay_id' in parsed) {
            // Still in replay block, skip this line
            continue;
          }

          // If it's a new envelope item (like event), we've exited the replay block
          if (parsed.type === 'event' || parsed.type === 'transaction' || parsed.type === 'session') {
            isInReplayBlock = false;
          } else {
            // Unknown type, assume we're still in replay block
            continue;
          }
        }

        // Keep valid headers and other JSON data (not in replay block)
        if (!isInReplayBlock) {
          filteredLines.push(line);
        }
      } catch {
        // If line doesn't parse as JSON, it might be binary data
        // If we're in a replay block, skip it (it's part of replay recording)
        if (isInReplayBlock) {
          continue;
        }

        // If not in replay block and not JSON, it might be corrupted data - skip it
        continue;
      }
    }

    return filteredLines.join('\n');
  }

  /**
   * Process the envelope item
   *
   * @param envelopeHeaders - The whole envelope headers
   * @param item - Sentry item
   * @param projectId - Sentry project ID
   * @returns 'processed' if event was sent, 'skipped' if non-event item, throws error on failure
   */
  private async handleEnvelopeItem(envelopeHeaders: Envelope[0], item: EnvelopeItem, projectId: string): Promise<'processed' | 'skipped'> {
    try {
      const [itemHeader, itemPayload] = item;

      if (!itemPayload) {
        throw new Error('Item payload is missing');
      }

      /**
       * Skip non-event items
       */
      if (itemHeader.type !== 'event') {
        this.logger.info(`Skipping non-event item of type: ${itemHeader.type}`);
        return 'skipped';
      }
      const payloadHasSDK = typeof itemPayload === 'object' && 'sdk' in itemPayload;

      /**
       * @todo react-native could be added if we support source-map sending for Metro bundler
       */
      const sentryJsSDK = ['browser', 'react', 'vue', 'angular', 'capacirtor', 'electron'];

      /**
       * Safely check if SDK name exists and is in the list
       * SDK name can be either a simple name like "react" or a full name like "sentry.javascript.react"
       */
      const sdkName = payloadHasSDK && itemPayload.sdk && typeof itemPayload.sdk === 'object' && 'name' in itemPayload.sdk
        ? itemPayload.sdk.name
        : undefined;

      /**
       * Check if SDK is a JavaScript-related SDK
       * Supports both simple names (e.g., "react") and full names (e.g., "sentry.javascript.react")
       */
      const isJsSDK = sdkName !== undefined && typeof sdkName === 'string' && (
        /**
         * Exact match for simple SDK names (e.g., "react", "browser")
         */
        sentryJsSDK.includes(sdkName) ||
        /**
         * Check if SDK name contains one of the JS SDK names
         * Examples:
         * - "sentry.javascript.react" matches "react"
         * - "sentry.javascript.browser" matches "browser"
         * - "@sentry/react" matches "react"
         */
        sentryJsSDK.some((jsSDK) => sdkName.includes(jsSDK))
      );

      const hawkEvent = this.transformToHawkFormat(envelopeHeaders as EventEnvelope[0], item as EventItem, projectId, isJsSDK);

      /**
       * Send task to appropriate worker and check if it was successfully queued
       */
      const workerName = isJsSDK ? WorkerNames.JAVASCRIPT : WorkerNames.DEFAULT;
      const taskSent = await this.addTask(workerName, hawkEvent as JavaScriptEventWorkerTask | DefaultEventWorkerTask);

      if (!taskSent) {
        /**
         * If addTask returns false, the message was not queued (queue full or channel closed)
         */
        const error = new Error(`Failed to queue event to ${workerName} worker. Queue may be full or channel closed.`);
        this.logger.error(error.message);
        this.logger.info('👇 Here is the event that failed to queue:');
        this.logger.json(hawkEvent);
        throw error;
      }

      return 'processed';
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
   * @param isJsSDK - Whether the event is from a Sentry JavaScript-related SDK
   */
  private transformToHawkFormat(
    envelopeHeader: EventEnvelope[0],
    eventItem: EventItem,
    projectId: string,
    isJsSDK: boolean
  ): DefaultEventWorkerTask | JavaScriptEventWorkerTask {
    /* eslint-disable @typescript-eslint/naming-convention */
    const { sent_at, trace } = envelopeHeader;

    /**
     * convert sent_at from ISO 8601 to Unix timestamp
     */
    const msInSecond = 1000;
    const sentAtDate = new Date(sent_at);
    const sentAtTime = sentAtDate.getTime();

    if (isNaN(sentAtTime)) {
      throw new Error(`Invalid sent_at timestamp: ${sent_at}`);
    }

    const sentAtUnix = Math.floor(sentAtTime / msInSecond);
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
      try {
        const textDecoder = new TextDecoder();
        const decoded = textDecoder.decode(eventPayload as Uint8Array);

        try {
          eventPayload = JSON.parse(decoded);
        } catch (parseError) {
          throw new Error(`Failed to parse event payload JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } catch (decodeError) {
        throw new Error(`Failed to decode Uint8Array event payload: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
      }
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
      event.addons = {
        sentry: addons,
      };
    }

    /**
     * Event release is the release of the individual event
     * while trace release is the release of the whole envelope (all items
     */
    if (eventPayload.release || trace?.release) {
      event.release = eventPayload.release || trace?.release;
    }

    return isJsSDK
      ? {
        projectId,
        catcherType: 'errors/javascript',
        payload: event as CatcherMessagePayload<'errors/javascript'>,
        timestamp: sentAtUnix,
      }
      : {
        projectId,
        catcherType: 'errors/default',
        payload: event as CatcherMessagePayload<'errors/default'>,
        timestamp: sentAtUnix,
      };
  }
}

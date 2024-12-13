import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';
import { SentryEnvelope, SentryItem } from '../types/sentry-envelope';
import { DefaultEventWorkerTask } from '../../default/types/default-event-worker-task';
import * as WorkerNames from '../../../lib/workerNames';

const b64decode = (str: string): string => Buffer.from(str, 'base64').toString('binary');

/**
 * Worker for handling Sentry events
 */
export default class SentryEventWorker extends EventWorker {
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
    this.type = 'errors/sentry';

    const rawEvent = b64decode(event.payload.envelope);
    const envelope = this.parseSentryEnvelope(rawEvent);
    this.logger.debug(JSON.stringify(envelope));

    // Todo: For now, we only handle the first item in the envelope
    const hawkEvent = this.transformToHawkFormat(envelope.Header, envelope.Items[0], event.projectId);
    this.logger.debug(JSON.stringify(hawkEvent));

    this.validate(hawkEvent);

    await this.addTask(WorkerNames.DEFAULT, hawkEvent as SentryEventWorkerTask);
  }

  /**
    * Parse Sentry envelope into structured format
    *
    * @param data - raw Sentry envelope data
    * @returns Parsed SentryEnvelope object
    */
  private parseSentryEnvelope(data: string): SentryEnvelope {
    const lines = data.split('\n').filter(line => line.trim() !== '');
    const envelope: SentryEnvelope = { Header: {}, Items: [] };

    // Parse envelope header
    const headerLine = lines.shift();
    if (!headerLine) {
      throw new Error('Failed to read envelope header');
    }
    envelope.Header = JSON.parse(headerLine);

    // Parse each item
    while (lines.length > 0) {
      // Item header
      const itemHeaderLine = lines.shift();
      if (!itemHeaderLine) {
        throw new Error('Failed to read item header');
      }
      const itemHeader = JSON.parse(itemHeaderLine);

      // Item payload
      const itemPayloadLine = lines.shift();
      if (!itemPayloadLine) {
        throw new Error('Failed to read item payload');
      }
      const itemPayload = JSON.parse(itemPayloadLine);

      envelope.Items.push({ Header: itemHeader, Payload: itemPayload });
    }

    return envelope;
  }

  /**
   * Transform a Sentry event into a Hawk-compatible structure
   *
   * @param envelopeHeader - Sentry envelope header
   * @param eventItem - Sentry event item
   * @returns Hawk-compatible event structure
   */
  private transformToHawkFormat(
    envelopeHeader: Record<string, any>,
    eventItem: SentryItem,
    projectId: string
  ): SentryEventWorkerTask {
    const { sent_at, trace } = envelopeHeader;
    const { Payload } = eventItem;

    // delete public_key from trace
    delete trace.public_key;

    // convert sent_at from ISO 8601 to Unix timestamp
    const sent_at_unix = Math.floor(new Date(sent_at).getTime() / 1000);

    const backtrace = Payload.exception?.values?.[0]?.stacktrace?.frames?.map((frame: any) => ({
      file: frame.filename,
      line: frame.lineno,
      function: frame.function,
      sourceCode: frame.pre_context?.concat(frame.context_line, frame.post_context || [])
        .map((line: string, index: number) => ({
          line: frame.lineno + index - frame.pre_context.length,
          content: line
        })) || [],
    })) || [];

    return {
      projectId: projectId, // Public key is used as hawk project ID
      catcherType: 'errors/sentry',
      payload: {
        title: `${Payload.exception?.values?.[0]?.type || 'Unknown'}: ${Payload.exception?.values?.[0]?.value || ''}`,
        type: Payload.level || 'error',
        timestamp: sent_at_unix,
        backtrace,
        release: trace?.release || null,
        context: {
          sentAt: sent_at_unix,
          trace: trace || {},
          environment: trace?.environment || 'unknown',
        },
        catcherVersion: pkg.version,
        user: null, // Can be populated with user data if available
      },
    };
  }

}

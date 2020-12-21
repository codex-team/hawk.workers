import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables/';
import { IncomingWebhookSendArguments } from '@slack/webhook';

/**
 * Slack templates should implement this interface
 */
export interface SlackTemplate {
  /**
   * Rendering method that accepts tpl args and return Webhook app arguments
   *
   * @param tplData - template variables
   */
  (tplData: EventsTemplateVariables): IncomingWebhookSendArguments;
}

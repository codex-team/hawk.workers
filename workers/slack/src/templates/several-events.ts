import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { IncomingWebhookSendArguments } from '@slack/webhook';

/**
 * Returns JSON with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): IncomingWebhookSendArguments {
  return {
    blocks: [],
  };
}

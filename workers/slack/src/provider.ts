import NotificationsProvider from 'hawk-worker-sender/src/provider';
import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import templates from './templates';
import { IncomingWebhookSendArguments, IncomingWebhook } from '@slack/webhook';
import { SlackTemplate } from '../types/template';

/**
 * This class provides a 'send' method that will renders and sends a notification
 */
export default class SlackProvider extends NotificationsProvider {
  /**
   * Send telegram message to recipient
   *
   * @param to - recipient endpoint
   * @param variables - variables for template
   */
  public async send(to: string, variables: EventsTemplateVariables): Promise<void> {
    let template: SlackTemplate;

    if (variables.events.length === 1) {
      template = templates.NewEventTpl;
    } else {
      template = templates.SeveralEventsTpl;
    }

    const webhookArgs = await this.render(template, variables);

    await this.deliver(to, webhookArgs);
  }

  /**
   * Render slack message template
   *
   * @param template - template to render
   * @param variables - variables for template
   */
  private async render(template: SlackTemplate, variables: EventsTemplateVariables): Promise<IncomingWebhookSendArguments> {
    return template(variables);
  }

  /**
   * Sends message to the Slack through the Incoming Webhook app
   * https://api.slack.com/messaging/webhooks
   *
   * @param endpoint - where to send
   * @param message - what to send
   */
  private async deliver(endpoint: string, message: IncomingWebhookSendArguments): Promise<void> {
    try {
      const webhook = new IncomingWebhook(endpoint, {
        username: 'Hawk',
      });

      await webhook.send(message);
    } catch (e) {
      this.logger.log('error', 'Can\'t deliver Incoming Webhook. Slack returns an error: ', e);
    }
  }
}

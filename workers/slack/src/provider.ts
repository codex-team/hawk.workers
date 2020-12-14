import NotificationsProvider from 'hawk-worker-sender/src/provider';
import { AllNotifications, EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import templates from './templates';
import { IncomingWebhookSendArguments } from '@slack/webhook';
import { SlackTemplate } from '../types/template';
import SlackDeliverer from './deliverer';

/**
 * This class provides a 'send' method that will renders and sends a notification
 */
export default class SlackProvider extends NotificationsProvider {
  /**
   * Class with the 'deliver' method for sending messages to the Slack
   */
  private readonly deliverer: SlackDeliverer;

  /**
   * Constructor allows to separate dependencies that can't be tested,
   * so in tests they will be mocked.
   */
  constructor() {
    super();

    this.deliverer = new SlackDeliverer();
  }

  /**
   * Send slack message to recipient
   *
   * @param to - recipient endpoint
   * @param variables - variables for template
   */
  public async send(to: string, variables: AllNotifications): Promise<void> {
    let template: SlackTemplate;

    if (variables.type === 'event') {
      template = templates.NewEventTpl;
    } else if (variables.type === 'several-events') {
      template = templates.SeveralEventsTpl;
    } else {
      // todo: add assignee notification
      return;
    }

    const webhookArgs = await this.render(template, variables.payload as EventsTemplateVariables);

    await this.deliverer.deliver(to, webhookArgs);
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
}

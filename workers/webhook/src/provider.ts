import NotificationsProvider from 'hawk-worker-sender/src/provider';
import { Notification, EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import templates from './templates';
import { WebhookTemplate } from '../types/template';
import WebhookDeliverer from './deliverer';

/**
 * This class provides a 'send' method that renders and sends a webhook notification
 */
export default class WebhookProvider extends NotificationsProvider {
  /**
   * Class with the 'deliver' method for sending HTTP POST requests
   */
  private readonly deliverer: WebhookDeliverer;

  constructor() {
    super();

    this.deliverer = new WebhookDeliverer();
  }

  /**
   * Send webhook notification to recipient
   *
   * @param to - recipient endpoint URL
   * @param notification - notification with payload and type
   */
  public async send(to: string, notification: Notification): Promise<void> {
    let template: WebhookTemplate;

    switch (notification.type) {
      case 'event': template = templates.EventTpl; break;
      case 'several-events': template = templates.SeveralEventsTpl; break;
      default: return;
    }

    const payload = template(notification.payload as EventsTemplateVariables);

    await this.deliverer.deliver(to, payload);
  }
}

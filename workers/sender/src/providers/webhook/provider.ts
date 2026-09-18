import NotificationsProvider from 'hawk-worker-sender/src/provider';
import { Notification } from 'hawk-worker-sender/types/template-variables';
import { toDelivery } from './templates';
import WebhookDeliverer from './deliverer';

/**
 * Webhook notification provider.
 * Supports all notification types via a single generic serializer —
 * type comes from notification.type, payload is sanitized automatically.
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
    const delivery = toDelivery(notification);

    await this.deliverer.deliver(to, delivery);
  }
}

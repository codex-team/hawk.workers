import { EventsTemplateVariables, Notification } from 'hawk-worker-sender/types/template-variables';
import NotificationsProvider from 'hawk-worker-sender/src/provider';
import templates from './templates';
import { TelegramTemplate } from '../types/template';
import axios from 'axios';

/**
 * Class to provide telegram notifications
 */
export default class TelegramProvider extends NotificationsProvider {
  /**
   * Send telegram message to recipient
   *
   * @param to - recipient endpoint
   * @param notification - notification with payload and type
   */
  public async send(to: string, notification: Notification): Promise<void> {
    let template: TelegramTemplate;

    switch (notification.type) {
      case 'event': template = templates.EventTpl; break;
      case 'several-events':template = templates.SeveralEventsTpl; break;
      /**
       * @todo add assignee notification for telegram provider
       */
    }

    const message = await this.render(template, notification.payload as EventsTemplateVariables);

    await this.deliver(to, message);
  }

  /**
   * Render telegram message template
   *
   * @param template - template to render
   * @param variables - variables for template
   */
  private async render(template: TelegramTemplate, variables: EventsTemplateVariables): Promise<string> {
    return template(variables);
  }

  /**
   * Sends message to the telegram through the @codex_bot
   *
   * @param endpoint - where to send
   * @param message - what to send
   */
  private async deliver(endpoint: string, message: string): Promise<void> {
    await axios({
      method: 'post',
      url: endpoint,
      data: `parse_mode=Markdown&message=` + encodeURIComponent(message),
    });
  }
}

import NotificationsProvider from 'hawk-worker-sender/src/provider';
import { Notification, EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import templates from './templates';
import { LoopTemplate } from '../types/template';
import LoopDeliverer from './deliverer';

/**
 * This class provides a 'send' method that will renders and sends a notification
 */
export default class LoopProvider extends NotificationsProvider {
  /**
   * Class with the 'deliver' method for sending messages to the Loop
   */
  private readonly deliverer: LoopDeliverer;

  /**
   * Constructor allows to separate dependencies that can't be tested,
   * so in tests they will be mocked.
   */
  constructor() {
    super();

    this.deliverer = new LoopDeliverer();
  }

  /**
   * Send loop message to recipient
   *
   * @param to - recipient endpoint
   * @param notification - notification with payload and type
   */
  public async send(to: string, notification: Notification): Promise<void> {
    let template: LoopTemplate;

    switch (notification.type) {
      case 'event': template = templates.EventTpl; break;
      case 'several-events':template = templates.SeveralEventsTpl; break;
      /**
       * @todo add assignee notification for telegram provider
       */
    }

    const message = await this.render(template, notification.payload as EventsTemplateVariables);

    await this.deliverer.deliver(to, message);
  }

  /**
   * Render loop message template
   *
   * @param template - template to render
   * @param variables - variables for template
   */
  private async render(template: LoopTemplate, variables: EventsTemplateVariables): Promise<string> {
    return template(variables);
  }
}

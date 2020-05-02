import { TemplateVariables, EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import NotificationsProvider from 'hawk-worker-sender/src/provider';
import templates from './templates';
import {TelegramTemplate} from '../types/template';
import * as utils from '../../../lib/utils';


/**
 * Class to provide telegram notifications
 */
export default class TelegramProvider extends NotificationsProvider {
  /**
   * Send telegram message to recipient
   *
   * @param {string} to - recipient endpoint
   * @param {TemplateVariables} variables - variables for template
   */
  public async send(to: string, variables: EventsTemplateVariables): Promise<void> {

    let template: TelegramTemplate;

    if (false && variables.events.length === 1) {
      template = templates.NewEventTpl;
    } else {
      template = templates.SeveralEventsTpl;
    }

    const message = await this.render(template, variables);

    await utils.sendReport(message);
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
}

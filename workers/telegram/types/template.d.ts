import {EventsTemplateVariables} from 'hawk-worker-sender/types/template-variables';

/**
 * All Telegram templates should implement this interface
 */
export interface TelegramTemplate {
  /**
   * Rendering method that accepts tpl args and return rendered string
   * @param tplData - template variables
   */
  (tplData: EventsTemplateVariables): string;
}

import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';

/**
 * Loop templates should implement this interface
 */
export interface LoopTemplate {
  /**
   * Rendering method that accepts tpl args and return rendered string
   *
   * @param tplData - template variables
   */
  (tplData: EventsTemplateVariables): string;
}

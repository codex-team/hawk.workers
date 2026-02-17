import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';

/**
 * Webhook templates should implement this interface.
 * Returns a JSON-serializable representation of EventsTemplateVariables.
 */
export interface WebhookTemplate {
  /**
   * Rendering method that accepts tpl args and returns a JSON-serializable object
   *
   * @param tplData - template variables
   */
  (tplData: EventsTemplateVariables): Record<string, unknown>;
}

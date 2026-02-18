import { Notification } from 'hawk-worker-sender/types/template-variables';
import { WebhookDelivery } from '../../types/template';

/**
 * Internal/sensitive fields stripped from webhook payload at any nesting level
 */
const INTERNAL_FIELDS = new Set([
  'host',
  'hostOfStatic',
  'token',
  'notifications',
  'integrationId',
  'notificationRuleId',
  'visitedBy',
  'uidAdded',
]);

/**
 * Recursively converts MongoDB ObjectIds and other non-JSON-safe values to strings
 *
 * @param value - any value to sanitize
 */
function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object' && '_bsontype' in (value as Record<string, unknown>)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!INTERNAL_FIELDS.has(k)) {
        result[k] = sanitize(v);
      }
    }

    return result;
  }

  return value;
}

/**
 * Generic webhook template — handles any notification type
 * by passing through the sanitized payload as-is.
 *
 * Used as a fallback when no curated template exists for the notification type.
 *
 * @param notification - notification with type and payload
 */
export default function render(notification: Notification): WebhookDelivery {
  return {
    type: notification.type,
    payload: sanitize(notification.payload) as Record<string, unknown>,
  };
}

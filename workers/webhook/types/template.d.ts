/**
 * Unified root-level structure for all webhook deliveries.
 * Every webhook POST body has the same shape: { type, payload }.
 */
export interface WebhookDelivery {
  /** Notification type (e.g. 'event', 'several-events', 'assignee', 'payment-failed', ...) */
  type: string;

  /** Notification-specific payload — structure depends on the type */
  payload: Record<string, unknown>;
}

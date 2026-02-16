/**
 * Shape of the JSON body sent to webhook endpoints
 */
export interface WebhookPayload {
  /** Notification type */
  type: 'event' | 'several-events';

  /** Project info */
  project: {
    id: string;
    name: string;
    url?: string;
  };

  /** List of events in this notification */
  events: Array<{
    id: string;
    title: string;
    newCount: number;
    totalCount: number;
    url: string;
    location: string | null;
    daysRepeated: number;
  }>;

  /** Time period in seconds (for several-events) */
  period?: number;
}

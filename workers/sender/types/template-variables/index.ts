import { EventsTemplateVariables, EventNotification } from './event';
import { SeveralEventsNotification } from './several-events';
import { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
import { LowBalanceNotification, LowBalanceTemplateVariables } from './low-balance';

export { CommonTemplateVariables } from './common-template';
export { TemplateEventData, EventsTemplateVariables, EventNotification } from './event';
export { SeveralEventsNotification } from './several-events';
export { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
export { LowBalanceNotification } from './low-balance';

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type Notification = EventNotification | SeveralEventsNotification | AssigneeNotification | LowBalanceNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables | LowBalanceTemplateVariables;
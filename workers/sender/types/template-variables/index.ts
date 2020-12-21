import { EventsTemplateVariables, EventNotification } from './event';
import { SeveralEventsNotification } from './several-events';
import { AssigneeTemplateVariables, AssigneeNotification } from './assignee';

export { CommonTemplateVariables } from './common-template';
export { TemplateEventData, EventsTemplateVariables, EventNotification } from './event';
export { SeveralEventsNotification } from './several-events';
export { AssigneeTemplateVariables, AssigneeNotification } from './assignee';

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type Notification = EventNotification | SeveralEventsNotification | AssigneeNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables;
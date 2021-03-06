import { EventsTemplateVariables, EventNotification } from './event';
import { SeveralEventsNotification } from './several-events';
import { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
import { BlockWorkspaceTemplateVariables, BlockWorkspaceNotification } from './blockWorkspace';
import { PaymentFailedTemplateVariables, PaymentFailedNotification } from './payment-failed';
import { PaymentSuccessNotification, PaymentSuccessTemplateVariables } from './payment-success';

export { CommonTemplateVariables } from './common-template';
export { TemplateEventData, EventsTemplateVariables, EventNotification } from './event';
export { SeveralEventsNotification } from './several-events';
export { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
export { BlockWorkspaceTemplateVariables, BlockWorkspaceNotification } from './blockWorkspace';
export { PaymentFailedTemplateVariables, PaymentFailedNotification } from './payment-failed';
export { PaymentSuccessNotification } from './payment-success';

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type Notification = EventNotification | SeveralEventsNotification | AssigneeNotification | BlockWorkspaceNotification | PaymentFailedNotification | PaymentSuccessNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables | BlockWorkspaceTemplateVariables | PaymentFailedTemplateVariables | PaymentSuccessTemplateVariables;

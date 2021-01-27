import { EventsTemplateVariables, EventNotification } from './event';
import { SeveralEventsNotification } from './several-events';
import { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
import { LowBalanceNotification, LowBalanceTemplateVariables } from './low-balance';
import { SuccessPaymentNotification, SuccessPaymentTemplateVariables } from './success-payment';

export { CommonTemplateVariables } from './common-template';
export { TemplateEventData, EventsTemplateVariables, EventNotification } from './event';
export { SeveralEventsNotification } from './several-events';
export { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
export { LowBalanceNotification } from './low-balance';
export { SuccessPaymentNotification } from './success-payment';

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type Notification = EventNotification | SeveralEventsNotification | AssigneeNotification | LowBalanceNotification | SuccessPaymentNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables | LowBalanceTemplateVariables | SuccessPaymentTemplateVariables;
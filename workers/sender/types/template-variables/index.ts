import { EventsTemplateVariables, EventNotification } from './event';
import { SeveralEventsNotification } from './several-events';
import { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
import { BlockWorkspaceTemplateVariables, BlockWorkspaceNotification } from './blockWorkspace';
import { PaymentFailedTemplateVariables, PaymentFailedNotification } from './payment-failed';
import { PaymentSuccessNotification, PaymentSuccessTemplateVariables } from './payment-success';
import { DaysLimitAlmostReachedTemplateVariables, DaysLimitAlmostReachedNotification } from './days-limit-almost-reached';
import { EventsLimitAlmostReachedNotification, EventsLimitAlmostReachedTemplateVariables } from './events-limit-almost-reached';
import { SignUpNotification, SignUpVariables } from './sign-up';
import { PasswordResetNotification, PasswordResetVariables } from './password-reset';
import { WorkspaceInviteNotification, WorkspaceInviteVariables } from './workspace-invite';

export { CommonTemplateVariables } from './common-template';
export { TemplateEventData, EventsTemplateVariables, EventNotification } from './event';
export { SeveralEventsNotification } from './several-events';
export { AssigneeTemplateVariables, AssigneeNotification } from './assignee';
export { BlockWorkspaceTemplateVariables, BlockWorkspaceNotification } from './blockWorkspace';
export { PaymentFailedTemplateVariables, PaymentFailedNotification } from './payment-failed';
export { PaymentSuccessNotification, PaymentSuccessTemplateVariables } from './payment-success';
export { SignUpNotification, SignUpVariables } from './sign-up';
export { PasswordResetNotification, PasswordResetVariables } from './password-reset';
export { WorkspaceInviteNotification, WorkspaceInviteVariables } from './workspace-invite';

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type Notification = EventNotification
  | SeveralEventsNotification
  | AssigneeNotification
  | BlockWorkspaceNotification
  | PaymentFailedNotification
  | PaymentSuccessNotification
  | DaysLimitAlmostReachedNotification
  | EventsLimitAlmostReachedNotification
  | SignUpNotification
  | PasswordResetNotification
  | WorkspaceInviteNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables
  | AssigneeTemplateVariables
  | BlockWorkspaceTemplateVariables
  | PaymentFailedTemplateVariables
  | PaymentSuccessTemplateVariables
  | DaysLimitAlmostReachedTemplateVariables
  | EventsLimitAlmostReachedTemplateVariables
  | SignUpVariables
  | PasswordResetVariables
  | WorkspaceInviteVariables;

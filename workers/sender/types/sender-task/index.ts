import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerBlockWorkspaceTask } from './blockWorkspace';
import { SenderWorkerPaymentFailedTask } from './payment-failed';
import { SenderWorkerPaymentSuccessTask } from './payment-success';
import { SenderWorkerDaysLimitAlmostReachedTask } from './days-limit-almost-reached';
import { SenderWorkerEventsLimitAlmostReachedTask } from './events-limit-almost-reached';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerBlockWorkspaceTask, SenderWorkerBlockWorkspacePayload } from './blockWorkspace';
export { SenderWorkerPaymentFailedTask, SenderWorkerPaymentFailedPayload } from './payment-failed';
export { SenderWorkerPaymentSuccessTask, SenderWorkerPaymentSuccessPayload } from './payment-success';
export { SenderWorkerDaysLimitAlmostReachedTask, SenderWorkerDaysLimitAlmostReachedPayload } from './days-limit-almost-reached';
export { SenderWorkerEventsLimitAlmostReachedTask, SenderWorkerEventsLimitAlmostReachedPayload } from './events-limit-almost-reached';

export type SenderWorkerTask = SenderWorkerEventTask
  | SenderWorkerAssigneeTask
  | SenderWorkerBlockWorkspaceTask
  | SenderWorkerPaymentFailedTask
  | SenderWorkerPaymentSuccessTask
  | SenderWorkerDaysLimitAlmostReachedTask
  | SenderWorkerEventsLimitAlmostReachedTask;

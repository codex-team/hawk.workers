import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerBlockWorkspaceTask } from './blockWorkspace';
import { SenderWorkerPaymentFailedTask } from './payment-failed';
import { SenderWorkerPaymentSuccessTask } from './payment-success';
import { SenderWorkerDaysLimitReachedTask } from './days-limit-reached';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerBlockWorkspaceTask, SenderWorkerBlockWorkspacePayload } from './blockWorkspace';
export { SenderWorkerPaymentFailedTask, SenderWorkerPaymentFailedPayload } from './payment-failed';
export { SenderWorkerPaymentSuccessTask, SenderWorkerPaymentSuccessPayload } from './payment-success';
export { SenderWorkerDaysLimitReachedTask, SenderWorkerDaysLimitReachedPayload } from './days-limit-reached';

export type SenderWorkerTask = SenderWorkerEventTask
  | SenderWorkerAssigneeTask
  | SenderWorkerBlockWorkspaceTask
  | SenderWorkerPaymentFailedTask
  | SenderWorkerPaymentSuccessTask
  | SenderWorkerDaysLimitReachedTask;

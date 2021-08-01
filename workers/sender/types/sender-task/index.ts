import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerBlockWorkspaceTask } from './blockWorkspace';
import { SenderWorkerPaymentFailedTask } from './payment-failed';
import { SenderWorkerPaymentSuccessTask } from './payment-success';
import { SenderWorkerSignUpTask } from './signUp';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerBlockWorkspaceTask, SenderWorkerBlockWorkspacePayload } from './blockWorkspace';
export { SenderWorkerPaymentFailedTask, SenderWorkerPaymentFailedPayload } from './payment-failed';
export { SenderWorkerPaymentSuccessTask, SenderWorkerPaymentSuccessPayload } from './payment-success';
export { SenderWorkerSignUpTask, SenderWorkerSignUpPayload } from './signUp';

export type SenderWorkerTask = SenderWorkerEventTask
  | SenderWorkerAssigneeTask
  | SenderWorkerBlockWorkspaceTask
  | SenderWorkerPaymentFailedTask
  | SenderWorkerPaymentSuccessTask
  | SenderWorkerSignUpTask;

import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerBlockWorkspaceTask } from './blockWorkspace';
import { SenderWorkerPaymentFailedTask } from './payment-failed';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerBlockWorkspaceTask, SenderWorkerBlockWorkspacePayload } from './blockWorkspace';
export { SenderWorkerPaymentFailedTask, SenderWorkerPaymentFailedPayload } from './payment-failed';

export type SenderWorkerTask = SenderWorkerEventTask | SenderWorkerAssigneeTask | SenderWorkerBlockWorkspaceTask | SenderWorkerPaymentFailedTask;

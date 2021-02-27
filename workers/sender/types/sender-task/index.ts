import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerPaymentFailedTask } from './payment-failed';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerPaymentFailedTask, SenderWorkerPaymentFailedPayload } from './payment-failed';

export type SenderWorkerTask = SenderWorkerEventTask | SenderWorkerAssigneeTask | SenderWorkerPaymentFailedTask;
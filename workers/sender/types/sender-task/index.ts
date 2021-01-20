import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';
import { SenderWorkerLowBalanceTask } from './low-balance';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';
export { SenderWorkerLowBalanceTask, SenderWorkerLowBalancePayload } from './low-balance';

export type SenderWorkerTask = SenderWorkerEventTask | SenderWorkerAssigneeTask | SenderWorkerLowBalanceTask;
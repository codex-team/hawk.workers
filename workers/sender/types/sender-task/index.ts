import { SenderWorkerAssigneeTask } from './assignee';
import { SenderWorkerEventTask } from './event';

export { SenderWorkerEventTask, SenderWorkerEventPayload } from './event';
export { SenderWorkerAssigneeTask, SenderWorkerAssigneePayload } from './assignee';

export type SenderWorkerTask = SenderWorkerEventTask | SenderWorkerAssigneeTask;
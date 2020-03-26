import {EventData} from '../../../lib/types/event-worker-task';
import {WorkerTask} from '../../../lib/types/worker-task';

type NotifierEvent = Pick<EventData, 'title'> & {
  groupHash: string;
  isNew: boolean;
};

export interface NotifierWorkerTask extends WorkerTask {
  projectId: string;

  event: NotifierEvent;
}

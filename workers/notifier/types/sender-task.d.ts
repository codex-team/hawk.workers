import {WorkerTask} from '../../../lib/types/worker-task';
import {BufferData} from '../src/buffer';

export interface SenderWorkerTask extends WorkerTask {
  projectId: string;
  ruleId: string;
  events: BufferData[];
}

import axios from 'axios';
import {CriticalError, NonCriticalError, Worker} from '../../../lib/worker';
import * as pkg from '../package.json';
import {NotifySlackWorkerTask} from '../types/notify-slack-worker-task';

/**
 * Worker for sending Slack notifications
 */
export default class NotifySlackWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   */
  public async handle(task: NotifySlackWorkerTask): Promise<void> {
    try {
      await axios.post(task.hook, {
        text: task.text,
      });
    } catch (error) {
      if (error.response || error.request) {
        /*
         * error.response:
         * The request was made and the server responded with a
         * status code that falls out of the range of 2xx
         *
         * error.request:
         * The request was made but no response was received, `error.request`
         * is an instance of XMLHttpRequest in the browser and an instance
         * of http.ClientRequest in Node.js
         *
         * Requeue message, try again.
         */
        throw new CriticalError(error);
      } else {
        // Something happened in setting up the request and triggered an Error
        throw new NonCriticalError(error);
      }
    }
  }
}

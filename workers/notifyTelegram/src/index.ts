import axios from "axios";
import qs from "querystring";
import {CriticalError, NonCriticalError, Worker} from "../../../lib/worker";
import * as pkg from "../package.json";
import {NotifyTelegramWorkerTask} from "../types/notify-telegram-worker-task";

/**
 * Worker for sending Telegram notifications
 */
export default class NotifyTelegramWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   */
  public async handle(event: NotifyTelegramWorkerTask): Promise<void> {
    try {
      await axios.post(event.hook, qs.stringify({
        message: event.message,
        // eslint-disable-next-line camelcase
        parse_mode: event.parseMode || "Markdown",
      }), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
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

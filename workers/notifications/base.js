const { Worker, CriticalError, NonCriticalError } = require('../../lib/worker');
const { NOTIFY_EMAIL, NOTIFY_SLACK, NOTIFY_TELEGRAM } = require('../../lib/workerNames');

/**
 * Notification worker base class
 */
class NotificationWorker extends Worker {

}

/**
 * Error when request to hook failed. Requeue message.
 */
class RequestFailedError extends CriticalError {
}

/**
 * Error when failed to set up request with given params
 */
class ParamError extends NonCriticalError {

}

const providerQueues = {
  email: NOTIFY_EMAIL,
  telegram: NOTIFY_TELEGRAM,
  slack: NOTIFY_SLACK
};

module.exports = { NotificationWorker, RequestFailedError, ParamError, providerQueues };

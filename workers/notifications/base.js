const { Worker, CriticalError, NonCriticalError } = require('../../lib/worker');

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

module.exports = { NotificationWorker, RequestFailedError, ParamError };

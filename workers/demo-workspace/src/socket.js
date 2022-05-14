const WebSocket = require('ws');

class Socket {
  constructor({
    collectorEndpoint,
    onMessage = (message) => { },
    onClose = () => { },
    onOpen = () => { },
    reconnectionAttempts = 5,
    reconnectionTimeout = 10000, // 10 * 1000 ms = 10 sec
  }) {
    this.url = collectorEndpoint;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.onOpen = onOpen;
    this.reconnectionTimeout = reconnectionTimeout;
    this.reconnectionAttempts = reconnectionAttempts;

    this.eventsQueue = [];
    this.ws = null;

    this.init()
      .then(() => {
        this.sendQueue();
      })
      .catch((error) => {
        console.log('WebSocket error', 'error', error);
      });
  }

  /**
   * Send an event to the Collector
   *
   * @param message - event data in Hawk Format
   */
  async send(message) {
    if (this.ws === null) {
      this.eventsQueue.push(message);

      return this.init();
    }

    switch (this.ws.readyState) {
      case WebSocket.OPEN:
        return this.ws.send(JSON.stringify(message));

      case WebSocket.CLOSED:
        this.eventsQueue.push(message);

        return this.reconnect();

      case WebSocket.CONNECTING:
      case WebSocket.CLOSING:
        this.eventsQueue.push(message);
    }
  }

  /**
   * Create new WebSocket connection and setup event listeners
   */
  init() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      /**
       * New message handler
       */
      if (typeof this.onMessage === 'function') {
        this.ws.onmessage = this.onMessage;
      }

      /**
       * Connection closing handler
       *
       * @param event - websocket event on closing
       */
      this.ws.onclose = (event) => {
        if (typeof this.onClose === 'function') {
          this.onClose(event);
        }
      };

      /**
       * Error handler
       *
       * @param event - websocket event on error
       */
      this.ws.onerror = (event) => {
        reject(event);
      };

      this.ws.onopen = (event) => {
        if (typeof this.onOpen === 'function') {
          this.onOpen(event);
        }

        resolve();
      };
    });
  }

  /**
   * Tries to reconnect to the server for specified number of times with the interval
   *
   * @param {boolean} [isForcedCall] - call function despite on timer
   * @returns {Promise<void>}
   */
  async reconnect(isForcedCall = false) {
    if (this.reconnectionTimer && !isForcedCall) {
      return;
    }

    this.reconnectionTimer = null;

    try {
      await this.init();

      console.log('Successfully reconnected.', 'info');
    } catch (error) {
      this.reconnectionAttempts--;

      if (this.reconnectionAttempts === 0) {
        return;
      }

      this.reconnectionTimer = setTimeout(() => {
        this.reconnect(true);
      }, this.reconnectionTimeout);
    }
  }

  /**
   * Sends all queued events one-by-one
   */
  sendQueue() {
    while (this.eventsQueue.length) {
      this.send(this.eventsQueue.shift())
        .catch((sendingError) => {
          console.log('WebSocket sending error', 'error', sendingError);
        });
    }
  }
}

module.exports = Socket;
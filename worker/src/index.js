const net = require('net');
let debug = require('debug')('worker');
const { EventEmitter } = require('events');

/**
 *
 *
 * @class Worker
 * @extends {EventEmitter}
 */
class Worker extends EventEmitter {
  /**
   *Creates an instance of Worker.
   * @param {*} name
   * @memberof Worker
   */
  constructor(name, host, port) {
    super();

    this.MESSAGES = {
      ACK: 'ACK',
      DONE: 'DONE',
      TASK: 'TASK'
    };

    this.name = name;
    this.host = host;
    this.port = port;

    debug = require('debug')('worker:' + name);

    try {
      this.connect();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }

    this.init();
  }

  /**
   *
   *
   * @memberof Worker
   */
  init() {
    this.socket.on('data', data => {
      const msg = JSON.parse(data.toString());

      debug(msg);

      if (msg.task) {
        this.socket.write(JSON.stringify({ message: this.MESSAGES.ACK }));
        this.emit('task', msg.task);
      }
    });

    this.socket.on('close', had_error => {
      if (had_error) {
        debug('Error on close');
      } else {
        debug('Socket closed');
      }
    });

    this.socket.on('error', err => {
      if (err) {
        console.error(err);
      }
    });

    this.socket.on('ready', () => {
      this.socket.write(
        JSON.stringify({
          message: 'Hello',
          name: this.name
        })
      );
    });

    this.on('done', state => {
      this.socket.write(
        JSON.stringify({
          message: this.MESSAGES.DONE,
          id: state.id,
          success: state.success,
          data: state.data
        })
      );
    });
  }

  /**
   *
   *
   * @memberof Worker
   */
  connect() {
    this.socket = net.connect(
      this.port,
      this.host,
      () => {
        debug(`Connected to ${this.host}:${this.port}`);
      }
    );
  }

  /**
   *
   *
   * @param {*} payload
   * @memberof Worker
   */
  sendMessage(payload) {
    this.socket.write(JSON.stringify(payload));
  }

  /**
   *
   *
   * @param {*} workerName
   * @param {*} payload
   * @memberof Worker
   */
  pushTask(workerName, payload) {
    this.sendMessage({
      message: this.MESSAGES.TASK,
      task: payload
    });
  }
}

module.exports = { Worker };

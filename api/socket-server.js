const net = require('net');
const registry = require('../helpers/registry');
const server = net.createServer();

let rooms = {};

server.on('connected', (socket) => {
  // 'connection' listener
  console.log('client connected');

  socket.on('data', (data) => {
    data = utils.bufferToJson(data);

    if (!data) {
      return;
    }

    if (data.type == 'INIT') {
      socket.room = data.message.room;
      socket.id = data.message.id;
      socket.isFree = true;

      if (rooms[data.message.worker]) {
        rooms[socket.room].push(socket);
      } else {
        rooms[socket.room] = [ socket ];
      }

      onFree(socket);
    }

    if (data.type == 'FREE') {
      let room = data.message.worker;
      let id = data.message.id;
      let s = rooms[room].find((item) => {
        return item.id == id;
      });

      onFree(s);
    }

    if (data.type == 'ADD_TASK') {
      let room = data.message.worker;
      let s = findFreeSocketInRoom(room);

      if (s != null) {
        s.isFree = false;
        let buff = utils.jsonToBuffer({
          type: 'POP_TASK',
          message: { task: data.message.task }
        });

        s.write(buff);
      } else {
        onPush(room, data.message.task);
      }
    }

    console.log(data);
  });

  socket.on('end', () => {
    // save current task if error ???
    rooms[socket.room].splise(rooms.indexOf(socket));
    console.log('client disconnected');
  });

  socket.on('error', (err) => {
    // save current task if error ???
    // rm from rooms
    console.log('socket error', err);
  });

  // socket.write('{"url":"example.com"}');
  // socket.pipe(socket);
});

server.on('error', (err) => {
  console.log('error', err);
  // throw err;
});

server.listen(8125, () => {
  console.log('server bound');
});

/**
 * Action if free worker excepted
 * @param {net.Socket} s
 */
async function onFree(s) {
  try {
    const task = await registry.popTask(s.room);

    if (task) {
      let buff = utils.jsonToBuffer({
        type: 'POP_TASK',
        message: { task: task }
      });

      s.write(buff);
      s.isFree = false;
    } else {
      s.isFree = true;
    }
  } catch (e) {
    console.log(e, 'onFree error');
  }
}

/**
 * Action on pushing new task
 * @param {string} room
 * @param {object} task
 */
async function onPush(room, task) {
  try {
    await registry.pushTask(room, task);
    // пока выполнялась асинхронная операция
    // один воркер мог освобоиться
    // проверим это
    // и если да, то
    // -- сразу поставим ему задачу,
    // -- текущую удалим из регистри
    let s = findFreeSocketInRoom(room);

    if (s != null) {
      s.isFree = false;
      let buff = utils.jsonToBuffer({
        type: 'POP_TASK',
        message: { task: task }
      });

      s.write(buff);
      await registry.popTask(room);
    }
  } catch (e) {
    console.log(e, ' error onPushTask');
  }
}

/**
 * Finding free socket in the room
 * @param {string} room
 * @returns {net.Socket | null}
 */
function findFreeSocketInRoom(room) {
  return rooms[room].find((item) => {
    return item.isFree == true;
  });
}

const utils = {
  /**
   * Convert buffer data to JSON
   * (for sockets)
   * @param {Buffer} message in buffer view
   * @returns {object|null}
   */
  jsonFromBuffer: function (buff) {
    let result;

    try {
      result = JSON.parse(buff.toString());
    } catch (err) {
      result = null;
    }

    return result;
  },

  /**
   * Convert JSON to buffer data
   * (for sockets)
   * @param {object} JSON message
   * @returns {Buffer|null}
   */
  jsonToBuffer: function (obj) {
    let result;

    try {
      result = Buffer.from(JSON.stringify(obj));
    } catch (err) {
      result = null;
    }

    return result;
  }

};
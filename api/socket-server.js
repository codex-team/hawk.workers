const net = require('net');
const registry = require('../helpers/registry');
const utils = {
  /**
   * Convert buffer data to JSON
   * (for sockets)
   * @param {Buffer} message in buffer view
   * @returns {object|null}
   */
  bufferToJson: function (buff) {
    let result;
    let str;

    try {
      str = '[' + buff.toString().slice(0, -1) + ']';
      console.log(str);
      result = JSON.parse(str);
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
let rooms = {};

let server = net.createServer((socket) => {
  // 'connection' listener
  console.log('client connected');

  socket.on('data', (datas) => {
    datas = utils.bufferToJson(datas);
    if (!datas) {
      return;
    }

    datas.forEach((data) => {
    console.log('signal', data);    
    if (data.type == 'INIT') {
      console.log('oninit');
      socket.room = data.message.room;
      socket.id = data.message.id;
      socket.isFree = true;

      if (rooms[data.message.worker]) {
        rooms[socket.room].push(socket);
      } else {
        rooms[socket.room] = [ socket ];
      }

      if (data.message.singleton) {
        let buf = utils.jsonToBuffer({ type: 'POP_TASK', message: {} });
        socket.write(buf);
      } else {
        onFree(socket);
      }
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
    });
  });

  socket.on('end', () => {
    // save current task if error ???
    rooms[socket.room].splice(rooms[socket.room].indexOf(socket), 1);
    console.log('client disconnected');
  });

  socket.on('error', (err) => {
    // save current task if error ???
    // rm from rooms
    console.log('socket error', err);
    console.log(socket.room);
  });

  // socket.write('{"url":"example.com"}');
  // socket.pipe(socket);
});

server.on('error', (err) => {
  console.log('error', err);
  // throw err;
});

server.listen(8126, () => {
  console.log('server bound');
});

/**
 * Action if free worker excepted
 * @param {net.Socket} s
 */
async function onFree(s) {
  console.log('onfree');
  try {
    const task = await registry.popTask(s.room);
    console.log('task');
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
  if (!rooms[room] || !rooms[room].length)
    return null;

  return rooms[room].find((item) => {
    return item.isFree == true;
  });
}


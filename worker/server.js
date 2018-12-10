const net = require('net');

const host = '0.0.0.0';
const port = 4000;

let sockets = [];

const server = net.createServer();

server.on('connection', sock => {
  console.log(`CONNECTED: ${sock.remoteAddress}:${sock.remotePort}, ${sockets.length}`);
  const id = sockets.length;

  sockets.push(sock);

  sock.write(JSON.stringify({ message: 'Hello' }) + '\n');

  sock.on('data', data => {
    let msg = data.toString();

    if (msg.indexOf('admin') !== -1) {
      const [admin, command, sendId, payload] = msg.split(' ');

      if (command === 'send') {
        sockets[+sendId].write(payload);
        sock.write('OK\n');
      }
    }
    console.log(`[${sock.remoteAddress}:${sock.remotePort}, ${id}] ${data.toString().replace('\n', '')}`);
  });
});

server.on('error', err => {
  console.error(err);
});

server.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}...`);
});

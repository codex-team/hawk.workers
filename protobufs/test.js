const { registry } = require('./message');

const toEncode = {
  type: 0,
  message: {
    worker: 'test',
    id: 'test',
    task: { kek: 'kek' }
  }
};

let msg = registry.Packet.create(toEncode);
let encoded = registry.Packet.encode(msg).finish();
let decoded = registry.Packet.decode(encoded);

console.dir(msg);
console.log(encoded);
console.dir(registry.Packet.toObject(decoded));

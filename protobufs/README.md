# Registry Protocol Buffers for TCP Sockets

## Table of Contents
--------------------

- [JS usage](#usage)
- [Protobuf reference](#proto)
- [message.proto](#message.proto)
  - [Packet](#registry.Packet)
  - [Packet.Payload](#registry.Packet.Payload)
  - [PacketType](#registry.PacketType)
  

<a name="usage"/>

## JS usage
-----------

- To encode an object call `Type.create(obj).encode().finish() `<br>
  E.g.

  ```js
  const toEncode = {
  type: 0,
  message: {
    worker: 'test',
    id: 'test',
    task: { kek: 'kek' }
   }
  };

  console.log(registry.Packet.create(toEncode).encode().finish())
  ```

- To decode call `Type.decode(msg).toObject()`<br>
  E.g.

  ```js
  let decoded = registry.Packet.decode(encoded);

  console.dir(registry.Packet.toObject(decoded));
  ```

- Run `build:proto` npm script to compile `.proto` files to JS

<a name="proto"/>

## Protobuf reference
---------------------

<a name="message.proto"/>

### message.proto

Registry-Worker tcp binary protocol

<a name="registry.Packet"/>

#### Packet
Represents protocol packet

| Field   | Type                                       | Label | Description            |
| ------- | ------------------------------------------ | ----- | ---------------------- |
| type    | [PacketType](#registry.PacketType)         |       | Type of packet(action) |
| message | [Packet.Payload](#registry.Packet.Payload) |       | Packet message         |

<a name="registry.Packet.Payload"/>

#### Packet.Payload

Represents packet payload

| Field  | Type                | Label    | Description |
| ------ | ------------------- | -------- | ----------- |
| worker | string              |          | Worker name |
| id     | string              |          | Worker id   |
| task   | map<string, string> | repeated | Worker task |

<a name="registry.PacketType"/>

#### PacketType

Represents packet type

| Name      | Number | Description               |
| --------- | ------ | ------------------------- |
| INIT      | 0      | New worker connect        |
| PUSH_TASK | 1      | Push task to registry     |
| POP_TASK  | 2      | Pop task from registry    |
| READY     | 3      | Ready for receiving tasks |

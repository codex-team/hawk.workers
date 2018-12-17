/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.registry = (function() {

    /**
     * Namespace registry.
     * @exports registry
     * @namespace
     */
    var registry = {};

    /**
     * PacketType enum.
     * @name registry.PacketType
     * @enum {string}
     * @property {number} INIT=0 INIT value
     * @property {number} PUSH_TASK=1 PUSH_TASK value
     * @property {number} POP_TASK=2 POP_TASK value
     * @property {number} READY=3 READY value
     */
    registry.PacketType = (function() {
        var valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "INIT"] = 0;
        values[valuesById[1] = "PUSH_TASK"] = 1;
        values[valuesById[2] = "POP_TASK"] = 2;
        values[valuesById[3] = "READY"] = 3;
        return values;
    })();

    registry.Packet = (function() {

        /**
         * Properties of a Packet.
         * @memberof registry
         * @interface IPacket
         * @property {registry.PacketType|null} [type] Packet type
         * @property {registry.Packet.IMessage|null} [message] Packet message
         */

        /**
         * Constructs a new Packet.
         * @memberof registry
         * @classdesc Represents a Packet.
         * @implements IPacket
         * @constructor
         * @param {registry.IPacket=} [properties] Properties to set
         */
        function Packet(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Packet type.
         * @member {registry.PacketType} type
         * @memberof registry.Packet
         * @instance
         */
        Packet.prototype.type = 0;

        /**
         * Packet message.
         * @member {registry.Packet.IMessage|null|undefined} message
         * @memberof registry.Packet
         * @instance
         */
        Packet.prototype.message = null;

        /**
         * Creates a new Packet instance using the specified properties.
         * @function create
         * @memberof registry.Packet
         * @static
         * @param {registry.IPacket=} [properties] Properties to set
         * @returns {registry.Packet} Packet instance
         */
        Packet.create = function create(properties) {
            return new Packet(properties);
        };

        /**
         * Encodes the specified Packet message. Does not implicitly {@link registry.Packet.verify|verify} messages.
         * @function encode
         * @memberof registry.Packet
         * @static
         * @param {registry.IPacket} message Packet message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Packet.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.type != null && message.hasOwnProperty("type"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
            if (message.message != null && message.hasOwnProperty("message"))
                $root.registry.Packet.Message.encode(message.message, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Packet message, length delimited. Does not implicitly {@link registry.Packet.verify|verify} messages.
         * @function encodeDelimited
         * @memberof registry.Packet
         * @static
         * @param {registry.IPacket} message Packet message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Packet.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Packet message from the specified reader or buffer.
         * @function decode
         * @memberof registry.Packet
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {registry.Packet} Packet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Packet.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.registry.Packet();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.type = reader.int32();
                    break;
                case 2:
                    message.message = $root.registry.Packet.Message.decode(reader, reader.uint32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Packet message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof registry.Packet
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {registry.Packet} Packet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Packet.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Packet message.
         * @function verify
         * @memberof registry.Packet
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Packet.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                    break;
                }
            if (message.message != null && message.hasOwnProperty("message")) {
                var error = $root.registry.Packet.Message.verify(message.message);
                if (error)
                    return "message." + error;
            }
            return null;
        };

        /**
         * Creates a Packet message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof registry.Packet
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {registry.Packet} Packet
         */
        Packet.fromObject = function fromObject(object) {
            if (object instanceof $root.registry.Packet)
                return object;
            var message = new $root.registry.Packet();
            switch (object.type) {
            case "INIT":
            case 0:
                message.type = 0;
                break;
            case "PUSH_TASK":
            case 1:
                message.type = 1;
                break;
            case "POP_TASK":
            case 2:
                message.type = 2;
                break;
            case "READY":
            case 3:
                message.type = 3;
                break;
            }
            if (object.message != null) {
                if (typeof object.message !== "object")
                    throw TypeError(".registry.Packet.message: object expected");
                message.message = $root.registry.Packet.Message.fromObject(object.message);
            }
            return message;
        };

        /**
         * Creates a plain object from a Packet message. Also converts values to other types if specified.
         * @function toObject
         * @memberof registry.Packet
         * @static
         * @param {registry.Packet} message Packet
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Packet.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.type = options.enums === String ? "INIT" : 0;
                object.message = null;
            }
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.registry.PacketType[message.type] : message.type;
            if (message.message != null && message.hasOwnProperty("message"))
                object.message = $root.registry.Packet.Message.toObject(message.message, options);
            return object;
        };

        /**
         * Converts this Packet to JSON.
         * @function toJSON
         * @memberof registry.Packet
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Packet.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        Packet.Message = (function() {

            /**
             * Properties of a Message.
             * @memberof registry.Packet
             * @interface IMessage
             * @property {string|null} [worker] Message worker
             * @property {string|null} [id] Message id
             * @property {Object.<string,string>|null} [task] Message task
             */

            /**
             * Constructs a new Message.
             * @memberof registry.Packet
             * @classdesc Represents a Message.
             * @implements IMessage
             * @constructor
             * @param {registry.Packet.IMessage=} [properties] Properties to set
             */
            function Message(properties) {
                this.task = {};
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Message worker.
             * @member {string} worker
             * @memberof registry.Packet.Message
             * @instance
             */
            Message.prototype.worker = "";

            /**
             * Message id.
             * @member {string} id
             * @memberof registry.Packet.Message
             * @instance
             */
            Message.prototype.id = "";

            /**
             * Message task.
             * @member {Object.<string,string>} task
             * @memberof registry.Packet.Message
             * @instance
             */
            Message.prototype.task = $util.emptyObject;

            /**
             * Creates a new Message instance using the specified properties.
             * @function create
             * @memberof registry.Packet.Message
             * @static
             * @param {registry.Packet.IMessage=} [properties] Properties to set
             * @returns {registry.Packet.Message} Message instance
             */
            Message.create = function create(properties) {
                return new Message(properties);
            };

            /**
             * Encodes the specified Message message. Does not implicitly {@link registry.Packet.Message.verify|verify} messages.
             * @function encode
             * @memberof registry.Packet.Message
             * @static
             * @param {registry.Packet.IMessage} message Message message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Message.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.worker != null && message.hasOwnProperty("worker"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.worker);
                if (message.id != null && message.hasOwnProperty("id"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.id);
                if (message.task != null && message.hasOwnProperty("task"))
                    for (var keys = Object.keys(message.task), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 3, wireType 2 =*/26).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.task[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified Message message, length delimited. Does not implicitly {@link registry.Packet.Message.verify|verify} messages.
             * @function encodeDelimited
             * @memberof registry.Packet.Message
             * @static
             * @param {registry.Packet.IMessage} message Message message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Message.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Message message from the specified reader or buffer.
             * @function decode
             * @memberof registry.Packet.Message
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {registry.Packet.Message} Message
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Message.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.registry.Packet.Message(), key;
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1:
                        message.worker = reader.string();
                        break;
                    case 2:
                        message.id = reader.string();
                        break;
                    case 3:
                        reader.skip().pos++;
                        if (message.task === $util.emptyObject)
                            message.task = {};
                        key = reader.string();
                        reader.pos++;
                        message.task[key] = reader.string();
                        break;
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Message message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof registry.Packet.Message
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {registry.Packet.Message} Message
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Message.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Message message.
             * @function verify
             * @memberof registry.Packet.Message
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Message.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.worker != null && message.hasOwnProperty("worker"))
                    if (!$util.isString(message.worker))
                        return "worker: string expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.task != null && message.hasOwnProperty("task")) {
                    if (!$util.isObject(message.task))
                        return "task: object expected";
                    var key = Object.keys(message.task);
                    for (var i = 0; i < key.length; ++i)
                        if (!$util.isString(message.task[key[i]]))
                            return "task: string{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a Message message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof registry.Packet.Message
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {registry.Packet.Message} Message
             */
            Message.fromObject = function fromObject(object) {
                if (object instanceof $root.registry.Packet.Message)
                    return object;
                var message = new $root.registry.Packet.Message();
                if (object.worker != null)
                    message.worker = String(object.worker);
                if (object.id != null)
                    message.id = String(object.id);
                if (object.task) {
                    if (typeof object.task !== "object")
                        throw TypeError(".registry.Packet.Message.task: object expected");
                    message.task = {};
                    for (var keys = Object.keys(object.task), i = 0; i < keys.length; ++i)
                        message.task[keys[i]] = String(object.task[keys[i]]);
                }
                return message;
            };

            /**
             * Creates a plain object from a Message message. Also converts values to other types if specified.
             * @function toObject
             * @memberof registry.Packet.Message
             * @static
             * @param {registry.Packet.Message} message Message
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Message.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.objects || options.defaults)
                    object.task = {};
                if (options.defaults) {
                    object.worker = "";
                    object.id = "";
                }
                if (message.worker != null && message.hasOwnProperty("worker"))
                    object.worker = message.worker;
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                var keys2;
                if (message.task && (keys2 = Object.keys(message.task)).length) {
                    object.task = {};
                    for (var j = 0; j < keys2.length; ++j)
                        object.task[keys2[j]] = message.task[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this Message to JSON.
             * @function toJSON
             * @memberof registry.Packet.Message
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Message.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            return Message;
        })();

        return Packet;
    })();

    return registry;
})();

module.exports = $root;

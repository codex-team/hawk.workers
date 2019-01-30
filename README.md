# Hawk workers

Workers for processing hawk's background tasks

Registry - RabbitMQ

> More info on setting up Registry [here](https://github.com/codex-team/hawk.registry)

## Getting started

- Inherit from `Worker` class and implement `handle` method which process tasks from registry (see more in [`lib/worker.js`](lib/worker.js)) [Example](workers/nodejs/index.js)

- Edit `.env` file (see more below)

- Use `worker.start()` to start your worker. You may write a simple runner like [this](workers/nodejs/runner.js)

## Env vars

| Variable            | Description                                                             | Default value    |
| ------------------- | ----------------------------------------------------------------------- | ---------------- |
| REGISTRY_URL        | RabbitMQ connection URL                                                 | amqp://localhost |
| REGISRTY_QUEUE_NAME | RabbitMQ queue name                                                     | test             |
| SIMULTANEOUS_TASKS  | RabbitMQ Consumer prefetch value (How many tasks can do simultaneously) | 1                |

**IMPORTANT**

> `.env` file in root act like _global_ preferences for all workers in `workers` folder.
>
> If some variable is present in root `.env` file, it is **NOT** overwritten by local `.env` in worker's folder
>
> This allows to set global MongoDB or/and RabbitMQ connection settings while leaving option to set local queue name for each worker

## Testing

- Make `.env` file with test settings
- Run `yarn test:<component name>`

| Component                       | Command            | Requirements |
| ------------------------------- | ------------------ | ------------ |
| Base worker(`lib`)              | `yarn test:base`   | - RabbitMQ   |
| NodeJS worker(`workers/nodejs`) | `yarn test:nodejs` | None         |

## Database controller

MongoDB controller is bundled(see [`lib/db`](lib/db))

You can tweak it (add schemas, etc) and use it in your workers to handle database communication

### Example

```javascript
const db = require("lib/db/mongoose-controller");

await db.connect("mongodb://localhost:27017");

await db.saveEvent(event);
```

### Env vars

| Variable  | Description            | Default value                      |
| --------- | ---------------------- | ---------------------------------- |
| MONGO_URL | MongoDB connection URL | mongodb://localhost:27017/hawk-dev |

### Testing

`yarn test:db`

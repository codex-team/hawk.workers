[![Build Status](https://travis-ci.com/codex-team/hawk.workers.svg?branch=master)](https://travis-ci.com/codex-team/hawk.workers) [![Coverage Status](https://codecov.io/gh/codex-team/hawk.workers/branch/master/graphs/badge.svg?branch=master)](https://codecov.io/gh/codex-team/hawk.workers) [![Total alerts](https://img.shields.io/lgtm/alerts/g/codex-team/hawk.workers.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/codex-team/hawk.workers/alerts/) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/codex-team/hawk.workers.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/codex-team/hawk.workers/context:javascript)

# Hawk workers

Workers for processing hawk's background tasks

Registry - RabbitMQ

> More info on setting up Registry [here](https://github.com/codex-team/hawk.registry)

## Requirements

- [Registry](https://github.com/codex-team/hawk.registry)

## Getting started

- Inherit from `Worker` class and implement `handle` method which process tasks from registry (see more in [`lib/worker.js`](lib/worker.js)) [Example](workers/nodejs/index.js)

- Define `type` - worker type (e.g `errors/nodejs`), which is also a Registry queue from where worker pulls tasks

- Edit `.env` file (see more below)

- Use `worker.start()` to start your worker. You may write a simple runner like [this](workers/nodejs/runner.js)

## Env vars

| Variable           | Description                                                             | Default value    |
| ------------------ | ----------------------------------------------------------------------- | ---------------- |
| REGISTRY_URL       | RabbitMQ connection URL                                                 | amqp://localhost |
| SIMULTANEOUS_TASKS | RabbitMQ Consumer prefetch value (How many tasks can do simultaneously) | 1                |

**IMPORTANT**

> `.env` file in root act like _global_ preferences for all workers in `workers` folder.
>
> If some variable is present in root `.env` file, it is **NOT** overwritten by local `.env` in worker's folder
>
> This allows to set global MongoDB or/and RabbitMQ connection settings while leaving possibility to set local options for each worker

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

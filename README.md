[![Build Status](https://travis-ci.com/codex-team/hawk.workers.svg?branch=master)](https://travis-ci.com/codex-team/hawk.workers) [![Coverage Status](https://codecov.io/gh/codex-team/hawk.workers/branch/master/graphs/badge.svg?branch=master)](https://codecov.io/gh/codex-team/hawk.workers) [![Total alerts](https://img.shields.io/lgtm/alerts/g/codex-team/hawk.workers.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/codex-team/hawk.workers/alerts/) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/codex-team/hawk.workers.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/codex-team/hawk.workers/context:javascript)

# Hawk Workers

Workers are services for processing hawk's background tasks



## Requirements

- [Registry](https://github.com/codex-team/hawk.registry)

Registry - RabbitMQ

> More info on setting up Registry [here](https://github.com/codex-team/hawk.registry)

For simplicity, Hawk workers can be used as part of the [Mono repository](https://github.com/codex-team/hawk.mono)

## How to write a Worker

- Inherit from `Worker` class and implement `handle` method which process tasks from registry (see more in [`lib/worker.js`](lib/worker.js)) [Example](workers/javascript/src/index.ts)

- Define `type` - worker type (e.g `errors/nodejs`), which is also a Registry queue from where worker pulls tasks

- Edit `.env` file (see more below)

- Use `worker.start()` to start your worker. You **should** write a simple runner like [this](workers/nodejs/runner.js)

- Set `LOG_LEVEL` to `verbose` if you want message logs

  > Also you can use `worker.logger` which is [`winston.Logger`](https://github.com/winstonjs/winston) to log something
                                                           >
                                                           >
## How to run workers

1. Make sure you are in Workers root directory
2. Add worker package as [Yarn Workspace](https://yarnpkg.com/lang/en/docs/workspaces/) — add worker's path to the root's package.json at "workspaces" section
3. `yarn install`
4. `yarn worker worker-package-name` (package name from worker's package.json). You can pass several workers separated by space.
5. (Optionally) You can add own script to run specified worker, for example `"run-js": "ts-node ./runner.ts hawk-worker-javascript"`

> Note. You can override some env variables on worker running:

```
SIMULTANEOUS_TASKS=1 yarn worker hawk-worker-release
```

## Running workers with PM2

- Install PM2

  ```bash
  yarn global add pm2
  OR
  npm i -g pm2
  ```

- If you've written your worker add it to `ecosystem.config.js` like the existing ones

- Edit `.env` files

- Run it

  ```bash
  # Run all workers
  pm2 start

  # Run specific worker, e.g. nodejs
  pm2 start nodejs
  ```

> Feel free to tune your setting in `ecosystem.config.js` file, [more info](https://pm2.io/doc/en/runtime/reference/ecosystem-file/)

## Running workers with Docker

Basic configuration is in `docker-compose.dev.yml`. 
Pull image from https://hub.docker.com/r/codexteamuser/hawk-workers
```
docker-compose -f docker-compose.dev.yml pull
```

If you run mongodb and rabbitmq with `hawk.mono` repository, by default your docker network will be named `hawkmono_default`. 
This network name is written as external for workers.

Run chosen worker (say hawk-worker-javascript)
```
docker-compose -f docker-compose.dev.yml up hawk-worker-javascript
```

### Adding new workers
Make sure that your `.env` configurations exists.

Add new section to the `docker-compose.{dev,prod}.yml` files.

```
 hawk-worker-telegram:
    image: "codexteamuser/hawk-workers:prod"
    env_file:
      - .env
      - workers/telegram/.env
    restart: unless-stopped
    entrypoint: /usr/local/bin/node runner.js hawk-worker-telegram
```

## Error handling

If an error is thrown inside `handle` method it will be ignored, except if it is `CriticalError` or `NonCriticalError`

On `CriticalError` the currently processing message will be requeued to the same queue in Registry using `Worker.requeue` method

On `NonCriticalError` the currently processing message will be queued to stash queue in Registry using `Worker.sendToStash` method

## Env vars

| Variable           | Description                                                                                              | Default value      |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------ |
| REGISTRY_URL       | RabbitMQ connection URL                                                                                  | `amqp://localhost` |
| SIMULTANEOUS_TASKS | RabbitMQ Consumer prefetch value (How many tasks can do simultaneously)                                  | 1                  |
| LOG_LEVEL          | Log level (error,warn,info,versobe,debug,silly) [See more](https://github.com/winstonjs/winston#logging) | `info`             |

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

await db.connect(); // Requires `MONGO_URL`

await db.saveEvent(event);
```

### Env vars

| Variable  | Description            | Default value                      |
| --------- | ---------------------- | ---------------------------------- |
| MONGO_URL | MongoDB connection URL | mongodb://localhost:27017/hawk-dev |

### Testing

`yarn test:db`

### Worker message format

```jsonc
{
  // Access token with `projectId` in payload
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  // Worker specific payload
  "payload": {
    "title": "Error: ..."
    // other fields
  }
}
```

## Cache controller

To reduce an amount of requests or any performance improvements you can use an [lib/cache/controller](./lib/cache/controller).

To use it in worker, you need to:

1. Call `this.prepareCache();` somewhere in worker to activate the cache module. For example, in `start()` method
2. Use `this.cache.get(key, resover?, ttl?)` or `this.cache.set(key, value, ttl?)`

Available methods:

- `set(key: string, value: any, ttl?: number)` — cache data
- `get(key: string, resolver?: Function, ttl?: number)` — get cached data (or resolve and cache). If you're passing a resolver, you may pass ttl too (for internal **set** command with resolver)
- `del(key: string|string[])` — delete cached data
- `flushAll()` — flush the whole data
 
> `ttl` (time to live) in seconds
 
## Migrations

To create new migration use command

```jsonc
yarn migration create {migrationName}
```

Each migration file contains two methods: up and down.

`Up` method executes revision and increases database version.

`Down` method rollbacks database changes

To execute migration run

```jsonc
yarn migrate
```

### Todo

Refactor mongo-migrate commands to have an opportunity to create or rollback

[More details](https://www.npmjs.com/package/migrate-mongo)

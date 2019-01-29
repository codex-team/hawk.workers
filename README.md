# Hawk workers

Workers for handling hawk's payloads

Registry - RabbitMQ

## Getting started

- Inherit from `Worker` class and implement `handle` method (see more in [`lib/worker.js`](lib/worker.js)) [Example](workers/nodejs/index.js)

- Edit `.env` file (see more below)

- Use `worker.start()` to start your worker. You may write a simple runner like [this](workers/nodejs/runner.js)

## Env vars

| Variable            | Description                                                             | Default value                      |
| ------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| REGISTRY_URL        | RabbitMQ connection URL                                                 | amqp://localhost                   |
| REGISRTY_QUEUE_NAME | RabbitMQ queue name                                                     | test                               |
| SIMULTANEOUS_TASKS  | RabbitMQ Consumer prefetch value (How many tasks can do simultaneously) | 1                                  |
| MONGO_URL           | MongoDB connection URL                                                  | mongodb://localhost:27017/hawk-dev |

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
| DB controller(`db`)             | `yarn test:db`     | - MongoDB    |
| NodeJS worker(`workers/nodejs`) | `yarn test:nodejs` | None         |

# Worker / Default

Default worker for handling events in correct format.

Processed events with type `errors/*`. Except types which requires a special processing after handling such as `errors/javascript`.  

## How to run

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-default`

## How to create worker for custom processing

1. Create a directory with worker's code.
2. Register run commands in `package.json` file.
3. Add types to `@hawk.so/types` if it is needed. 
4. Update docker-compose file for dev and prod environments.
5. Update variable `NON_DEFAULT_QUEUES` in collector's `.env` file by adding a new queue type (`javascript` for `errors/javascript`).
6. Create a new queue in registry's `rabbit.definitions.json` file in `queues` and `bindings` sections. Do the same in rabbitmq admin panel manually. 

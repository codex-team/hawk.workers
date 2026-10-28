# Release Validator Job

Standalone one-shot MongoDB job: connects, validates eligible releases, closes the connection and exits. It does not use RabbitMQ, `runner.ts`/`runner.js`, or a permanent metrics server. `REGISTRY_URL` and `SIMULTANEOUS_TASKS` are not needed; scheduling belongs to infrastructure, not the process.

Releases are processed oldest first after a 24-hour observation period. The first release without an event is stored in `resolvedInRelease`; successfully processed releases receive `fixChecked: true`. Records without the fields required for matching are ignored. Candidates must be older than 24 hours and within the `MAX_DAYS_NUMBER` retention window. All available project releases are used as history; if the original release was archived, the original event timestamp is the chronological boundary.

## Configuration and prerequisite

Required environment variables:

- `MONGO_EVENTS_DATABASE_URI`: events MongoDB connection URI, including the database name.
- `MAX_DAYS_NUMBER`: finite positive retention period in days; use the same value as archiver.

Optional: `MONGO_RECONNECT_TRIES` (default `60`) and `MONGO_RECONNECT_INTERVAL` (milliseconds, default `3000`) control initial connection attempts; both accept positive integers. `MONGO_APP_NAME` labels the connection. `LOG_LEVEL` defaults to `info`.

**Before running**, verify that every project collection `repetitions:<projectId>` has the compound index `{ groupHash: 1, release: 1 }` named **`groupHashAndRelease`**. Aggregation uses this exact index name as a hint; a missing index causes validation to fail. Provision it through the existing index/migration workflow before enabling the job.

## Run

Locally, from the workers repository root with the required environment exported:

```sh
yarn run-release-validator
```

The root script runs `ts-node -T --prefer-ts-exts ./workers/release-validator/src/index.ts` directly, without the worker runner. TypeScript files take precedence over JavaScript left by a previous local build.

In the production image, from `/app` (the Dockerfile compiles JavaScript in place):

```sh
/usr/local/bin/node workers/release-validator/src/index.js
```

Both Compose services use `restart: 'no'`. For an explicit one-off dev run with Compose environment files:

```sh
docker compose -f docker-compose.dev.yml run --rm hawk-worker-release-validator
```

Exit codes:

- `0`: successful run, including no eligible unchecked releases older than 24 hours.
- `1`: configuration, connection or validation errors. Project failures are collected after attempting the remaining projects, then the run fails. Successfully checked releases stay marked; failed projects' unchecked releases can be retried on the next run while within retention.

For Kubernetes migration and cutover, see [KUBERNETES.md](./KUBERNETES.md).

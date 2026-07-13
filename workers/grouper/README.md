# Worker / Grouper

Language-workers adds tasks for Group Worker in this format.
Group Worker gets these tasks (events from language-workers) and saves it to the DB

## Rate limiting

Per-project rate limits are enforced before events are saved to MongoDB. Limits are loaded from the accounts database (`rateLimitSettings` on plans, workspaces, and projects) and tracked in Redis hash `rate_limits` (`timestamp:count` per project).

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PROJECTS_LIMITS_UPDATE_PERIOD` | Cache refresh interval (seconds) | `3600` |
| `REDIS_RATE_LIMITS_KEY` | Redis hash key for counters | `rate_limits` |

When the limit is exceeded, the event is dropped (message acked, no DB write) and `events-rate-limited` TimeSeries metrics are recorded.

## How to run

1. Make sure you are in Workers root directory
2. `nvm use` (requires Node 24, see `.nvmrc`)
3. Start dependencies: Redis and MongoDB (e.g. `docker compose up -d redis` from repo root)
4. `yarn install`
5. `yarn run-grouper`

## Tests

```bash
nvm use
yarn build
yarn test:grouper
```

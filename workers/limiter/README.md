# Worker / Limiter

Limiter worker runs by cron schedule and checks if the workspace has exceeded its limits.
If so, the Limiter puts information to Redis about the workspace's projects for which it is necessary to stop accepting events.

## How to run

1. Fill `.env` file according to `.env.sample`
2. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-limiter`

## Event types

### Regular check
Serves to check current total events count in workspaces and blocks events receiving if workspace exceed the limit.
Event shape:
```json
{
  "type":"regular-workspaces-check"
}
```

### Single workspace check
Serves to check single workspace by id. Blocks workspace if the event limit is exceeded and unblocks if not.
Event shape:
```json
{
  "type": "check-single-workspace",
  "workspaceId":"5e4ff30a628a6c73a415f4d5"
}
```

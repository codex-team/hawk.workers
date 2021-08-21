# Worker / Limiter

Limiter worker runs by cron schedule and checks if the workspace
has exceeded its events limits according to tariff plan.

Also it checks if workspace was blocked (by paymaster) or need
to be banned cause reached events limit.

Limiter puts information to Redis about the workspace's projects
for which it is necessary to stop accepting events. This list updates
every Limiter run from zero (all workspaces check) or adds/removes
target items from the list (single workspace check).

Limiter has no ability to unblock any workspace in main database.

## Worker Logic

Worker runs by tasks to check and update list of banned projects.

- Regular check
  - Get all workspaces
  - Get events limit for workspace's plan.
  - Count events from `events` collection and `repetitions` for the last 30 days
    after date of the last payment.
  - If events limit is almost reached then Limiter adds a task for Sender worker
    to notify workspace's admins.
  - If events limit has been reached then set `isBlocked` to `true` and workspace
    will be blocked. Add a task for Sender to notify workspace's admins 'workspace was blocked'.  
  - If workspace already has a field `isBlocked=true` then it's projects will
    be added to list of blocked.
  - Update number of events `billingPeriodEventsCount` in database.
  - For each workspace decide do we need to block events receiving from its projects.
  - Then blocked list in Redis will be updated.
  
- Single workspace check
  - Same checks as for regular work. But at the end of task Limiter
    is not rewrites whole set in Redis. It adds/remove only target values
    (project ids for a workspace) from the list. 

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

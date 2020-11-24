# Worker / Limiter

Limiter worker runs by cron schedule and checks if the workspace has exceeded its limits.
If so, the limiter puts information in Redis about the workspace's projects for which it is necessary to stop accepting events.

## How to run

1. Fill `.env` file according to `.env.sample`
2. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-limiter`




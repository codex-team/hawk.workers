# Worker / Paymaster

Periodically checks if we need to charge money for the workspace tariff plan.
Also handles tariff plan changes.

## How to run

1. Make sure you are in Workers root directory
2. `yarn install`
3. Create `.env` file from `.env.sample` and fill necessary variables
3. `yarn run-paymaster`

## Supported events

Format: 

```json
{
  "type": "daily-check|plan-changed",
  "payload": {}
}
```

### WorkspacePlanChargeEvent

When receives WorkspacePlanChargeEvent worker goes through workspaces and check if today is a payday.
If so, purchase workspace plan. 

WorkspacePlanChargeEvent doesn't have any payload.

### PlanChangedEvent

When receives this event, change plan for workspace in the database and calculates different between plans tariffs.

Payload:
```json
{
  "workspaceId": "Id of workspace for which plan is changesd",
  "oldPlan": "Name of the old tariff plan",
  "newPlan": "Name of the new tariff plan"
}
```

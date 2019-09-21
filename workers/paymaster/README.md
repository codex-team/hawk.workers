# Worker / Paymaster

Daily checks workspaces balance and send notification to Accountant worker if today is pay day.
Also handles tariff plan changes

## How to run

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-paymaster`

## Supported events

Format: 

```json
{
  "type": "daily-check|plan-changed",
  "payload": {}
}
```

### DailyCheckEvent

When receives DailyCheckEvent worker goes through workspaces and check if today is a payday. If so, sends event to the accountant worker. 

DailyCheckEvent doesn't have any payload.

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

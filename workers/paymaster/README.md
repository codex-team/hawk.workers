# Worker / Paymaster

Periodically checks actual subscription of workspaces and block them if they haven't.

## How to run

1. Make sure you are in Workers root directory
2. `yarn install`
3. Create `.env` file from `.env.sample` and fill necessary variables
3. `yarn run-paymaster`

## Supported events

Format: 

```json
{
  "type": "workspace-subscription-check"
}
```

### WorkspaceSubscriptionCheck

When receives WorkspaceSubscriptionCheck worker goes through workspaces and check if today is a payday.
If so, worker checks subscription and tariff charge:
- If workspace has free tariff plan, worker updates `lastChargeDate` and `billingPeriodEventsCount` of workspace;
- If workspace has tariff plan with monthly charge, but hasn't subscription, worker will block this workspace;
- If workspace has actual subscription, we wait 3 days for payment by subscription;
- If it passed more than 3 days after a payday, worker will block workspace until we get payment. 

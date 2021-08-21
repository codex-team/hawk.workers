# Worker / Paymaster

Periodically checks actual subscription of workspaces and block them if they haven't.

Automatically prolongates free plans for a few workspaces and unblock that workspaces.

## Worker Logic

Worker runs by tasks to check dates of payments.

- Get list of all workspaces.
- Calculate days interval from the last charge date.   
- If it is time to pay.
  - If this is a free plan then prolongate it for the next month.
    - Update `lastChargeDate` param.
    - Set `isBanned` to `false`.
    - Also reset `clearBillingPeriodEventsCount` (but it if not necessary
      because Limiter will recalculate this value).
  - If plan is paid then we will not block workspace for a next three days
    to allow admins check payments settings or link a card.
    Otherwise workspace's`isBanned` will become `true`.
- If it is not time to pay but only few days left then check if it is not a free plan
  and create a task for a Sender worker to notify workspace admins to be ready to pay. 

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

# Worker / Accountant

Manages workspaces balance.

Receives transaction events and logs them to the database. Changes workspaces balance in accordance with transactions.  

## How to run

1. Make sure you are in Workers root directory
2. `yarn install`
3. `yarn run-accountant`

## Event format

```json
{
  "type": "transaction",
  "payload": {
    "type": TransactionType,
    ...
  }
}
```

### Payload

Worker accepts two types of events: income and charge.

Common fields for both types:

```json
{
  "type": "Event type",
  "date": "Timestamp of transaction date",
  "workspaceId": "Id of related workspace",
  "amount": "Transaction amount"
}
```

Income transaction additional fields:

```json
{
  "cardPan": "PAN code of the card payment has been made by",
  "userId": "Id of user who has been proceeded transaction"
}
```

Charge transaction doesn't have any additional fields.



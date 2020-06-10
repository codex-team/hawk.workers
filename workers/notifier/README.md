# Worker / Notifier

Handles new events from Grouper Worker, holds it and sends to sender worlers

## How to run  

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-notifier`


## Events handling scheme

```
1) On task received
  -> receive task
  -> get project notification rules
  -> filter rules
  -> check channel timer
     a) if timer doesn't exist
       -> send tasks to sender workers
       -> set timeout for minPeriod
     b) if timer exists
       -> push event to channel's buffer

2) On timeout
  -> get events from channel's buffer
  -> flush channel's buffer
  -> send tasks to sender workers
```

### Event example

```json
{
  "projectId": "5e3eef0679fa3700a0198a49",
  "event": {
    "title": "New event",
    "groupHash": "11da819a3d8c2024d16a55bc27f5ee6d8d572bb802c560495b5d546ad90b6fbb",
    "isNew": true
  }
}
```

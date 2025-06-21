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
  -> update eventsCount in redis
  -> get updated eventCount
  -> send notification if eventCount == treshold
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

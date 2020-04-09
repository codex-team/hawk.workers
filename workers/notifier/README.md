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

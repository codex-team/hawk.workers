# Worker / Notify checker

Sends notifications on various events

Receives event from `grouper` and check if a notification should be sent to user

```
+-------------------+                                              +--------------+ 
|  Merchant worker  |                                        +---->| Email worker | 
+-------------------+                                        |     +--------------+ 
          |                                                  |                      
          |                  +-------------------------+     |     +--------------+ 
          +------------------>  Notify checker worker  |-----+---->| Slack worker | 
          |                  +-------------------------+     |     +--------------+ 
          |                                                  |                      
+---------|--------+                                         |   +-----------------+
|  Grouper worker  |                                         +-->| Telegram worker |
+------------------+                                             +-----------------+
```

## Format

_From grouper_:

```json5
{
"type": "grouper",
"payload": {
  "projectId": event.projectId, // Event project ID 
  "new": false, // New error?
  "catcherType": event.catcherType, // Cacther type (`errors/javascript`, etc)
  "payload": event.payload // Event payload
}}
```


_From merchant_:

```json5
{
"type": "merchant",
"payload": {
  "amount" : 123212, // Amount in kopecs
  "userId": user.id ,// User ID
  "workspaceId": event.workspaceId, // Event project ID
  "timestamp": 21321312 // Unix timestamp
}}
```

## How to run

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn worker hawk-worker-notify-checker`


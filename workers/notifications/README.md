# Notifications workers

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

## Checker

Queue - `notify/checker`

Receives event from `grouper` and check if a notification should be sent to user

```json5
{
  "projectId": event.projectId, // Event project ID 
  "new": false, // New error?
  "catcherType": event.catcherType, // Cacther type (`errors/javascript`, etc)
  "payload": event.payload // Event payload
}
```

## Senders

### Email

Queue - `notify/email`

Expected input example:

```json5
{
  "to": "customer@hawk.so", // Recepient email
  "subject": "New error in project Editor.js", // Email subject
  "text": "TypeError: can't convert [object Array] to number", // Email text
  "html": "<code>TypeError: can't convert [object Array] to number</code>" // Email html
}
```

### Telegram

Queue - `notify/telegram`

Expected input example:

```json5
{
  "hook": "http://notify.bot.codex.so/GHGAF", // CodeX Bot hook URL
  "message": "**New error in project Editor.js**\n`TypeError: can't convert [object Array] to number`", // Message
  "parseMode": "Markdown" // Message parse mode - Markdown or HTML
}
```

### Slack

Queue - `notify/slack`

Expected input example:

```json5
{
  "hook": "http://notify.bot.codex.so/GHGAF", // CodeX Bot hook URL
  "text": "**New error in project Editor.js**\n`TypeError: can't convert [object Array] to number`", // Message
}
```

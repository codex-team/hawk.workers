# Javascript worker docs

## Payload format

```json
{
  // Original event data
  "event": {
    // Column number
    "colno": 1,
    // Line number
    "lineno": 1,
    // Filename
    "filename": "main.js",
    // Error message
    "message": "Unexpected ';' at line 1",
    // Error type
    "type": "SyntaxError",
    // TODO
    "isTrusted": "todo",
    // Error object
    "error": {
      // Error message
      "message": "todo",
      // Error stacktrace
      "stack": "at func ..."
    }
  },
  // App revision
  "revision": "1.0.0",
  // Location object
  "location": {
    "url": "http://somesite/somepath",
    "origin": "http://somesite",
    "host": "somesite",
    "path": "/somepath",
    "port": ""
  },
  // Timestamp
  "timestamp": 1565943536319,
  // Browser properties
  "navigator": {
    // User Agent
    "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
    // Window frame properties
    "frame": {
      "width": 1059,
      "height": 949
    }
  }
}
```

# registry

Workers system task manager

## API

- `GET /api/popTask/:workerName` - Pop task for `workerName`. Returns json-formatted task.
- `PUT /api/pushTask/:workerName` - Push task for `workerName`. Payload should be in json.

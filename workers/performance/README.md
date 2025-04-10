# Performance worker

This worker is needed to save performance data uploaded from user to our DB. 

## Performance delivery scheme

1. User wants to deploy project
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our [Webpack Plugin](https://github.com/codex-team/hawk.webpack.plugin) gets a source maps for new bundles and sends them to us.

example request:

```bash
curl --location 'http://localhost:3000/performance' \
--header 'Content-Type: application/json' \
--data '{
    "token": "eyJpbnRlZ3JhdGlvbklkIjoiZTU2ZTU5ODctN2JhZi00NTI3LWI4MmMtYjdkOWRhZDBiMDBmIiwic2VjcmV0IjoiZDQ5YTU0YjMtOWExZi00ZGI2LTkxZmYtMjk4M2JlMTVlODA0In0=",
  "projectId": "67d4adeccf25fa00ab563c32",
  "catcherType": "performance",
  "payload": {
    "projectId": "67d4adeccf25fa00ab563c32",
    "transactionId": "drxEFnbxGc7OumTVl3FkCm1v9BvBC9OpBrEiE3qG",
    "name": "complex-operation",
    "timestamp": 1742075217,
    "duration": 702.9999999999964,
    "startTime": 15322.000000000002,
    "endTime": 16024.999999999998,
    "catcherVersion": "3.2.1",
    "spans": [
      {
        "id": "6tk2UD4m0wDUjD99uvO1wylp3SnYumiWPlhRCZ2w",
        "name": "step-1",
        "duration": 400.9999999999982,
        "startTime": 15322.000000000002,
        "endTime": 15723,
        "transactionId": "drxEFnbxGc7OumTVl3FkCm1v9BvBC9OpBrEiE3qG"
      },
      {
        "id": "V2ZOiUWjtip5ZSATIr7VX4KInAZgGJxdUQNZot2j",
        "name": "step-2",
        "duration": 301.9999999999982,
        "startTime": 15723,
        "endTime": 16024.999999999998,
        "transactionId": "drxEFnbxGc7OumTVl3FkCm1v9BvBC9OpBrEiE3qG"
      },
      {
        "id": "JGIerBJqInvnvpIPBwsUIfuIxt3LcWQ6lFPwQJdN",
        "name": "step-3",
        "duration": 300.9999999999982,
        "startTime": 15724,
        "endTime": 16024.999999999998,
        "transactionId": "drxEFnbxGc7OumTVl3FkCm1v9BvBC9OpBrEiE3qG"
      }
    ],
    "tags": {
      "type": "background"
    }
  }
}'
```

4. Collector accepts file and give a task for PerformanceWorker for saving it to DB
5. PerformanceWorker saves it to DB.

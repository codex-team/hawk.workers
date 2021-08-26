# Release worker

This worker is needed to save releases with commits or/and source-maps uploaded from user to our DB. Commits are used to identify suspicious ones. 

## Important 

**Current implementation supports only single Rabbit prefetch count (SIMULTANEOUS_TASKS=1)**

## Delivery scheme

1. User wants to deploy project
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our [Webpack Plugin](https://github.com/codex-team/hawk.webpack.plugin) gets a source maps for new bundles and sends them to us.

Example request:

```bash
curl --request POST \
 -F 'release=Verison 1.0.1'\
 -F 'commits=[{"hash":"557940a440352d9d86ad5610f2e366aafb2729e4","title":"Add some stuff","author":"somebody@codex.so","date":"Wed May 6 13:37:00 2021 +0300"}]'\
 -F file=@"main.min.js.map"\
 -H "Authorization: Bearer INTEGRATION_TOKEN" \
 http://localhost:3000/release
```

4. Collector accepts files and give a task for ReleaseWorker for saving it to the database.
5. ReleaseWorker saves commits and source maps to the database.

## Script for sending comments
To make it easier to send commits, you can use a [shell script](./scripts/commits.sh) that will take the last few commits and send them to the collector

#### Script arguments
| Argument name | Required | Description |
| -- | -- | -- |
| `-t` \| `--token` | Yes | Hawk integration token for your project. |
| `-r` \| `--release` | Yes | Release name. Any string that will be associated with project events. |
| `-ce` \| `--collectorEndpoint` | No | Endpoint to send release data. |
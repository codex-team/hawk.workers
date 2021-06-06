# Release worker

This worker is needed to save releases with commits or/and source-maps uploaded from user to our DB. Commits are used to identify suspicious ones. 

## Important 

**Current implementation supports only single Rabbit prefetch count (SIMULTANEOUS_TASKS=1)**

## Source maps delivery scheme

1. User wants to deploy project
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our **Webpack Plugin** gets a source maps for new bundles and sends them to us.

example request:

```bash
curl -F file=@"main.min.js.map" -F 'release=$RANDOM' -H "Authorization: Bearer TOKEN" http://localhost:3000/release
```

```bash
curl --request POST \
 -F 'release=Verison 1.0'\
 -F 'commits=[{"hash":"557940a440352d9d86ad5610f2e366aafb2729e4","title":"Add some stuff","author":"somebody@codex.so","date":"Wed May 6 13:37:00 2021 +0300"}]'\
 -F "repository=https://github.com/codex-team/hawk.api.nodejs"\
 -F file=@"main.min.js.map"
 -H "Authorization: Bearer TOKEN" http://localhost:3000/release
```

4. Collector accepts file and give a task for ReleaseWorker for saving it to DB
5. ReleaseWorker saves it to DB.

# Release worker

This worker is needed to save releases with commits or/and source-maps uploaded from user to our DB. Commits are used to identify suspicious ones. 

## Important 

**Current implementation supports only single Rabbit prefetch count (SIMULTANEOUS_TASKS=1)**

## Release delivery scheme

1. User wants to deploy project
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our [Webpack Plugin](https://github.com/codex-team/hawk.webpack.plugin) gets a source maps for new bundles and sends them to us.
4. Also webpack plugin will try to get a few last commits from `.git` directory that will be used to display commits suspected of an error event in the garage. 

Example request:

```bash
curl --request POST \
 -F 'release=Verison 1.0.1'\
 -F 'commits=[{"hash":"557940a440352d9d86ad5610f2e366aafb2729e4","title":"Add some stuff","author":"somebody@codex.so","date":"Wed May 6 13:37:00 2021 +0300"}]'\
 -F file=@"main.min.js.map"\
 -H "Authorization: Bearer INTEGRATION_TOKEN" \
 http://localhost:3000/release
```

5. Collector accepts commits and source map files and give a task for ReleaseWorker for saving it to the database.
6. ReleaseWorker saves commits and source maps to the database.

A release doesn't have to contain commits or sourcemaps. But if there is a possibility it will be a useful feature for investigating errors.

To send commits not through the webpack plugin, you can use a script from the [hawk.release](https://github.com/codex-team/hawk.release) repository.
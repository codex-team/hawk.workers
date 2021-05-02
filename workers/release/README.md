# Source map parsing

This worker is needed to save releases with commits or/and source-maps uploaded from user to our DB.

## Important 

**Current implementation supports only single Rabbit prefetch count (SIMULTANEOUS_TASKS=1)**

## Parsing scheme

1. User wants to deploy project
2. REWRITE THIS DOC PLEASE
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our **Webpack Plugin** gets a source maps for new bundles and sends them to us.

example request:

```bash
curl -F file=@"main.min.js.map" -F release=$RANDOM -H "Authorization: Bearer TOKEN" http://localhost:3000/sourcemap
```

4. Collector accepts file and give a task for ReleaseWorker for saving it to DB
5. ReleaseWorker saves it to DB.






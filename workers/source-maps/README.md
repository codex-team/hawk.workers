# Source map parsing

This worker is needed to save source-map uploaded from user to our DB.

## Parsing scheme

1. User wants to deploy project
2. He runs deploy script on the server and it runs static builder, for example Webpack.
3. After Webpack finished his job, our **Webpack Plugin** gets a source maps for new bundles and sends them to us.

example request:

```bash
curl -F secret=@"main.min.js.map" release=$RANDOM -H "Authentication: Bearer TOKEN" http://localhost:3000/sourcemap
```

4. Collector accepts file and give a task for SourceMapsWorker for saving it to DB
5. SourceMapsWorker saves it to DB.






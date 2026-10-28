# Release Validator Job

One-shot MongoDB job that checks releases after a 24-hour observation period and exits. It does not use RabbitMQ.

Events that no longer occur are marked with `resolvedInRelease`; successfully checked releases receive `fixChecked: true`. The validation window follows the archiver retention period.

## Run

From the workers repository root:

```sh
yarn run-release-validator
```

Requires the events database connection and retention period configured for the environment. The `repetitions:<projectId>` collections must have the `{ groupHash: 1, release: 1 }` index named `groupHashAndRelease`.

The process exits with code `0` on success, including when there is nothing to check, or `1` on failure.

For Kubernetes deployment, see [KUBERNETES.md](./KUBERNETES.md).

# Release Validator Worker

Checks releases after a 24-hour observation period and marks original events that no longer occur as resolved.

The worker processes releases from oldest to newest, stores the first release without an event in `resolvedInRelease`, and marks successfully processed releases with `fixChecked: true`.

The worker only uses the fields required for matching releases and event groups. Records without these fields are ignored. Candidate releases must be between 24 hours and 30 days old, while all project releases are still used to compare event history.

Queue: `cron-tasks/release-validator`

Run locally:

```sh
yarn run-release-validator
```

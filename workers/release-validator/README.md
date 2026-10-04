# Release Validator Worker

Checks releases after a 24-hour observation period and marks original events that no longer occur as resolved.

The worker processes releases from oldest to newest, stores the first release without an event in `resolvedInRelease`, and marks successfully processed releases with `fixChecked: true`.

The worker only uses the fields required for matching releases and event groups. Records without these fields are ignored. Candidate releases must be older than 24 hours and no older than the `MAX_DAYS_NUMBER` retention period, while all available project releases are still used to compare event history. If an event's original release was archived, the original event timestamp is used as its chronological boundary.

Queue: `cron-tasks/release-validator`

Run locally:

```sh
yarn run-release-validator
```

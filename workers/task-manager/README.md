# Task Manager Worker

Worker for automatically creating GitHub issues for errors that meet the threshold.

## Description

This worker processes tasks to automatically create GitHub issues for events that:
- Have `totalCount >= taskThresholdTotalCount`
- Don't have a `taskManagerItem` (not yet processed)
- Occurred after `taskManager.connectedAt`

## Rate Limiting

The worker implements daily rate limiting:
- Maximum `MAX_AUTO_TASKS_PER_DAY` (default: 10) tasks per project per day
- Uses atomic increment to prevent race conditions
- Resets daily budget at the start of each UTC day

## Environment Variables

- `REGISTRY_URL` - RabbitMQ registry connection URL
- `MAX_AUTO_TASKS_PER_DAY` - Maximum auto tasks per day (default: 10)

## Usage

The worker is triggered by cron tasks with routing key `cron-tasks/task-manager` and payload:
```json
{
  "type": "auto-task-creation"
}
```

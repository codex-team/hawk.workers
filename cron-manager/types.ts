export interface CronManagerConfig {
  tasks: CronManagerTask[];
}

export interface CronManagerTask {
  workerName: string;
  schedule: string;
}

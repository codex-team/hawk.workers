import fs from 'fs';
import * as yaml from 'yaml';
import path from 'path';
import cron from 'cron';
import { CronManagerConfig } from './types';

const configFile = fs.readFileSync(path.join(__dirname, './config.yml')).toString();

const config = yaml.parse(configFile) as CronManagerConfig;
const jobs: cron.CronJob[] = [];

config.tasks.forEach(task => {
  const job = new cron.CronJob(task.schedule, () => {
    console.log(task.workerName);
  });

  job.start();

  jobs.push(job);
});

console.log(config);

import './env';
import { ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import type { TaskManagerWorkerTask } from '../types/task-manager-worker-task';
import type {
  ProjectDBScheme,
  GroupedEventDBScheme,
  ProjectTaskManagerConfig,
} from '@hawk.so/types';
import type { TaskManagerItem } from '@hawk.so/types/src/base/event/taskManagerItem.ts';
import HawkCatcher from '@hawk.so/nodejs';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { GitHubService } from './GithubService';
import { formatIssueFromEvent } from './utils/issue';

/**
 * Maximum number of auto-created tasks per project per day
 */
const MAX_AUTO_TASKS_PER_DAY = Number(process.env.MAX_AUTO_TASKS_PER_DAY) || 10;

/**
 * Worker for automatically creating GitHub issues for errors that meet the threshold
 */
export default class TaskManagerWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller for accounts database
   */
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Database Controller for events database
   */
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * GitHub Service for creating issues
   */
  private githubService: GitHubService = new GitHubService();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect();
    await this.eventsDb.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.accountsDb.close();
    await this.eventsDb.close();
  }

  /**
   * Task handling function
   *
   * @param task - task manager task to handle
   */
  public async handle(task: TaskManagerWorkerTask): Promise<void> {
    try {
      this.logger.info('Starting task manager worker', { taskType: task.type });

      /**
       * Get all projects with GitHub task manager enabled
       */
      const projects = await this.getProjectsWithTaskManager();

      this.logger.info(`Found ${projects.length} projects with task manager enabled`);

      /**
       * Process each project
       */
      for (const project of projects) {
        await this.processProject(project);
      }

      this.logger.info('Task manager worker completed');
    } catch (error) {
      this.logger.error('Failed to handle task manager task:', error);

      HawkCatcher.send(error as Error, {
        taskType: task.type,
      });
    }
  }

  /**
   * Get all projects with task manager enabled
   *
   * @returns Promise with array of projects
   */
  private async getProjectsWithTaskManager(): Promise<ProjectDBScheme[]> {
    const connection = await this.accountsDb.getConnection();
    const projectsCollection = connection.collection<ProjectDBScheme>('projects');

    const projects = await projectsCollection.find({
      'taskManager.type': 'github',
      'taskManager.autoTaskEnabled': true,
      'taskManager.config.repoId': { $exists: true, $ne: null },
      'taskManager.config.repoFullName': { $exists: true, $ne: null },
    }).toArray();

    return projects;
  }

  /**
   * Process a single project
   *
   * @param project - project to process
   */
  private async processProject(project: ProjectDBScheme): Promise<void> {
    const projectId = project._id.toString();
    const taskManager = project.taskManager as ProjectTaskManagerConfig;

    if (!taskManager) {
      this.logger.warn(`Project ${projectId} has no task manager config`);

      return;
    }

    this.logger.info(`Processing project ${projectId}`, {
      repoFullName: taskManager.config.repoFullName,
      threshold: taskManager.taskThresholdTotalCount,
    });

    /**
     * Calculate day start UTC for today
     */
    const now = new Date();
    const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    /**
     * Check and reset usage if dayStartUtc differs
     */
    const usage = taskManager.usage;
    const shouldResetUsage = !usage || usage.dayStartUtc.getTime() !== dayStartUtc.getTime();

    let currentUsage: { autoTasksCreated: number };

    if (shouldResetUsage) {
      this.logger.info(`Resetting usage for project ${projectId}`, {
        oldDayStartUtc: usage?.dayStartUtc,
        newDayStartUtc: dayStartUtc,
      });

      await this.resetUsage(projectId, dayStartUtc);

      /**
       * After reset, usage is 0
       */
      currentUsage = { autoTasksCreated: 0 };
    } else {
      /**
       * Use usage from already loaded project
       */
      currentUsage = {
        autoTasksCreated: usage.autoTasksCreated || 0,
      };
    }

    /**
     * Check if budget is available
     */
    if (currentUsage.autoTasksCreated >= MAX_AUTO_TASKS_PER_DAY) {
      this.logger.info(`Project ${projectId} has reached daily budget limit`, {
        autoTasksCreated: currentUsage.autoTasksCreated,
        maxAutoTasksPerDay: MAX_AUTO_TASKS_PER_DAY,
      });

      return;
    }

    /**
     * Calculate remaining budget
     */
    const remainingBudget = MAX_AUTO_TASKS_PER_DAY - currentUsage.autoTasksCreated;

    this.logger.info(`Project ${projectId} has remaining budget`, {
      autoTasksCreated: currentUsage.autoTasksCreated,
      remainingBudget,
    });

    /**
     * Find events that need task creation
     */
    const events = await this.findEventsForTaskCreation(
      projectId,
      taskManager.connectedAt,
      taskManager.taskThresholdTotalCount
    );

    this.logger.info(`Found ${events.length} events for task creation in project ${projectId}`);

    /**
     * Process events up to remaining budget
     */
    const eventsToProcess = events.slice(0, remainingBudget);

    for (const event of eventsToProcess) {
      /**
       * Atomically increment usage.autoTasksCreated
       */
      const incrementSuccess = await this.incrementAutoTasksCreated(projectId, dayStartUtc);

      if (!incrementSuccess) {
        this.logger.warn(`Failed to increment usage for project ${projectId}, budget may be exhausted`);

        break;
      }

      /**
       * Format Issue data from event
       */
      const issueData = formatIssueFromEvent(event, project);

      /**
       * Create GitHub Issue
       */
      const githubIssue = await this.githubService.createIssue(
        taskManager.config.repoFullName,
        taskManager.config.installationId,
        issueData
      );

      /**
       * Assign Copilot if enabled
       */
      if (taskManager.assignAgent) {
        try {
          await this.githubService.assignCopilot(
            taskManager.config.repoFullName,
            githubIssue.number,
            taskManager.config.installationId
          );
        } catch (error) {
          /**
           * Log error but don't fail the task creation
           */
          this.logger.warn(`Failed to assign Copilot to issue #${githubIssue.number}:`, error);
        }
      }

      /**
       * Save taskManagerItem to event
       */
      await this.saveTaskManagerItem(projectId, event, githubIssue.number, taskManager, githubIssue.html_url);

      this.logger.info(`Created task for event ${event.groupHash} in project ${projectId}`, {
        issueNumber: githubIssue.number,
        issueUrl: githubIssue.html_url,
        assignAgent: taskManager.assignAgent,
      });
    }
  }

  /**
   * Reset usage for a project
   *
   * @param projectId - project ID
   * @param dayStartUtc - new day start UTC
   */
  private async resetUsage(projectId: string, dayStartUtc: Date): Promise<void> {
    const connection = await this.accountsDb.getConnection();
    const projectsCollection = connection.collection<ProjectDBScheme>('projects');

    await projectsCollection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          'taskManager.usage': {
            dayStartUtc,
            autoTasksCreated: 0,
          },
        },
      }
    );
  }


  /**
   * Atomically increment autoTasksCreated
   *
   * @param projectId - project ID
   * @param dayStartUtc - day start UTC
   * @returns Promise with true if increment was successful, false if budget exhausted
   */
  private async incrementAutoTasksCreated(projectId: string, dayStartUtc: Date): Promise<boolean> {
    const connection = await this.accountsDb.getConnection();
    const projectsCollection = connection.collection<ProjectDBScheme>('projects');

    /**
     * Use findOneAndUpdate with condition to atomically increment
     * Only increment if autoTasksCreated < MAX_AUTO_TASKS_PER_DAY
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (projectsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(projectId),
        'taskManager.usage.dayStartUtc': dayStartUtc,
        $or: [
          { 'taskManager.usage.autoTasksCreated': { $exists: false } },
          { 'taskManager.usage.autoTasksCreated': { $lt: MAX_AUTO_TASKS_PER_DAY } },
        ],
      },
      {
        $inc: { 'taskManager.usage.autoTasksCreated': 1 },
      } as any,
      {
        returnDocument: 'after',
      }
    ) as any);

    return result?.value !== null && result?.value !== undefined;
  }

  /**
   * Find events that need task creation
   *
   * @param projectId - project ID
   * @param connectedAt - task manager connection date
   * @param threshold - minimum totalCount threshold
   * @returns Promise with array of events
   */
  private async findEventsForTaskCreation(
    projectId: string,
    connectedAt: Date,
    threshold: number
  ): Promise<GroupedEventDBScheme[]> {
    const connection = await this.eventsDb.getConnection();
    const eventsCollection = connection.collection<GroupedEventDBScheme>(`events:${projectId}`);

    /**
     * Convert connectedAt to timestamp (seconds)
     */
    const connectedAtTimestamp = Math.floor(connectedAt.getTime() / 1000);

    const events = await eventsCollection
      .find({
        taskManagerItem: { $exists: false },
        timestamp: { $gte: connectedAtTimestamp },
        totalCount: { $gte: threshold },
      })
      .sort({ totalCount: -1, timestamp: -1 })
      .toArray();

    return events;
  }


  /**
   * Save taskManagerItem to event
   *
   * @param projectId - project ID
   * @param event - event to save taskManagerItem to
   * @param issueNumber - GitHub issue number
   * @param taskManager - task manager config
   * @param issueUrl - GitHub issue URL
   */
  private async saveTaskManagerItem(
    projectId: string,
    event: GroupedEventDBScheme,
    issueNumber: number,
    taskManager: ProjectTaskManagerConfig,
    issueUrl: string
  ): Promise<void> {
    const connection = await this.eventsDb.getConnection();
    const eventsCollection = connection.collection<GroupedEventDBScheme>(`events:${projectId}`);

    /**
     * Decode unsafe fields to get actual title
     */
    const decodedEvent = { ...event };

    decodeUnsafeFields(decodedEvent);

    const taskManagerItem: TaskManagerItem = {
      type: 'github-issue',
      number: issueNumber,
      url: issueUrl,
      title: decodedEvent.payload.title,
      createdBy: 'auto',
      createdAt: new Date(),
      assignee: taskManager.assignAgent ? 'copilot' : null,
    };

    await eventsCollection.updateOne(
      { _id: event._id },
      {
        $set: {
          taskManagerItem,
        },
      }
    );

    this.logger.info(`Saved taskManagerItem for event ${event.groupHash}`, {
      issueNumber,
      url: taskManagerItem.url,
    });
  }

}

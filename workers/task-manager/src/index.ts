import './env';
import { ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import type { TaskManagerWorkerTask } from '../types/task-manager-worker-task';
import type {
  ProjectDBScheme,
  GroupedEventDBScheme,
  ProjectTaskManagerConfig
} from '@hawk.so/types';
import type { TaskManagerItem } from '@hawk.so/types/src/base/event/taskManagerItem';
import HawkCatcher from '@hawk.so/nodejs';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { GitHubService } from './GithubService';
import { formatIssueFromEvent } from './utils/issue';
import TimeMs from '../../../lib/utils/time';

/**
 * Default maximum number of auto-created tasks per project per day
 */
const DEFAULT_MAX_AUTO_TASKS_PER_DAY = 10;

/**
 * Maximum number of auto-created tasks per project per day
 */
const MAX_AUTO_TASKS_PER_DAY = parseInt(process.env.MAX_AUTO_TASKS_PER_DAY, 10) || DEFAULT_MAX_AUTO_TASKS_PER_DAY;

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
    this.handle({ type: 'auto-task-creation' });
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await this.accountsDb.close();
    await this.eventsDb.close();
    await super.finish();
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
      'taskManager.config.repoId': {
        $exists: true,
        $ne: null,
      },
      'taskManager.config.repoFullName': {
        $exists: true,
        $ne: null,
      },
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
      await this.processEventForAutoTaskCreation({
        project,
        projectId,
        taskManager,
        event,
        dayStartUtc,
      });
    }
  }

  /**
   * Process a single event for auto task creation
   *
   * @param params - method params
   * @param params.project - project
   * @param params.projectId - project id
   * @param params.taskManager - task manager config
   * @param params.event - grouped event
   * @param params.dayStartUtc - day start UTC used for usage increment
   */
  private async processEventForAutoTaskCreation(params: {
    project: ProjectDBScheme;
    projectId: string;
    taskManager: ProjectTaskManagerConfig;
    event: GroupedEventDBScheme;
    dayStartUtc: Date;
  }): Promise<void> {
    const { project, projectId, taskManager, event, dayStartUtc } = params;

    /**
     * Format Issue data from event
     */
    const issueData = formatIssueFromEvent(event, project);

    /**
     * Step 1: Create GitHub Issue using installation token (GitHub App)
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    let githubIssue: { number: number; html_url: string };

    try {
      githubIssue = await this.githubService.createIssue(
        taskManager.config.repoFullName,
        taskManager.config.installationId,
        issueData
      );
    } catch (error) {
      /**
       * Log error message only, not the full error object to avoid logging tokens
       */
      this.logger.error(`Failed to create GitHub issue for event ${event.groupHash} (project ${projectId}): ${error instanceof Error ? error.message : String(error)}`);

      /**
       * Do not increment usage and do not save taskManagerItem if issue creation failed
       */
      return;
    }

    /**
     * Atomically increment usage.autoTasksCreated (only after successful issue creation)
     */
    const incrementSuccess = await this.incrementAutoTasksCreated(projectId, dayStartUtc);

    if (!incrementSuccess) {
      this.logger.warn(
        `Issue #${githubIssue.number} was created but usage increment failed for project ${projectId} (budget may be exhausted)`
      );

      /**
       * We still link the created issue to the event to avoid duplicates.
       */
    }

    /**
     * Save taskManagerItem to event (independent of Copilot assignment)
     * We determine assignee status based on whether assignAgent is enabled,
     * not whether assignment actually succeeded
     */
    let copilotAssigned = false;

    /**
     * Step 2: Assign Copilot agent if enabled (using user-to-server OAuth token)
     */
    if (taskManager.assignAgent && taskManager.config.delegatedUser?.accessToken) {
      try {
        await this.executeWithTokenRefresh({
          projectId,
          taskManager,
          operationName: 'assign Copilot',
          operation: async (token) => {
            await this.githubService.assignCopilot(
              taskManager.config.repoFullName,
              githubIssue.number,
              token
            );
          },
        });
        copilotAssigned = true;
      } catch (error) {
        /**
         * Log error but don't fail the whole operation - issue was created successfully
         */
        this.logger.warn(`Failed to assign Copilot to issue #${githubIssue.number}: ${error instanceof Error ? error.message : String(error)}`);
        copilotAssigned = false;
      }
    }

    /**
     * Save taskManagerItem to event
     * Note: assignee is set based on whether assignment was attempted and succeeded,
     * not just whether assignAgent is enabled
     */
    await this.saveTaskManagerItem(
      projectId,
      event,
      githubIssue.number,
      taskManager,
      githubIssue.html_url,
      copilotAssigned
    );

    this.logger.info(`Created task for event ${event.groupHash} in project ${projectId}`, {
      issueNumber: githubIssue.number,
      issueUrl: githubIssue.html_url,
      assignAgent: taskManager.assignAgent,
    });
  }

  /**
   * Update delegatedUser tokens in project
   *
   * @param {string} projectId - Project ID
   * @param {Object} tokenData - New token data
   * @returns {Promise<void>}
   */
  private async updateDelegatedUserTokens(
    projectId: string,
    tokenData: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date | null;
      refreshTokenExpiresAt: Date | null;
      tokenLastValidatedAt: Date;
    }
  ): Promise<void> {
    const connection = await this.accountsDb.getConnection();
    const projectsCollection = connection.collection<ProjectDBScheme>('projects');

    await projectsCollection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          'taskManager.config.delegatedUser.accessToken': tokenData.accessToken,
          'taskManager.config.delegatedUser.refreshToken': tokenData.refreshToken,
          'taskManager.config.delegatedUser.accessTokenExpiresAt': tokenData.expiresAt,
          'taskManager.config.delegatedUser.refreshTokenExpiresAt': tokenData.refreshTokenExpiresAt,
          'taskManager.config.delegatedUser.tokenLastValidatedAt': tokenData.tokenLastValidatedAt,
          'taskManager.updatedAt': new Date(),
        },
      }
    );
  }

  /**
   * Execute a GitHub API operation with automatic token refresh on 401 errors
   * This function handles token refresh and retry logic for operations that may fail with 401
   *
   * @param {Object} params - Parameters for the operation
   * @param {string} params.projectId - Project ID
   * @param {ProjectTaskManagerConfig} params.taskManager - Task manager configuration
   * @param {Function} params.operation - Async function that performs the GitHub API operation
   * @param {string} params.operationName - Name of the operation for logging (e.g., "create issue")
   * @returns {Promise<T>} Result of the operation
   * @throws {Error} If operation fails and token refresh doesn't help
   */
  private async executeWithTokenRefresh<T>(params: {
    projectId: string;
    taskManager: ProjectTaskManagerConfig;
    operation: (token: string | null) => Promise<T>;
    operationName: string;
  }): Promise<T> {
    const { projectId, taskManager, operation, operationName } = params;

    /**
     * Get valid access token with automatic refresh if needed
     */
    let delegatedUserToken: string | null = null;

    if (taskManager.config.delegatedUser?.status === 'active') {
      const delegatedUser = taskManager.config.delegatedUser;

      try {
        /**
         * Get valid access token with automatic refresh if needed
         */
        delegatedUserToken = await this.githubService.getValidAccessToken(
          {
            accessToken: delegatedUser.accessToken,
            refreshToken: delegatedUser.refreshToken,
            accessTokenExpiresAt: delegatedUser.accessTokenExpiresAt
              ? new Date(delegatedUser.accessTokenExpiresAt)
              : null,
            refreshTokenExpiresAt: delegatedUser.refreshTokenExpiresAt
              ? new Date(delegatedUser.refreshTokenExpiresAt)
              : null,
          },
          /**
           * Callback to save refreshed tokens in database
           *
           * @param newTokens
           */
          async (newTokens) => {
            await this.updateDelegatedUserTokens(projectId, {
              ...newTokens,
              tokenLastValidatedAt: new Date(),
            });

            this.logger.info(`Refreshed and saved new tokens for project ${projectId}`);
          }
        );
      } catch (refreshError) {
        /**
         * Log error message only, not the full error object to avoid logging tokens
         */
        this.logger.warn(`Failed to refresh token for project ${projectId}, falling back to installation token: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);

        /**
         * If refresh fails, fall back to installation token
         */
        delegatedUserToken = null;
      }
    }

    /**
     * Try to execute the operation
     */
    try {
      return await operation(delegatedUserToken);
    } catch (error) {
      /**
       * Check if error is 401 (unauthorized) - token might be revoked
       * Try to refresh token and retry once
       */
      const HTTP_UNAUTHORIZED = 401;

      if (error?.status === HTTP_UNAUTHORIZED && taskManager.config.delegatedUser?.status === 'active') {
        const delegatedUser = taskManager.config.delegatedUser;

        this.logger.warn(`Received 401 error for project ${projectId} during ${operationName}, attempting token refresh...`);

        try {
          /**
           * Refresh token
           */
          const newTokens = await this.githubService.refreshUserToken(delegatedUser.refreshToken);

          /**
           * Save refreshed tokens
           */
          await this.updateDelegatedUserTokens(projectId, {
            ...newTokens,
            tokenLastValidatedAt: new Date(),
          });

          /**
           * Retry operation with new token
           */
          const result = await operation(newTokens.accessToken);

          this.logger.info(`Successfully refreshed token and completed ${operationName} for project ${projectId}`);

          return result;
        } catch (refreshError) {
          /**
           * Refresh failed, mark token as revoked
           * Log error message only, not the full error object to avoid logging tokens
           */
          this.logger.error(`Failed to refresh token for project ${projectId}: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);

          await this.markDelegatedUserAsRevoked(projectId);

          /**
           * Re-throw original error
           */
          throw error;
        }
      } else {
        /**
         * Not a 401 error or no delegatedUser, re-throw original error
         */
        throw error;
      }
    }
  }

  /**
   * Mark delegatedUser as revoked
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<void>}
   */
  private async markDelegatedUserAsRevoked(projectId: string): Promise<void> {
    const connection = await this.accountsDb.getConnection();
    const projectsCollection = connection.collection<ProjectDBScheme>('projects');

    await projectsCollection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          'taskManager.config.delegatedUser.status': 'revoked',
          'taskManager.updatedAt': new Date(),
        },
      }
    );
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        returnDocument: 'after',
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const connectedAtTimestamp = Math.floor(connectedAt.getTime() / TimeMs.SECOND);

    const events = await eventsCollection
      .find({
        taskManagerItem: { $exists: false },
        timestamp: { $gte: connectedAtTimestamp },
        totalCount: { $gte: threshold },
      })
      .sort({
        totalCount: -1,
        timestamp: -1,
      })
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
   * @param copilotAssigned - whether Copilot was successfully assigned
   */
  private async saveTaskManagerItem(
    projectId: string,
    event: GroupedEventDBScheme,
    issueNumber: number,
    taskManager: ProjectTaskManagerConfig,
    issueUrl: string,
    copilotAssigned = false
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
      assignee: copilotAssigned ? 'copilot' : null,
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

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
  WorkspaceDBScheme,
  UserDBScheme,
  GitHubAuthorization,
  GitHubInstallation
} from '@hawk.so/types';
import type { TaskManagerItem } from '@hawk.so/types/src/base/event/taskManagerItem';
import HawkCatcher from '@hawk.so/nodejs';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { GitHubService } from '@hawk.so/github-sdk';
import { formatIssueFromEvent } from './utils/issue';
import { TimeMs } from '@hawk.so/utils';

/**
 * Resolved delegate information for Copilot assignment
 */
interface DelegateInfo {
  hawkUserId: string;
  githubUserId: number;
  githubLogin: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date | null;
}

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
  private githubService: GitHubService;

  constructor() {
    super();

    if (
      !process.env.GITHUB_APP_ID || 
      !process.env.GITHUB_PRIVATE_KEY || 
      !process.env.GITHUB_APP_SLUG || 
      !process.env.GITHUB_APP_CLIENT_ID ||
      !process.env.GITHUB_APP_CLIENT_SECRET
    ) {
      throw new Error('Some required environment variable in not set');
    }

    this.githubService = new GitHubService({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
      appSlug: process.env.GITHUB_APP_SLUG,
      clientId: process.env.GITHUB_APP_CLIENT_ID,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    });
  }

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
     * We determine assignee status based on whether assignment actually succeeded
     */
    let copilotAssigned = false;

    /**
     * Step 2: Assign Copilot agent if enabled.
     * Delegate is resolved from workspace installation → user.githubAuthorizations.
     */
    if (taskManager.assignAgent) {
      try {
        const delegate = await this.findDelegate(project.workspaceId.toString(), taskManager.config.installationId);

        if (delegate) {
          const accessToken = await this.getAccessTokenForDelegate(delegate);

          await this.githubService.assignCopilot(
            taskManager.config.repoFullName,
            githubIssue.number,
            accessToken
          );
          copilotAssigned = true;
        } else {
          this.logger.warn(`No active delegate found for project ${projectId}, skipping Copilot assignment`);
        }
      } catch (error) {
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
   * Find a delegate user for Copilot assignment.
   *
   * Resolution chain:
   *   project.workspaceId → workspace.integrations.github.installations[installationId]
   *     → delegatedUser.hawkUserId → user.githubAuthorizations[].refreshToken
   *
   * @param workspaceId - Workspace ID
   * @param installationId - GitHub App installation ID (string, from project config)
   * @returns DelegateInfo or null if no active delegate found
   */
  private async findDelegate(workspaceId: string, installationId: string): Promise<DelegateInfo | null> {
    const connection = await this.accountsDb.getConnection();

    /**
     * Step 1: Find workspace and its installation
     */
    const workspacesCollection = connection.collection<WorkspaceDBScheme>('workspaces');
    const workspace = await workspacesCollection.findOne({ _id: new ObjectId(workspaceId) });

    if (!workspace) {
      this.logger.warn(`Workspace ${workspaceId} not found`);

      return null;
    }

    const installIdNum = parseInt(installationId, 10);
    const installation = workspace.integrations?.github?.installations?.find(
      (i: GitHubInstallation) => i.installationId === installIdNum
    );

    if (!installation) {
      this.logger.warn(`Installation ${installationId} not found in workspace ${workspaceId}`);

      return null;
    }

    /**
     * Step 2: Check delegatedUser status
     */
    if (!installation.delegatedUser || installation.delegatedUser.status !== 'active') {
      this.logger.warn(`No active delegate for installation ${installationId} in workspace ${workspaceId}`);

      return null;
    }

    /**
     * Step 3: Find user and their GitHub authorization
     */
    const usersCollection = connection.collection<UserDBScheme>('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(installation.delegatedUser.hawkUserId) });

    if (!user) {
      this.logger.warn(`Delegate user ${installation.delegatedUser.hawkUserId} not found`);

      return null;
    }

    const authorization = user.githubAuthorizations?.find(
      (a: GitHubAuthorization) => a.githubUserId === installation.delegatedUser.githubUserId && a.status === 'active'
    );

    if (!authorization) {
      this.logger.warn(`No active GitHub authorization for user ${installation.delegatedUser.hawkUserId} (githubUserId: ${installation.delegatedUser.githubUserId})`);

      return null;
    }

    return {
      hawkUserId: installation.delegatedUser.hawkUserId,
      githubUserId: authorization.githubUserId,
      githubLogin: authorization.githubLogin,
      refreshToken: authorization.refreshToken,
      refreshTokenExpiresAt: authorization.refreshTokenExpiresAt,
    };
  }

  /**
   * Get a fresh access token for a delegate by refreshing their OAuth token.
   * Also persists the new refreshToken back to user.githubAuthorizations[].
   *
   * @param delegate - delegate info with refreshToken
   * @returns Fresh access token
   */
  private async getAccessTokenForDelegate(delegate: DelegateInfo): Promise<string> {
    const newTokens = await this.githubService.refreshUserToken(delegate.refreshToken);

    /**
     * Persist updated refreshToken back to user document
     * (GitHub may rotate the refreshToken during refresh)
     */
    const connection = await this.accountsDb.getConnection();
    const usersCollection = connection.collection<UserDBScheme>('users');

    await usersCollection.updateOne(
      {
        _id: new ObjectId(delegate.hawkUserId),
        'githubAuthorizations.githubUserId': delegate.githubUserId,
      },
      {
        $set: {
          'githubAuthorizations.$.refreshToken': newTokens.refreshToken,
          'githubAuthorizations.$.refreshTokenExpiresAt': newTokens.refreshTokenExpiresAt,
          'githubAuthorizations.$.tokenLastValidatedAt': new Date(),
        },
      }
    );

    return newTokens.accessToken;
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
    const connectedAtTimestamp = Math.floor(connectedAt.getTime() / TimeMs.Second);

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

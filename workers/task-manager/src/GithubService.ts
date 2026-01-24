import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { normalizeGitHubPrivateKey } from './utils/githubPrivateKey';

/**
 * Type for GitHub Issue creation parameters
 */
export type IssueData = Pick<
  Endpoints['POST /repos/{owner}/{repo}/issues']['parameters'],
  'title' | 'body' | 'labels'
>;

/**
 * Type for GitHub Issue response data
 */
export type GitHubIssue = Pick<
  Endpoints['POST /repos/{owner}/{repo}/issues']['response']['data'],
  'number' | 'html_url' | 'title' | 'state'
>;

/**
 * Service for interacting with GitHub API from workers
 * Simplified version of api/src/integrations/github/service.ts
 * Only includes methods needed for creating issues
 */
export class GitHubService {
  /**
   * GitHub App ID from environment variables
   */
  private readonly appId: string;

  /**
   * Default timeout for GitHub API requests (in milliseconds)
   */
  private static readonly DEFAULT_TIMEOUT = 10000;

  /**
   * Creates an instance of GitHubService
   */
  constructor() {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID environment variable is not set');
    }

    this.appId = process.env.GITHUB_APP_ID;
  }

  /**
   * Create Octokit instance with configured timeout
   *
   * @param auth - Authentication token (JWT or installation access token)
   * @returns Configured Octokit instance
   */
  private createOctokit(auth: string): Octokit {
    return new Octokit({
      auth,
      request: {
        timeout: GitHubService.DEFAULT_TIMEOUT,
      },
    });
  }

  /**
   * Get private key from environment variables
   *
   * @returns {string} Private key in PEM format with real newlines
   * @throws {Error} If GITHUB_PRIVATE_KEY is not set
   */
  private getPrivateKey(): string {
    if (process.env.GITHUB_PRIVATE_KEY) {
      return normalizeGitHubPrivateKey(process.env.GITHUB_PRIVATE_KEY);
    }

    throw new Error('GITHUB_PRIVATE_KEY must be set');
  }

  /**
   * Create JWT token for GitHub App authentication
   *
   * @returns {string} JWT token
   */
  private createJWT(): string {
    const privateKey = this.getPrivateKey();
    const now = Math.floor(Date.now() / 1000);

    /**
     * JWT payload for GitHub App
     * - iat: issued at time (current time)
     * - exp: expiration time (10 minutes from now, GitHub allows up to 10 minutes)
     * - iss: issuer (GitHub App ID)
     */
    const payload = {
      iat: now - 60, // Allow 1 minute clock skew
      exp: now + 600, // 10 minutes expiration
      iss: this.appId,
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  /**
   * Get installation access token from GitHub API
   *
   * @param {string} installationId - GitHub App installation ID
   * @returns {Promise<string>} Installation access token (valid for 1 hour)
   * @throws {Error} If token creation fails
   */
  private async createInstallationToken(installationId: string): Promise<string> {
    const token = this.createJWT();

    /**
     * Create Octokit instance with JWT authentication and configured timeout
     */
    const octokit = this.createOctokit(token);

    try {
      /**
       * Request installation access token
       */
      const { data } = await octokit.rest.apps.createInstallationAccessToken({
        installation_id: parseInt(installationId, 10),
      });

      return data.token;
    } catch (error) {
      throw new Error(`Failed to create installation token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a GitHub issue
   *
   * @param {string} repoFullName - Repository full name (owner/repo)
   * @param {string} installationId - GitHub App installation ID
   * @param {IssueData} issueData - Issue data (title, body, labels)
   * @returns {Promise<GitHubIssue>} Created issue
   * @throws {Error} If issue creation fails
   */
  public async createIssue(
    repoFullName: string,
    installationId: string,
    issueData: IssueData
  ): Promise<GitHubIssue> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Get installation access token
     */
    const accessToken = await this.createInstallationToken(installationId);

    /**
     * Create Octokit instance with installation access token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    try {
      const { data } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueData.title,
        body: issueData.body,
        labels: issueData.labels,
      });

      return {
        number: data.number,
        html_url: data.html_url,
        title: data.title,
        state: data.state,
      };
    } catch (error) {
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Assign GitHub Copilot to an issue using GraphQL API
   *
   * @param {string} repoFullName - Repository full name (owner/repo)
   * @param {number} issueNumber - Issue number
   * @param {string} installationId - GitHub App installation ID
   * @returns {Promise<boolean>} True if assignment was successful
   * @throws {Error} If assignment fails
   */
  public async assignCopilot(
    repoFullName: string,
    issueNumber: number,
    installationId: string
  ): Promise<boolean> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Get installation access token
     */
    const accessToken = await this.createInstallationToken(installationId);

    /**
     * Create Octokit instance with installation access token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    try {
      /**
       * Step 1: Get repository ID and find Copilot bot ID
       * According to GitHub docs: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-a-pr
       */
      const repoInfoQuery = `
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
            issue(number: ${issueNumber}) {
              id
            }
            suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
              nodes {
                login
                __typename
                ... on Bot {
                  id
                }
              }
            }
          }
        }
      `;

      const repoInfo: any = await octokit.graphql(repoInfoQuery, {
        owner,
        name: repo,
      });

      const repositoryId = repoInfo?.repository?.id;
      const issueId = repoInfo?.repository?.issue?.id;

      if (!repositoryId || !issueId) {
        throw new Error(`Failed to get repository or issue ID for ${repoFullName}#${issueNumber}`);
      }

      /**
       * Find Copilot bot in suggested actors
       */
      const copilotBot = repoInfo.repository.suggestedActors.nodes.find(
        (node: any) => node.login === 'copilot-swe-agent'
      );

      if (!copilotBot || !copilotBot.id) {
        throw new Error('Copilot coding agent (copilot-swe-agent) is not available for this repository');
      }

      /**
       * Step 2: Assign issue to Copilot using GraphQL mutation
       */
      const assignMutation = `
        mutation($assignableId: ID!, $actorIds: [ID!]!) {
          addAssigneesToAssignable(input: {
            assignableId: $assignableId
            assigneeIds: $actorIds
          }) {
            assignable {
              ... on Issue {
                id
                number
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
        }
      `;

      await octokit.graphql(assignMutation, {
        assignableId: issueId,
        actorIds: [copilotBot.id],
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to assign Copilot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

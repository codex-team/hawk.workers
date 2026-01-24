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
   * GitHub App ID from environment variables (optional if using PAT)
   */
  private readonly appId?: string;

  /**
   * Default timeout for GitHub API requests (in milliseconds)
   */
  private static readonly DEFAULT_TIMEOUT = 10000;

  /**
   * Creates an instance of GitHubService
   * Supports both GitHub App authentication and Personal Access Token (PAT)
   */
  constructor() {
    /**
     * If GITHUB_PAT is set, use PAT authentication (no need for GITHUB_APP_ID)
     * Otherwise, require GITHUB_APP_ID for GitHub App authentication
     */
    if (!process.env.GITHUB_PAT && !process.env.GITHUB_APP_ID) {
      throw new Error('Either GITHUB_PAT or GITHUB_APP_ID environment variable must be set');
    }

    if (process.env.GITHUB_APP_ID) {
      this.appId = process.env.GITHUB_APP_ID;
    }
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
        headers: {
          'GraphQL-Features': 'issues_copilot_assignment_api_support',
        },
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
   * @throws {Error} If GITHUB_APP_ID is not set
   */
  private createJWT(): string {
    if (!this.appId) {
      throw new Error('GITHUB_APP_ID is required for GitHub App authentication');
    }

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
   * Get Personal Access Token from environment variables
   *
   * @returns {string | null} PAT if available, null otherwise
   */
  private getPAT(): string | null {
    return process.env.GITHUB_PAT || null;
  }

  /**
   * Get authentication token (PAT or installation access token)
   *
   * @param {string | null} installationId - GitHub App installation ID (optional if using PAT)
   * @returns {Promise<string>} Authentication token
   * @throws {Error} If token creation fails
   */
  private async getAuthToken(installationId: string | null): Promise<string> {
    /**
     * If PAT is available, use it directly
     */
    const pat = this.getPAT();
    if (pat) {
      console.log('[GitHub API] Using Personal Access Token (PAT) for authentication');
      return pat;
    }

    /**
     * Otherwise, use GitHub App authentication
     */
    if (!installationId) {
      throw new Error('installationId is required when using GitHub App authentication');
    }

    console.log('[GitHub API] Using GitHub App authentication with installation ID:', installationId);
    return this.createInstallationToken(installationId);
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
   * @param {string | null} installationId - GitHub App installation ID (optional if using PAT)
   * @param {IssueData} issueData - Issue data (title, body, labels)
   * @param {boolean} assignAgent - Whether to assign Copilot agent (creates issue via GraphQL with assigneeIds)
   * @returns {Promise<GitHubIssue>} Created issue
   * @throws {Error} If issue creation fails
   */
  public async createIssue(
    repoFullName: string,
    installationId: string | null,
    issueData: IssueData,
    assignAgent: boolean = false
  ): Promise<GitHubIssue> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Get authentication token (PAT or installation access token)
     */
    const accessToken = await this.getAuthToken(installationId);

    /**
     * Create Octokit instance with authentication token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    /**
     * If assignAgent is true, create issue via GraphQL with Copilot assignment
     * This is the recommended approach according to GitHub community discussions
     */
    if (assignAgent) {
      try {
        /**
         * Step 1: Get repository ID and find Copilot bot ID
         * Note: Actor is a union type, so we need to use fragments to get id
         */
        const repoInfoQuery = `
          query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              id
              suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
                nodes {
                  login
                  __typename
                  ... on Bot {
                    id
                  }
                  ... on User {
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

        console.log('[GitHub API] Repository info query response:', JSON.stringify(repoInfo, null, 2));

        const repositoryId = repoInfo?.repository?.id;

        if (!repositoryId) {
          throw new Error(`Failed to get repository ID for ${repoFullName}`);
        }

        /**
         * Find Copilot bot in suggested actors
         */
        let copilotBot = repoInfo.repository.suggestedActors.nodes.find(
          (node: any) => node.login === 'copilot-swe-agent'
        );

        console.log('[GitHub API] Copilot bot found in suggestedActors:', copilotBot ? { login: copilotBot.login, id: copilotBot.id } : 'not found');

        /**
         * If not found in suggestedActors, try to get it directly by login
         */
        if (!copilotBot || !copilotBot.id) {
          console.log('[GitHub API] Trying to get Copilot bot directly by login...');

          try {
            const copilotBotQuery = `
              query($login: String!) {
                user(login: $login) {
                  id
                  login
                  __typename
                }
              }
            `;

            const copilotUserInfo: any = await octokit.graphql(copilotBotQuery, {
              login: 'copilot-swe-agent',
            });

            console.log('[GitHub API] Direct Copilot bot query response:', JSON.stringify(copilotUserInfo, null, 2));

            if (copilotUserInfo?.user?.id) {
              copilotBot = {
                login: copilotUserInfo.user.login,
                id: copilotUserInfo.user.id,
              };
            }
          } catch (directQueryError) {
            console.log('[GitHub API] Failed to get Copilot bot directly:', directQueryError);
          }
        }

        if (!copilotBot || !copilotBot.id) {
          /**
           * Fallback: Create issue without Copilot assignment via REST API
           */
          console.log('[GitHub API] Copilot bot not found, creating issue without assignment');
          return this.createIssueViaRest(octokit, owner, repo, issueData);
        }

        console.log('[GitHub API] Using Copilot bot:', { login: copilotBot.login, id: copilotBot.id });

        /**
         * Step 2: Create issue via GraphQL with Copilot assignment
         * This is the recommended approach from GitHub community discussions
         */
        const createIssueMutation = `
          mutation($repoId: ID!, $title: String!, $body: String!, $assigneeIds: [ID!]) {
            createIssue(input: {
              repositoryId: $repoId
              title: $title
              body: $body
              assigneeIds: $assigneeIds
            }) {
              issue {
                number
                title
                url
                state
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
        `;

        const response: any = await octokit.graphql(createIssueMutation, {
          repoId: repositoryId,
          title: issueData.title,
          body: issueData.body,
          assigneeIds: [copilotBot.id],
        });

        console.log('[GitHub API] Create issue with Copilot mutation response:', JSON.stringify(response, null, 2));

        const issue = response?.createIssue?.issue;

        if (!issue) {
          throw new Error('Failed to create issue via GraphQL');
        }

        return {
          number: issue.number,
          html_url: issue.url,
          title: issue.title,
          state: issue.state,
        };
      } catch (error) {
        /**
         * If GraphQL creation fails, fallback to REST API
         */
        console.log('[GitHub API] GraphQL issue creation failed, falling back to REST API:', error);
        return this.createIssueViaRest(octokit, owner, repo, issueData);
      }
    }

    /**
     * Default: Create issue via REST API (no Copilot assignment)
     */
    return this.createIssueViaRest(octokit, owner, repo, issueData);
  }

  /**
   * Create a GitHub issue via REST API (helper method)
   *
   * @param {Octokit} octokit - Octokit instance
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {IssueData} issueData - Issue data (title, body, labels)
   * @returns {Promise<GitHubIssue>} Created issue
   * @throws {Error} If issue creation fails
   */
  private async createIssueViaRest(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueData: IssueData
  ): Promise<GitHubIssue> {
    try {
      const { data } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueData.title,
        body: issueData.body,
        labels: issueData.labels,
      });

      console.log('[GitHub API] Create issue response:', JSON.stringify({
        number: data.number,
        html_url: data.html_url,
        title: data.title,
        state: data.state,
        assignees: data.assignees?.map(a => a.login) || [],
      }, null, 2));

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

}

import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import TimeMs from '../../../lib/utils/time';
import { normalizeGitHubPrivateKey } from './utils/githubPrivateKey';
import { refreshToken as refreshOAuthToken } from '@octokit/oauth-methods';

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
   * Default timeout for GitHub API requests (in milliseconds)
   */
  private static readonly DEFAULT_TIMEOUT = 10000;

  /**
   * Minutes in 10 minutes (JWT expiration time)
   */
  private static readonly JWT_EXPIRATION_MINUTES = 10;

  /**
   * Minutes for token refresh buffer
   */
  private static readonly TOKEN_REFRESH_BUFFER_MINUTES = 5;

  /**
   * Number of assignees to fetch in GraphQL query
   */
  private static readonly ASSIGNEES_QUERY_LIMIT = 20;

  /**
   * GitHub App ID from environment variables
   */
  private readonly appId?: string;

  /**
   * GitHub App Client ID from environment variables (optional, needed for token refresh)
   */
  private readonly clientId?: string;

  /**
   * GitHub App Client Secret from environment variables (optional, needed for token refresh)
   */
  private readonly clientSecret?: string;

  /**
   * Creates an instance of GitHubService
   * Requires GitHub App authentication
   */
  constructor() {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID environment variable must be set');
    }

    this.appId = process.env.GITHUB_APP_ID;

    /**
     * Client ID and Secret are optional but needed for token refresh
     */
    if (process.env.GITHUB_APP_CLIENT_ID) {
      this.clientId = process.env.GITHUB_APP_CLIENT_ID;
    }

    if (process.env.GITHUB_APP_CLIENT_SECRET) {
      this.clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
    }
  }

  /**
   * Create a GitHub issue using GitHub App installation token
   *
   * @param {string} repoFullName - Repository full name (owner/repo)
   * @param {string | null} installationId - GitHub App installation ID
   * @param {IssueData} issueData - Issue data (title, body, labels)
   * @returns {Promise<GitHubIssue>} Created issue
   * @throws {Error} If issue creation fails
   */
  public async createIssue(
    repoFullName: string,
    installationId: string | null,
    issueData: IssueData
  ): Promise<GitHubIssue> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Get installation access token (GitHub App token)
     */
    const accessToken = await this.getAuthToken(installationId);

    /**
     * Create Octokit instance with installation token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    /**
     * Create issue via REST API using installation token
     */
    return this.createIssueViaRest(octokit, owner, repo, issueData);
  }

  /**
   * Assign Copilot agent to a GitHub issue using user-to-server OAuth token
   *
   * @param {string} repoFullName - Repository full name (owner/repo)
   * @param {number} issueNumber - Issue number
   * @param {string} delegatedUserToken - User-to-server OAuth token
   * @returns {Promise<void>}
   * @throws {Error} If Copilot assignment fails
   */
  public async assignCopilot(
    repoFullName: string,
    issueNumber: number,
    delegatedUserToken: string
  ): Promise<void> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Create Octokit instance with user-to-server OAuth token
     */
    const octokit = this.createOctokit(delegatedUserToken);

    try {
      /**
       * Step 1: Get repository ID and find Copilot bot ID
       */
      const suggestedActorsLimit = GitHubService.ASSIGNEES_QUERY_LIMIT;
      const repoInfoQuery = `
        query($owner: String!, $name: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $name) {
            id
            issue(number: $issueNumber) {
              id
            }
            suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: ${suggestedActorsLimit}) {
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
        issueNumber,
      });

      const JSON_INDENT_SPACES = 2;

      console.log('[GitHub API] Repository info query response:', JSON.stringify(repoInfo, null, JSON_INDENT_SPACES));

      const repositoryId = repoInfo?.repository?.id;
      const issueId = repoInfo?.repository?.issue?.id;

      if (!repositoryId) {
        throw new Error(`Failed to get repository ID for ${repoFullName}`);
      }

      if (!issueId) {
        throw new Error(`Failed to get issue ID for issue #${issueNumber}`);
      }

      /**
       * Find Copilot bot in suggested actors
       */
      let copilotBot = repoInfo.repository.suggestedActors.nodes.find(
        (node: any) => node.login === 'copilot-swe-agent'
      );

      console.log('[GitHub API] Copilot bot found in suggestedActors:', copilotBot
        ? {
          login: copilotBot.login,
          id: copilotBot.id,
        }
        : 'not found');

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

          console.log('[GitHub API] Direct Copilot bot query response:', JSON.stringify(copilotUserInfo, null, JSON_INDENT_SPACES));

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
        throw new Error('Copilot coding agent (copilot-swe-agent) is not available for this repository');
      }

      console.log('[GitHub API] Using Copilot bot:', {
        login: copilotBot.login,
        id: copilotBot.id,
      });

      /**
       * Step 2: Assign Copilot to issue via GraphQL
       * Note: Assignable is a union type (Issue | PullRequest), so we need to use fragments
       */
      const assignCopilotMutation = `
        mutation($issueId: ID!, $assigneeIds: [ID!]!) {
          addAssigneesToAssignable(input: {
            assignableId: $issueId
            assigneeIds: $assigneeIds
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
              ... on PullRequest {
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

      const response: any = await octokit.graphql(assignCopilotMutation, {
        issueId,
        assigneeIds: [ copilotBot.id ],
      });

      console.log('[GitHub API] Assign Copilot mutation response:', JSON.stringify(response, null, JSON_INDENT_SPACES));

      const assignable = response?.addAssigneesToAssignable?.assignable;

      if (!assignable) {
        throw new Error('Failed to assign Copilot to issue');
      }

      /**
       * Assignable is a union type (Issue | PullRequest), so we need to check which type it is
       * Both Issue and PullRequest have assignees field, so we can access it directly
       *
       * Note: The assignees list might not be immediately updated in the response,
       * so we check if the mutation succeeded (assignable is not null) rather than
       * verifying the assignees list directly
       */
      const assignedLogins = assignable.assignees?.nodes?.map((n: any) => n.login) || [];

      /**
       * Log assignees for debugging (but don't fail if Copilot is not in the list yet)
       * GitHub API might not immediately reflect the assignment in the response
       */
      console.log(`[GitHub API] Issue assignees after mutation:`, assignedLogins);

      /**
       * Get issue number from assignable (works for both Issue and PullRequest)
       */
      const assignedNumber = assignable.number;

      /**
       * If Copilot is in the list, log success. Otherwise, just log a warning
       * but don't throw an error, as the mutation might have succeeded even if
       * the response doesn't show the assignee yet
       */
      if (assignedLogins.includes('copilot-swe-agent')) {
        console.log(`[GitHub API] Successfully assigned Copilot to issue #${assignedNumber}`);
      } else {
        /**
         * Mutation succeeded (assignable is not null), but assignees list might not be updated yet
         * This is a known behavior of GitHub API - the mutation succeeds but the response
         * might not immediately reflect the new assignee
         */
        console.log(`[GitHub API] Copilot assignment mutation completed for issue #${assignedNumber}, but assignees list not yet updated in response`);
      }
    } catch (error) {
      throw new Error(`Failed to assign Copilot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get valid access token with automatic refresh if needed
   * Checks if token is expired or close to expiration and refreshes if necessary
   *
   * @param {Object} tokenInfo - Current token information
   * @param {string} tokenInfo.accessToken - Current access token
   * @param {string} tokenInfo.refreshToken - Refresh token
   * @param {Date | null} tokenInfo.accessTokenExpiresAt - Access token expiration date
   * @param {Date | null} tokenInfo.refreshTokenExpiresAt - Refresh token expiration date
   * @param {Function} onRefresh - Callback to save refreshed tokens (called after successful refresh)
   * @returns {Promise<string>} Valid access token
   * @throws {Error} If token refresh fails or refresh token is expired
   */
  public async getValidAccessToken(
    tokenInfo: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date | null;
      refreshTokenExpiresAt: Date | null;
    },
    onRefresh?: (newTokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date | null;
      refreshTokenExpiresAt: Date | null;
    }) => Promise<void>
  ): Promise<string> {
    const now = new Date();
    const bufferTime = GitHubService.TOKEN_REFRESH_BUFFER_MINUTES * TimeMs.MINUTE; // 5 minutes buffer before expiration

    /**
     * Check if access token is expired or close to expiration
     */
    if (tokenInfo.accessTokenExpiresAt) {
      const timeUntilExpiration = tokenInfo.accessTokenExpiresAt.getTime() - now.getTime();

      if (timeUntilExpiration <= bufferTime) {
        /**
         * Token is expired or close to expiration, need to refresh
         */
        if (!tokenInfo.refreshToken) {
          throw new Error('Access token expired and no refresh token available');
        }

        /**
         * Check if refresh token is expired
         */
        if (tokenInfo.refreshTokenExpiresAt && tokenInfo.refreshTokenExpiresAt <= now) {
          throw new Error('Refresh token is expired');
        }

        if (!this.clientId || !this.clientSecret) {
          throw new Error('GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET are required for token refresh');
        }

        /**
         * Refresh the token
         */
        const newTokens = await this.refreshUserToken(tokenInfo.refreshToken);

        /**
         * Save refreshed tokens if callback provided
         */
        if (onRefresh) {
          await onRefresh(newTokens);
        }

        return newTokens.accessToken;
      }
    }

    /**
     * Token is still valid, return it
     */
    return tokenInfo.accessToken;
  }

  /**
   * Refresh user-to-server access token using refresh token
   * Rotates refresh token if a new one is provided
   *
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<{ accessToken: string; refreshToken: string; expiresAt: Date | null; refreshTokenExpiresAt: Date | null }>} New tokens
   * @throws {Error} If token refresh fails
   */
  public async refreshUserToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET are required for token refresh');
    }

    try {
      const { authentication } = await refreshOAuthToken({
        clientType: 'github-app',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
      });

      if (!authentication.token) {
        throw new Error('No access token in refresh response');
      }

      /**
       * refreshToken, expiresAt, and refreshTokenExpiresAt are only available in certain authentication types
       * Use type guards to safely access these properties
       */
      const newRefreshToken = 'refreshToken' in authentication && authentication.refreshToken
        ? authentication.refreshToken
        : refreshToken; // Use new refresh token if provided, otherwise keep old one

      return {
        accessToken: authentication.token,
        refreshToken: newRefreshToken,
        expiresAt: 'expiresAt' in authentication && authentication.expiresAt
          ? new Date(authentication.expiresAt)
          : null,
        refreshTokenExpiresAt: 'refreshTokenExpiresAt' in authentication && authentication.refreshTokenExpiresAt
          ? new Date(authentication.refreshTokenExpiresAt)
          : null,
      };
    } catch (error) {
      throw new Error(`Failed to refresh user token: ${error instanceof Error ? error.message : String(error)}`);
    }
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

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { html_url } = data;

      const JSON_INDENT_SPACES = 2;

      console.log('[GitHub API] Create issue response:', JSON.stringify({
        number: data.number,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        html_url,
        title: data.title,
        state: data.state,
        assignees: data.assignees?.map(a => a.login) || [],
      }, null, JSON_INDENT_SPACES));

      return {
        number: data.number,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        html_url,
        title: data.title,
        state: data.state,
      };
    } catch (error) {
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : String(error)}`);
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
    const now = Math.floor(Date.now() / TimeMs.SECOND);

    /**
     * JWT payload for GitHub App
     * - iat: issued at time (current time)
     * - exp: expiration time (10 minutes from now, GitHub allows up to 10 minutes)
     * - iss: issuer (GitHub App ID)
     */
    const secondsInMinute = TimeMs.MINUTE / TimeMs.SECOND;
    const payload = {
      iat: now - secondsInMinute, // Allow 1 minute clock skew
      exp: now + (GitHubService.JWT_EXPIRATION_MINUTES * secondsInMinute), // 10 minutes expiration
      iss: this.appId,
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  /**
   * Get authentication token (installation access token)
   *
   * @param {string | null} installationId - GitHub App installation ID
   * @returns {Promise<string>} Authentication token
   * @throws {Error} If token creation fails
   */
  private async getAuthToken(installationId: string | null): Promise<string> {
    if (!installationId) {
      throw new Error('installationId is required for GitHub App authentication');
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { data } = await octokit.rest.apps.createInstallationAccessToken({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        installation_id: parseInt(installationId, 10),
      });

      return data.token;
    } catch (error) {
      throw new Error(`Failed to create installation token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

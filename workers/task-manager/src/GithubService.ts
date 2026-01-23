import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

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
      /**
       * Get private key from environment variable
       * Check if the string contains literal \n (backslash followed by n) instead of actual newlines
       */
      let privateKey = process.env.GITHUB_PRIVATE_KEY;

      if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
        /**
         * Replace literal \n with actual newlines
         */
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      return privateKey;
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
   * Assign GitHub Copilot to an issue
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
       * Assign GitHub Copilot (github-copilot[bot]) as assignee
       */
      await octokit.rest.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees: ['github-copilot[bot]'],
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to assign Copilot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

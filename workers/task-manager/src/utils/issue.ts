import type { GroupedEventDBScheme, ProjectDBScheme } from '@hawk.so/types';
import { decodeUnsafeFields } from '../../../../lib/utils/unsafeFields';
import type { IssueData } from '../GithubService';

/**
 * Format date for display in GitHub issue
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string (e.g., "23 Feb 2025 14:40:21")
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');

  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate days repeating from timestamp
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Number of days since first occurrence
 */
function calculateDaysRepeating(timestamp: number): number {
  const now = Date.now();
  const eventTimestamp = timestamp * 1000;
  const differenceInDays = (now - eventTimestamp) / (1000 * 3600 * 24);

  return Math.round(differenceInDays);
}

/**
 * Format source code as diff with line numbers
 * The error line is marked with minus sign, other lines with space
 *
 * @param sourceCode - Array of source code lines
 * @param errorLine - Line number where error occurred
 * @returns Formatted diff string
 */
function formatSourceCodeAsDiff(sourceCode: Array<{ line: number; content: string }>, errorLine: number): string {
  const lines: string[] = [];

  for (const sourceLine of sourceCode) {
    const lineNumber = sourceLine.line.toString().padStart(3, ' ');
    const isErrorLine = sourceLine.line === errorLine;
    const prefix = isErrorLine ? '-' : ' ';

    /**
     * Escape HTML entities in content
     */
    const escapedContent = sourceLine.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    lines.push(`${prefix}${lineNumber}: ${escapedContent}`);
  }

  return lines.join('\n');
}

/**
 * Format GitHub Issue from event
 *
 * @param event - event to format issue for
 * @param project - project
 * @returns Issue data for GitHub API
 */
export function formatIssueFromEvent(event: GroupedEventDBScheme, project: ProjectDBScheme): IssueData {
  /**
   * Decode unsafe fields (context, addons) if they are strings
   */
  const decodedEvent = { ...event };

  decodeUnsafeFields(decodedEvent);

  const projectId = project._id.toString();
  const garageUrl = process.env.GARAGE_URL || 'https://garage.hawk.so';
  const eventUrl = `${garageUrl}/project/${projectId}/event/${event.groupHash}`;

  /**
   * Format title: [Hawk] ${event.payload.title}
   */
  const title = `[Hawk] ${decodedEvent.payload.title}`;

  /**
   * Format body according to the template:
   * - H2 header
   * - Stacktrace with first frame expanded, others in details
   * - Table with event data
   * - Context and Addons as JSON
   * - Link to event in Hawk
   */
  const bodyParts: string[] = [];

  /**
   * H2 header with title
   */
  bodyParts.push(`## ${decodedEvent.payload.title}`);

  /**
   * Stacktrace section
   */
  if (decodedEvent.payload.backtrace && decodedEvent.payload.backtrace.length > 0) {
    const firstFrame = decodedEvent.payload.backtrace[0];
    const file = firstFrame.file || '<unknown>';
    const line = firstFrame.line || 0;
    const column = firstFrame.column || 0;
    const func = firstFrame.function || '<anonymous>';

    /**
     * First frame - always visible
     */
    bodyParts.push(`\n- at ${func} (${file}:${line}:${column})`);

    /**
     * Source code for first frame in diff format
     */
    if (firstFrame.sourceCode && firstFrame.sourceCode.length > 0) {
      bodyParts.push('\n```diff');
      bodyParts.push(formatSourceCodeAsDiff(firstFrame.sourceCode, line));
      bodyParts.push('```');
    }

    /**
     * Additional frames in details section
     */
    if (decodedEvent.payload.backtrace.length > 1) {
      bodyParts.push('\n<details>');
      bodyParts.push('  <summary>View full stack trace</summary>');
      bodyParts.push('    \n');

      for (let i = 1; i < decodedEvent.payload.backtrace.length; i++) {
        const frame = decodedEvent.payload.backtrace[i];
        const frameFile = frame.file || '<unknown>';
        const frameLine = frame.line || 0;
        const frameColumn = frame.column || 0;
        const frameFunc = frame.function || '<anonymous>';

        bodyParts.push(`- at ${frameFunc} (${frameFile}:${frameLine}:${frameColumn})`);

        /**
         * Source code for this frame in diff format
         */
        if (frame.sourceCode && frame.sourceCode.length > 0) {
          bodyParts.push('\n```diff');
          bodyParts.push(formatSourceCodeAsDiff(frame.sourceCode, frameLine));
          bodyParts.push('```');
        }

        /**
         * Add newline between frames if not last
         */
        if (i < decodedEvent.payload.backtrace.length - 1) {
          bodyParts.push('');
        }
      }

      bodyParts.push('\n</details>');
    }
  }

  /**
   * Table with event data
   */
  const sinceDate = formatDate(decodedEvent.timestamp);
  const daysRepeating = calculateDaysRepeating(decodedEvent.timestamp);

  bodyParts.push('\n| Param | Value |');
  bodyParts.push('| -- | :--: |');
  bodyParts.push(`| Since | ${sinceDate} |`);
  bodyParts.push(`| Days Repeating | ${daysRepeating} |`);
  bodyParts.push(`| Total Occurrences | ${decodedEvent.totalCount} |`);
  bodyParts.push(`| Users Affected | ${decodedEvent.usersAffected || '-'} |`);

  /**
   * Context and Addons sections in details
   */
  if (decodedEvent.payload.context || decodedEvent.payload.addons) {
    bodyParts.push('\n<details>');
    bodyParts.push('  <summary>View Context and Addons</summary>');
    bodyParts.push('    \n');

    /**
     * Context section
     */
    if (decodedEvent.payload.context) {
      bodyParts.push('### Context');
      bodyParts.push('\n```json');
      bodyParts.push(JSON.stringify(decodedEvent.payload.context, null, 2));
      bodyParts.push('```');
    }

    /**
     * Addons section
     */
    if (decodedEvent.payload.addons) {
      bodyParts.push('\n### Addons');
      bodyParts.push('\n```json');
      bodyParts.push(JSON.stringify(decodedEvent.payload.addons, null, 2));
      bodyParts.push('```');
    }

    bodyParts.push('\n</details>');
  }

  /**
   * Link to event in Hawk
   */
  bodyParts.push('\n### Details');
  bodyParts.push(`\n[View in Hawk](${eventUrl})`);

  /**
   * Technical marker for tracking
   */
  bodyParts.push(`\n\n<!-- hawk_groupHash: ${event.groupHash} -->`);

  const body = bodyParts.join('\n');

  /**
   * Labels: hawk:error
   */
  const labels = [ 'hawk:error' ];

  return {
    title,
    body,
    labels,
  };
}

import type { GroupedEventDBScheme, ProjectDBScheme } from '@hawk.so/types';
import { decodeUnsafeFields } from '../../../../lib/utils/unsafeFields';
import type { IssueData } from '../GithubService';

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
   * Format body with:
   * - Link to event page in Hawk
   * - totalCount
   * - Stacktrace (top frames, truncated)
   * - Technical marker: hawk_groupHash
   */
  const bodyParts: string[] = [];

  /**
   * Link to event page
   */
  bodyParts.push(`**View in Hawk:** ${eventUrl}`);

  /**
   * Total count
   */
  bodyParts.push(`\n**Total occurrences:** ${decodedEvent.totalCount}`);

  /**
   * Stacktrace (top frames, truncated to 10 frames max)
   */
  if (decodedEvent.payload.backtrace && decodedEvent.payload.backtrace.length > 0) {
    bodyParts.push('\n**Stacktrace:**');
    bodyParts.push('```');

    /**
     * Take top 10 frames and format them
     */
    const topFrames = decodedEvent.payload.backtrace.slice(0, 10);

    for (const frame of topFrames) {
      const file = frame.file || '<unknown>';
      const line = frame.line || 0;
      const column = frame.column || 0;
      const func = frame.function || '<anonymous>';

      bodyParts.push(`at ${func} (${file}:${line}:${column})`);

      /**
       * Add source code snippet if available (first 3 lines)
       */
      if (frame.sourceCode && frame.sourceCode.length > 0) {
        const sourceLines = frame.sourceCode.slice(0, 3);

        for (const sourceLine of sourceLines) {
          bodyParts.push(`  ${sourceLine.line}: ${sourceLine.content}`);
        }
      }
    }

    bodyParts.push('```');
  }

  /**
   * Technical marker for tracking
   */
  bodyParts.push(`\n<!-- hawk_groupHash: ${event.groupHash} -->`);

  const body = bodyParts.join('\n');

  /**
   * Labels: hawk:error
   */
  const labels = ['hawk:error'];

  return {
    title,
    body,
    labels,
  };
}

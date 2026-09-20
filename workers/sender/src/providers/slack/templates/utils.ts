/**
 * Some helpers used in templates
 */
import { DecodedGroupedEvent, GroupedEventDBScheme, ProjectDBScheme } from '@hawk.so/types';

/**
 * Returns event location based on the first backtrace frame or URL
 *
 * @param event - event from which we need to get location
 */
export function getEventLocation(event: DecodedGroupedEvent): string {
  const { backtrace, addons } = event.payload;

  if (!backtrace || !backtrace.length) {
    return '';
  }

  if (backtrace[0].file) {
    return backtrace[0].file;
  }

  if ('url' in addons) {
    return addons.url as string;
  }

  return 'Unknown location';
}

/**
 * Return event URL in a Garage
 *
 * @param host - garage host. Also, can be accessed from process.env.GARAGE_URL
 * @param project - parent project
 * @param event - event to compose its URL
 * @param repetitionId - id of the specific repetition that triggered the notification
 */
export function getEventUrl(host: string, project: ProjectDBScheme, event: GroupedEventDBScheme, repetitionId?: string | null): string {
  const base = host + '/project/' + project._id + '/event/' + event._id + '/';

  return repetitionId ? base + repetitionId + '/overview' : base;
}

/**
 * Trim string to max length
 *
 * @param str - string to trim
 * @param len - max length
 */
export function toMaxLen(str: string, len = 50): string {
  if (str.length <= len) {
    return str;
  }

  return str.substr(0, len) + '…';
}

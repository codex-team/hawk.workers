/**
 * Some helpers used in templates
 */

import { GroupedEventDBScheme, ProjectDBScheme } from 'hawk.types';

/**
 * Returns event location based on the first backtrace frame or URL
 *
 * @param event - event from which we need to get location
 */
export function getEventLocation(event: GroupedEventDBScheme): string {
  const { backtrace, addons } = event.payload;

  if (!backtrace || !backtrace.length) {
    return '';
  }

  if (backtrace[0].file) {
    return backtrace[0].file;
  }

  if (addons.url) {
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
 */
export function getEventUrl(host: string, project: ProjectDBScheme, event: GroupedEventDBScheme): string {
  return host + '/project/' + project._id + '/event/' + event._id + '/';
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

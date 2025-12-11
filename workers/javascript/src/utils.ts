import { JavaScriptAddons } from '@hawk.so/types';
import useragent from 'useragent';

/**
 * Converts userAgent to strict format for: browser browserVersion / OS OsVersion
 *
 * @param userAgent - user agent
 */
export function beautifyUserAgent(userAgent: string): JavaScriptAddons['beautifiedUserAgent'] {
  let beautifiedAgent: JavaScriptAddons['beautifiedUserAgent'] = {
    os: '',
    osVersion: '',
    browser: '',
    browserVersion: '',
  };

  try {
    const agent = useragent.parse(userAgent);

    beautifiedAgent = {
      os: agent.os.family,
      osVersion: agent.os.toVersion(),
      browser: agent.family,
      browserVersion: agent.toVersion(),
    };
  } catch {
    console.error('Cannot parse user-agent ' + userAgent);
  }

  return beautifiedAgent;
}

/**
 * Count line breaks in the provided string.
 *
 * @param value - string to inspect
 */
export function countLineBreaks(value: string): number {
  if (!value) {
    return 0;
  }

  const matches = value.match(/\r\n|\r|\n/g);

  return matches ? matches.length : 0;
}

/**
 * Strip query and hash fragments from a source path.
 *
 * @param sourcePath - path that may contain query/hash suffix
 */
export function cleanSourcePath(sourcePath: string): string {
  return sourcePath.split('?')[0].split('#')[0];
}

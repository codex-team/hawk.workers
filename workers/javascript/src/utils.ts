import { JavaScriptAddons } from 'hawk.types';
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
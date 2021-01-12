import * as shortNumber from 'short-number';
import * as Twig from 'twig';
import type { TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import { BacktraceFrame } from 'hawk.types';

/**
 * Function to use in template to find backtrace frame with source code
 *
 * @param {BacktraceFrame[]} backtrace - event backtrace
 * @returns {BacktraceFrame}
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Twig.extendFunction('findTrace', (backtrace: BacktraceFrame[]): BacktraceFrame | undefined => {
  if (!backtrace || backtrace.length === 0) {
    return undefined;
  }

  return backtrace.find((frame) => frame.sourceCode !== null);
});

/**
 * Prettify URLs
 *
 * @param {string} value - path to prettify
 * @returns {string}
 */
Twig.extendFilter('prettyPath', (value: string): string => {
  return value
    // remove protocol
    .replace(/^(.*?)\/{2,3}/, '')
    // remove get params
    .replace(/\?.*/, '')
    // replace '/' with ' / '
    .replace(/\//g, ' / ');
});

/**
 * Trim string to max chart from left and add '...'
 *
 * @param {string} value - path to prettify
 * @param {number} maxLen - max length of string
 * @returns {string}
 */
Twig.extendFilter('leftTrim', (value: string, maxLen: number): string => {
  if (value.length > maxLen) {
    return '…' + value.slice(value.length - maxLen);
  }

  return value;
});

/**
 * Prettify time to show in 'DD days HH hours MM minutes"
 *
 * @param {number} seconds - time in seconds
 * @returns {string}
 */
Twig.extendFilter('prettyTime', (seconds: number): string => {
  const SECONDS_IN_MINUTE = 60;
  const HOURS_IN_DAY = 24;
  const MINUTES_IN_HOUR = 60;

  const sec = seconds % SECONDS_IN_MINUTE;
  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE) % SECONDS_IN_MINUTE;
  const hours = Math.floor(seconds / SECONDS_IN_MINUTE / MINUTES_IN_HOUR) % HOURS_IN_DAY;
  const days = Math.floor(seconds / SECONDS_IN_MINUTE / MINUTES_IN_HOUR / HOURS_IN_DAY);

  let result = '';

  if (days) {
    result += days + ' days ';
  }

  if (hours) {
    result += hours + ' hours ';
  }

  if (minutes) {
    result += minutes + ' minutes ';
  }

  if (sec) {
    result += sec + ' seconds';
  }

  return result;
});

/**
 * Get color by unique id
 *
 * @param {string} id - project/user/stc id to the color
 * @returns {string}
 */
Twig.extendFilter('colorById', (id: string): string => {
  const colors = [
    '#15c46d',
    '#36a9e0',
    '#ef4b4b',
    '#4ec520',
    '#b142af',
    '#6632b8',
    '#3251b8',
    '#505b74',
  ];

  if (!id) {
    return colors[Math.floor(Math.random() * colors.length)];
  }

  const NEW_BASE = 16;

  const decimalId = parseInt(id.toString().substr(-1), NEW_BASE); // take last id char and convert to decimal number system

  return colors[Math.floor(decimalId / (NEW_BASE / colors.length))];
});

/**
 * Make number abbreviation
 *
 * @param {number} value - number to abbreviate
 *
 * @returns {string}
 */
Twig.extendFilter('abbrNumber', (value: number): string => {
  const MAX_VALUE_SIZE = 1000;

  if (value < MAX_VALUE_SIZE) {
    return value.toString();
  }

  return shortNumber(value);
});

/**
 * Sort events in order of new events amount
 *
 * @param {TemplateEventData[]} events - events to sort
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Twig.extendFilter('sortEvents', (events: TemplateEventData[]): TemplateEventData[] => {
  return events.sort((a, b) => a.newCount - b.newCount);
});

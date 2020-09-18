import * as shortNumber from 'short-number';
import * as Twig from 'twig';
import { TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import { BacktraceFrame } from 'hawk.types';

/**
 * Function to use in template to find backtrace frame with source code
 *
 * @param {BacktraceFrame[]} backtrace - event backtrace
 * @returns {BacktraceFrame}
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
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
  const sec = seconds % 60;
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 60 / 60) % 24;
  const days = Math.floor(seconds / 60 / 60 / 24);

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
 * @param {string} id - project/user/stc id to calcula  te color
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

  const decimalId = parseInt(id.toString().substr(-1), 16); // take last id char and convert to decimal number system

  return colors[Math.floor(decimalId / 2)];
});

/**
 * Make number abbreviation
 *
 * @param {number} value - number to abbreviate
 *
 * @returns {string}
 */
Twig.extendFilter('abbrNumber', (value: number): string => {
  if (value < 1000) {
    return value.toString();
  }

  return shortNumber(value);
});

/**
 * Sort events in order of new events amount
 *
 * @param {TemplateEventData[]} events - events to sort
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
Twig.extendFilter('sortEvents', (events: TemplateEventData[]): TemplateEventData[] => {
  return events.sort((a, b) => a.newCount - b.newCount);
});

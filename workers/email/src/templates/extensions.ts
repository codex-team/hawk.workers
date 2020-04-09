import Twig from 'twig';
import {BacktraceFrame} from '../../../../lib/types/event-worker-task';

/**
 * Function to use in template to find backtrace frame with source code
 *
 * @param {BacktraceFrame[]} backrace - event backtrace
 * @return {BacktraceFrame}
 */
// @ts-ignore
Twig.extendFunction('findTrace', (backtrace: BacktraceFrame[]): BacktraceFrame => {
  return backtrace.find((frame) => frame.sourceCode !== null);
});

/**
 * Prettify URLs
 *
 * @param {string} value - path to prettify
 * @return {string}
 */
Twig.extendFilter('prettyPath', (value: string): string => {
  return value.split('/').join(' / ');
});

/**
 * Prettify date to show in MMM D, YYYY, HH:MM format
 *
 * @param {number} tmstmp - date timestamp
 * @return {string}
 */
Twig.extendFilter('prettyDate', (tmstmp: number): string => {
  const date = new Date(tmstmp);

  const dateString = date.toLocaleDateString('en-us', {month: 'short', day: 'numeric', year: 'numeric'});
  const time = date.toLocaleTimeString('ru', {hour: '2-digit', minute: '2-digit'});

  return `${dateString}, ${time}`;
});

/**
 * Get color by unique id
 *
 * @param {string} id
 * @return {stirng}
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

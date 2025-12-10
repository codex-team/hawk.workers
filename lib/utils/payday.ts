import { WorkspaceDBScheme } from '@hawk.so/types';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, SECONDS_IN_MINUTE, MS_IN_SEC } from './consts';

/**
 * Milliseconds in day. Needs for calculating difference between dates in days.
 */
const MILLISECONDS_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SEC;

/**
 * Returns difference between now and payday in days
 *
 * Pay day is calculated by formula: paidUntil date or last charge date + 1 month
 *
 * @param date - last charge date
 * @param paidUntil - paid until date
 * @param isDebug - flag for debug purposes
 */
export function countDaysBeforePayday(date: Date, paidUntil: Date = null, isDebug = false): number {
  const expectedPayDay = paidUntil ? new Date(paidUntil) : new Date(date);

  if (isDebug) {
    expectedPayDay.setDate(date.getDate() + 1);
  } else if (!paidUntil) {
    expectedPayDay.setMonth(date.getMonth() + 1);
  }

  const now = new Date().getTime();

  return Math.floor((expectedPayDay.getTime() - now) / MILLISECONDS_IN_DAY);
}

/**
 * Returns difference between payday and now in days
 *
 * Pay day is calculated by formula: paidUntil date or last charge date + 1 month
 *
 * @param date - last charge date
 * @param paidUntil - paid until date
 * @param isDebug - flag for debug purposes
 */
export function countDaysAfterPayday(date: Date, paidUntil: Date = null, isDebug = false): number {
  const expectedPayDay = paidUntil ? new Date(paidUntil) : new Date(date);

  if (isDebug) {
    expectedPayDay.setDate(date.getDate() + 1);
  } else if (!paidUntil) {
    expectedPayDay.setMonth(date.getMonth() + 1);
  }

  const now = new Date().getTime();

  return Math.floor((now - expectedPayDay.getTime()) / MILLISECONDS_IN_DAY);
}

/**
 * Returns difference between day when workspace was blocked and now in days
 *
 * @param workspace - workspace object
 */
export function countDaysAfterBlock(workspace: WorkspaceDBScheme): number | undefined {
  if (!workspace.blockedDate) {
    return undefined;
  }

  const blockedDay = new Date(workspace.blockedDate);

  const now = new Date().getTime();

  return Math.floor((now - blockedDay.getTime()) / MILLISECONDS_IN_DAY);
}
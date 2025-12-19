import { WorkspaceDBScheme } from '@hawk.so/types';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, SECONDS_IN_MINUTE, MS_IN_SEC } from './consts';

/**
 * Milliseconds in day. Needs for calculating difference between dates in days.
 */
const MILLISECONDS_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SEC;

/**
 * Returns expected payday date
 *
 * Pay day is calculated by formula: paidUntil date or last charge date + 1 month
 *
 * @param lastChargeDate - last charge date
 * @param paidUntil - paid until date
 * @param isDebug - flag for debug purposes
 */
export function getPayday(lastChargeDate: Date, paidUntil: Date = null, isDebug = false): Date {
  let expectedPayDay: Date;

  if (paidUntil) {
    // If paidUntil is provided, use it as the payday
    expectedPayDay = new Date(paidUntil);
  } else {
    // Otherwise calculate from lastChargeDate
    expectedPayDay = new Date(lastChargeDate);
    if (isDebug) {
      expectedPayDay.setDate(lastChargeDate.getDate() + 1);
    } else {
      expectedPayDay.setMonth(lastChargeDate.getMonth() + 1);
    }
  }

  return expectedPayDay;
}

/**
 * Returns difference between now and payday in days
 *
 * Pay day is calculated by formula: paidUntil date or last charge date + 1 month
 *
 * @param lastChargeDate - last charge date
 * @param paidUntil - paid until date
 * @param isDebug - flag for debug purposes
 */
export function countDaysBeforePayday(lastChargeDate: Date, paidUntil: Date = null, isDebug = false): number {
  const expectedPayDay = getPayday(lastChargeDate, paidUntil, isDebug);
  const now = new Date().getTime();

  return Math.floor((expectedPayDay.getTime() - now) / MILLISECONDS_IN_DAY);
}

/**
 * Returns difference between payday and now in days
 *
 * Pay day is calculated by formula: paidUntil date or last charge date + 1 month
 *
 * @param lastChargeDate - last charge date
 * @param paidUntil - paid until date
 * @param isDebug - flag for debug purposes
 */
export function countDaysAfterPayday(lastChargeDate: Date, paidUntil: Date = null, isDebug = false): number {
  const expectedPayDay = getPayday(lastChargeDate, paidUntil, isDebug);
  const now = new Date().getTime();

  return Math.floor((now - expectedPayDay.getTime()) / MILLISECONDS_IN_DAY);
}

/**
 * Returns difference between day when workspace was blocked and now in days. Undefined for workspaces blocked before the "blockedDate" implemented.
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
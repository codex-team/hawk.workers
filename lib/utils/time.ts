/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * Time intervals in ms
 */
export default class TimeMs {
  /** The smallest time interval */
  public static MILLISECOND = 1;

  public static SECOND = TimeMs.MILLISECOND * 1000;

  public static MINUTE = TimeMs.SECOND * 60;

  public static HOUR = TimeMs.MINUTE * 60;

  public static DAY = TimeMs.HOUR * 24;

  public static WEEK = TimeMs.DAY * 7;
}

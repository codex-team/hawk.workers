/**
 * Time intervals in ms
 */
export default class Time {
  /** The smallest time interval */
  public static MILLISECOND = 1;

  public static SECOND = Time.MILLISECOND * 1000;

  public static MINUTE = Time.SECOND * 60;

  public static HOUR = Time.MINUTE * 60;

  public static DAY = Time.HOUR * 24;

  public static WEEK = Time.DAY * 7;
}

const rand: Function = function (): string {
  return Math.random().toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 5);
};

/**
 *
 */
export default class Timer {
  /**
   *
   * @private
   */
  private label: string;

  /**
   *
   * @private
   */
  private tag: string;

  /**
   * @param labelText
   * @param tag
   */
  constructor(labelText, tag = '') {
    this.label = this.composeLabel(labelText, tag);

    console.time(this.label);
  }

  /**
   *
   */
  public stop(): void {
    console.timeEnd(this.label);
  }

  /**
   * @param labelText
   * @param tag
   * @private
   */
  private composeLabel(labelText, tag): string {
    return `[TIMER${tag ? ' ' + tag : ''}]: ${labelText} // ${rand()}`;
  }
}

/**
 * String helpers
 */

/**
 * Trims string to max length
 * Adds «...» in case of trimming
 *
 * @param content - content to trim
 * @param maxLen - trimming criteria
 */
export function rightTrim(content: string, maxLen = 140): string {
  if (content.length <= maxLen) {
    return content;
  }

  return content.substr(0, maxLen)  + '…';
}

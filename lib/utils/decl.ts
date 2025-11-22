/**
 * Decl of number
 *
 * @param value - value to decl
 * @param titles - titles to decl: ['новое событие', 'новых события', 'новых событий']
 * @returns decl of number
 */
export function declOfNum(value: number, titles: string[]): string {
  const decimalBase = 10;
  const hundredBase = 100;
  const minExclusiveTeens = 4;
  const maxExclusiveTeens = 20;
  const manyFormIndex = 2;
  const maxCaseIndex = 5;
  const declCases = [manyFormIndex, 0, 1, 1, 1, manyFormIndex];

  const valueModHundred = value % hundredBase;
  const valueModTen = value % decimalBase;
  const isTeens = valueModHundred > minExclusiveTeens && valueModHundred < maxExclusiveTeens;
  const caseIndex = isTeens
    ? manyFormIndex
    : declCases[valueModTen < maxCaseIndex ? valueModTen : maxCaseIndex];

  return titles[caseIndex];
}
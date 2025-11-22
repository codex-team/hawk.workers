/**
 * Decl of number
 *
 * @param value - value to decl
 * @param titles - titles to decl: ['новое событие', 'новых события', 'новых событий']
 * @returns decl of number
 */
export function declOfNum(value: number, titles: string[]): string {  
    const cases = [2, 0, 1, 1, 1, 2];  
    return titles[ (value%100>4 && value%100<20)? 2 : cases[(value%10<5)?value%10:5] ];  
}
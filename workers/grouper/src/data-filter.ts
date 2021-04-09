import { EventAddons, EventDataAccepted } from 'hawk.types';
import iterator from 'object-recursive-iterator';
import { unsafeFields } from '../../../lib/utils/unsafeFields';

/**
 * This file contains class with methods for sensitive data filtering
 */
export default class DataFilter {
  /**
   * This string will be substituted instead of a sensitive data value
   */
  private filteredValuePlaceholder = '[filtered]';

  /**
   * Accept event and process 'addons' and 'context' fields.
   * It mutates the original object
   *
   * @param event - event to process
   */
  public processEvent(event: EventDataAccepted<EventAddons>): void {
    unsafeFields.forEach(field => {
      if (event[field]) {
        this.processField(event[field]);
      }
    });
  }

  /**
   * Recursively iterates object and applies filtering to its entries
   *
   * @param field - any object to iterate
   */
  private processField(field): void {
    iterator.forAll(field, (path, key, obj) => {
      const value = obj[key];

      obj[key] = this.filterPanNumbers(value);
      obj[key] = this.filterSensitiveData(key, value);
    });
  }

  /**
   * Replace PAN numbers in values
   *
   * @param string - value to process
   */
  private filterPanNumbers(string: string | number | boolean): string | number | boolean {
    /**
     * If value is not a string — it is not a PAN
     */
    if (typeof string !== 'string') {
      return string;
    }

    const bankCardRegex = /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/g;

    /**
     * Remove all non-digit chars
     */
    string = string.replace(/\D/g, '');

    if (!bankCardRegex.test(string)) {
      return string;
    }

    return this.filteredValuePlaceholder;
  }

  /**
   * Filter values which are keys in list of possible sensitive keys
   *
   * @param key - object key to check
   * @param value - object value to filter
   */
  private filterSensitiveData(key: string, value: string | number | boolean): string | number | boolean {
    /**
     * Values can be an object — leave them as is
     */
    if (typeof value === 'object') {
      return value;
    }

    const possibleSensitiveDataKeys = [
      'pan',
      'secret',
      'credentials',
      'card[number]',
      'password',
      'auth',
      'access_token',
    ];
    const keyRegex = new RegExp(possibleSensitiveDataKeys.join('|').replace('[', '\\['), 'gi');

    if (keyRegex.test(key)) {
      return this.filteredValuePlaceholder;
    }

    return value;
  }
}

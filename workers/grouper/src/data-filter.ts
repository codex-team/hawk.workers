import { EventAddons, EventDataAccepted } from 'hawk.types';
import { unsafeFields } from '../../../lib/utils/unsafeFields';

/**
 * Recursively iterate through object and call function on each key
 *
 * @param obj - Object to iterate
 * @param callback - Function to call on each iteration
 */
function forAll(obj: Record<string, unknown>, callback: (path: string[], key: string, obj: Record<string, unknown>) => void): void {
  const visit = (current, path: string[]): void => {
    for (const key in current) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        continue;
      }
      const value = current[key];

      if (!(typeof value === 'object' && !Array.isArray(value))) {
        callback(path, key, current);
      } else {
        visit(value, [...path, key]);
      }
    }
  };

  visit(obj, []);
}

/**
 * This file contains class with methods for sensitive data filtering
 */
export default class DataFilter {
  /**
   * This string will be substituted instead of a sensitive data value
   */
  private filteredValuePlaceholder = '[filtered]';

  /**
   * Possibly sensitive keys
   */
  private possiblySensitiveDataKeys = new Set([
    'pan',
    'secret',
    'credentials',
    'card[number]',
    'password',
    'auth',
    'access_token',
    'accesstoken',
  ]);

  /**
   * Bank card PAN Regex
   */
  private bankCardRegex = /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/g;

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
    if (typeof field === 'string') {
      return;
    }
    forAll(field, (_path, key, obj) => {
      obj[key] = this.filterPanNumbers(obj[key]);
      obj[key] = this.filterSensitiveData(key, obj[key]);
    });
  }

  /**
   * Replace PAN numbers in values
   *
   * @param value - value to process
   */
  private filterPanNumbers<T>(value: T): T | string {
    /**
     * If value is not a string — it is not a PAN
     */
    if (typeof value !== 'string') {
      return value;
    }

    /**
     * Remove all non-digit chars
     */
    const clean = value.replace(/\D/g, '');

    // Reset last index to 0
    this.bankCardRegex.lastIndex = 0;
    if (!this.bankCardRegex.test(clean)) {
      return value;
    }

    return this.filteredValuePlaceholder;
  }

  /**
   * Filter values which keys are in list of possible sensitive keys
   *
   * @param key - object key to check
   * @param value - object value to filter
   */
  private filterSensitiveData<T>(key: string, value: T): T | string {
    /**
     * Values can be an object — leave them as is
     */
    if (typeof value === 'object') {
      return value;
    }

    if (this.possiblySensitiveDataKeys.has(key.toLowerCase())) {
      return this.filteredValuePlaceholder;
    }

    return value;
  }
}

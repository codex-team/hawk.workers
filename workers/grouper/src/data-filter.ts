import { EventAddons, EventDataAccepted, Json } from 'hawk.types';
import { unsafeFields } from '../../../lib/utils/unsafeFields';

/**
 * Recursevly iterate through object and call function on each key
 *
 * @param obj - Object to iterate
 * @param callback - Function to call on each iteratin
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
    'accessToken',
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
    forAll(field, (path, key, obj) => {
      const value = obj[key];

      obj[key] = this.filterPanNumbers(value as any);
      obj[key] = this.filterSensitiveData(key, value as any);
    });
  }

  /**
   * Replace PAN numbers in values
   *
   * @param string - value to process
   */
  private filterPanNumbers(string: string | number | boolean | Json): string | number | boolean | Json {
    /**
     * If value is not a string — it is not a PAN
     */
    if (typeof string !== 'string') {
      return string;
    }

    /**
     * Remove all non-digit chars
     */
    string = string.replace(/\D/g, '');

    if (!this.bankCardRegex.test(string)) {
      return string;
    }

    return this.filteredValuePlaceholder;
  }

  /**
   * Filter values which keys are in list of possible sensitive keys
   *
   * @param key - object key to check
   * @param value - object value to filter
   */
  private filterSensitiveData(key: string, value: string | number | boolean | Json): string | number | boolean | Json {
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

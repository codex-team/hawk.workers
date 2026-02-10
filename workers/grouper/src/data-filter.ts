import type { EventAddons, EventData } from '@hawk.so/types';
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
        /**
         * Limit path depth to prevent excessive memory allocations from deep nesting
         * This reduces GC pressure and memory usage for deeply nested objects
         */
        const newPath = path.length < 20 ? path.concat(key) : path;
        visit(value, newPath);
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
   * Possibly sensitive keys (lowercase; keys are compared via key.toLowerCase())
   */
  private possiblySensitiveDataKeys = new Set([
    /**
     * Authorization and sessions
     */
    'auth',
    'authorization',
    'access_token',
    'accesstoken',
    'token',
    'jwt',
    'session',
    'sessionid',
    'session_id',
    /**
     * API keys and secure tokens
     */
    'api_key',
    'apikey',
    'x-api-key',
    'x-auth-token',
    'bearer',
    'client_secret',
    'secret',
    'credentials',
    /**
     * Passwords
     */
    'password',
    'passwd',
    'mysql_pwd',
    'oldpassword',
    'old-password',
    'old_password',
    'newpassword',
    'new-password',
    'new_password',
    /**
     * Encryption keys
     */
    'private_key',
    'ssh_key',
    /**
     * Payments data
     */
    'card',
    'cardnumber',
    'card[number]',
    'creditcard',
    'credit_card',
    'pan',
    'pin',
    'security_code',
    'stripetoken',
    'cloudpayments_public_id',
    'cloudpayments_secret',
    /**
     * Config and connections
     */
    'dsn',
    /**
     * Personal data
     */
    'ssn',
  ]);

  /**
   * Bank card PAN Regex
   */
  private bankCardRegex = /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/g;

  /**
   * MongoDB ObjectId Regex (24 hexadecimal characters)
   */
  private objectIdRegex = /^[0-9a-fA-F]{24}$/;

  /**
   * UUID Regex - matches UUIDs with all dashes (8-4-4-4-12 format) or no dashes (32 hex chars)
   */
  private uuidRegex = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32})$/;

  /**
   * Accept event and process 'addons' and 'context' fields.
   * It mutates the original object
   *
   * @param event - event to process
   */
  public processEvent(event: EventData<EventAddons>): void {
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
     * Check if value matches MongoDB ObjectId pattern (24 hex chars)
     * ObjectIds should not be filtered
     */
    if (this.objectIdRegex.test(value)) {
      return value;
    }

    /**
     * Check if value matches UUID pattern (with or without dashes)
     * UUIDs should not be filtered
     */
    if (this.uuidRegex.test(value)) {
      return value;
    }

    /**
     * Remove all non-digit chars
     */
    const clean = value.replace(/\D/g, '');

    /**
     * Reset last index to 0
     */
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

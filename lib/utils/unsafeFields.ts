import { GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';

/**
 * Fields in event payload with unsafe data for encoding before saving in database
 */
export const unsafeFields = ['context', 'addons'] as const;

/**
 * Decodes some event fields
 * Some object keys can contain dots and MongoDB will throw error on save, that's because they were encoded
 *
 * @param event - event to encode its fields
 */
export function decodeUnsafeFields(event: GroupedEventDBScheme | RepetitionDBScheme): void {
  unsafeFields.forEach((field) => {
    try {
      let fieldValue: unknown;

      if ('delta' in event) {
        fieldValue = event.delta[field];
      } else {
        fieldValue = event.payload[field];
      }

      if (typeof fieldValue === 'string') {
        if ('delta' in event) {
          event.delta[field] = JSON.parse(fieldValue);
        } else {
          event.payload[field] = JSON.parse(fieldValue);
        }
      }
    } catch {
      console.error(`Failed to parse field ${field} in event ${event._id}`);
    }
  });
}

/**
 * Stringifies some event fields because some object keys can contain dots and MongoDB will throw error on save
 *
 * @param event - event to encode its fields
 */
export function encodeUnsafeFields(event: GroupedEventDBScheme | RepetitionDBScheme): void {
  unsafeFields.forEach((field) => {
    let fieldValue: unknown;

    /**
     * Repetition includes delta field, grouped event includes payload
     */
    if ('delta' in event) {
      fieldValue = event.delta[field];
    } else {
      fieldValue = event.payload[field];
    }

    /**
     * Repetition diff can omit these fields if they are not changed
     */
    if (fieldValue === undefined) {
      return;
    }
    

    let newValue: string;

    try {
      if (typeof fieldValue !== 'string') {
        newValue = JSON.stringify(fieldValue);
      }
    } catch {
      console.error(`Failed to stringify field ${field} in event ${event._id}`);
      newValue = undefined;
    }

    /**
     * Repetition includes delta field, grouped event includes payload
     */
    if ('delta' in event) {
      event.delta[field] = newValue;
    } else {
      event.payload[field] = newValue;
    }
  });
}

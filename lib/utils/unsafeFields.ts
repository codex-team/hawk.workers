import { GroupedEventDBScheme, RepetitionDBScheme } from 'hawk.types';

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
      const fieldValue = event.payload[field];

      if (typeof fieldValue === 'string') {
        event.payload[field] = JSON.parse(fieldValue);
      }
    } catch { /* ignore if caught */ }
  });
}

/**
 * Stringifies some event fields because some object keys can contain dots and MongoDB will throw error on save
 *
 * @param event - event to encode its fields
 */
export function encodeUnsafeFields(event: GroupedEventDBScheme | RepetitionDBScheme): void {
  unsafeFields.forEach((field) => {
    const fieldValue = event.payload[field];
    let newValue: string;

    try {
      if (typeof fieldValue !== 'string') {
        newValue = JSON.stringify(fieldValue);
      }
    } catch {
      newValue = undefined;
    }
    event.payload[field] = newValue;
  });
}

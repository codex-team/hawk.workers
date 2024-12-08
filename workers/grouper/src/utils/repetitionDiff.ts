import { EventAddons, EventDataAccepted } from "@hawk.so/types";
import { Delta, diff, patch } from "@n1ru4l/json-patch-plus";

export function computeDelta(originalEvent: EventDataAccepted<EventAddons>, repetition: EventDataAccepted<EventAddons>): Delta {
  const delta = diff({
    left: originalEvent,
    right: repetition,
  });

  return delta;
}

export function repetitionDiff(originalEvent: object, repetition: object): Record<string, unknown> {
  // console.log('originalEvent', originalEvent);
  // console.log('repetition', repetition);

  const delta = diff({
    left: originalEvent,
    right: repetition,
  });

  /**
   * No difference between the original event and the repetition
   */
  if (delta === undefined) {
    return {};
  }

  console.log('delta', JSON.stringify(delta));

  // Helper function to extract only the new values from the delta
  function extractDiff(deltaPart: Delta): any {
    const result: Record<string, unknown> = {};

    /**
     * @see https://github.com/benjamine/jsondiffpatch/blob/master/docs/deltas.md#object-with-inner-changes
     */
    for (const [key, value] of Object.entries(deltaPart)) {
      if (typeof value === 'object' && value._t === 'a') {
        /**
         * Return array of new values, skip removed values (started with _)
         */
        console.log('Object.entries(value)', Object.entries(value));
        result[key] = [
          ...Object.entries(value).map(([index, item]) => {
            if (index.startsWith("_")) {
              return;
            }

            return item[0];
          })
        ].filter(Boolean); // skip undefined values

        return result;
      } 

      if (key.startsWith("_")) {
        continue;
      }
      
      if (Array.isArray(value)) {
        /**
         * [ newValue1 ] — meands that obj[property1] = newValue1
         */
        if (value.length === 1) {
          result[key] = value[0];
        }
        /**
         * [ oldValue2, newValue2 ], new is newValue2 (and previous value was oldValue2)
         */
        else if (value.length === 2) {
          result[key] = value[1];
        /**
         * [ oldValue5, 0, 0 ] // delete obj[property5] (and previous value was oldValue5)
         */
        } else if (value.length === 3) {
          result[key] = undefined;
        }
        
      } else if (typeof value === "object" && value !== null) {
        // Recursively handle nested objects
        result[key] = extractDiff(value as Delta);
      }
    }

    return result;
  }

  return extractDiff(delta);
  

  // return patch({
  //   left: {},
  //   delta,
  // });
}

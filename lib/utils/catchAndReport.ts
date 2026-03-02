import HawkCatcher from '@hawk.so/nodejs';
import { Worker } from '../worker';

//
// Catches unhandled exceptions from the decorated method, sends them to HawkCatcher
// with the current worker’s type, and re‑throws.
//
/**
 *
 */
export function catchAndReport(): MethodDecorator {
  return function (_target, propertyKey, descriptor) {
    const original = descriptor.value;

    if (typeof original !== 'function') {
      throw new Error(
        `@catchAndReport can only be applied to methods (${String(propertyKey)})`
      );
    }

    descriptor.value = async function (...args: any[]) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        HawkCatcher.send(error, {
          workerType: (this as Worker).type,
        });
        throw error;
      }
    } as typeof original;
  };
}

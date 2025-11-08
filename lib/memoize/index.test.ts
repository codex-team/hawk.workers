/* eslint-disable
  no-unused-vars,
  @typescript-eslint/explicit-function-return-type,
  @typescript-eslint/no-unused-vars-experimental,
  jsdoc/require-param-description
*/
/**
 * Ignore eslint jsdoc rules for mocked class
 * Ignore eslint unused vars rule for decorator
 */

import { memoize } from './index';
import Crypto from '../utils/crypto';

describe('memoize decorator — per-test inline classes', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should memoize return value with concat strategy across several calls', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'concat', ttl: 60_000, max: 50 })
      public async run(a: number, b: string) {
        this.calls += 1;

        return `${a}-${b}`;
      }
    }

    const sample = new Sample();

    /**
     * First call should memoize the method
     */
    expect(await sample.run(1, 'x')).toBe('1-x');
    /**
     * In this case
     */
    expect(await sample.run(1, 'x')).toBe('1-x');
    expect(await sample.run(1, 'x')).toBe('1-x');

    expect(sample.calls).toBe(1);
  });

  it('should memoize return value with set of arguments with concat strategy across several calls', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'concat' })
      public async run(a: unknown, b: unknown) {
        this.calls += 1;

        return `${String(a)}|${String(b)}`;
      }
    }

    const sample = new Sample();

    /**
     * Fill the memoization cache with values
     */
    await sample.run(1, 'a');
    await sample.run(2, 'a');
    await sample.run(1, 'b');
    await sample.run(true, false);
    await sample.run(undefined, null);

    expect(sample.calls).toBe(5);

    /**
     * Those calls should not call the original method, they should return from memoize
     */
    await sample.run(1, 'a');
    await sample.run(2, 'a');
    await sample.run(1, 'b');
    await sample.run(true, false);
    await sample.run(undefined, null);

    expect(sample.calls).toBe(5);
  });

  it('should memoize return value for stringified objects across several calls', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'concat' })
      public async run(x: unknown, y: unknown) {
        this.calls += 1;

        return 'ok';
      }
    }
    const sample = new Sample();
    const o1 = { a: 1 };
    const o2 = { b: 2 };

    await sample.run(o1, o2);
    await sample.run(o1, o2);

    expect(sample.calls).toBe(1);
  });

  it('should memoize return value for method with non-default arguments (NaN, Infinity, -0, Symbol, Date, RegExp) still cache same-args', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'concat' })
      public async run(...args: unknown[]) {
        this.calls += 1;

        return args.map(String).join(',');
      }
    }
    const sample = new Sample();

    const sym = Symbol('t');
    const d = new Date('2020-01-01T00:00:00Z');
    const re = /a/i;

    const first = await sample.run(NaN, Infinity, -0, sym, d, re);
    const second = await sample.run(NaN, Infinity, -0, sym, d, re);

    expect(second).toBe(first);
    expect(sample.calls).toBe(1);
  });

  it('should call crypto hash with blake2b512 algo and base64url digest, should memoize return value with hash strategy', async () => {
    const hashSpy = jest.spyOn(Crypto, 'hash');

    class Sample {
      public calls = 0;

      @memoize({ strategy: 'hash' })
      public async run(...args: unknown[]) {
        this.calls += 1;

        return 'ok';
      }
    }
    const sample = new Sample();

    await sample.run({ a: 1 }, undefined, 0);
    await sample.run({ a: 1 }, undefined, 0);

    expect(hashSpy).toHaveBeenCalledWith([ { a: 1 }, undefined, 0], 'blake2b512', 'base64url');
    expect(sample.calls).toBe(1);
  });

  it('should not memoize return value with hash strategy and different arguments', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'hash' })
      public async run(...args: unknown[]) {
        this.calls += 1;

        return 'ok';
      }
    }
    const sample = new Sample();

    await sample.run({ v: 1 });
    await sample.run({ v: 2 });
    await sample.run({ v: 3 });

    expect(sample.calls).toBe(3);
  });

  it('should memoize return value with hash strategy across several calls with same args', async () => {
    class Sample {
      public calls = 0;

      @memoize({ strategy: 'hash' })
      public async run(arg: unknown) {
        this.calls += 1;

        return 'ok';
      }
    }
    const sample = new Sample();

    await sample.run({ a: 1 });
    await sample.run({ a: 1 });

    expect(sample.calls).toBe(1);
  });

  it('should memoize return value exactly for passed ttl millis', async () => {
    jest.resetModules();
    jest.useFakeTimers({ legacyFakeTimers: false });
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const { memoize: memoizeWithMockedTimers } = await import('../memoize/index');

    class Sample {
      public calls = 0;

      @memoizeWithMockedTimers({ strategy: 'concat', ttl: 1_000 })
      public async run(x: string) {
        this.calls += 1;

        return x;
      }
    }
    const sample = new Sample();

    await sample.run('k1');
    expect(sample.calls).toBe(1);

    /**
     * Skip time beyond the ttl
     */
    jest.advanceTimersByTime(1_001);

    await sample.run('k1');
    expect(sample.calls).toBe(2);
  });

  it('error calls should never be momized', async () => {
    class Sample {
      public calls = 0;

      @memoize()
      public async run(x: number) {
        this.calls += 1;
        if (x === 1) {
          throw new Error('boom');
        }

        return x * 2;
      }
    }
    const sample = new Sample();

    /**
     * Compute with throw
     */
    await expect(sample.run(1)).rejects.toThrow('boom');
    await expect(sample.run(1)).rejects.toThrow('boom');
    expect(sample.calls).toBe(2);
  });

  it('should NOT cache results listed in skipCache (primitives)', async () => {
    class Sample {
      public calls = 0;
  
      @memoize({ strategy: 'concat', skipCache: [null, undefined, 0, false, ''] })
      public async run(kind: 'null' | 'undef' | 'zero' | 'false' | 'empty') {
        this.calls += 1;
        switch (kind) {
          case 'null': return null;
          case 'undef': return undefined;
          case 'zero': return 0;
          case 'false': return false;
          case 'empty': return '';
        }
      }
    }
  
    const sample = new Sample();
  
    // Each repeated call should invoke the original again because result is in skipCache.
    await sample.run('null');
    await sample.run('null');
  
    await sample.run('undef');
    await sample.run('undef');
  
    await sample.run('zero');
    await sample.run('zero');
  
    await sample.run('false');
    await sample.run('false');
  
    await sample.run('empty');
    await sample.run('empty');
  
    // 5 kinds × 2 calls each = 10 calls, none cached
    expect(sample.calls).toBe(10);
  });
  
  it('should cache results NOT listed in skipCache', async () => {
    class Sample {
      public calls = 0;
  
      @memoize({ strategy: 'concat', skipCache: [null, undefined] })
      public async run(x: number) {
        this.calls += 1;
        // returns a non-skipped primitive
        return x * 2;
      }
    }
  
    const sample = new Sample();
  
    expect(await sample.run(21)).toBe(42);
    expect(await sample.run(21)).toBe(42);
  
    expect(sample.calls).toBe(1);
  });
  
  it('should use STRICT equality for skipCache with objects: different-but-equal objects are cached', async () => {
    const deepEqualButDifferent = { a: 1 };
  
    class Sample {
      public calls = 0;
  
      @memoize({ strategy: 'concat', skipCache: [deepEqualButDifferent] })
      public async run() {
        this.calls += 1;

        return { a: 1 };
      }
    }
  
    const sample = new Sample();
  
    const first = await sample.run();
    const second = await sample.run();
  
    expect(first).toEqual({ a: 1 });
    expect(second).toBe(first);
    expect(sample.calls).toBe(1);
  });
  
  it('should NOT cache when the EXACT same object instance is listed in skipCache', async () => {
    const SKIP = { a: 1 };
  
    class Sample {
      public calls = 0;
  
      @memoize({ strategy: 'concat', skipCache: [SKIP] })
      public async run() {
        this.calls += 1;

        return SKIP;
      }
    }
  
    const sample = new Sample();
  
    const first = await sample.run();
    const second = await sample.run();
  
    expect(first).toBe(SKIP);
    expect(second).toBe(SKIP);
    expect(sample.calls).toBe(2);
  });
  
});

import { validateEventStructure } from './validateEventStructure';

describe('validateEventStructure', () => {
  describe('Basic type validation', () => {
    test('should reject null payload', () => {
      const result = validateEventStructure(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid payload type: null');
    });

    test('should reject array payload', () => {
      const result = validateEventStructure([]);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expected object, got array');
    });

    test('should reject string payload', () => {
      const result = validateEventStructure('invalid');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expected object, got string');
    });

    test('should reject number payload', () => {
      const result = validateEventStructure(123);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expected object, got number');
    });

    test('should reject undefined payload', () => {
      const result = validateEventStructure(undefined);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expected object, got undefined');
    });
  });

  describe('Required fields validation', () => {
    test('should reject payload without title', () => {
      const result = validateEventStructure({
        backtrace: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Event title is required');
    });

    test('should reject payload with empty title', () => {
      const result = validateEventStructure({
        title: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Event title is required');
    });

    test('should reject payload with non-string title', () => {
      const result = validateEventStructure({
        title: 123,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('title');
    });

    test('should accept payload with only title', () => {
      const result = validateEventStructure({
        title: 'Error occurred',
      });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Optional fields validation', () => {
    test('should accept valid payload with all optional fields', () => {
      const result = validateEventStructure({
        title: 'TypeError: Cannot read property',
        type: 'TypeError',
        backtrace: [
          {
            file: '/path/to/file.js',
            line: 42,
            column: 10,
            function: 'myFunction',
          },
        ],
        breadcrumbs: [
          {
            timestamp: Date.now(),
            type: 'navigation',
            message: 'User navigated to /home',
          },
        ],
        release: 'v1.0.0',
        user: {
          id: 'user123',
          name: 'John Doe',
        },
        context: {
          customKey: 'customValue',
        },
        addons: {
          vue: {
            version: '3.0.0',
          },
        },
        catcherVersion: '3.2.0',
      });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should accept payload with optional backtrace', () => {
      const result = validateEventStructure({
        title: 'Error',
        backtrace: [
          {
            file: 'file.js',
            line: 1,
          },
        ],
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept payload with optional breadcrumbs', () => {
      const result = validateEventStructure({
        title: 'Error',
        breadcrumbs: [
          {
            timestamp: 1234567890,
            message: 'User clicked button',
          },
        ],
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept payload with optional user', () => {
      const result = validateEventStructure({
        title: 'Error',
        user: {
          id: 'user123',
        },
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept payload with context as object', () => {
      const result = validateEventStructure({
        title: 'Error',
        context: {
          key: 'value',
        },
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept payload with context as string', () => {
      const result = validateEventStructure({
        title: 'Error',
        context: 'string context',
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept payload with addons', () => {
      const result = validateEventStructure({
        title: 'Error',
        addons: {
          vue: {
            componentName: 'MyComponent',
          },
        },
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Type validation for optional fields', () => {
    test('should reject backtrace if not array', () => {
      const result = validateEventStructure({
        title: 'Error',
        backtrace: 'invalid',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('backtrace');
    });

    test('should reject breadcrumbs if not array', () => {
      const result = validateEventStructure({
        title: 'Error',
        breadcrumbs: 'invalid',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('breadcrumbs');
    });

    test('should reject breadcrumbs with missing timestamp', () => {
      const result = validateEventStructure({
        title: 'Error',
        breadcrumbs: [
          {
            message: 'test',
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    test('should reject release if not string', () => {
      const result = validateEventStructure({
        title: 'Error',
        release: 123,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('release');
    });

    test('should reject type if not string', () => {
      const result = validateEventStructure({
        title: 'Error',
        type: 123,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('type');
    });
  });

  describe('Edge cases', () => {
    test('should accept empty backtrace array', () => {
      const result = validateEventStructure({
        title: 'Error',
        backtrace: [],
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept empty breadcrumbs array', () => {
      const result = validateEventStructure({
        title: 'Error',
        breadcrumbs: [],
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept empty context object', () => {
      const result = validateEventStructure({
        title: 'Error',
        context: {},
      });

      expect(result.isValid).toBe(true);
    });

    test('should accept empty addons object', () => {
      const result = validateEventStructure({
        title: 'Error',
        addons: {},
      });

      expect(result.isValid).toBe(true);
    });

    test('should handle multiple validation errors', () => {
      const result = validateEventStructure({
        title: 123,
        backtrace: 'invalid',
        breadcrumbs: 'invalid',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});

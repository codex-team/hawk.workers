import * as yup from 'yup';
import type { AffectedUser, BacktraceFrame, Breadcrumb } from '@hawk.so/types';

/**
 * Schema for sourceCode line (BacktraceFrame.sourceCode item)
 */
const sourceCodeLineSchema = yup.object({
  line: yup.number().strict(true).required(),
  content: yup.string().strict(true).required(),
});

/**
 * Schema for BacktraceFrame
 */
const backtraceFrameSchema: yup.ObjectSchema<Partial<BacktraceFrame>> = yup.object({
  file: yup.string().strict(true).optional(),
  line: yup.number().strict(true).optional(),
  column: yup.number().strict(true).optional(),
  function: yup.string().strict(true).optional(),
  sourceCode: yup.array().of(sourceCodeLineSchema).optional(),
  arguments: yup.array().of(yup.string().strict(true)).optional(),
});

/**
 * Schema for Breadcrumb
 */
const breadcrumbSchema: yup.ObjectSchema<Partial<Breadcrumb>> = yup.object({
  timestamp: yup.number().strict(true).required(),
  type: yup.string().strict(true).optional(),
  category: yup.string().strict(true).optional(),
  message: yup.string().strict(true).optional(),
  level: yup.string().strict(true).optional(),
  data: yup.object().optional(),
});

/**
 * Schema for AffectedUser
 */
const affectedUserSchema: yup.ObjectSchema<Partial<AffectedUser>> = yup.object({
  id: yup.string().strict(true).optional(),
  name: yup.string().strict(true).optional(),
  photo: yup.string().strict(true).optional(),
  url: yup.string().strict(true).optional(),
});

/**
 * Event payload validation schema
 * Validates the structure and types of event data
 */
const eventDataSchema = yup.object({
  /**
   * Title is required and non-empty after trim
   */
  title: yup.string().strict(true).trim().min(1, 'Event title is required').required('Event title is required'),

  /**
   * Optional fields
   */
  type: yup.string().strict(true).optional(),
  backtrace: yup.array().of(backtraceFrameSchema).optional(),
  breadcrumbs: yup.array().of(breadcrumbSchema).optional(),
  addons: yup.object().strict(true).optional(),
  release: yup.string().strict(true).optional(),
  user: affectedUserSchema.optional(),
  context: yup.mixed().optional(),
  catcherVersion: yup.string().strict(true).optional(),
});

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether the validation passed
   */
  isValid: boolean;

  /**
   * Error message if validation failed
   */
  error?: string;
}

/**
 * Validates event structure according to EventData schema.
 * Rejects invalid payload types (e.g. payload: true from beforeSend) so they are not
 * persisted; otherwise GraphQL returns null for EventPayload.title and frontend breaks.
 *
 * @param payload - Event payload to validate
 * @returns Validation result with isValid flag and optional error message
 */
export function validateEventStructure(payload: unknown): ValidationResult {
  /**
   * Explicit null check for human-readable message (typeof null === 'object')
   */
  if (payload === null) {
    return {
      isValid: false,
      error: 'Invalid payload type: null',
    };
  }

  /**
   * Payload must be a non-array object
   */
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      error: `Invalid payload type: expected object, got ${Array.isArray(payload) ? 'array' : typeof payload}`,
    };
  }

  /**
   * Validate against schema (strict: no type coercion)
   */
  try {
    eventDataSchema.validateSync(payload, { abortEarly: false, strict: true });

    return {
      isValid: true,
    };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      const errors = error.errors.join('; ');

      return {
        isValid: false,
        error: `Event validation failed: ${errors}`,
      };
    }

    return {
      isValid: false,
      error: `Unexpected validation error: ${String(error)}`,
    };
  }
}

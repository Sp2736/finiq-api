import { Logger } from '@nestjs/common';

/**
 * Postgres error codes we know how to translate into a safe, specific,
 * user-facing message without leaking table/column/constraint names.
 * Extend this map as new cases are discovered — do NOT fall through to
 * the raw driver message for anything not listed here.
 */
const PG_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'This record already exists.',
  '23503': 'This action cannot be completed because related data is linked elsewhere.',
  '23502': 'A required field is missing.',
  '22P02': 'One of the values provided is in an invalid format.',
  '23514': 'The provided value does not meet a required condition.',
};

/**
 * Returns a safe, generic message for ANY error, using the Postgres error
 * code map above when available, otherwise a flat generic fallback. Never
 * derived from `error.message` — that text must never reach the response body.
 */
export function toSafeMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = (error as any)?.code || (error as any)?.driverError?.code;
  if (code && PG_ERROR_MESSAGES[code]) return PG_ERROR_MESSAGES[code];
  return fallback;
}

/**
 * Standard "log full detail server-side, return safe message" helper.
 * Use this in every catch block that currently does
 * `throw new SomeException(error.message)`.
 */
export function logAndSanitize(logger: Logger, context: string, error: unknown, fallback?: string): string {
  logger.error(`${context}: ${(error as any)?.message ?? error}`, (error as any)?.stack);
  return toSafeMessage(error, fallback);
}

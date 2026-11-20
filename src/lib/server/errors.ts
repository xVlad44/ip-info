import { ERROR_STATUS, type ApiError, type ErrorCode } from '@/lib/ip/types';

/** A failure the API reports to clients, with a stable machine-readable code. */
export class LookupError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'LookupError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toJSON(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfterSec !== undefined ? { retryAfter: this.retryAfterSec } : {}),
      },
    };
  }
}

export function toLookupError(err: unknown): LookupError {
  if (err instanceof LookupError) return err;
  return new LookupError('internal', 'Unexpected server error.');
}

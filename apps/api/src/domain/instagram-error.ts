export type InstagramErrorKind =
  'rate_limit' | 'account_inaccessible' | 'auth' | 'network' | 'other';

/** Graph API error codes that mean "application/user request limit reached". */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
/** business_discovery on a non-business, private or unknown account. */
const INACCESSIBLE_CODES = new Set([100, 110]);
/** Invalid / expired token or missing permission. */
const AUTH_CODES = new Set([102, 190, 200, 10]);

export class InstagramApiError extends Error {
  constructor(
    readonly kind: InstagramErrorKind,
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'InstagramApiError';
  }

  static fromGraphError(
    body: { code?: number; error_subcode?: number; message?: string; type?: string } | undefined,
    httpStatus?: number,
  ): InstagramApiError {
    const code = body?.code;
    const message = body?.message ?? `Graph API HTTP ${httpStatus ?? '?'}`;
    return new InstagramApiError(
      classifyGraphError(code),
      message,
      code,
      body?.error_subcode,
      httpStatus,
    );
  }
}

export function classifyGraphError(code: number | undefined): InstagramErrorKind {
  if (code === undefined) return 'other';
  if (RATE_LIMIT_CODES.has(code)) return 'rate_limit';
  if (INACCESSIBLE_CODES.has(code)) return 'account_inaccessible';
  if (AUTH_CODES.has(code)) return 'auth';
  return 'other';
}

export function describeError(error: unknown): { kind: string; message: string; code?: number } {
  if (error instanceof InstagramApiError) {
    return { kind: error.kind, message: error.message, code: error.code };
  }
  if (error instanceof Error) return { kind: 'internal', message: error.message };
  return { kind: 'internal', message: String(error) };
}

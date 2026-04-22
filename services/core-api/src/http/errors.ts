/**
 * HttpError — thrown by route handlers / rules. The error middleware turns
 * these into JSON responses with the matching status code. Anything that is
 * NOT an HttpError gets logged as an unexpected internal error and returned
 * as a 500 with no detail leaked.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const BadRequest    = (code: string, message?: string, details?: unknown) =>
  new HttpError(400, code, message, details);
export const Unauthorized  = (code = 'unauthenticated') => new HttpError(401, code);
export const Forbidden     = (code = 'forbidden')       => new HttpError(403, code);
export const NotFound      = (code = 'not_found')       => new HttpError(404, code);
export const Conflict      = (code: string, message?: string) => new HttpError(409, code, message);

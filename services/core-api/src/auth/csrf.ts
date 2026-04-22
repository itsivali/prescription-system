import { createHmac, randomBytes } from 'node:crypto';
import type { CookieOptions, RequestHandler } from 'express';
import { env } from '../env';
import { Forbidden } from '../http/errors';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

function signToken(token: string): string {
  return createHmac('sha256', env.CSRF_SECRET).update(token).digest('hex');
}

/** CSRF cookie options — omits `domain` when empty so the browser defaults to the request origin. */
function csrfCookieOpts(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: false,           // frontend JS must read this
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
  if (env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN;
  return opts;
}

/**
 * Issue a CSRF token via a readable cookie. The frontend reads this cookie
 * and sends it back as a header on every state-changing request.
 * The server validates HMAC(cookie_value) === header_value.
 *
 * This is the "double-submit cookie" pattern — the cookie proves the browser
 * sent the request; the header proves the JS running on our origin read it.
 */
export const csrfIssue: RequestHandler = (req, res, next) => {
  if (!req.cookies[CSRF_COOKIE]) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, csrfCookieOpts());
  }
  next();
};

/**
 * Validate CSRF on state-changing methods (POST, PUT, PATCH, DELETE).
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 */
export const csrfValidate: RequestHandler = (req, _res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'];
  if (safe.includes(req.method)) return next();

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return next(Forbidden('csrf_missing'));
  }

  // The header must carry the HMAC-signed version of the cookie value.
  const expected = signToken(cookieToken);
  if (headerToken !== expected) {
    return next(Forbidden('csrf_invalid'));
  }
  next();
};

/**
 * GET /v1/auth/csrf — returns the signed CSRF token the frontend should
 * attach as X-CSRF-Token on mutations.
 */
export const csrfTokenHandler: RequestHandler = (req, res) => {
  const token = req.cookies[CSRF_COOKIE] ?? randomBytes(32).toString('hex');
  if (!req.cookies[CSRF_COOKIE]) {
    res.cookie(CSRF_COOKIE, token, csrfCookieOpts());
  }
  res.json({ csrfToken: signToken(token) });
};

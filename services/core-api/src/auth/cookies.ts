import type { CookieOptions, Response } from 'express';
import { env } from '../env';

const ACCESS_COOKIE  = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

/** Shared cookie base — omits `domain` when empty so the browser defaults to the request origin. */
function baseCookieOpts(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
  };
  if (env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN;
  return opts;
}

/**
 * Set access + refresh tokens as HttpOnly, Secure, SameSite cookies.
 * Tokens are NEVER returned in the JSON response body — this prevents
 * XSS from exfiltrating credentials.
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOpts(),
    maxAge: env.ACCESS_TOKEN_TTL_SEC * 1000,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOpts(),
    maxAge: env.REFRESH_TOKEN_TTL_SEC * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const opts = baseCookieOpts();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };

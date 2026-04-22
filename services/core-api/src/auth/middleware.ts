import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from './sessions';
import { ACCESS_COOKIE } from './cookies';
import { prisma } from '../db';
import { Forbidden, Unauthorized } from '../http/errors';

export type Actor = { id: string; role: Role; email: string };
export type AuthedRequest = Request & { actor: Actor };

/**
 * Decode + verify the access token, attach `req.actor`.
 * Token source priority:
 *   1. HttpOnly cookie (preferred — XSS-safe)
 *   2. Authorization: Bearer header (for API/Postman compatibility)
 */
export const authn: RequestHandler = async (req, _res, next) => {
  try {
    let token: string | undefined;

    // Prefer HttpOnly cookie
    if (req.cookies?.[ACCESS_COOKIE]) {
      token = req.cookies[ACCESS_COOKIE];
    } else {
      const header = req.header('authorization');
      if (header?.startsWith('Bearer ')) {
        token = header.slice('Bearer '.length).trim();
      }
    }

    if (!token) throw Unauthorized();
    const claims = await verifyAccessToken(token);

    // Resolve actor from DB so revoked/role-changed users are enforced immediately.
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw Unauthorized('user_inactive');

    (req as AuthedRequest).actor = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (e) { next(e); }
};

/** Restrict a route to one or more roles. */
export const requireRole = (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const actor = (req as AuthedRequest).actor;
    if (!actor) return next(Unauthorized());
    if (!roles.includes(actor.role)) return next(Forbidden('insufficient_role'));
    next();
  };

/** Wrap async handlers so thrown errors reach the central error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

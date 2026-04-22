import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';
import { env } from '../env';
import { prisma } from '../db';
import { Unauthorized } from '../http/errors';

const SESSION_SECRET = new TextEncoder().encode(env.SESSION_SECRET);
const ISS = 'hospital-crm/auth';
const AUD = 'hospital-crm/api';

// ---------------------------------------------------------------------------
// Access tokens — short-lived HS256 JWTs containing actor identity.
// ---------------------------------------------------------------------------

export type SessionClaims = {
  sub: string;
  role: Role;
  email: string;
};

export async function signAccessToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISS).setAudience(AUD)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.ACCESS_TOKEN_TTL_SEC)
    .sign(SESSION_SECRET);
}

export async function verifyAccessToken(token: string): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      issuer: ISS, audience: AUD, algorithms: ['HS256'],
    });
    return {
      sub: String(payload.sub),
      role: payload.role as Role,
      email: String(payload.email),
    };
  } catch {
    throw Unauthorized('invalid_token');
  }
}

// ---------------------------------------------------------------------------
// Refresh tokens — opaque random strings; only SHA-256 hash stored in DB.
// Rotated on every use; reusing a rotated token revokes the entire chain
// (token-theft detection per RFC 6749 §10.4 / draft-ietf-oauth-security-topics).
// ---------------------------------------------------------------------------

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw  = randomBytes(48).toString('base64url');
  const hash = sha256(raw);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000),
    },
  });
  return raw;
}

export async function rotateRefreshToken(raw: string): Promise<{ userId: string; refreshToken: string }> {
  const hash = sha256(raw);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!existing || existing.expiresAt < new Date()) throw Unauthorized('invalid_refresh');

    if (existing.revokedAt) {
      // Reuse of a revoked token => suspected theft. Burn the whole user's chain.
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
      throw Unauthorized('refresh_reuse_detected');
    }

    const fresh = randomBytes(48).toString('base64url');
    const freshHash = sha256(fresh);
    const next = await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: freshHash,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000),
      },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data:  { revokedAt: new Date(), rotatedTo: next.id },
    });

    return { userId: existing.userId, refreshToken: fresh };
  });
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const hash = sha256(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

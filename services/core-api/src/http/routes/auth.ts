import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { hashPassword, verifyPassword } from '../../auth/password';
import {
  signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken,
} from '../../auth/sessions';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../../auth/cookies';
import { csrfTokenHandler } from '../../auth/csrf';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { recordLoginAttempt, clearLoginAttempts } from '../../redis';
import { Unauthorized, Forbidden, BadRequest } from '../errors';
import { env } from '../../env';

export const authRouter = Router();

// Stricter throttle on login than the global one.
const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

// ---------------------------------------------------------------------------
// GET /auth/csrf — frontend calls this to get the signed CSRF token
// ---------------------------------------------------------------------------
authRouter.get('/csrf', csrfTokenHandler);

// ---------------------------------------------------------------------------
// POST /auth/login — credentials-based authentication
// ---------------------------------------------------------------------------
const LoginBody = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(8).max(256),
});

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = LoginBody.parse(req.body);

  const attempts = await recordLoginAttempt(email);
  if (attempts > 8) throw Forbidden('too_many_attempts');

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always hash-compare to keep timing constant even on missing users.
  const ok = user?.passwordHash
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$abcd$abcdabcdabcdabcdabcdabcd', password).catch(() => false);

  if (!user || !ok || !user.isActive) throw Unauthorized('invalid_credentials');

  await clearLoginAttempts(email);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken  = await signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);

  // Set tokens as HttpOnly cookies — never in the response body.
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    expiresIn: env.ACCESS_TOKEN_TTL_SEC,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}));

// ---------------------------------------------------------------------------
// POST /auth/refresh — rotate refresh token (reads from cookie)
// ---------------------------------------------------------------------------
authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) throw Unauthorized('no_refresh_token');

  const { userId, refreshToken: nextRefresh } = await rotateRefreshToken(rawToken);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw Unauthorized('user_inactive');

  const accessToken = await signAccessToken({ sub: user.id, role: user.role, email: user.email });
  setAuthCookies(res, accessToken, nextRefresh);

  res.json({ expiresIn: env.ACCESS_TOKEN_TTL_SEC });
}));

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) await revokeRefreshToken(rawToken);
  clearAuthCookies(res);
  res.status(204).end();
}));

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
authRouter.get('/me', authn, asyncHandler(async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true, email: true, fullName: true, role: true,
      isActive: true, createdAt: true, lastLoginAt: true,
      doctorProfile: { include: { specialty: true, department: true } },
      accounts: { select: { provider: true, createdAt: true } },
    },
  });
  res.json(user);
}));

// ---------------------------------------------------------------------------
// GET /auth/providers — lists enabled OAuth providers
// ---------------------------------------------------------------------------
authRouter.get('/providers', (_req, res) => {
  const providers: string[] = [];
  if (env.GOOGLE_CLIENT_ID)    providers.push('google');
  if (env.MICROSOFT_CLIENT_ID) providers.push('microsoft');
  if (env.APPLE_CLIENT_ID)     providers.push('apple');
  res.json({ providers });
});

// ---------------------------------------------------------------------------
// GET /auth/oauth/:provider — initiate OAuth redirect
// ---------------------------------------------------------------------------
const OAUTH_CONFIGS: Record<string, { authUrl: string; scopes: string }> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'openid email profile',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: 'openid email profile',
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    scopes: 'name email',
  },
};

authRouter.get('/oauth/:provider', (req, res) => {
  const provider = req.params.provider;
  const config = OAUTH_CONFIGS[provider];
  if (!config) return res.status(404).json({ error: 'unknown_provider' });

  const clientId =
    provider === 'google'    ? env.GOOGLE_CLIENT_ID :
    provider === 'microsoft' ? env.MICROSOFT_CLIENT_ID :
    provider === 'apple'     ? env.APPLE_CLIENT_ID : '';

  if (!clientId) return res.status(404).json({ error: 'provider_not_configured' });

  const redirectUri = `${env.FRONTEND_URL}/api/auth/callback/${provider}`;
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes,
    state,
  });

  res.redirect(`${config.authUrl}?${params.toString()}`);
});

// ---------------------------------------------------------------------------
// POST /auth/oauth/:provider/callback — exchange code for tokens
// ---------------------------------------------------------------------------
const OAuthCallbackBody = z.object({
  code:  z.string().min(1),
  state: z.string().optional(),
});

authRouter.post('/oauth/:provider/callback', loginLimiter, asyncHandler(async (req, res) => {
  const provider = req.params.provider as string;
  const { code } = OAuthCallbackBody.parse(req.body);

  // Token exchange + userinfo is provider-specific.
  const profile = await exchangeOAuthCode(provider, code);

  // Find or create user via linked account.
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.sub } },
    include: { user: true },
  }) as Prisma.AccountGetPayload<{ include: { user: true } }> | null;

  let user;
  if (account) {
    user = account.user;
    if (!user.isActive) throw Unauthorized('user_inactive');
  } else {
    // Check if a user with this email already exists — link the account.
    user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
    if (user) {
      await prisma.account.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId: profile.sub,
        },
      });
    } else {
      // New user via OAuth — default role is determined by admin invite flow.
      // For self-registration we reject; users must be created by admin first.
      throw Forbidden('no_account_found');
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken  = await signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    expiresIn: env.ACCESS_TOKEN_TTL_SEC,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}));

// ---------------------------------------------------------------------------
// POST /auth/users  — admin-only user creation
// ---------------------------------------------------------------------------
const CreateUserBody = z.object({
  email:    z.string().email(),
  password: z.string().min(12).max(256),
  fullName: z.string().min(1).max(120),
  role:     z.enum(['DOCTOR', 'PHARMACIST', 'ADMIN']),
  doctor:   z.object({
    licenseNo:    z.string().min(1),
    departmentId: z.string().min(1),
    specialtyId:  z.string().min(1),
  }).optional(),
});

authRouter.post('/users', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = CreateUserBody.parse(req.body);
  if (body.role === 'DOCTOR' && !body.doctor) throw BadRequest('doctor_profile_required');

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: body.email.toLowerCase(), fullName: body.fullName, role: body.role, passwordHash },
    });
    if (body.role === 'DOCTOR' && body.doctor) {
      await tx.doctorProfile.create({
        data: {
          userId:       u.id,
          licenseNo:    body.doctor.licenseNo,
          departmentId: body.doctor.departmentId,
          specialtyId:  body.doctor.specialtyId,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: (req as AuthedRequest).actor.id, actorRole: 'ADMIN',
        action: 'USER_CREATE', entity: 'User', entityId: u.id,
        payload: { role: body.role, email: u.email },
      },
    });
    return u;
  });

  res.status(201).json({ id: user.id, email: user.email, role: user.role });
}));

// ---------------------------------------------------------------------------
// OAuth code exchange helper
// ---------------------------------------------------------------------------
type OAuthProfile = { sub: string; email: string; name: string };

const TOKEN_ENDPOINTS: Record<string, string> = {
  google:    'https://oauth2.googleapis.com/token',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  apple:     'https://appleid.apple.com/auth/token',
};

const USERINFO_ENDPOINTS: Record<string, string> = {
  google:    'https://openidconnect.googleapis.com/v1/userinfo',
  microsoft: 'https://graph.microsoft.com/oidc/userinfo',
};

async function exchangeOAuthCode(provider: string, code: string): Promise<OAuthProfile> {
  const tokenEndpoint = TOKEN_ENDPOINTS[provider];
  if (!tokenEndpoint) throw BadRequest('unsupported_provider');

  const clientId =
    provider === 'google'    ? env.GOOGLE_CLIENT_ID :
    provider === 'microsoft' ? env.MICROSOFT_CLIENT_ID :
    provider === 'apple'     ? env.APPLE_CLIENT_ID : '';
  const clientSecret =
    provider === 'google'    ? env.GOOGLE_CLIENT_SECRET :
    provider === 'microsoft' ? env.MICROSOFT_CLIENT_SECRET :
    provider === 'apple'     ? env.APPLE_CLIENT_SECRET : '';

  const redirectUri = `${env.FRONTEND_URL}/api/auth/callback/${provider}`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw Unauthorized('oauth_token_exchange_failed');
  }

  const tokens = await tokenRes.json() as { access_token: string; id_token?: string };

  // For Google/Microsoft, fetch userinfo. For Apple, decode the id_token.
  if (provider === 'apple') {
    // Apple's id_token is a JWT; decode payload (already verified by TLS + client_secret).
    const payload = JSON.parse(
      Buffer.from(tokens.id_token!.split('.')[1]!, 'base64url').toString(),
    );
    return { sub: payload.sub, email: payload.email, name: payload.email };
  }

  const userinfoEndpoint = USERINFO_ENDPOINTS[provider]!;
  const userinfoRes = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfoRes.ok) throw Unauthorized('oauth_userinfo_failed');

  const info = await userinfoRes.json() as { sub: string; email: string; name?: string };
  return { sub: info.sub, email: info.email, name: info.name ?? info.email };
}

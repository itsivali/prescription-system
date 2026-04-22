// Centralized environment variable validation. Fail fast at boot.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function loadDotEnvIfPresent(): void {
  // Prefer service-local .env when running from services/core-api.
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    // Stop at first existing .env file.
    return;
  }
}

loadDotEnvIfPresent();

const Schema = z.object({
  NODE_ENV:     z.enum(['development', 'test', 'production']).default('development'),
  PORT:         z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL:    z.string().url().default('redis://127.0.0.1:6380'),

  // Prescription QR signing keys (RS256)
  JWT_PRIVATE_KEY_PATH: z.string().min(1),
  JWT_PUBLIC_KEY_PATH:  z.string().min(1),

  // Session signing — symmetric (HS256). Min length enforced.
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be ≥32 chars'),
  ACCESS_TOKEN_TTL_SEC:  z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),

  // CORS allow-list (comma separated)
  CORS_ORIGINS: z.string().default(''),

  // Frontend origin for cookie Domain / CSRF validation
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // CSRF secret for double-submit cookie pattern
  CSRF_SECRET: z.string().min(32).default('dev-csrf-secret-at-least-32-characters-long'),

  // Cookie settings
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: z.coerce.boolean().default(false),      // true in production (HTTPS)

  // OAuth2 providers (all optional — disabled if blank)
  GOOGLE_CLIENT_ID:     z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_CLIENT_ID:     z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  APPLE_CLIENT_ID:     z.string().default(''),
  APPLE_CLIENT_SECRET: z.string().default(''),
});

export const env = Schema.parse(process.env);
export type Env = typeof env;

if (
  env.NODE_ENV === 'production' &&
  !/(sslmode=require|ssl=true|sslaccept=strict)/i.test(env.DATABASE_URL)
) {
  throw new Error('DATABASE_URL must enforce SSL in production (e.g. sslmode=require)');
}

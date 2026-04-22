import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { env } from './env';
import { logger } from './logger';
import { errorHandler } from './http/errorHandler';
import { csrfIssue, csrfValidate } from './auth/csrf';

import { healthRouter }        from './http/routes/health';
import { authRouter }          from './http/routes/auth';
import { shiftsRouter }        from './http/routes/shifts';
import { doctorsRouter }       from './http/routes/doctors';
import { patientsRouter }      from './http/routes/patients';
import { encountersRouter }    from './http/routes/encounters';
import { drugsRouter }         from './http/routes/drugs';
import { prescriptionsRouter } from './http/routes/prescriptions';
import { dispensationsRouter } from './http/routes/dispensations';
import { billingRouter }       from './http/routes/billing';
import { auditRouter }         from './http/routes/audit';
import { adminRouter }         from './http/routes/admin';

export function buildServer(): Express {
  const app = express();

  // ---- Hardening (must run before route handlers) ------------------------
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // honor X-Forwarded-* from the ingress

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src':     ["'self'"],
        'img-src':         ["'self'", 'data:'],
        'script-src':      ["'self'"],
        'object-src':      ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri':        ["'none'"],
        'form-action':     ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  // CORS — explicit allow-list. Empty list disables CORS entirely.
  const origins = env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  if (origins.length > 0) {
    app.use(cors({ origin: origins, credentials: true, maxAge: 600 }));
  }

  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit:    240,
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
  }));
  app.use(pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  }));

  // CSRF protection — issue token cookie on every response, validate on mutations.
  app.use(csrfIssue);
  app.use(csrfValidate);

  // Friendly root for humans/browsers. This service is API-only.
  app.get('/', (_req, res) => {
    res.json({
      name: 'hospital-crm-core-api',
      status: 'ok',
      docsHint: 'Use /healthz, /readyz, and /v1/* endpoints',
      endpoints: {
        health: '/healthz',
        ready: '/readyz',
        authLogin: '/v1/auth/login',
      },
    });
  });

  // ---- Routes ------------------------------------------------------------
  app.use(healthRouter);
  app.use('/v1/auth',           authRouter);
  app.use('/v1/shifts',         shiftsRouter);
  app.use('/v1/doctors',        doctorsRouter);
  app.use('/v1/patients',       patientsRouter);
  app.use('/v1/encounters',     encountersRouter);
  app.use('/v1/drugs',          drugsRouter);
  app.use('/v1/prescriptions',  prescriptionsRouter);
  app.use('/v1/dispensations',  dispensationsRouter);
  app.use('/v1/billing',        billingRouter);
  app.use('/v1/audit',          auditRouter);
  app.use('/v1/admin',          adminRouter);

  // ---- Catch-all 404 -----------------------------------------------------
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  // ---- Centralized error handler (must be last) --------------------------
  app.use(errorHandler);

  return app;
}

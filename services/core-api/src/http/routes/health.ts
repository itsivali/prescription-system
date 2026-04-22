import { Router } from 'express';
import { prisma } from '../../db';
import { redis } from '../../redis';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Deep readiness check — both datastores must respond.
healthRouter.get('/readyz', async (_req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    res.status(200).send('ready');
  } catch {
    res.status(503).send('not_ready');
  }
});

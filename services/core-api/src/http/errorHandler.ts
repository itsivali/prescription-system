import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from './errors';
import { logger } from '../logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation', details: err.flatten() });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { // unique constraint
      res.status(409).json({ error: 'conflict', details: err.meta });
      return;
    }
    if (err.code === 'P2025') { // record not found
      res.status(404).json({ error: 'not_found' });
      return;
    }
  }
  logger.error({ err }, 'unhandled');
  res.status(500).json({ error: 'internal' });
};

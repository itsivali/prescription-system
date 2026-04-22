import { Router } from 'express';
import { z } from 'zod';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { clockIn, clockOut } from '../../rules/shifts';

export const shiftsRouter = Router();

const ClockInBody = z.object({
  durationHours: z.number().positive().max(12).default(8),
});

shiftsRouter.post('/clock-in', authn, requireRole('DOCTOR'), asyncHandler(async (req, res) => {
  const { durationHours } = ClockInBody.parse(req.body ?? {});
  const result = await clockIn((req as AuthedRequest).actor.id, durationHours);
  res.json(result);
}));

shiftsRouter.post('/clock-out', authn, requireRole('DOCTOR'), asyncHandler(async (req, res) => {
  await clockOut((req as AuthedRequest).actor.id);
  res.status(204).end();
}));

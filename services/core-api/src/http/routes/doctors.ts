import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, asyncHandler } from '../../auth/middleware';
import { NotFound } from '../errors';

export const doctorsRouter = Router();
const IdParams = z.object({ id: z.string().min(1) });

doctorsRouter.get('/', authn, asyncHandler(async (_req, res) => {
  const items = await prisma.doctorProfile.findMany({
    include: {
      user:       { select: { fullName: true, email: true, isActive: true } },
      specialty:  true,
      department: true,
    },
  });
  res.json({ items });
}));

doctorsRouter.get('/:id', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const doc = await prisma.doctorProfile.findUnique({
    where: { id },
    include: {
      user:       { select: { fullName: true, email: true, isActive: true, lastLoginAt: true } },
      specialty:  true,
      department: true,
    },
  });
  if (!doc) throw NotFound();
  const onShift =
    doc.shiftStartedAt && doc.shiftEndsAt && doc.shiftEndsAt > new Date();
  res.json({ ...doc, onShift });
}));

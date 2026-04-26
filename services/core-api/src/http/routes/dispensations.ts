import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { dispenseMedication } from '../../rules/dispenseAndBill';
import { Conflict, NotFound } from '../errors';

export const dispensationsRouter = Router();

const DispenseBody = z.object({
  code: z.string().min(8).max(128).optional(),
  qrHash: z.string().length(64).optional(),
});
const IdParams = z.object({ id: z.string().min(1) });

/** Pharmacist scans a QR and dispenses. Atomic: inventory + billing or rollback. */
dispensationsRouter.post('/', authn, requireRole('PHARMACIST'), asyncHandler(async (req, res) => {
  const { code, qrHash } = DispenseBody.parse(req.body);
  const actor = (req as AuthedRequest).actor;
  const result = await dispenseMedication({ code: code ?? qrHash ?? '', pharmacistId: actor.id });

  if (!result.ok) {
    if (result.reason === 'PRESCRIPTION_NOT_FOUND') throw NotFound();
    throw Conflict(result.reason.toLowerCase());
  }

  // Enrich response with prescription + invoice details for the scan UI.
  const dispensation = await prisma.dispensation.findUnique({
    where: { id: result.dispensationId },
    include: {
      prescription: {
        include: {
          drug: { select: { name: true, strength: true } },
          patient: { select: { fullName: true, mrn: true } },
        },
      },
      invoice: { select: { id: true, totalCents: true, copayCents: true, insuredCents: true } },
    },
  });

  res.status(201).json({
    ...result,
    id: result.dispensationId,
    dispensedAt: dispensation?.prescription?.fulfilledAt ?? new Date(),
    prescription: dispensation?.prescription,
    invoice: dispensation?.invoice,
  });
}));

dispensationsRouter.get('/:id', authn, requireRole('PHARMACIST', 'ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  const d = await prisma.dispensation.findUnique({
    where: { id },
    include: {
      prescription: { include: { drug: true, patient: true } },
      pharmacist:   { select: { id: true, fullName: true, email: true } },
      lines:        { include: { drugBatch: true } },
      invoice:      { include: { claim: true } },
    },
  });
  if (!d) throw NotFound();
  if (actor.role === 'PHARMACIST' && d.pharmacistId !== actor.id) throw NotFound();
  res.json(d);
}));

const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

dispensationsRouter.get('/', authn, requireRole('PHARMACIST', 'ADMIN'), asyncHandler(async (req, res) => {
  const { take, skip } = ListQuery.parse(req.query);
  const actor = (req as AuthedRequest).actor;
  const where = actor.role === 'PHARMACIST' ? { pharmacistId: actor.id } : {};
  const items = await prisma.dispensation.findMany({
    where,
    take, skip,
    orderBy: { dispensedAt: 'desc' },
    include: { prescription: { include: { drug: true, patient: { select: { fullName: true, mrn: true } } } } },
  });
  res.json({ items });
}));

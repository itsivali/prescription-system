import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { requireDoctorProfileId } from '../../auth/authorization';
import { createPrescription } from '../../rules/createPrescription';
import { voidPrescription } from '../../rules/voidPrescription';
import { NotFound } from '../errors';

export const prescriptionsRouter = Router();
const IdParams = z.object({ id: z.string().min(1) });

const ListPrescriptions = z.object({
  patientId: z.string().optional(),
  doctorId:  z.string().optional(),
  status:    z.enum(['PENDING', 'FULFILLED', 'VOID', 'EXPIRED']).optional(),
  take:      z.coerce.number().int().min(1).max(200).default(50),
  skip:      z.coerce.number().int().min(0).default(0),
});

prescriptionsRouter.get('/', authn, asyncHandler(async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const { patientId, doctorId, status, take, skip } = ListPrescriptions.parse(req.query);

  const where: {
    patientId?: string;
    doctorId?: string;
    status?: 'PENDING' | 'FULFILLED' | 'VOID' | 'EXPIRED';
  } = {};
  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;
  if (actor.role === 'DOCTOR') {
    const actorDoctorId = await requireDoctorProfileId(actor.id);
    where.doctorId = actorDoctorId;
  }
  if (actor.role === 'PHARMACIST' && !status) where.status = 'PENDING';
  if (actor.role === 'PHARMACIST' && status === 'VOID') {
    res.json({ items: [], total: 0 });
    return;
  }

  const [items, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      take,
      skip,
      orderBy: { signedAt: 'desc' },
      include: {
        drug: { select: { id: true, name: true, strength: true, form: true, unitPriceCents: true } },
        patient: { select: { id: true, fullName: true, mrn: true, insurance: { select: { carrier: true, coveragePercent: true } } } },
        doctor: { include: { user: { select: { id: true, fullName: true } }, specialty: true } },
      },
    }),
    prisma.prescription.count({ where }),
  ]);
  res.json({ items, total });
}));

const CreateBody = z.object({
  encounterId: z.string().min(1),
  patientId:   z.string().min(1),
  drugId:      z.string().min(1),
  quantity:    z.number().int().positive().max(1000),
  dosage:      z.string().min(1).max(500),
});

prescriptionsRouter.post('/', authn, requireRole('DOCTOR'), asyncHandler(async (req, res) => {
  const body = CreateBody.parse(req.body);
  const result = await createPrescription({
    doctorUserId: (req as AuthedRequest).actor.id,
    ...body,
  });
  res.status(201).json(result);
}));

/**
 * Returns the full prescription record. Doctors and admins see everything;
 * pharmacists see only PENDING / FULFILLED rows (no draft visibility).
 */
prescriptionsRouter.get('/:id', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  const rx = await prisma.prescription.findUnique({
    where: { id },
    include: {
      drug: true,
      doctor: { include: { user: { select: { fullName: true } }, specialty: true } },
      patient: { include: { insurance: { select: { carrier: true, coveragePercent: true } } } },
    },
  });
  if (!rx) throw NotFound();
  if (actor.role === 'DOCTOR' && rx.doctor.userId !== actor.id) throw NotFound();
  if (actor.role === 'PHARMACIST' && rx.status === 'VOID') throw NotFound();
  res.json(rx);
}));

const VoidBody = z.object({ reason: z.string().min(3).max(500) });

prescriptionsRouter.post('/:id/void', authn, requireRole('DOCTOR', 'ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const { reason } = VoidBody.parse(req.body);
  const actor = (req as AuthedRequest).actor;
  await voidPrescription({
    prescriptionId: id,
    actorUserId:    actor.id,
    actorRole:      actor.role,
    reason,
  });
  res.status(204).end();
}));

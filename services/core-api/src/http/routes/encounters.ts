import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { requireDoctorProfileId } from '../../auth/authorization';
import { Forbidden, NotFound, Conflict } from '../errors';

export const encountersRouter = Router();

const ListEncounters = z.object({
  doctorId:  z.string().optional(),
  patientId: z.string().optional(),
  active:    z.coerce.boolean().optional(),
  take:      z.coerce.number().int().min(1).max(200).default(50),
  skip:      z.coerce.number().int().min(0).default(0),
});

encountersRouter.get('/', authn, asyncHandler(async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const { doctorId, patientId, active, take, skip } = ListEncounters.parse(req.query);
  const where: Record<string, unknown> = {
    ...(doctorId ? { doctorId } : {}),
    ...(patientId ? { patientId } : {}),
    ...(active === true ? { endedAt: null } : {}),
  };

  if (actor.role === 'DOCTOR') {
    const actorDoctorId = await requireDoctorProfileId(actor.id);
    where.doctorId = actorDoctorId;
  } else if (actor.role === 'PHARMACIST') {
    throw Forbidden('insufficient_role');
  }

  const [items, total] = await Promise.all([
    prisma.encounter.findMany({
      where,
      take,
      skip,
      orderBy: { startedAt: 'desc' },
      include: {
        patient: { select: { id: true, fullName: true, mrn: true } },
        doctor: { include: { user: { select: { id: true, fullName: true } }, specialty: true } },
      },
    }),
    prisma.encounter.count({ where }),
  ]);
  res.json({ items, total });
}));

const IdParams = z.object({ id: z.string().min(1) });
const StartEncounter = z.object({
  patientId: z.string().min(1),
  notes:     z.string().max(4000).optional(),
});

/** Doctor must be on shift to start an encounter. */
encountersRouter.post('/', authn, requireRole('DOCTOR'), asyncHandler(async (req, res) => {
  const body = StartEncounter.parse(req.body);
  const userId = (req as AuthedRequest).actor.id;

  const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!doctor) throw Forbidden('not_a_doctor');

  const now = new Date();
  const onShift = doctor.shiftStartedAt && doctor.shiftEndsAt && doctor.shiftEndsAt > now;
  if (!onShift) throw Forbidden('not_on_shift');

  const encounter = await prisma.encounter.create({
    data: {
      doctorId:  doctor.id,
      patientId: body.patientId,
      notes:     body.notes ?? null,
    },
  });
  res.status(201).json(encounter);
}));

const EndEncounter = z.object({ notes: z.string().max(4000).optional() });

encountersRouter.post('/:id/end', authn, requireRole('DOCTOR'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const body = EndEncounter.parse(req.body ?? {});
  const userId = (req as AuthedRequest).actor.id;

  const enc = await prisma.encounter.findUnique({
    where: { id },
    include: { doctor: true },
  });
  if (!enc) throw NotFound();
  if (enc.doctor.userId !== userId) throw Forbidden('not_owner');
  if (enc.endedAt) throw Conflict('already_ended');

  const updated = await prisma.encounter.update({
    where: { id: enc.id },
    data:  { endedAt: new Date(), notes: body.notes ?? enc.notes },
  });
  res.json(updated);
}));

encountersRouter.get('/:id', authn, asyncHandler(async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const { id } = IdParams.parse(req.params);

  const enc = await prisma.encounter.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor:  { include: { user: { select: { fullName: true } }, specialty: true } },
      prescriptions: { include: { drug: true } },
    },
  });
  if (!enc) throw NotFound();

  if (actor.role === 'DOCTOR' && enc.doctor.userId !== actor.id) throw NotFound();
  if (actor.role === 'PHARMACIST') throw Forbidden('insufficient_role');

  res.json(enc);
}));

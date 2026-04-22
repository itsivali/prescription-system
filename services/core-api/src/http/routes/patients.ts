import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { assertCanAccessPatient, requireDoctorProfileId } from '../../auth/authorization';
import { NotFound } from '../errors';

export const patientsRouter = Router();
const IdParams = z.object({ id: z.string().min(1) });

const CreatePatient = z.object({
  mrn:         z.string().min(1).max(64),
  fullName:    z.string().min(1).max(120),
  dateOfBirth: z.coerce.date(),
  insuranceId: z.string().optional(),
});

patientsRouter.post('/', authn, requireRole('DOCTOR', 'ADMIN'), asyncHandler(async (req, res) => {
  const body = CreatePatient.parse(req.body);
  const patient = await prisma.patient.create({
    data: {
      mrn: body.mrn,
      fullName: body.fullName,
      dateOfBirth: body.dateOfBirth,
      ...(body.insuranceId ? { insurance: { connect: { id: body.insuranceId } } } : {}),
    },
  });
  res.status(201).json(patient);
}));

const UpdatePatient = CreatePatient.partial();

patientsRouter.patch('/:id', authn, requireRole('DOCTOR', 'ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  if (actor.role !== 'ADMIN') await assertCanAccessPatient(actor, id);
  const body = UpdatePatient.parse(req.body);
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...(body.mrn !== undefined ? { mrn: body.mrn } : {}),
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth } : {}),
      ...(body.insuranceId !== undefined
        ? body.insuranceId
          ? { insurance: { connect: { id: body.insuranceId } } }
          : { insurance: { disconnect: true } }
        : {}),
    },
  });
  res.json(patient);
}));

patientsRouter.get('/:id', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  await assertCanAccessPatient(actor, id);
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { insurance: true },
  });
  if (!patient) throw NotFound();
  res.json(patient);
}));

const SearchQuery = z.object({
  q:    z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
});

patientsRouter.get('/', authn, asyncHandler(async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const { q, take, skip } = SearchQuery.parse(req.query);
  const qWhere = q
    ? { OR: [
        { mrn:      { contains: q, mode: 'insensitive' as const } },
        { fullName: { contains: q, mode: 'insensitive' as const } },
      ] }
    : {};

  let scopeWhere: Record<string, unknown> = {};
  if (actor.role === 'DOCTOR') {
    const doctorId = await requireDoctorProfileId(actor.id);
    scopeWhere = { encounters: { some: { doctorId } } };
  } else if (actor.role === 'PHARMACIST') {
    scopeWhere = {
      prescriptions: { some: { dispensation: { pharmacistId: actor.id } } },
    };
  }

  const where =
    Object.keys(scopeWhere).length > 0
      ? { AND: [qWhere, scopeWhere] }
      : qWhere;

  const [items, total] = await Promise.all([
    prisma.patient.findMany({ where, take, skip, orderBy: { fullName: 'asc' } }),
    prisma.patient.count({ where }),
  ]);
  res.json({ items, total });
}));

// Encounter list for a patient — clinical view
patientsRouter.get('/:id/encounters', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  await assertCanAccessPatient(actor, id);
  const items = await prisma.encounter.findMany({
    where: { patientId: id },
    orderBy: { startedAt: 'desc' },
    include: { doctor: { include: { user: { select: { fullName: true } } } } },
    take: 100,
  });
  res.json({ items });
}));

patientsRouter.get('/:id/prescriptions', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  await assertCanAccessPatient(actor, id);
  const items = await prisma.prescription.findMany({
    where: { patientId: id },
    orderBy: { signedAt: 'desc' },
    include: { drug: true },
    take: 100,
  });
  res.json({ items });
}));

patientsRouter.get('/:id/invoices', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const actor = (req as AuthedRequest).actor;
  await assertCanAccessPatient(actor, id);
  const items = await prisma.invoice.findMany({
    where: { patientId: id },
    orderBy: { createdAt: 'desc' },
    include: { claim: true },
    take: 100,
  });
  res.json({ items });
}));

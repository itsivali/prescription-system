import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler } from '../../auth/middleware';

export const adminRouter = Router();

// Departments ---------------------------------------------------------------
const Dept = z.object({ name: z.string().min(1).max(120) });

adminRouter.get('/departments', authn, asyncHandler(async (_req, res) => {
  res.json({ items: await prisma.department.findMany({ orderBy: { name: 'asc' } }) });
}));

adminRouter.post('/departments', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = Dept.parse(req.body);
  res.status(201).json(await prisma.department.create({ data: body }));
}));

// Specialties ---------------------------------------------------------------
const Spec = z.object({
  code:         z.string().min(1).max(40),
  name:         z.string().min(1).max(120),
  departmentId: z.string().min(1),
});

adminRouter.get('/specialties', authn, asyncHandler(async (_req, res) => {
  res.json({ items: await prisma.specialty.findMany({ include: { department: true } }) });
}));

adminRouter.post('/specialties', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = Spec.parse(req.body);
  res.status(201).json(await prisma.specialty.create({ data: body }));
}));

// Drug classes --------------------------------------------------------------
const DrugClass = z.object({ code: z.string().min(1).max(40), name: z.string().min(1).max(120) });

adminRouter.get('/drug-classes', authn, asyncHandler(async (_req, res) => {
  res.json({ items: await prisma.drugClass.findMany() });
}));

adminRouter.post('/drug-classes', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = DrugClass.parse(req.body);
  res.status(201).json(await prisma.drugClass.create({ data: body }));
}));

// Specialty <-> drug class authorization ------------------------------------
const Authz = z.object({ specialtyId: z.string().min(1), drugClassId: z.string().min(1) });

adminRouter.post('/specialty-drug-class', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = Authz.parse(req.body);
  const link = await prisma.specialtyDrugClass.upsert({
    where:  { specialtyId_drugClassId: body },
    update: {},
    create: body,
  });
  res.status(201).json(link);
}));

adminRouter.get('/specialty-drug-class', authn, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const items = await prisma.specialtyDrugClass.findMany({
    include: { specialty: true, drugClass: true },
    orderBy: [{ specialtyId: 'asc' }, { drugClassId: 'asc' }],
  });
  res.json({ items });
}));

adminRouter.delete('/specialty-drug-class', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = Authz.parse(req.body);
  await prisma.specialtyDrugClass.delete({ where: { specialtyId_drugClassId: body } });
  res.status(204).end();
}));

// Insurance policies --------------------------------------------------------
const Policy = z.object({
  carrier:         z.string().min(1).max(120),
  memberNumber:    z.string().min(1).max(80),
  coveragePercent: z.number().int().min(0).max(100),
});

adminRouter.post('/insurance-policies', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const body = Policy.parse(req.body);
  res.status(201).json(await prisma.insurancePolicy.create({ data: body }));
}));

adminRouter.get('/insurance-policies', authn, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  res.json({
    items: await prisma.insurancePolicy.findMany({
      orderBy: [{ carrier: 'asc' }, { memberNumber: 'asc' }],
    }),
  });
}));

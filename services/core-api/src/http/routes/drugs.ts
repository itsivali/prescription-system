import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler } from '../../auth/middleware';
import { NotFound } from '../errors';

export const drugsRouter = Router();
const IdParams = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
const ListQuery = z.object({
  q:    z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

drugsRouter.get('/', authn, asyncHandler(async (req, res) => {
  const { q, take, skip } = ListQuery.parse(req.query);
  const where = q
    ? { OR: [
        { name:    { contains: q, mode: 'insensitive' as const } },
        { ndcCode: { contains: q, mode: 'insensitive' as const } },
      ] }
    : {};
  const [items, total] = await Promise.all([
    prisma.drug.findMany({ where, take, skip, include: { drugClass: true } }),
    prisma.drug.count({ where }),
  ]);
  res.json({ items, total });
}));

drugsRouter.get('/:id', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const drug = await prisma.drug.findUnique({
    where: { id },
    include: { drugClass: true, batches: { orderBy: { expiresAt: 'asc' } } },
  });
  if (!drug) throw NotFound();

  const stock = drug.batches.reduce((sum: number, b) => sum + b.quantityOnHand, 0);
  res.json({ ...drug, stockOnHand: stock });
}));

const CreateDrug = z.object({
  name:           z.string().min(1).max(120),
  ndcCode:        z.string().min(1).max(40),
  form:           z.string().min(1).max(40),
  strength:       z.string().min(1).max(40),
  drugClassId:    z.string().min(1),
  unitPriceCents: z.number().int().nonnegative(),
});

drugsRouter.post('/', authn, requireRole('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const body = CreateDrug.parse(req.body);
  const drug = await prisma.drug.create({
    data: {
      name: body.name,
      ndcCode: body.ndcCode,
      form: body.form,
      strength: body.strength,
      unitPriceCents: body.unitPriceCents,
      drugClass: { connect: { id: body.drugClassId } },
    },
  });
  res.status(201).json(drug);
}));

const UpdateDrug = CreateDrug.partial();
drugsRouter.patch('/:id', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const body = UpdateDrug.parse(req.body);
  const drug = await prisma.drug.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.ndcCode !== undefined ? { ndcCode: body.ndcCode } : {}),
      ...(body.form !== undefined ? { form: body.form } : {}),
      ...(body.strength !== undefined ? { strength: body.strength } : {}),
      ...(body.unitPriceCents !== undefined ? { unitPriceCents: body.unitPriceCents } : {}),
      ...(body.drugClassId !== undefined ? { drugClass: { connect: { id: body.drugClassId } } } : {}),
    },
  });
  res.json(drug);
}));

// ---------------------------------------------------------------------------
// Batches (stock receipt)
// ---------------------------------------------------------------------------
const CreateBatch = z.object({
  lotNumber:       z.string().min(1).max(64),
  supplier:        z.string().min(1).max(120),
  expiresAt:       z.coerce.date(),
  quantity:        z.number().int().positive(),
});

drugsRouter.post('/:id/batches', authn, requireRole('PHARMACIST', 'ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const body = CreateBatch.parse(req.body);
  if (body.expiresAt <= new Date()) {
    res.status(400).json({ error: 'already_expired' });
    return;
  }
  const batch = await prisma.drugBatch.create({
    data: {
      drug:            { connect: { id } },
      lotNumber:       body.lotNumber,
      supplier:        body.supplier,
      expiresAt:       body.expiresAt,
      quantityOnHand:  body.quantity,
      initialQuantity: body.quantity,
    },
  });
  res.status(201).json(batch);
}));

drugsRouter.get('/:id/batches', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const batches = await prisma.drugBatch.findMany({
    where: { drugId: id },
    orderBy: { expiresAt: 'asc' },
  });
  res.json({ items: batches });
}));

const ExpiringQuery = z.object({ days: z.coerce.number().int().positive().max(365).default(30) });

drugsRouter.get('/_/batches/expiring', authn, requireRole('PHARMACIST', 'ADMIN'), asyncHandler(async (req, res) => {
  const { days } = ExpiringQuery.parse(req.query);
  const cutoff = new Date(Date.now() + days * 24 * 3600_000);
  const items = await prisma.drugBatch.findMany({
    where: { expiresAt: { lte: cutoff }, quantityOnHand: { gt: 0 } },
    include: { drug: true },
    orderBy: { expiresAt: 'asc' },
  });
  res.json({ items, cutoff });
}));

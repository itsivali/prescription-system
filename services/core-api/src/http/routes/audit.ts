import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler } from '../../auth/middleware';

export const auditRouter = Router();

const Query = z.object({
  entity:   z.string().optional(),
  entityId: z.string().optional(),
  actorId:  z.string().optional(),
  action:   z.string().optional(),
  take:     z.coerce.number().int().min(1).max(500).default(100),
  skip:     z.coerce.number().int().min(0).default(0),
});

auditRouter.get('/', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { entity, entityId, actorId, action, take, skip } = Query.parse(req.query);
  const where: Record<string, string> = {};
  if (entity)   where.entity   = entity;
  if (entityId) where.entityId = entityId;
  if (actorId)  where.actorId  = actorId;
  if (action)   where.action   = action;

  const items = await prisma.auditLog.findMany({
    where,
    take, skip,
    orderBy: { occurredAt: 'desc' },
  });
  // BigInt id needs to be serialized as string for JSON safety.
  const serialized = items.map((row) => ({ ...row, id: row.id.toString() }));
  res.json({ items: serialized });
}));

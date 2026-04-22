import { prisma } from '../db';
import { redis } from '../redis';
import { Conflict, Forbidden, NotFound } from '../http/errors';
import type { Role } from '@prisma/client';

/**
 * Voids a PENDING prescription. Allowed by:
 *   - the original prescribing doctor, or
 *   - any ADMIN.
 * Burns the QR nonce in Redis so the corresponding code, even if scanned now,
 * fails replay protection.
 */
export async function voidPrescription(args: {
  prescriptionId: string;
  actorUserId: string;
  actorRole: Role;
  reason: string;
}): Promise<void> {
  const rx = await prisma.prescription.findUnique({
    where: { id: args.prescriptionId },
    include: { doctor: { select: { userId: true } } },
  });
  if (!rx) throw NotFound('prescription_not_found');
  if (rx.status !== 'PENDING') throw Conflict('not_pending');

  const isOwner = rx.doctor.userId === args.actorUserId;
  if (!isOwner && args.actorRole !== 'ADMIN') throw Forbidden('not_owner');

  await prisma.$transaction(async (tx) => {
    await tx.prescription.update({
      where: { id: rx.id },
      data:  { status: 'VOID', voidReason: args.reason },
    });
    await tx.auditLog.create({
      data: {
        actorId:   args.actorUserId,
        actorRole: args.actorRole,
        action:    'PRESCRIPTION_VOID',
        entity:    'Prescription',
        entityId:  rx.id,
        payload:   { reason: args.reason },
      },
    });
  });

  // Burn the nonce — even if a stolen QR is scanned later, it'll be a replay.
  await redis.set(`rx:nonce:${rx.nonce}`, 'VOID', 'EX', 24 * 60 * 60);
}

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { consumeNonce } from '../redis';

// ---------------------------------------------------------------------------
// dispenseMedication
// ---------------------------------------------------------------------------
//   1. Look up the Prescription by qrHash (entered from prescription invoice).
//   2. Atomically consume the nonce in Redis (anti-replay).
//   3. Inside a single DB transaction (Serializable):
//        a. Re-fetch Prescription, assert PENDING + not expired.
//        b. Pull oldest non-expired DrugBatch rows with quantityOnHand > 0
//           and decrement them FIFO until requested quantity is satisfied.
//        c. Generate split bill (Insurance claim + patient copay invoice).
//        d. Append hash-chained LedgerTransaction rows.
//        e. Mark Prescription FULFILLED.
//   If billing throws, the entire transaction rolls back including inventory.
// ---------------------------------------------------------------------------

export type DispenseInput = {
  qrHash: string;
  pharmacistId: string;
};

export type DispenseResult =
  | {
      ok: true;
      dispensationId: string;
      invoiceId: string;
      claimId: string;
      patientCopayCents: number;
      insuredCents: number;
    }
  | { ok: false; reason: string };

export async function dispenseMedication(input: DispenseInput): Promise<DispenseResult> {
  // (1) Look up prescription by QR hash.
  const rx = await prisma.prescription.findUnique({
    where: { qrHash: input.qrHash },
    select: {
      id: true,
      nonce: true,
      status: true,
      expiresAt: true,
      quantity: true,
      patientId: true,
      drugId: true,
    },
  });
  if (!rx) return { ok: false, reason: 'PRESCRIPTION_NOT_FOUND' };
  if (rx.status !== 'PENDING') return { ok: false, reason: 'NOT_PENDING' };
  if (rx.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };

  // (2) One-time use enforcement.
  const ttl = Math.max(60, Math.floor((rx.expiresAt.getTime() - Date.now()) / 1000));
  const fresh = await consumeNonce(rx.nonce, ttl);
  if (!fresh) return { ok: false, reason: 'REPLAY_DETECTED' };

  // (3) Single transaction wraps inventory + billing.
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // (3a) Re-fetch Prescription and validate state.
        const prescription = await tx.prescription.findUnique({
          where: { id: rx.id },
          include: { patient: { include: { insurance: true } }, drug: true },
        });
        if (!prescription)                     throw new DispenseError('PRESCRIPTION_NOT_FOUND');
        if (prescription.status !== 'PENDING') throw new DispenseError('NOT_PENDING');
        if (prescription.expiresAt < new Date()) throw new DispenseError('EXPIRED');

        // (3b) FIFO inventory pull.
        const lines = await fifoConsume(tx, prescription.drugId, prescription.quantity);

        const dispensation = await tx.dispensation.create({
          data: {
            prescriptionId: prescription.id,
            pharmacistId:   input.pharmacistId,
            lines: { create: lines.map(l => ({
              drugBatchId: l.batchId,
              quantity:    l.quantity,
            })) },
          },
        });

        // (3c) Split-bill calculation.
        const totalCents     = prescription.quantity * prescription.drug.unitPriceCents;
        const coverage       = prescription.patient.insurance?.coveragePercent ?? 0;
        const insuredCents   = Math.floor(totalCents * coverage / 100);
        const copayCents     = totalCents - insuredCents;

        const invoice = await tx.invoice.create({
          data: {
            patientId:      prescription.patientId,
            dispensationId: dispensation.id,
            totalCents,
            copayCents,
            insuredCents,
          },
        });

        let claimId: string | null = null;
        if (prescription.patient.insurance && insuredCents > 0) {
          const claim = await tx.insuranceClaim.create({
            data: {
              invoiceId:   invoice.id,
              policyId:    prescription.patient.insurance.id,
              amountCents: insuredCents,
            },
          });
          claimId = claim.id;
        }

        // (3d) Append-only hash-chained ledger entries.
        await appendLedger(tx, invoice.id, copayCents,    'CREDIT', 'Patient copay billed');
        if (insuredCents > 0) {
          await appendLedger(tx, invoice.id, insuredCents, 'CREDIT', 'Insurance portion billed');
        }

        // (3e) Mark prescription fulfilled.
        await tx.prescription.update({
          where: { id: prescription.id },
          data:  { status: 'FULFILLED', fulfilledAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            actorId:   input.pharmacistId,
            actorRole: 'PHARMACIST',
            action:    'DISPENSE',
            entity:    'Prescription',
            entityId:  prescription.id,
            payload:   { invoiceId: invoice.id, totalCents, copayCents, insuredCents },
          },
        });

        return {
          dispensationId: dispensation.id,
          invoiceId:      invoice.id,
          claimId:        claimId ?? '',
          copayCents,
          insuredCents,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );

    return {
      ok: true,
      dispensationId:   result.dispensationId,
      invoiceId:        result.invoiceId,
      claimId:          result.claimId,
      patientCopayCents: result.copayCents,
      insuredCents:      result.insuredCents,
    };
  } catch (err) {
    if (err instanceof DispenseError) return { ok: false, reason: err.message };
    throw err; // unexpected — let the caller / error middleware see it
  }
}

// ---------------------------------------------------------------------------
// FIFO inventory consumption.
// Picks the oldest non-expired batches with stock and decrements them. Uses
// SELECT ... FOR UPDATE semantics via Prisma's $queryRaw to prevent two
// concurrent dispensations from oversubscribing the same batch.
// ---------------------------------------------------------------------------
type ConsumedLine = { batchId: string; quantity: number };

async function fifoConsume(
  tx: Prisma.TransactionClient,
  drugId: string,
  needed: number,
): Promise<ConsumedLine[]> {
  // Lock candidate batch rows for the duration of the transaction.
  const batches = await tx.$queryRaw<{ id: string; quantityOnHand: number }[]>`
    SELECT id, "quantityOnHand"
    FROM "DrugBatch"
    WHERE "drugId" = ${drugId}
      AND "expiresAt" > NOW()
      AND "quantityOnHand" > 0
    ORDER BY "expiresAt" ASC, "receivedAt" ASC
    FOR UPDATE
  `;

  const picks: ConsumedLine[] = [];
  let remaining = needed;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantityOnHand, remaining);

    await tx.drugBatch.update({
      where: { id: batch.id },
      data:  { quantityOnHand: { decrement: take } },
    });

    picks.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) throw new DispenseError('INSUFFICIENT_STOCK');
  return picks;
}

// ---------------------------------------------------------------------------
// Hash-chained ledger append. Each new row's `hash` covers the previous row's
// hash + this row's content, producing a tamper-evident chain per invoice.
// ---------------------------------------------------------------------------
export async function appendLedger(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amountCents: number,
  direction: 'DEBIT' | 'CREDIT',
  memo: string,
  paymentMethod?: 'CASH' | 'CARD' | 'MPESA',
): Promise<void> {
  const last = await tx.ledgerTransaction.findFirst({
    where:   { invoiceId },
    orderBy: { occurredAt: 'desc' },
    select:  { hash: true },
  });

  // Pin occurredAt so the hash is reproducible by verifyLedger().
  const occurredAt = new Date();
  const prevHash   = last?.hash ?? null;
  const body       = `${prevHash ?? ''}|${invoiceId}|${amountCents}|${direction}|${memo}|${occurredAt.getTime()}`;
  const hash       = createHash('sha256').update(body).digest('hex');

  await tx.ledgerTransaction.create({
    data: { invoiceId, amountCents, direction, memo, paymentMethod: paymentMethod ?? null, prevHash, hash, occurredAt },
  });
}

class DispenseError extends Error {}

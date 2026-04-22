import { createHash } from 'node:crypto';
import { prisma } from '../db';

export type LedgerVerification = {
  invoiceId: string;
  ok: boolean;
  totalCents: number;
  netBalanceCents: number;          // CREDIT - DEBIT
  brokenAtTransactionId?: string;
};

/**
 * Re-derives the SHA-256 hash chain for an invoice's ledger entries and
 * compares each computed hash to the stored hash. Catches tampering even
 * though the DB-level trigger should make UPDATE/DELETE impossible.
 */
export async function verifyLedger(invoiceId: string): Promise<LedgerVerification> {
  const entries = await prisma.ledgerTransaction.findMany({
    where: { invoiceId },
    orderBy: { occurredAt: 'asc' },
  });

  let prev: string | null = null;
  let net = 0;

  for (const entry of entries) {
    const expectedPrev: string | null = prev;
    if ((entry.prevHash ?? null) !== expectedPrev) {
      return { invoiceId, ok: false, totalCents: 0, netBalanceCents: 0, brokenAtTransactionId: entry.id };
    }
    const body: string = `${expectedPrev ?? ''}|${invoiceId}|${entry.amountCents}|${entry.direction}|${entry.memo}|${entry.occurredAt.getTime()}`;
    const expected: string = createHash('sha256').update(body).digest('hex');
    if (expected !== entry.hash) {
      return { invoiceId, ok: false, totalCents: 0, netBalanceCents: 0, brokenAtTransactionId: entry.id };
    }
    prev = entry.hash;
    net += entry.direction === 'CREDIT' ? entry.amountCents : -entry.amountCents;
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { totalCents: true } });
  return {
    invoiceId,
    ok: true,
    totalCents: invoice?.totalCents ?? 0,
    netBalanceCents: net,
  };
}

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { Conflict, NotFound, BadRequest } from '../http/errors';
import { appendLedger } from './dispenseAndBill';

/**
 * Records a patient/insurance payment against an invoice. Appends a DEBIT row
 * to the ledger; if the running net hits zero, the invoice flips to PAID.
 * All in one Serializable transaction so the ledger and invoice status stay
 * consistent under concurrent payment attempts.
 */
export async function recordPayment(args: {
  invoiceId: string;
  amountCents: number;
  source: 'PATIENT' | 'INSURANCE';
  paymentMethod?: 'CASH' | 'CARD' | 'MPESA';
  actorUserId: string;
}): Promise<{ invoiceId: string; status: string; remainingCents: number }> {
  if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) {
    throw BadRequest('invalid_amount');
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } });
    if (!invoice) throw NotFound('invoice_not_found');
    if (invoice.status === 'WRITTEN_OFF') throw Conflict('invoice_written_off');

    const ledger = await tx.ledgerTransaction.findMany({
      where: { invoiceId: args.invoiceId },
      select: { amountCents: true, direction: true },
    });
    const owed = ledger.reduce(
      (acc, e) => acc + (e.direction === 'CREDIT' ? e.amountCents : -e.amountCents),
      0,
    );
    if (args.amountCents > owed) throw Conflict('overpayment');

    await appendLedger(
      tx,
      args.invoiceId,
      args.amountCents,
      'DEBIT',
      `Payment received (${args.source})`,
      args.paymentMethod,
    );

    const remaining = owed - args.amountCents;
    const status = remaining === 0 ? 'PAID' : invoice.status;
    if (status !== invoice.status) {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
    }

    await tx.auditLog.create({
      data: {
        actorId:   args.actorUserId,
        actorRole: 'ADMIN',
        action:    'INVOICE_PAYMENT',
        entity:    'Invoice',
        entityId:  invoice.id,
        payload:   { amountCents: args.amountCents, source: args.source, remainingCents: remaining },
      },
    });

    return { invoiceId: invoice.id, status, remainingCents: remaining };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authn, requireRole, asyncHandler, type AuthedRequest } from '../../auth/middleware';
import { recordPayment } from '../../rules/payInvoice';
import { verifyLedger } from '../../rules/verifyLedger';
import { generateInvoicePdf } from '../../rules/generateInvoicePdf';
import { NotFound } from '../errors';

export const billingRouter = Router();
const IdParams = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
billingRouter.get('/invoices/:id', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      claim:   true,
      ledgerEntries: { orderBy: { occurredAt: 'asc' } },
    },
  });
  if (!inv) throw NotFound();
  res.json(inv);
}));

/** Download invoice as a PDF. */
billingRouter.get('/invoices/:id/pdf', authn, asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const pdf = await generateInvoicePdf(id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
  pdf.pipe(res);
}));

const ListInvoices = z.object({
  status: z.enum(['OPEN', 'PAID', 'WRITTEN_OFF']).optional(),
  take:   z.coerce.number().int().min(1).max(200).default(50),
  skip:   z.coerce.number().int().min(0).default(0),
});

billingRouter.get('/invoices', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { status, take, skip } = ListInvoices.parse(req.query);
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where, take, skip,
      orderBy: { createdAt: 'desc' },
      include: { patient: { select: { fullName: true, mrn: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ items, total });
}));

const PaymentBody = z.object({
  amountCents:   z.number().int().positive(),
  source:        z.enum(['PATIENT', 'INSURANCE']),
  paymentMethod: z.enum(['CASH', 'CARD', 'MPESA']).optional(),
});

billingRouter.post('/invoices/:id/payments', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const body = PaymentBody.parse(req.body);
  const result = await recordPayment({
    invoiceId:     id,
    amountCents:   body.amountCents,
    source:        body.source,
    ...(body.paymentMethod ? { paymentMethod: body.paymentMethod } : {}),
    actorUserId:   (req as AuthedRequest).actor.id,
  });
  res.status(201).json(result);
}));

billingRouter.post('/invoices/:id/write-off', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  await prisma.invoice.update({ where: { id }, data: { status: 'WRITTEN_OFF' } });
  await prisma.auditLog.create({
    data: {
      actorId: (req as AuthedRequest).actor.id, actorRole: 'ADMIN',
      action: 'INVOICE_WRITE_OFF', entity: 'Invoice', entityId: id, payload: {},
    },
  });
  res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Insurance claims
// ---------------------------------------------------------------------------
billingRouter.get('/claims/:id', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const claim = await prisma.insuranceClaim.findUnique({
    where: { id },
    include: { invoice: true, policy: true },
  });
  if (!claim) throw NotFound();
  res.json(claim);
}));

const UpdateClaimStatus = z.object({
  status: z.enum(['SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID']),
});

billingRouter.patch('/claims/:id', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const { status } = UpdateClaimStatus.parse(req.body);
  const claim = await prisma.insuranceClaim.update({
    where: { id },
    data:  { status },
  });

  // If claim is PAID, auto-record a DEBIT against the invoice for the insured portion.
  if (status === 'PAID') {
    await recordPayment({
      invoiceId:   claim.invoiceId,
      amountCents: claim.amountCents,
      source:      'INSURANCE',
      actorUserId: (req as AuthedRequest).actor.id,
    });
  }

  res.json(claim);
}));

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
billingRouter.get('/invoices/:id/ledger', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const items = await prisma.ledgerTransaction.findMany({
    where:   { invoiceId: id },
    orderBy: { occurredAt: 'asc' },
  });
  res.json({ items });
}));

billingRouter.get('/invoices/:id/ledger/verify', authn, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const result = await verifyLedger(id);
  res.status(result.ok ? 200 : 422).json(result);
}));

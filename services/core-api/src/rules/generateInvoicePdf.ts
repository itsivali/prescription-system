import PDFDocument from 'pdfkit';
import { prisma } from '../db';
import { NotFound } from '../http/errors';

/**
 * Generate a PDF invoice for a given invoice ID.
 * Returns a readable stream of the PDF content.
 * Includes: hospital header, patient details, prescription/drug info,
 * itemised billing in KES, insurance breakdown, and payment status.
 */
export async function generateInvoicePdf(invoiceId: string): Promise<PDFKit.PDFDocument> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      patient: true,
      dispensation: {
        include: {
          prescription: {
            include: {
              drug: true,
              doctor: { include: { user: { select: { fullName: true } }, specialty: true } },
            },
          },
        },
      },
      claim: { include: { policy: true } },
      ledgerEntries: { orderBy: { occurredAt: 'asc' } },
    },
  });
  if (!invoice) throw NotFound('invoice_not_found');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const formatKES = (cents: number) => `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

  // ── Hospital Header ──
  doc.fontSize(20).font('Helvetica-Bold').text('Hospital CRM', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Prescription Invoice', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#666')
    .text(`Invoice #: ${invoice.id}`, { align: 'center' })
    .text(`Date: ${invoice.createdAt.toLocaleDateString('en-KE')}`, { align: 'center' });
  doc.moveDown(1);

  // ── Divider ──
  doc.strokeColor('#e0e0e0').lineWidth(1)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // ── Patient Details ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text('Patient Details');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Name: ${invoice.patient.fullName}`);
  doc.text(`MRN: ${invoice.patient.mrn}`);
  doc.text(`Date of Birth: ${invoice.patient.dateOfBirth.toLocaleDateString('en-KE')}`);
  doc.moveDown(1);

  // ── Prescription Details ──
  const rx = invoice.dispensation?.prescription;
  if (rx) {
    doc.fontSize(12).font('Helvetica-Bold').text('Prescription Details');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Prescribing Doctor: Dr. ${rx.doctor.user.fullName} (${rx.doctor.specialty.name})`);
    doc.text(`Medication: ${rx.drug.name} ${rx.drug.strength} (${rx.drug.form})`);
    doc.text(`Dosage: ${rx.dosage}`);
    doc.text(`Quantity: ${rx.quantity}`);
    doc.text(`Prescribed: ${rx.signedAt.toLocaleDateString('en-KE')}`);
    if (rx.fulfilledAt) {
      doc.text(`Dispensed: ${rx.fulfilledAt.toLocaleDateString('en-KE')}`);
    }
    doc.moveDown(1);
  }

  // ── Divider ──
  doc.strokeColor('#e0e0e0').lineWidth(1)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // ── Billing Table ──
  doc.fontSize(12).font('Helvetica-Bold').text('Billing Summary');
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 350;

  // Table header
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Description', col1, tableTop);
  doc.text('Amount', col2, tableTop, { align: 'right', width: 195 });

  doc.strokeColor('#ccc').lineWidth(0.5)
    .moveTo(col1, tableTop + 15).lineTo(545, tableTop + 15).stroke();

  let y = tableTop + 25;
  doc.font('Helvetica').fontSize(10);

  // Drug line item
  if (rx) {
    doc.text(`${rx.drug.name} ${rx.drug.strength} x ${rx.quantity}`, col1, y);
    doc.text(formatKES(invoice.totalCents), col2, y, { align: 'right', width: 195 });
    y += 20;
  }

  // Divider before totals
  doc.strokeColor('#ccc').lineWidth(0.5)
    .moveTo(col1, y).lineTo(545, y).stroke();
  y += 10;

  // Totals
  doc.font('Helvetica-Bold');
  doc.text('Total', col1, y);
  doc.text(formatKES(invoice.totalCents), col2, y, { align: 'right', width: 195 });
  y += 20;

  // Insurance breakdown
  if (invoice.insuredCents > 0 && invoice.claim) {
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    doc.text(`Insurance (${invoice.claim.policy.carrier})`, col1, y);
    doc.text(`- ${formatKES(invoice.insuredCents)}`, col2, y, { align: 'right', width: 195 });
    y += 18;
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
  doc.text('Patient Copay', col1, y);
  doc.text(formatKES(invoice.copayCents), col2, y, { align: 'right', width: 195 });
  y += 25;

  // ── Payment Status ──
  doc.strokeColor('#e0e0e0').lineWidth(1)
    .moveTo(50, y).lineTo(545, y).stroke();
  y += 15;

  doc.fontSize(12).font('Helvetica-Bold').text('Payment History', col1, y);
  y += 20;

  if (invoice.ledgerEntries.length > 0) {
    doc.fontSize(9).font('Helvetica');
    for (const entry of invoice.ledgerEntries) {
      const sign = entry.direction === 'DEBIT' ? '-' : '+';
      const method = (entry as Record<string, unknown>).paymentMethod
        ? ` (${(entry as Record<string, unknown>).paymentMethod})`
        : '';
      doc.fillColor(entry.direction === 'DEBIT' ? '#16a34a' : '#333');
      doc.text(
        `${entry.occurredAt.toLocaleDateString('en-KE')} — ${entry.memo}${method}`,
        col1, y,
      );
      doc.text(
        `${sign} ${formatKES(entry.amountCents)}`,
        col2, y, { align: 'right', width: 195 },
      );
      y += 16;
    }
  } else {
    doc.fontSize(9).font('Helvetica').fillColor('#999');
    doc.text('No payments recorded yet.', col1, y);
    y += 16;
  }

  y += 15;
  doc.fillColor('#000');
  doc.fontSize(10).font('Helvetica-Bold');
  const statusLabel = invoice.status === 'PAID' ? 'PAID' : invoice.status === 'WRITTEN_OFF' ? 'WRITTEN OFF' : 'OUTSTANDING';
  doc.text(`Status: ${statusLabel}`, col1, y);
  y += 30;

  // ── Footer ──
  doc.strokeColor('#e0e0e0').lineWidth(1)
    .moveTo(50, y).lineTo(545, y).stroke();
  y += 10;
  doc.fontSize(8).font('Helvetica').fillColor('#999');
  doc.text('This is a computer-generated invoice. All amounts are in Kenyan Shillings (KES).', col1, y, { align: 'center', width: 495 });

  doc.end();
  return doc;
}

import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { Conflict, NotFound, BadRequest, Forbidden } from '../http/errors';
import { canPrescribe } from './canPrescribe';
import { generatePrescriptionHash, toPatientPickupCode } from './qrCrypto';

export type CreatePrescriptionInput = {
  /** User id of the doctor (User.id, not DoctorProfile.id). */
  doctorUserId: string;
  encounterId: string;
  patientId: string;
  drugId: string;
  quantity: number;
  dosage: string;
};

export type CreatePrescriptionResult = {
  prescriptionId: string;
  prescriptionHash: string;
  patientPickupCode: string;
  expiresAt: Date;
  patient: { fullName: string; mrn: string; dateOfBirth: Date };
  doctor: { fullName: string; specialty: string };
  drug: { name: string; strength: string; form: string; unitPriceCents: number };
  quantity: number;
  dosage: string;
  totalCents: number;
  copayCents: number;
  insuredCents: number;
  insuranceCarrier: string | null;
};

/**
 * Resolves the DoctorProfile from the authenticated user, runs canPrescribe,
 * persists a PENDING Prescription, generates a hash, then writes the
 * resulting nonce back onto the row — all in a single transaction.
 */
export async function createPrescription(
  input: CreatePrescriptionInput,
): Promise<CreatePrescriptionResult> {
  if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
    throw BadRequest('invalid_quantity');
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: input.doctorUserId },
    select: { id: true, user: { select: { fullName: true } }, specialty: { select: { name: true } } },
  });
  if (!doctor) throw Forbidden('not_a_doctor');

  // Encounter must belong to this doctor (defense beyond the 48h check).
  const encounter = await prisma.encounter.findUnique({
    where: { id: input.encounterId },
    select: { doctorId: true, patientId: true },
  });
  if (!encounter) throw NotFound('encounter_not_found');
  if (encounter.doctorId !== doctor.id || encounter.patientId !== input.patientId) {
    throw Forbidden('encounter_mismatch');
  }

  const auth = await canPrescribe({
    doctorId:  doctor.id,
    patientId: input.patientId,
    drugId:    input.drugId,
  });
  if (!auth.allowed) throw Conflict(auth.reason.toLowerCase());

  // Fetch drug + patient for the invoice details returned to the doctor.
  const [drug, patient] = await Promise.all([
    prisma.drug.findUnique({ where: { id: input.drugId } }),
    prisma.patient.findUnique({
      where: { id: input.patientId },
      include: { insurance: true },
    }),
  ]);
  if (!drug) throw NotFound('drug_not_found');
  if (!patient) throw NotFound('patient_not_found');

  const totalCents   = input.quantity * drug.unitPriceCents;
  const coverage     = patient.insurance?.coveragePercent ?? 0;
  const insuredCents = Math.floor(totalCents * coverage / 100);
  const copayCents   = totalCents - insuredCents;

  return prisma.$transaction(async (tx) => {
    const draft = await tx.prescription.create({
      data: {
        encounterId: input.encounterId,
        patientId:   input.patientId,
        doctorId:    doctor.id,
        drugId:      input.drugId,
        quantity:    input.quantity,
        dosage:      input.dosage,
        nonce:       'PENDING-' + randomUUID(),
        qrHash:      'PENDING-' + randomUUID(),
        expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const signed = generatePrescriptionHash({
      rxId:      draft.id,
      patientId: input.patientId,
      drugId:    input.drugId,
      quantity:  input.quantity,
    });

    await tx.prescription.update({
      where: { id: draft.id },
      data:  { nonce: signed.nonce, qrHash: signed.prescriptionHash, expiresAt: signed.expiresAt },
    });

    await tx.auditLog.create({
      data: {
        actorId:   input.doctorUserId,
        actorRole: 'DOCTOR',
        action:    'PRESCRIPTION_CREATE',
        entity:    'Prescription',
        entityId:  draft.id,
        payload:   { drugId: input.drugId, quantity: input.quantity, encounterId: input.encounterId },
      },
    });

    return {
      prescriptionId:   draft.id,
      prescriptionHash: signed.prescriptionHash,
      patientPickupCode: toPatientPickupCode(signed.prescriptionHash),
      expiresAt:        signed.expiresAt,
      patient: {
        fullName:    patient.fullName,
        mrn:         patient.mrn,
        dateOfBirth: patient.dateOfBirth,
      },
      doctor: {
        fullName:  doctor.user.fullName,
        specialty: doctor.specialty.name,
      },
      drug: {
        name:           drug.name,
        strength:       drug.strength,
        form:           drug.form,
        unitPriceCents: drug.unitPriceCents,
      },
      quantity:  input.quantity,
      dosage:   input.dosage,
      totalCents,
      copayCents,
      insuredCents,
      insuranceCarrier: patient.insurance?.carrier ?? null,
    };
  });
}

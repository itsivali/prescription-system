import type { Role } from '@prisma/client';
import { prisma } from '../db';
import { Forbidden, NotFound } from '../http/errors';

type Actor = { id: string; role: Role; email: string };

export async function requireDoctorProfileId(userId: string): Promise<string> {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!doctor) throw Forbidden('not_a_doctor');
  return doctor.id;
}

/**
 * Enforces patient-level object access.
 * - ADMIN: any patient
 * - DOCTOR: patients linked to this doctor's encounters/prescriptions
 * - PHARMACIST: patients linked to this pharmacist's dispensations
 */
export async function assertCanAccessPatient(actor: Actor, patientId: string): Promise<void> {
  if (actor.role === 'ADMIN') return;

  if (actor.role === 'DOCTOR') {
    const doctorId = await requireDoctorProfileId(actor.id);
    const linked = await prisma.patient.findFirst({
      where: {
        id: patientId,
        OR: [
          { encounters: { some: { doctorId } } },
          { prescriptions: { some: { doctorId } } },
        ],
      },
      select: { id: true },
    });
    if (linked) return;
    throw NotFound();
  }

  const linked = await prisma.patient.findFirst({
    where: {
      id: patientId,
      prescriptions: {
        some: {
          dispensation: {
            pharmacistId: actor.id,
          },
        },
      },
    },
    select: { id: true },
  });
  if (linked) return;
  throw NotFound();
}

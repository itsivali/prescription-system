import { prisma } from '../db';

export type CanPrescribeInput = {
  doctorId: string;
  patientId: string;
  drugId: string;
  /** Pass `new Date()` in production; injectable for deterministic tests. */
  now?: Date;
};

export type CanPrescribeResult =
  | { allowed: true }
  | { allowed: false; reason: 'NOT_ON_SHIFT' | 'NO_RECENT_ENCOUNTER' | 'SPECIALTY_NOT_AUTHORIZED' | 'DOCTOR_NOT_FOUND' | 'DRUG_NOT_FOUND' };

const ENCOUNTER_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Authorization gate for prescription creation. Three independent checks:
 *   (1) Doctor is currently on an active shift.
 *   (2) Doctor had a logged Encounter with this patient within the last 48h.
 *   (3) Doctor's specialty is authorized to prescribe this drug's class.
 *
 * All checks run in a single round-trip via Prisma's transactional client to
 * avoid TOCTOU windows where a shift could end mid-evaluation.
 */
export async function canPrescribe(input: CanPrescribeInput): Promise<CanPrescribeResult> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - ENCOUNTER_WINDOW_MS);

  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: {
        id: true,
        shiftStartedAt: true,
        shiftEndsAt: true,
        specialtyId: true,
      },
    });
    if (!doctor) return { allowed: false, reason: 'DOCTOR_NOT_FOUND' };

    // (1) Active shift?
    const onShift =
      doctor.shiftStartedAt !== null &&
      doctor.shiftEndsAt !== null &&
      doctor.shiftStartedAt <= now &&
      doctor.shiftEndsAt > now;
    if (!onShift) return { allowed: false, reason: 'NOT_ON_SHIFT' };

    // (2) Recent encounter?
    const recentEncounter = await tx.encounter.findFirst({
      where: {
        doctorId: input.doctorId,
        patientId: input.patientId,
        startedAt: { gte: windowStart },
      },
      select: { id: true },
    });
    if (!recentEncounter) return { allowed: false, reason: 'NO_RECENT_ENCOUNTER' };

    // (3) Specialty authorized for the drug's class?
    const drug = await tx.drug.findUnique({
      where: { id: input.drugId },
      select: { drugClassId: true },
    });
    if (!drug) return { allowed: false, reason: 'DRUG_NOT_FOUND' };

    const authorized = await tx.specialtyDrugClass.findUnique({
      where: {
        specialtyId_drugClassId: {
          specialtyId: doctor.specialtyId,
          drugClassId: drug.drugClassId,
        },
      },
      select: { specialtyId: true },
    });
    if (!authorized) return { allowed: false, reason: 'SPECIALTY_NOT_AUTHORIZED' };

    return { allowed: true };
  });
}

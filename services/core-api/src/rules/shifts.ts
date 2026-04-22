import { prisma } from '../db';
import { Forbidden, Conflict, NotFound } from '../http/errors';

const MAX_SHIFT_HOURS = 12;

/**
 * Clock the doctor in for the given duration (default 8h). Rejects if the
 * doctor is already on shift, or if duration exceeds policy.
 */
export async function clockIn(userId: string, durationHours = 8): Promise<{
  shiftStartedAt: Date;
  shiftEndsAt: Date;
}> {
  if (durationHours <= 0 || durationHours > MAX_SHIFT_HOURS) {
    throw Forbidden('shift_too_long');
  }

  const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!doctor) throw NotFound('doctor_profile_not_found');

  const now = new Date();
  if (doctor.shiftStartedAt && doctor.shiftEndsAt && doctor.shiftEndsAt > now) {
    throw Conflict('already_on_shift');
  }

  const shiftStartedAt = now;
  const shiftEndsAt    = new Date(now.getTime() + durationHours * 3600_000);

  await prisma.$transaction([
    prisma.doctorProfile.update({
      where: { id: doctor.id },
      data:  { shiftStartedAt, shiftEndsAt },
    }),
    prisma.auditLog.create({
      data: {
        actorId: userId, actorRole: 'DOCTOR',
        action: 'SHIFT_CLOCK_IN', entity: 'DoctorProfile', entityId: doctor.id,
        payload: { shiftStartedAt, shiftEndsAt },
      },
    }),
  ]);

  return { shiftStartedAt, shiftEndsAt };
}

export async function clockOut(userId: string): Promise<void> {
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!doctor) throw NotFound('doctor_profile_not_found');
  if (!doctor.shiftStartedAt) throw Conflict('not_on_shift');

  await prisma.$transaction([
    prisma.doctorProfile.update({
      where: { id: doctor.id },
      data:  { shiftEndsAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: userId, actorRole: 'DOCTOR',
        action: 'SHIFT_CLOCK_OUT', entity: 'DoctorProfile', entityId: doctor.id,
        payload: {},
      },
    }),
  ]);
}

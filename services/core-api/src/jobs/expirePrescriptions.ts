import { prisma } from '../db';
import { logger } from '../logger';

/**
 * Sweeps PENDING prescriptions whose expiresAt has passed and flips them to
 * EXPIRED. Idempotent. Safe to run on multiple instances simultaneously
 * (updateMany is atomic).
 */
export async function sweepExpiredPrescriptions(): Promise<number> {
  const result = await prisma.prescription.updateMany({
    where:  { status: 'PENDING', expiresAt: { lt: new Date() } },
    data:   { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    logger.info({ count: result.count }, 'expired pending prescriptions swept');
  }
  return result.count;
}

/** Start a setInterval-based sweeper. Returns a stop() handle. */
export function startExpiryJob(intervalMs = 5 * 60_000): () => void {
  const id = setInterval(() => {
    sweepExpiredPrescriptions().catch((err) => logger.error({ err }, 'expiry sweep failed'));
  }, intervalMs);
  // First run on next tick.
  setImmediate(() => sweepExpiredPrescriptions().catch(() => undefined));
  return () => clearInterval(id);
}

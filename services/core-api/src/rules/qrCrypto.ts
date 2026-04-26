import { createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../env';

const TTL_SEC = 24 * 60 * 60; // prescriptions expire in 24h

/**
 * Generate a SHA-256 prescription hash and a cryptographic nonce.
 * The hash is displayed on the prescription invoice for the patient to
 * present at the pharmacy. The pharmacist enters the hash to look up and
 * validate the prescription.
 */
export function generatePrescriptionHash(payload: {
  rxId: string;
  patientId: string;
  drugId: string;
  quantity: number;
}): {
  prescriptionHash: string;
  nonce: string;
  expiresAt: Date;
} {
  const nonce = randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_SEC * 1000);

  const body = `${payload.rxId}|${payload.patientId}|${payload.drugId}|${payload.quantity}|${nonce}|${expiresAt.getTime()}`;
  const prescriptionHash = createHash('sha256').update(body).digest('hex');

  return { prescriptionHash, nonce, expiresAt };
}

/**
 * Patient-facing pickup code:
 *  - easy to read/say (3 groups of 4 chars)
 *  - derived from secure hash + server secret
 *  - does not expose full hash
 */
export function toPatientPickupCode(prescriptionHash: string): string {
  const normalized = prescriptionHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('invalid_prescription_hash');

  const prefix = normalized.slice(0, 4).toUpperCase();
  const suffix = normalized.slice(-4).toUpperCase();
  const check = createHmac('sha256', env.SESSION_SECRET)
    .update(normalized)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();

  return `${prefix}-${check}-${suffix}`;
}

export function normalizePickupCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function looksLikeFullPrescriptionHash(input: string): boolean {
  return /^[a-f0-9]{64}$/i.test(input.trim());
}

export function looksLikePickupCode(input: string): boolean {
  return /^[A-Za-z0-9\-]{8,16}$/.test(input.trim());
}

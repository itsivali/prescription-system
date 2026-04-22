import { createHash, randomBytes } from 'node:crypto';

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

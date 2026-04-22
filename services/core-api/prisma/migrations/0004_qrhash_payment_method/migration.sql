-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MPESA');

-- AlterTable: add qrHash as nullable first, backfill, then make NOT NULL
ALTER TABLE "Prescription" ADD COLUMN "qrHash" TEXT;

-- Backfill existing rows: generate a unique hash per row from id + nonce
UPDATE "Prescription"
SET "qrHash" = encode(sha256(convert_to(id || '|' || nonce, 'UTF8')), 'hex')
WHERE "qrHash" IS NULL;

-- Now enforce NOT NULL and add unique constraint
ALTER TABLE "Prescription" ALTER COLUMN "qrHash" SET NOT NULL;
CREATE UNIQUE INDEX "Prescription_qrHash_key" ON "Prescription"("qrHash");

-- AlterTable: add paymentMethod to LedgerTransaction
ALTER TABLE "LedgerTransaction" ADD COLUMN "paymentMethod" "PaymentMethod";

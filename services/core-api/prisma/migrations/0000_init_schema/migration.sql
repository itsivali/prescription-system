-- Initial relational schema for Hospital CRM.

CREATE TYPE "Role" AS ENUM ('DOCTOR', 'PHARMACIST', 'ADMIN');
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'VOID', 'EXPIRED');
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'WRITTEN_OFF');
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedTo" TEXT,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Specialty" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoctorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "licenseNo" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "shiftStartedAt" TIMESTAMP(3),
  "shiftEndsAt" TIMESTAMP(3),
  CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurancePolicy" (
  "id" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "memberNumber" TEXT NOT NULL,
  "coveragePercent" INTEGER NOT NULL,
  CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Patient" (
  "id" TEXT NOT NULL,
  "mrn" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "insuranceId" TEXT,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Encounter" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrugClass" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "DrugClass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialtyDrugClass" (
  "specialtyId" TEXT NOT NULL,
  "drugClassId" TEXT NOT NULL,
  CONSTRAINT "SpecialtyDrugClass_pkey" PRIMARY KEY ("specialtyId", "drugClassId")
);

CREATE TABLE "Drug" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ndcCode" TEXT NOT NULL,
  "form" TEXT NOT NULL,
  "strength" TEXT NOT NULL,
  "drugClassId" TEXT NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrugBatch" (
  "id" TEXT NOT NULL,
  "drugId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "supplier" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "quantityOnHand" INTEGER NOT NULL,
  "initialQuantity" INTEGER NOT NULL,
  CONSTRAINT "DrugBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Prescription" (
  "id" TEXT NOT NULL,
  "encounterId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "drugId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "dosage" TEXT NOT NULL,
  "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
  "nonce" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "fulfilledAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dispensation" (
  "id" TEXT NOT NULL,
  "prescriptionId" TEXT NOT NULL,
  "pharmacistId" TEXT NOT NULL,
  "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dispensation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DispensationLine" (
  "id" TEXT NOT NULL,
  "dispensationId" TEXT NOT NULL,
  "drugBatchId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "DispensationLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "dispensationId" TEXT,
  "totalCents" INTEGER NOT NULL,
  "copayCents" INTEGER NOT NULL,
  "insuredCents" INTEGER NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceClaim" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerTransaction" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "direction" TEXT NOT NULL,
  "memo" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prevHash" TEXT,
  "hash" TEXT NOT NULL,
  CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" BIGSERIAL NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

CREATE UNIQUE INDEX "Specialty_code_key" ON "Specialty"("code");

CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");
CREATE UNIQUE INDEX "DoctorProfile_licenseNo_key" ON "DoctorProfile"("licenseNo");
CREATE INDEX "DoctorProfile_shiftEndsAt_idx" ON "DoctorProfile"("shiftEndsAt");

CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

CREATE INDEX "Encounter_doctorId_patientId_startedAt_idx" ON "Encounter"("doctorId", "patientId", "startedAt");

CREATE UNIQUE INDEX "DrugClass_code_key" ON "DrugClass"("code");

CREATE UNIQUE INDEX "Drug_ndcCode_key" ON "Drug"("ndcCode");

CREATE INDEX "DrugBatch_drugId_expiresAt_idx" ON "DrugBatch"("drugId", "expiresAt");
CREATE UNIQUE INDEX "DrugBatch_drugId_lotNumber_key" ON "DrugBatch"("drugId", "lotNumber");

CREATE UNIQUE INDEX "Prescription_nonce_key" ON "Prescription"("nonce");
CREATE INDEX "Prescription_patientId_status_idx" ON "Prescription"("patientId", "status");
CREATE INDEX "Prescription_doctorId_signedAt_idx" ON "Prescription"("doctorId", "signedAt");

CREATE UNIQUE INDEX "Dispensation_prescriptionId_key" ON "Dispensation"("prescriptionId");

CREATE UNIQUE INDEX "Invoice_dispensationId_key" ON "Invoice"("dispensationId");

CREATE UNIQUE INDEX "InsuranceClaim_invoiceId_key" ON "InsuranceClaim"("invoiceId");

CREATE UNIQUE INDEX "LedgerTransaction_hash_key" ON "LedgerTransaction"("hash");
CREATE INDEX "LedgerTransaction_invoiceId_occurredAt_idx" ON "LedgerTransaction"("invoiceId", "occurredAt");

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Specialty"
  ADD CONSTRAINT "Specialty_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoctorProfile"
  ADD CONSTRAINT "DoctorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorProfile"
  ADD CONSTRAINT "DoctorProfile_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorProfile"
  ADD CONSTRAINT "DoctorProfile_specialtyId_fkey"
  FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_insuranceId_fkey"
  FOREIGN KEY ("insuranceId") REFERENCES "InsurancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Encounter"
  ADD CONSTRAINT "Encounter_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Encounter"
  ADD CONSTRAINT "Encounter_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SpecialtyDrugClass"
  ADD CONSTRAINT "SpecialtyDrugClass_specialtyId_fkey"
  FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialtyDrugClass"
  ADD CONSTRAINT "SpecialtyDrugClass_drugClassId_fkey"
  FOREIGN KEY ("drugClassId") REFERENCES "DrugClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Drug"
  ADD CONSTRAINT "Drug_drugClassId_fkey"
  FOREIGN KEY ("drugClassId") REFERENCES "DrugClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DrugBatch"
  ADD CONSTRAINT "DrugBatch_drugId_fkey"
  FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_drugId_fkey"
  FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispensation"
  ADD CONSTRAINT "Dispensation_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispensation"
  ADD CONSTRAINT "Dispensation_pharmacistId_fkey"
  FOREIGN KEY ("pharmacistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DispensationLine"
  ADD CONSTRAINT "DispensationLine_dispensationId_fkey"
  FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispensationLine"
  ADD CONSTRAINT "DispensationLine_drugBatchId_fkey"
  FOREIGN KEY ("drugBatchId") REFERENCES "DrugBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_dispensationId_fkey"
  FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InsuranceClaim"
  ADD CONSTRAINT "InsuranceClaim_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim"
  ADD CONSTRAINT "InsuranceClaim_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerTransaction"
  ADD CONSTRAINT "LedgerTransaction_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });

function ledgerHash(
  prevHash: string | null,
  invoiceId: string,
  amountCents: number,
  direction: 'DEBIT' | 'CREDIT',
  memo: string,
  occurredAt: Date,
): string {
  return createHash('sha256')
    .update(`${prevHash ?? ''}|${invoiceId}|${amountCents}|${direction}|${memo}|${occurredAt.getTime()}`)
    .digest('hex');
}

async function main() {
  const [cardiology, internalMed] = await Promise.all([
    prisma.department.upsert({ where: { name: 'Cardiology' }, update: {}, create: { name: 'Cardiology' } }),
    prisma.department.upsert({ where: { name: 'Internal Medicine' }, update: {}, create: { name: 'Internal Medicine' } }),
  ]);

  const [cardioSpec, imSpec] = await Promise.all([
    prisma.specialty.upsert({
      where: { code: 'CARDIO' },
      update: { name: 'Cardiologist', departmentId: cardiology.id },
      create: { code: 'CARDIO', name: 'Cardiologist', departmentId: cardiology.id },
    }),
    prisma.specialty.upsert({
      where: { code: 'INTERNAL_MED' },
      update: { name: 'Internal Medicine', departmentId: internalMed.id },
      create: { code: 'INTERNAL_MED', name: 'Internal Medicine', departmentId: internalMed.id },
    }),
  ]);

  const [cardiacClass, antibioticClass] = await Promise.all([
    prisma.drugClass.upsert({ where: { code: 'CARDIAC' }, update: { name: 'Cardiac' }, create: { code: 'CARDIAC', name: 'Cardiac' } }),
    prisma.drugClass.upsert({ where: { code: 'ANTIBIOTIC' }, update: { name: 'Antibiotic' }, create: { code: 'ANTIBIOTIC', name: 'Antibiotic' } }),
  ]);

  await Promise.all([
    prisma.specialtyDrugClass.upsert({
      where: { specialtyId_drugClassId: { specialtyId: cardioSpec.id, drugClassId: cardiacClass.id } },
      update: {},
      create: { specialtyId: cardioSpec.id, drugClassId: cardiacClass.id },
    }),
    prisma.specialtyDrugClass.upsert({
      where: { specialtyId_drugClassId: { specialtyId: imSpec.id, drugClassId: antibioticClass.id } },
      update: {},
      create: { specialtyId: imSpec.id, drugClassId: antibioticClass.id },
    }),
  ]);

  const [atorvastatin, amoxicillin] = await Promise.all([
    prisma.drug.upsert({
      where: { ndcCode: '0001-0001-01' },
      update: { name: 'Atorvastatin', unitPriceCents: 250, drugClassId: cardiacClass.id },
      create: {
        name: 'Atorvastatin',
        ndcCode: '0001-0001-01',
        form: 'tablet',
        strength: '20mg',
        drugClassId: cardiacClass.id,
        unitPriceCents: 250,
      },
    }),
    prisma.drug.upsert({
      where: { ndcCode: '0002-0001-01' },
      update: { name: 'Amoxicillin', unitPriceCents: 180, drugClassId: antibioticClass.id },
      create: {
        name: 'Amoxicillin',
        ndcCode: '0002-0001-01',
        form: 'capsule',
        strength: '500mg',
        drugClassId: antibioticClass.id,
        unitPriceCents: 180,
      },
    }),
  ]);

  await Promise.all([
    prisma.drugBatch.upsert({
      where: { drugId_lotNumber: { drugId: atorvastatin.id, lotNumber: 'ATORV-A' } },
      update: { quantityOnHand: 100, initialQuantity: 100 },
      create: {
        drugId: atorvastatin.id,
        lotNumber: 'ATORV-A',
        supplier: 'PharmaCo',
        expiresAt: new Date(Date.now() + 90 * 24 * 3600_000),
        quantityOnHand: 100,
        initialQuantity: 100,
      },
    }),
    prisma.drugBatch.upsert({
      where: { drugId_lotNumber: { drugId: atorvastatin.id, lotNumber: 'ATORV-B' } },
      update: { quantityOnHand: 200, initialQuantity: 200 },
      create: {
        drugId: atorvastatin.id,
        lotNumber: 'ATORV-B',
        supplier: 'PharmaCo',
        expiresAt: new Date(Date.now() + 180 * 24 * 3600_000),
        quantityOnHand: 200,
        initialQuantity: 200,
      },
    }),
    prisma.drugBatch.upsert({
      where: { drugId_lotNumber: { drugId: amoxicillin.id, lotNumber: 'AMOX-A' } },
      update: { quantityOnHand: 180, initialQuantity: 180 },
      create: {
        drugId: amoxicillin.id,
        lotNumber: 'AMOX-A',
        supplier: 'MediSupply',
        expiresAt: new Date(Date.now() + 120 * 24 * 3600_000),
        quantityOnHand: 180,
        initialQuantity: 180,
      },
    }),
  ]);

  const [policy80, policy60] = await Promise.all([
    prisma.insurancePolicy.upsert({
      where: { id: 'seed-policy-80' },
      update: { carrier: 'NHIF/SHA', memberNumber: 'SHA-2024-001', coveragePercent: 80 },
      create: { id: 'seed-policy-80', carrier: 'NHIF/SHA', memberNumber: 'SHA-2024-001', coveragePercent: 80 },
    }),
    prisma.insurancePolicy.upsert({
      where: { id: 'seed-policy-60' },
      update: { carrier: 'Jubilee Insurance', memberNumber: 'JUB-KE-5543', coveragePercent: 60 },
      create: { id: 'seed-policy-60', carrier: 'Jubilee Insurance', memberNumber: 'JUB-KE-5543', coveragePercent: 60 },
    }),
  ]);

  const [admin, pharmacist, cardioDoctorUser, imDoctorUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@hospital.local' },
      update: { fullName: 'Admin User', role: 'ADMIN', isActive: true },
      create: {
        email: 'admin@hospital.local',
        fullName: 'Admin User',
        role: 'ADMIN',
        passwordHash: await hashPassword('AdminPass123!'),
      },
    }),
    prisma.user.upsert({
      where: { email: 'pharm@hospital.local' },
      update: { fullName: 'Pat Pharmacist', role: 'PHARMACIST', isActive: true },
      create: {
        email: 'pharm@hospital.local',
        fullName: 'Pat Pharmacist',
        role: 'PHARMACIST',
        passwordHash: await hashPassword('PharmPass123!'),
      },
    }),
    prisma.user.upsert({
      where: { email: 'ada@hospital.local' },
      update: { fullName: 'Dr. Ada Cardio', role: 'DOCTOR', isActive: true },
      create: {
        email: 'ada@hospital.local',
        fullName: 'Dr. Ada Cardio',
        role: 'DOCTOR',
        passwordHash: await hashPassword('DoctorPass123!'),
      },
    }),
    prisma.user.upsert({
      where: { email: 'linus@hospital.local' },
      update: { fullName: 'Dr. Linus Med', role: 'DOCTOR', isActive: true },
      create: {
        email: 'linus@hospital.local',
        fullName: 'Dr. Linus Med',
        role: 'DOCTOR',
        passwordHash: await hashPassword('DoctorPass123!'),
      },
    }),
  ]);

  const now = new Date();
  const [cardioDoctor, imDoctor] = await Promise.all([
    prisma.doctorProfile.upsert({
      where: { userId: cardioDoctorUser.id },
      update: {
        licenseNo: 'LIC-001',
        departmentId: cardiology.id,
        specialtyId: cardioSpec.id,
        shiftStartedAt: new Date(now.getTime() - 2 * 3600_000),
        shiftEndsAt: new Date(now.getTime() + 6 * 3600_000),
      },
      create: {
        userId: cardioDoctorUser.id,
        licenseNo: 'LIC-001',
        departmentId: cardiology.id,
        specialtyId: cardioSpec.id,
        shiftStartedAt: new Date(now.getTime() - 2 * 3600_000),
        shiftEndsAt: new Date(now.getTime() + 6 * 3600_000),
      },
    }),
    prisma.doctorProfile.upsert({
      where: { userId: imDoctorUser.id },
      update: {
        licenseNo: 'LIC-002',
        departmentId: internalMed.id,
        specialtyId: imSpec.id,
        shiftStartedAt: new Date(now.getTime() - 1 * 3600_000),
        shiftEndsAt: new Date(now.getTime() + 8 * 3600_000),
      },
      create: {
        userId: imDoctorUser.id,
        licenseNo: 'LIC-002',
        departmentId: internalMed.id,
        specialtyId: imSpec.id,
        shiftStartedAt: new Date(now.getTime() - 1 * 3600_000),
        shiftEndsAt: new Date(now.getTime() + 8 * 3600_000),
      },
    }),
  ]);

  const [patientOne, patientTwo, patientThree] = await Promise.all([
    prisma.patient.upsert({
      where: { mrn: 'MRN-0001' },
      update: { fullName: 'Pat Patient', insuranceId: policy80.id },
      create: {
        mrn: 'MRN-0001',
        fullName: 'Pat Patient',
        dateOfBirth: new Date('1970-05-04'),
        insuranceId: policy80.id,
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-0002' },
      update: { fullName: 'Ira Insured', insuranceId: policy60.id },
      create: {
        mrn: 'MRN-0002',
        fullName: 'Ira Insured',
        dateOfBirth: new Date('1988-10-17'),
        insuranceId: policy60.id,
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-0003' },
      update: { fullName: 'Casey Cash', insuranceId: null },
      create: {
        mrn: 'MRN-0003',
        fullName: 'Casey Cash',
        dateOfBirth: new Date('1995-02-11'),
      },
    }),
  ]);

  async function ensureEncounter(doctorId: string, patientId: string, notes: string, minutesAgo: number) {
    const recent = await prisma.encounter.findFirst({
      where: {
        doctorId,
        patientId,
        startedAt: { gte: new Date(now.getTime() - 24 * 3600_000) },
      },
    });
    if (recent) return recent;
    return prisma.encounter.create({
      data: {
        doctorId,
        patientId,
        notes,
        startedAt: new Date(now.getTime() - minutesAgo * 60_000),
      },
    });
  }

  const [encounterOne, encounterTwo, encounterThree] = await Promise.all([
    ensureEncounter(cardioDoctor.id, patientOne.id, 'Cardiology follow-up for lipid management (seed)', 35),
    ensureEncounter(imDoctor.id, patientTwo.id, 'Upper respiratory evaluation (seed)', 45),
    ensureEncounter(imDoctor.id, patientThree.id, 'General medicine intake (seed)', 55),
  ]);

  const pendingNonce = 'seed-rx-pending-nonce';
  const existingPending = await prisma.prescription.findUnique({ where: { nonce: pendingNonce } });
  if (!existingPending) {
    await prisma.prescription.create({
      data: {
        encounterId: encounterOne.id,
        patientId: patientOne.id,
        doctorId: cardioDoctor.id,
        drugId: atorvastatin.id,
        quantity: 30,
        dosage: 'Take 1 tablet by mouth nightly (seed pending)',
        nonce: pendingNonce,
        qrHash: createHash('sha256').update(`seed-pending-qr-hash`).digest('hex'),
        expiresAt: new Date(now.getTime() + 24 * 3600_000),
      },
    });
  }

  const expiredNonce = 'seed-rx-expired-nonce';
  const existingExpired = await prisma.prescription.findUnique({ where: { nonce: expiredNonce } });
  if (!existingExpired) {
    await prisma.prescription.create({
      data: {
        encounterId: encounterThree.id,
        patientId: patientThree.id,
        doctorId: imDoctor.id,
        drugId: amoxicillin.id,
        quantity: 14,
        dosage: 'Take 1 capsule twice daily for 7 days (seed expired)',
        status: 'EXPIRED',
        nonce: expiredNonce,
        qrHash: createHash('sha256').update(`seed-expired-qr-hash`).digest('hex'),
        expiresAt: new Date(now.getTime() - 12 * 3600_000),
      },
    });
  }

  const fulfilledNonce = 'seed-rx-fulfilled-nonce';
  const existingFulfilled = await prisma.prescription.findUnique({
    where: { nonce: fulfilledNonce },
    include: { dispensation: { include: { invoice: true } } },
  });

  if (!existingFulfilled) {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.drugBatch.findUnique({
        where: { drugId_lotNumber: { drugId: amoxicillin.id, lotNumber: 'AMOX-A' } },
      });
      if (!batch) throw new Error('seed batch missing');
      if (batch.quantityOnHand < 20) {
        await tx.drugBatch.update({
          where: { id: batch.id },
          data: { quantityOnHand: 180 },
        });
      }

      const rx = await tx.prescription.create({
        data: {
          encounterId: encounterTwo.id,
          patientId: patientTwo.id,
          doctorId: imDoctor.id,
          drugId: amoxicillin.id,
          quantity: 20,
          dosage: 'Take 1 capsule three times daily (seed fulfilled)',
          status: 'FULFILLED',
          nonce: fulfilledNonce,
          qrHash: createHash('sha256').update(`seed-fulfilled-qr-hash`).digest('hex'),
          expiresAt: new Date(now.getTime() + 4 * 3600_000),
          fulfilledAt: now,
        },
      });

      const disp = await tx.dispensation.create({
        data: {
          prescriptionId: rx.id,
          pharmacistId: pharmacist.id,
        },
      });

      await tx.dispensationLine.create({
        data: {
          dispensationId: disp.id,
          drugBatchId: batch.id,
          quantity: 20,
        },
      });

      await tx.drugBatch.update({
        where: { id: batch.id },
        data: { quantityOnHand: { decrement: 20 } },
      });

      const totalCents = 20 * amoxicillin.unitPriceCents;
      const insuredCents = Math.floor(totalCents * policy60.coveragePercent / 100);
      const copayCents = totalCents - insuredCents;

      const invoice = await tx.invoice.create({
        data: {
          patientId: patientTwo.id,
          dispensationId: disp.id,
          totalCents,
          copayCents,
          insuredCents,
          status: 'OPEN',
        },
      });

      await tx.insuranceClaim.create({
        data: {
          invoiceId: invoice.id,
          policyId: policy60.id,
          amountCents: insuredCents,
          status: 'SUBMITTED',
        },
      });

      const t1 = new Date(now.getTime() - 5 * 60_000);
      const t2 = new Date(now.getTime() - 4 * 60_000);
      const h1 = ledgerHash(null, invoice.id, copayCents, 'CREDIT', 'Patient copay billed', t1);
      const h2 = ledgerHash(h1, invoice.id, insuredCents, 'CREDIT', 'Insurance portion billed', t2);

      await tx.ledgerTransaction.create({
        data: {
          invoiceId: invoice.id,
          amountCents: copayCents,
          direction: 'CREDIT',
          memo: 'Patient copay billed',
          occurredAt: t1,
          prevHash: null,
          hash: h1,
        },
      });

      await tx.ledgerTransaction.create({
        data: {
          invoiceId: invoice.id,
          amountCents: insuredCents,
          direction: 'CREDIT',
          memo: 'Insurance portion billed',
          occurredAt: t2,
          prevHash: h1,
          hash: h2,
        },
      });
    }, { maxWait: 30000, timeout: 30000 });
  }

  console.log('--------------------------------------------------------');
  console.log('Seed complete.');
  console.log('  Admin:          admin@hospital.local  / AdminPass123!');
  console.log('  Pharmacist:     pharm@hospital.local  / PharmPass123!');
  console.log('  Doctor (Cardio):ada@hospital.local    / DoctorPass123!');
  console.log('  Doctor (IM):    linus@hospital.local  / DoctorPass123!');
  console.log('  Patients:       MRN-0001, MRN-0002, MRN-0003');
  console.log('  Prescriptions:  1 pending, 1 fulfilled, 1 expired');
  console.log('--------------------------------------------------------');

  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

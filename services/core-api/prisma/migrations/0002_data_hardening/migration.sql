-- Data integrity hardening for clinical + billing sensitive paths.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_policy_coverage_range_chk') THEN
    ALTER TABLE "InsurancePolicy"
      ADD CONSTRAINT insurance_policy_coverage_range_chk
      CHECK ("coveragePercent" >= 0 AND "coveragePercent" <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drug_unit_price_nonnegative_chk') THEN
    ALTER TABLE "Drug"
      ADD CONSTRAINT drug_unit_price_nonnegative_chk
      CHECK ("unitPriceCents" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drug_batch_qty_nonnegative_chk') THEN
    ALTER TABLE "DrugBatch"
      ADD CONSTRAINT drug_batch_qty_nonnegative_chk
      CHECK ("quantityOnHand" >= 0 AND "initialQuantity" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drug_batch_qty_le_initial_chk') THEN
    ALTER TABLE "DrugBatch"
      ADD CONSTRAINT drug_batch_qty_le_initial_chk
      CHECK ("quantityOnHand" <= "initialQuantity");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescription_quantity_positive_chk') THEN
    ALTER TABLE "Prescription"
      ADD CONSTRAINT prescription_quantity_positive_chk
      CHECK ("quantity" > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispensation_line_quantity_positive_chk') THEN
    ALTER TABLE "DispensationLine"
      ADD CONSTRAINT dispensation_line_quantity_positive_chk
      CHECK ("quantity" > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_amounts_nonnegative_chk') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT invoice_amounts_nonnegative_chk
      CHECK ("totalCents" >= 0 AND "copayCents" >= 0 AND "insuredCents" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_amounts_match_total_chk') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT invoice_amounts_match_total_chk
      CHECK ("copayCents" + "insuredCents" = "totalCents");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claim_amount_nonnegative_chk') THEN
    ALTER TABLE "InsuranceClaim"
      ADD CONSTRAINT insurance_claim_amount_nonnegative_chk
      CHECK ("amountCents" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_amount_positive_chk') THEN
    ALTER TABLE "LedgerTransaction"
      ADD CONSTRAINT ledger_amount_positive_chk
      CHECK ("amountCents" > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_direction_enum_chk') THEN
    ALTER TABLE "LedgerTransaction"
      ADD CONSTRAINT ledger_direction_enum_chk
      CHECK ("direction" IN ('DEBIT', 'CREDIT'));
  END IF;
END $$;

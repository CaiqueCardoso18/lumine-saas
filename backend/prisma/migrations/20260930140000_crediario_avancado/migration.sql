-- Frequência de vencimento das parcelas
CREATE TYPE "InstallmentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- Entrada paga na hora e cadência das parcelas
ALTER TABLE "sales" ADD COLUMN "down_payment" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN "installment_frequency" "InstallmentFrequency";

-- Vendas antigas no crediário eram sempre mensais
UPDATE "sales" SET "installment_frequency" = 'MONTHLY'
WHERE "installment_frequency" IS NULL
  AND "id" IN (SELECT DISTINCT "sale_id" FROM "installments");

-- Rastro da renegociação: a parcela antiga aponta para a nova
ALTER TABLE "installments" ADD COLUMN "renegotiated_into_id" TEXT;
CREATE INDEX "installments_renegotiated_into_id_idx" ON "installments"("renegotiated_into_id");

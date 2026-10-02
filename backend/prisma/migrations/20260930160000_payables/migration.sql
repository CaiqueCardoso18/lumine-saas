-- Contas a pagar da loja (aluguel, fornecedor, energia...)
CREATE TYPE "PayableStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "supplier_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payables_due_date_idx" ON "payables"("due_date");
CREATE INDEX "payables_status_idx" ON "payables"("status");

ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

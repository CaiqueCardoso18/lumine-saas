-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "search_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(10,2),
    "paid_method" "PaymentMethod",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "customer_id" TEXT;

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");
CREATE INDEX "customers_search_text_idx" ON "customers"("search_text");
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");
CREATE INDEX "installments_customer_id_idx" ON "installments"("customer_id");
CREATE INDEX "installments_status_idx" ON "installments"("status");
CREATE INDEX "installments_due_date_idx" ON "installments"("due_date");
CREATE INDEX "installments_sale_id_idx" ON "installments"("sale_id");
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "installments" ADD CONSTRAINT "installments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installments" ADD CONSTRAINT "installments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "sale_payments" ADD COLUMN     "installments" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '[]';

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ADULTO', 'INFANTIL');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "audience" "Audience";

-- CreateIndex
CREATE INDEX "products_audience_idx" ON "products"("audience");

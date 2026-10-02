-- Tabela de taxas da maquininha (por forma e nº de parcelas)
CREATE TABLE "card_fees" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "fee_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_fees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_fees_method_installments_key" ON "card_fees"("method", "installments");

-- Taxa e valor líquido por forma de pagamento
ALTER TABLE "sale_payments" ADD COLUMN "fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "sale_payments" ADD COLUMN "fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "sale_payments" ADD COLUMN "net_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Totais na venda
ALTER TABLE "sales" ADD COLUMN "fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN "net_total" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Vendas antigas: sem taxa registrada, o líquido é o próprio total
UPDATE "sales" SET "net_total" = "total" WHERE "net_total" = 0;
UPDATE "sale_payments" SET "net_amount" = "amount" WHERE "net_amount" = 0;

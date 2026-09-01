-- AlterTable
ALTER TABLE "products" ADD COLUMN "search_text" TEXT;

-- Backfill dos produtos existentes, incluindo o nome da categoria.
-- translate() remove os acentos do pt-BR sem precisar da extensão unaccent,
-- mantendo a migration executável em qualquer instância.
UPDATE "products" p
SET "search_text" = translate(
  lower(
    concat_ws(' ',
      p."sku",
      p."name",
      p."brand",
      p."size",
      p."color",
      p."barcode",
      p."short_description",
      c."name",
      CASE p."audience"
        WHEN 'ADULTO' THEN 'adulto'
        WHEN 'INFANTIL' THEN 'infantil crianca'
        ELSE NULL
      END
    )
  ),
  'áàâãäéèêëíìîïóòôõöúùûüç',
  'aaaaaeeeeiiiiooooouuuuc'
)
FROM "categories" c
WHERE c."id" = p."category_id";

-- CreateIndex
CREATE INDEX "products_search_text_idx" ON "products"("search_text");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

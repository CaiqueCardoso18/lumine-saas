/**
 * Helpers de normalização e agregação para o import de planilhas.
 *
 * Contexto: na Lumine uma linha da planilha representa uma VARIANTE
 * (mesmo modelo, tamanho e cor diferentes). O SKU da planilha identifica
 * o modelo, não a variante — então geramos um SKU composto por variante.
 */

/** Remove acentos e normaliza caixa/espaços. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza para comparação de categoria, ignorando singular/plural.
 * "Sapatilha" e "Sapatilhas" viram a mesma chave.
 */
export function categoryKey(text: string): string {
  return normalize(text).replace(/s$/, '');
}

/**
 * Interpreta a coluna "publico" da planilha.
 * Aceita as variações que a loja costuma digitar e devolve o enum do banco.
 * Qualquer coisa não reconhecida vira undefined (campo fica vazio).
 */
export function parseAudience(value?: string | number | null): 'ADULTO' | 'INFANTIL' | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  const key = normalize(String(value));
  if (!key) return undefined;

  const adulto = ['adulto', 'adulta', 'adultos', 'adl', 'adt', 'a'];
  const infantil = ['infantil', 'infanto', 'inf', 'crianca', 'criancas', 'kids', 'kid', 'baby', 'bebe', 'i'];

  if (adulto.includes(key)) return 'ADULTO';
  if (infantil.includes(key)) return 'INFANTIL';

  // fallback por prefixo, pega "infantil feminino", "adulto unissex" etc
  if (key.startsWith('adult')) return 'ADULTO';
  if (key.startsWith('infan') || key.startsWith('crian') || key.startsWith('kid')) return 'INFANTIL';

  return undefined;
}

/** Converte um pedaço do SKU composto: "Rosa EUA" -> "ROSAEUA" */
function skuPart(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]/g, '')
    .toUpperCase();
}

/**
 * Monta o SKU composto de uma variante.
 * Ex: ("400", "38", "Rosa EUA") -> "400-38-ROSAEUA"
 * Partes vazias são omitidas: ("400", "", "") -> "400"
 */
export function buildVariantSku(sku: string, size?: string, color?: string): string {
  const parts = [sku.trim()];
  if (size && String(size).trim()) parts.push(skuPart(String(size)));
  if (color && String(color).trim()) parts.push(skuPart(String(color)));
  return parts.join('-');
}

export interface VariantRow {
  variantSku: string;
  baseSku: string;
  name: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  categoryName?: string;
  brand?: string;
  size?: string;
  color?: string;
  audience?: 'ADULTO' | 'INFANTIL';
  description?: string;
  shortDescription?: string;
  barcode?: string;
  /** Linhas da planilha que foram agrupadas nesta variante (1-indexed, com header) */
  sourceRows: number[];
}

/**
 * Agrupa linhas por variante (sku + tamanho + cor).
 *
 * Linhas repetidas da mesma variante têm a QUANTIDADE SOMADA — é comum a
 * planilha da loja listar o mesmo item em lotes separados. Os demais campos
 * (preço, nome, marca) usam o valor da última linha, que é a mais recente.
 */
export function aggregateVariants<
  T extends {
    sku: string;
    name: string;
    quantity: number;
    salePrice: number;
    costPrice: number;
    categoryName?: string;
    brand?: string;
    size?: string;
    color?: string;
    audience?: 'ADULTO' | 'INFANTIL';
    description?: string;
    shortDescription?: string;
    barcode?: string;
  }
>(rows: Array<{ data: T; rowNumber: number }>): VariantRow[] {
  const map = new Map<string, VariantRow>();

  for (const { data, rowNumber } of rows) {
    const variantSku = buildVariantSku(data.sku, data.size, data.color);
    const existing = map.get(variantSku);

    if (existing) {
      // Mesma variante repetida: soma o estoque, mantém o resto da última linha
      existing.quantity += data.quantity;
      existing.name = data.name;
      existing.salePrice = data.salePrice;
      if (data.costPrice) existing.costPrice = data.costPrice;
      if (data.categoryName) existing.categoryName = data.categoryName;
      if (data.brand) existing.brand = data.brand;
      if (data.audience) existing.audience = data.audience;
      if (data.description) existing.description = data.description;
      if (data.shortDescription) existing.shortDescription = data.shortDescription;
      if (data.barcode) existing.barcode = data.barcode;
      existing.sourceRows.push(rowNumber);
    } else {
      map.set(variantSku, {
        variantSku,
        baseSku: data.sku,
        name: data.name,
        quantity: data.quantity,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        categoryName: data.categoryName,
        brand: data.brand,
        size: data.size,
        color: data.color,
        audience: data.audience,
        description: data.description,
        shortDescription: data.shortDescription,
        barcode: data.barcode,
        sourceRows: [rowNumber],
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Busca de produtos.
 *
 * A busca do PDV precisa funcionar do jeito que a vendedora digita: várias
 * palavras soltas, em qualquer ordem, misturando nome, cor, tamanho e marca —
 * "sapatilha rosa EUA", "brise 38 preto", "capezio infantil".
 *
 * Um `contains` da frase inteira em `name` nunca casa nesses casos, porque cor
 * e tamanho são colunas separadas. A solução é manter um campo `searchText`
 * com tudo junto e normalizado (sem acento, minúsculo) e exigir que CADA termo
 * digitado apareça nele.
 */

/** Minúsculo, sem acento, espaços colapsados. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const AUDIENCE_WORDS: Record<string, string> = {
  ADULTO: 'adulto',
  INFANTIL: 'infantil crianca',
};

export interface SearchableProduct {
  sku?: string | null;
  name?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  shortDescription?: string | null;
  audience?: string | null;
  categoryName?: string | null;
}

/**
 * Monta o conteúdo do campo searchText de um produto.
 * Deve ser chamado em toda criação/atualização de produto (CRUD e import).
 */
export function buildSearchText(p: SearchableProduct): string {
  const parts = [
    p.sku,
    p.name,
    p.brand,
    p.size,
    p.color,
    p.barcode,
    p.shortDescription,
    p.categoryName,
    p.audience ? AUDIENCE_WORDS[p.audience] ?? p.audience : null,
  ].filter((v): v is string => typeof v === 'string' && v.trim() !== '');

  return normalizeText(parts.join(' '));
}

/**
 * Quebra o texto digitado em termos normalizados.
 * "  Sapatilha  Rosa EUA " -> ['sapatilha', 'rosa', 'eua']
 */
export function searchTerms(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter((t) => t.length > 0);
}

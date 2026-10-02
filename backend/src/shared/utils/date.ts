/**
 * Começo do dia de hoje.
 *
 * Os vencimentos são gravados ao MEIO-DIA (para o fuso não virar o dia), então
 * comparar com `new Date()` fazia a parcela que vence hoje virar "atrasada"
 * às 12h01. Atraso só existe a partir do dia seguinte.
 */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

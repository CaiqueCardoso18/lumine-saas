/**
 * Variáveis de ambiente mínimas para os testes.
 *
 * `config/env.ts` derruba o processo quando falta alguma, e qualquer teste que
 * importe `app.ts` passa por lá. Os valores são fictícios de propósito: nenhum
 * teste toca banco de verdade.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/lumine_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'segredo-de-teste-com-mais-de-32-caracteres-ok';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

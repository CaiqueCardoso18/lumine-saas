/**
 * Config em .js de propósito: a versão .ts exigia `ts-node`, que não está
 * nas devDependencies, então `npm test` quebrava antes de rodar o primeiro
 * teste. Os testes em si continuam em TypeScript, via ts-jest.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  // Testes *.integration.test.ts precisam de Postgres rodando e ficam de fora
  // do `npm test`. Rode-os com `npm run test:integration`, com o banco de pé.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Carrega as variáveis de ambiente ANTES dos módulos, senão config/env.ts
  // derruba o processo no import
  setupFiles: ['<rootDir>/../jest.setup.js'],
  clearMocks: true,
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage',
  verbose: true,
};

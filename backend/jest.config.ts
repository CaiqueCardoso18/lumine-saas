import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: [],
  clearMocks: true,
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage',
  verbose: true,
};

export default config;

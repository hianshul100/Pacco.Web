/**
 * Jest + React Testing Library. Tests live in `tests/` mirroring `src/`.
 *
 * Coverage thresholds encode LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5:
 * 100% branch on ErrorMapper, 100% line on SessionStore, >=80% overall for
 * wave-1 client code.
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(png|jpe?g|gif|svg|webp|avif)$': '<rootDir>/tests/__mocks__/fileMock.cjs',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
    'src/session/errorMapper.ts': { branches: 100 },
    'src/session/sessionStore.ts': { lines: 100 },
  },
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
}

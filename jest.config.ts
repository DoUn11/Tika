import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** `@/shared/*` 등 tsconfig 경로 별칭을 Jest에 고정한다. */
const moduleNameMapper = {
  '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
  '^@/server/(.*)$': '<rootDir>/src/server/$1',
  '^@/client/(.*)$': '<rootDir>/src/client/$1',
};

/** 헬퍼는 테스트 파일이 아니라 유틸이므로 수집 대상에서 제외한다. */
const testPathIgnorePatterns = ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/__tests__/helpers/'];

/**
 * 계층별 실행 환경이 다르다 (TEST_CASES.md 2.1).
 * - server: API·서비스 테스트는 Node 환경
 * - client: 컴포넌트·통합 테스트는 jsdom 환경
 */
const config: Config = {
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/.gitkeep',
  ],
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/api/**/*.test.ts', '<rootDir>/__tests__/server/**/*.test.ts'],
      moduleNameMapper,
      testPathIgnorePatterns,
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/client/**/*.test.{ts,tsx}',
        '<rootDir>/__tests__/integration/**/*.test.{ts,tsx}',
      ],
      moduleNameMapper,
      testPathIgnorePatterns,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};

export default createJestConfig(config);

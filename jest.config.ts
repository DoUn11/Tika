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
const testPathIgnorePatterns = [
  '<rootDir>/node_modules/',
  '<rootDir>/.next/',
  '<rootDir>/__tests__/helpers/',
];

/** 테스트 실행 전 .env.test 로드 (로컬 PostgreSQL) */
const setupFiles = ['<rootDir>/jest.env.ts'];

/** API·서비스 테스트 — Node 환경 (TEST_CASES.md 2.1) */
const serverConfig: Config = {
  displayName: 'server',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/api/**/*.test.ts',
    '<rootDir>/__tests__/server/**/*.test.ts',
  ],
  moduleNameMapper,
  testPathIgnorePatterns,
  setupFiles,
  setupFilesAfterEnv: ['<rootDir>/jest.teardown.ts'],
};

/** 컴포넌트·통합 테스트 — jsdom 환경 (TEST_CASES.md 2.1) */
const clientConfig: Config = {
  displayName: 'client',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/__tests__/client/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/integration/**/*.test.{ts,tsx}',
  ],
  moduleNameMapper,
  testPathIgnorePatterns,
  setupFiles,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

/**
 * next/jest는 SWC 트랜스폼을 "자신이 감싼 설정"에만 주입한다.
 * projects 배열 안에 그냥 넣으면 각 project가 트랜스폼 없이 실행되어
 * TypeScript 파일에서 "Cannot use import statement outside a module"이 난다.
 * 따라서 project별로 createJestConfig를 각각 적용한 뒤 합친다.
 */
const config = async (): Promise<Config> => ({
  projects: [await createJestConfig(serverConfig)(), await createJestConfig(clientConfig)()],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', '!**/*.d.ts'],
});

export default config;

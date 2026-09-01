import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * 계층 경계 규칙 (TRD 4.1).
 * src/client/와 src/server/는 서로 import하지 않는다.
 * 문서로만 두지 않고 린트로 강제한다.
 */
const serverFromClient = {
  patterns: [
    {
      group: ['@/server/*', '**/src/server/*'],
      message: 'src/client/는 src/server/를 import할 수 없습니다. src/shared/를 경유하세요 (TRD 4.1).',
    },
  ],
};

const clientFromServer = {
  patterns: [
    {
      group: ['@/client/*', '**/src/client/*'],
      message: 'src/server/와 app/api/는 src/client/를 import할 수 없습니다. src/shared/를 경유하세요 (TRD 4.1).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'drizzle/**', 'next-env.d.ts'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // CLAUDE.md: any 사용 금지
      '@typescript-eslint/no-explicit-any': 'error',
      // CLAUDE.md: console.log 커밋 금지
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // 프론트엔드 → 백엔드 import 차단
  {
    files: ['src/client/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', serverFromClient] },
  },

  // 백엔드 → 프론트엔드 import 차단
  {
    files: ['src/server/**/*.{ts,tsx}', 'app/api/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', clientFromServer] },
  },

  // src/shared/는 런타임 의존성을 갖지 않아야 한다 (TRD 4.1)
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/*', '@/server/*', 'react', 'react-dom', 'next/*', 'drizzle-orm*'],
              message: 'src/shared/는 React·DB 등 런타임 의존성을 가질 수 없습니다 (TRD 4.1).',
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
);

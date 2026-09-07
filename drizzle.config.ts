import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

/**
 * 개발 접속 정보는 .env.local에 둔다 (TRD 5.2).
 * dotenv는 기본으로 .env만 읽으므로 경로를 명시한다.
 */
config({ path: '.env.local' });
config();

/**
 * 마이그레이션은 커넥션 풀러를 우회해야 하므로
 * POSTGRES_URL_NON_POOLING을 사용한다 (TRD 5.2).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? '',
  },
  verbose: true,
  strict: true,
});

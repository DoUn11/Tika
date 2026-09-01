import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * 마이그레이션은 커넥션 풀러를 우회해야 하므로
 * POSTGRES_URL_NON_POOLING을 사용한다 (TRD 5.2).
 *
 * schema.ts는 아직 존재하지 않는다. Green 단계에서 작성한 뒤에야
 * db:generate / db:push가 동작한다.
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

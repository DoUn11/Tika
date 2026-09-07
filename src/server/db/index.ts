import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/server/db/schema';

/**
 * node-postgres 드라이버로 통일한다.
 * 로컬 PostgreSQL과 Neon(Vercel Postgres) 모두 표준 접속 문자열을 쓰므로
 * 환경에 따라 코드가 갈리지 않는다.
 *
 * 연결은 지연 생성한다. 모듈을 불러오는 것만으로 커넥션 설정을 요구하면
 * next build가 Route Handler를 수집하는 단계에서 실패한다.
 */
let poolInstance: Pool | undefined;
let dbInstance: NodePgDatabase<typeof schema> | undefined;

export const getPool = (): Pool => {
  if (!poolInstance) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        'POSTGRES_URL 환경 변수가 필요합니다. .env.test 또는 .env.local을 확인하세요.',
      );
    }
    poolInstance = new Pool({ connectionString });
  }
  return poolInstance;
};

export const getDb = (): NodePgDatabase<typeof schema> => {
  dbInstance ??= drizzle(getPool(), { schema });
  return dbInstance;
};

/** 이미 만들어진 커넥션 풀만 닫는다. 없으면 아무것도 하지 않는다. */
export const closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = undefined;
    dbInstance = undefined;
  }
};

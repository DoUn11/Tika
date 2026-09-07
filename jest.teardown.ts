/**
 * 테스트 종료 후 커넥션 풀을 닫는다.
 * 닫지 않으면 열린 소켓 때문에 Jest 프로세스가 종료되지 않는다.
 */
import { closePool } from '@/server/db';

afterAll(async () => {
  await closePool();
});

import { closePool, getDb } from '@/server/db';
import { tickets, type NewTicketRow } from '@/server/db/schema';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import { today, toDateString } from '@/shared/utils/date';

/** 각 테스트 전 tickets 테이블을 비우고 id 시퀀스를 초기화한다. */
export const resetDatabase = async (): Promise<void> => {
  await getDb().execute('truncate table tickets restart identity cascade');
};

/** 테스트용 티켓을 직접 삽입한다. 검증·비즈니스 로직을 거치지 않는다. */
export const seedTicket = async (overrides: Partial<NewTicketRow> = {}) => {
  const [row] = await getDb()
    .insert(tickets)
    .values({
      title: '테스트 티켓',
      status: TICKET_STATUS.BACKLOG,
      priority: TICKET_PRIORITY.MEDIUM,
      position: 0,
      ...overrides,
    })
    .returning();
  return row!;
};

/** Route Handler에 넘길 POST 요청을 만든다. */
export const jsonRequest = (body: unknown, url = 'http://localhost/api/tickets'): Request =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

/** 오늘 날짜 (YYYY-MM-DD) — 구현과 같은 기준을 쓴다 */
export { today };
/** n일 전 날짜 (YYYY-MM-DD) */
export const daysAgo = (n: number): string => shiftDays(-n);
/** n일 후 날짜 (YYYY-MM-DD) */
export const daysLater = (n: number): string => shiftDays(n);
/** n시간 전 시각 */
export const hoursAgo = (n: number): Date => new Date(Date.now() - n * 60 * 60 * 1000);

/** 모든 테스트 종료 후 커넥션 풀을 닫는다. */
export { closePool };

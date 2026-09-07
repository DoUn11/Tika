/**
 * TC-API-003 · GET /api/tickets/:id — 티켓 상세 조회 (FR-003)
 *
 * 관련 스토리: US-007(할 일 수정) — 카드 클릭 시 상세 모달이 이 API를 쓴다.
 * 명세: docs/API_SPEC.md 5장, docs/REQUIREMENTS.md FR-003
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import { GET } from '../../app/api/tickets/[id]/route';
import { daysAgo, daysLater, hoursAgo, resetDatabase, seedTicket } from '../helpers';

/** Next.js 15의 Route Handler는 params를 Promise로 받는다. */
const call = (id: string | number) =>
  GET(new Request(`http://localhost/api/tickets/${id}`), {
    params: Promise.resolve({ id: String(id) }),
  });

describe('TC-API-003: GET /api/tickets/:id — 티켓 상세 조회', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 003-N1
    it('존재하는 ID로 조회하면 티켓 전체 데이터를 반환한다', async () => {
      const seeded = await seedTicket({
        title: 'API 설계',
        description: '엔드포인트 정의',
        status: TICKET_STATUS.TODO,
        priority: TICKET_PRIORITY.HIGH,
        position: 0,
        dueDate: daysLater(3),
      });

      const res = await call(seeded.id);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(
        expect.objectContaining({
          id: seeded.id,
          title: 'API 설계',
          description: '엔드포인트 정의',
          status: TICKET_STATUS.TODO,
          priority: TICKET_PRIORITY.HIGH,
          position: 0,
          dueDate: daysLater(3),
          startedAt: null,
          completedAt: null,
          isOverdue: false,
        }),
      );
    });

    it('응답에 생성·수정 시각이 포함된다', async () => {
      const seeded = await seedTicket({});

      const body = await (await call(seeded.id)).json();

      expect(Date.parse(body.createdAt)).not.toBeNaN();
      expect(Date.parse(body.updatedAt)).not.toBeNaN();
    });

    it('종료예정일이 지난 미완료 티켓은 isOverdue가 true다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.TODO,
        dueDate: daysAgo(2),
      });

      const body = await (await call(seeded.id)).json();

      expect(body.isOverdue).toBe(true);
    });

    // 003-N2
    it('완료된 지 24시간이 지나 보드에서 감춰진 티켓도 조회된다', async () => {
      // GET /api/tickets(보드)에서는 제외되지만 상세 조회는 계속 가능해야 한다
      const seeded = await seedTicket({
        title: '오래된 완료',
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(72),
      });

      const res = await call(seeded.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('오래된 완료');
      expect(body.status).toBe(TICKET_STATUS.DONE);
    });
  });

  describe('예외 케이스', () => {
    // 003-E1
    it('존재하지 않는 ID면 404와 안내 메시지를 반환한다', async () => {
      const res = await call(999999);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('티켓을 찾을 수 없습니다');
    });

    it('삭제된 티켓의 ID로 조회하면 404를 반환한다', async () => {
      const seeded = await seedTicket({});
      await resetDatabase();

      const res = await call(seeded.id);

      expect(res.status).toBe(404);
    });

    // 003-E2
    it.each([
      ['문자열', 'abc'],
      ['빈 문자열에 가까운 값', '-'],
      ['소수', '1.5'],
    ])('숫자가 아닌 ID(%s)면 400 또는 404를 반환한다', async (_label, id) => {
      const res = await call(id);

      expect([400, 404]).toContain(res.status);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('음수 ID면 404를 반환한다', async () => {
      const res = await call(-1);

      expect([400, 404]).toContain(res.status);
    });
  });
});

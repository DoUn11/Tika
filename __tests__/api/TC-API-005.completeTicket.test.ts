/**
 * TC-API-005 · PATCH /api/tickets/:id/complete — 완료 처리 (FR-005)
 *
 * 관련 스토리: US-006(할 일 완료 처리)
 * 명세: docs/API_SPEC.md 7장, docs/REQUIREMENTS.md FR-005
 *
 * 요청 본문이 없다. 이 엔드포인트는 완료 처리 한 가지만 수행한다.
 * 완료 해제(Done → 다른 칼럼)는 이동 대상이 DONE이 아니므로
 * /reorder의 관할이며 TC-API-007이 다룬다 (API_SPEC 13.1).
 */
import { TICKET_STATUS } from '@/shared/constants/ticket';
import { PATCH } from '../../app/api/tickets/[id]/complete/route';
import { GET as getBoard } from '../../app/api/tickets/route';
import { daysAgo, hoursAgo, resetDatabase, seedTicket } from '../helpers';

/** 본문 없이 호출한다. */
const complete = (id: string | number) =>
  PATCH(new Request(`http://localhost/api/tickets/${id}/complete`, { method: 'PATCH' }), {
    params: Promise.resolve({ id: String(id) }),
  });

describe('TC-API-005: PATCH /api/tickets/:id/complete — 완료 처리', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 005-N1
    it('완료 처리하면 status가 DONE이 되고 completedAt이 기록된다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.IN_PROGRESS,
        completedAt: null,
      });

      const res = await complete(seeded.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe(TICKET_STATUS.DONE);
      expect(body.completedAt).not.toBeNull();
      expect(Date.parse(body.completedAt)).not.toBeNaN();
    });

    // 005-N2
    it('완료해도 시작일은 유지된다', async () => {
      const startedAt = hoursAgo(3);
      const seeded = await seedTicket({ status: TICKET_STATUS.IN_PROGRESS, startedAt });

      const body = await (await complete(seeded.id)).json();

      expect(Date.parse(body.startedAt)).toBe(startedAt.getTime());
    });

    // 005-N3
    it.each([
      [TICKET_STATUS.BACKLOG],
      [TICKET_STATUS.TODO],
      [TICKET_STATUS.IN_PROGRESS],
    ])('%s 칼럼에서도 바로 완료할 수 있다', async (status) => {
      const seeded = await seedTicket({ status });

      const body = await (await complete(seeded.id)).json();

      expect(body.status).toBe(TICKET_STATUS.DONE);
      expect(body.completedAt).not.toBeNull();
    });

    // 005-N4
    it('이미 완료된 티켓을 다시 호출하면 completedAt이 갱신된다', async () => {
      const old = hoursAgo(5);
      const seeded = await seedTicket({ status: TICKET_STATUS.DONE, completedAt: old });

      const body = await (await complete(seeded.id)).json();

      expect(Date.parse(body.completedAt)).toBeGreaterThan(old.getTime());
    });

    // 005-N5
    it('완료하면 updatedAt이 갱신된다', async () => {
      const seeded = await seedTicket({ updatedAt: hoursAgo(2) });

      const body = await (await complete(seeded.id)).json();

      expect(Date.parse(body.updatedAt)).toBeGreaterThan(seeded.updatedAt.getTime());
    });

    it('완료해도 createdAt은 바뀌지 않는다', async () => {
      const seeded = await seedTicket({ createdAt: hoursAgo(9) });

      const body = await (await complete(seeded.id)).json();

      expect(Date.parse(body.createdAt)).toBe(seeded.createdAt.getTime());
    });

    it('종료예정일이 지났어도 완료하면 isOverdue가 false가 된다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.TODO,
        dueDate: daysAgo(3),
      });

      const body = await (await complete(seeded.id)).json();

      expect(body.isOverdue).toBe(false);
    });

    // 005-N6
    it('완료한 티켓이 보드의 Done 칼럼에 나타난다', async () => {
      const seeded = await seedTicket({
        title: '보드 구현',
        status: TICKET_STATUS.IN_PROGRESS,
      });

      await complete(seeded.id);

      const board = await (await getBoard()).json();
      expect(board.DONE.map((t: { title: string }) => t.title)).toEqual(['보드 구현']);
      expect(board.IN_PROGRESS).toEqual([]);
    });
  });

  describe('예외 케이스', () => {
    // 005-E1
    it('존재하지 않는 ID면 404와 안내 메시지를 반환한다', async () => {
      const res = await complete(999999);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('티켓을 찾을 수 없습니다');
    });

    // 005-E2
    it.each([['문자열', 'abc'], ['소수', '1.5'], ['음수', '-1']])(
      '숫자가 아닌 ID(%s)면 404를 반환한다',
      async (_label, id) => {
        const res = await complete(id);

        expect(res.status).toBe(404);
      },
    );
  });
});

/**
 * TC-API-006 · DELETE /api/tickets/:id — 티켓 삭제 (FR-006)
 *
 * 관련 스토리: US-008(할 일 삭제)
 * 명세: docs/API_SPEC.md 8장, docs/REQUIREMENTS.md FR-006
 *
 * 하드 삭제다. soft delete를 쓰지 않으므로 DB에서 행이 사라져야 한다.
 * 완료(FR-005)와 혼동하지 않도록 구분해서 검증한다.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { tickets } from '@/server/db/schema';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import { DELETE, GET } from '../../app/api/tickets/[id]/route';
import { GET as getBoard } from '../../app/api/tickets/route';
import { hoursAgo, resetDatabase, seedTicket } from '../helpers';

const context = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

const remove = (id: string | number) =>
  DELETE(new Request(`http://localhost/api/tickets/${id}`, { method: 'DELETE' }), context(id));

const fetchOne = (id: string | number) =>
  GET(new Request(`http://localhost/api/tickets/${id}`), context(id));

/** DB에 행이 실제로 남아 있는지 직접 확인한다. */
const rowExists = async (id: number): Promise<boolean> => {
  const rows = await getDb().select().from(tickets).where(eq(tickets.id, id));
  return rows.length > 0;
};

describe('TC-API-006: DELETE /api/tickets/:id — 티켓 삭제', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 006-N1
    it('존재하는 티켓을 삭제하면 204와 빈 본문을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await remove(seeded.id);

      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
    });

    // 006-N2
    it('삭제한 티켓을 다시 조회하면 404다', async () => {
      const seeded = await seedTicket({});

      await remove(seeded.id);

      expect((await fetchOne(seeded.id)).status).toBe(404);
    });

    // 006-N3
    it('삭제한 티켓은 보드에서 사라진다', async () => {
      const kept = await seedTicket({ title: '남을 티켓', status: TICKET_STATUS.TODO });
      const doomed = await seedTicket({ title: '지울 티켓', status: TICKET_STATUS.TODO });

      await remove(doomed.id);

      const board = await (await getBoard()).json();
      expect(board.TODO.map((t: { title: string }) => t.title)).toEqual(['남을 티켓']);
      expect(await rowExists(kept.id)).toBe(true);
    });

    // 006-N4
    it('하드 삭제다 — DB에 행이 남지 않는다', async () => {
      const seeded = await seedTicket({});
      expect(await rowExists(seeded.id)).toBe(true);

      await remove(seeded.id);

      expect(await rowExists(seeded.id)).toBe(false);
    });

    it('완료된 티켓도 삭제할 수 있다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(1),
      });

      expect((await remove(seeded.id)).status).toBe(204);
      expect(await rowExists(seeded.id)).toBe(false);
    });

    it('보드에서 감춰진 오래된 완료 티켓도 삭제할 수 있다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(72),
      });

      expect((await remove(seeded.id)).status).toBe(204);
      expect(await rowExists(seeded.id)).toBe(false);
    });

    it('다른 티켓의 position은 재계산하지 않는다', async () => {
      // API_SPEC 8.2 — 상대 순서가 유지되므로 건드릴 이유가 없다
      const first = await seedTicket({ status: TICKET_STATUS.TODO, position: -1024 });
      const middle = await seedTicket({ status: TICKET_STATUS.TODO, position: 0 });
      const last = await seedTicket({ status: TICKET_STATUS.TODO, position: 1024 });

      await remove(middle.id);

      const board = await (await getBoard()).json();
      expect(board.TODO.map((t: { id: number; position: number }) => [t.id, t.position])).toEqual([
        [first.id, -1024],
        [last.id, 1024],
      ]);
    });
  });

  describe('예외 케이스', () => {
    // 006-E1
    it('존재하지 않는 ID면 404와 안내 메시지를 반환한다', async () => {
      const res = await remove(999999);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('티켓을 찾을 수 없습니다');
    });

    // 006-E2
    it('같은 ID를 두 번 삭제하면 첫 번째는 204, 두 번째는 404다', async () => {
      const seeded = await seedTicket({});

      expect((await remove(seeded.id)).status).toBe(204);
      expect((await remove(seeded.id)).status).toBe(404);
    });

    it.each([['문자열', 'abc'], ['소수', '1.5'], ['음수', '-1']])(
      '숫자가 아닌 ID(%s)면 404를 반환한다',
      async (_label, id) => {
        expect((await remove(id)).status).toBe(404);
      },
    );

    it('삭제에 실패해도 다른 티켓은 영향을 받지 않는다', async () => {
      const kept = await seedTicket({ title: '남을 티켓' });

      await remove(999999);

      expect(await rowExists(kept.id)).toBe(true);
    });
  });
});

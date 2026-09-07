/**
 * TC-API-007 · PATCH /api/tickets/reorder — 상태·순서 변경 (FR-007)
 *
 * 관련 스토리: US-005(드래그앤드롭 상태 변경), US-006(완료 해제)
 * 명세: docs/API_SPEC.md 9장, docs/REQUIREMENTS.md FR-007
 *
 * 응답은 BoardData 전체다 (API_SPEC 13.2).
 *
 * 이동 대상으로 DONE은 허용하지 않는다. Done으로 들어가는 것은 /complete가
 * 담당한다. 다만 DONE에서 빠져나오는 이동은 대상이 DONE이 아니므로
 * 이 API가 처리하며, 이때 completedAt을 초기화한다.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { tickets } from '@/server/db/schema';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import { PATCH } from '../../app/api/tickets/reorder/route';
import { hoursAgo, resetDatabase, seedTicket } from '../helpers';

const reorder = (body: unknown) =>
  PATCH(
    new Request('http://localhost/api/tickets/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

/** 보드 응답에서 특정 칼럼의 (제목, position) 목록을 뽑는다. */
const column = (board: Record<string, { title: string; position: number }[]>, status: string) =>
  board[status]!.map((t) => [t.title, t.position] as const);

const rowOf = async (id: number) => {
  const [row] = await getDb().select().from(tickets).where(eq(tickets.id, id));
  return row!;
};

describe('TC-API-007: PATCH /api/tickets/reorder — 상태·순서 변경', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 007-N1
    it('다른 칼럼으로 이동하면 status와 position이 반영된다', async () => {
      const seeded = await seedTicket({ title: '이동할 티켓', status: TICKET_STATUS.BACKLOG });

      const res = await reorder({
        ticketId: seeded.id,
        status: TICKET_STATUS.IN_PROGRESS,
        position: 512,
      });

      expect(res.status).toBe(200);
      const board = await res.json();
      expect(column(board, TICKET_STATUS.IN_PROGRESS)).toEqual([['이동할 티켓', 512]]);
      expect(board.BACKLOG).toEqual([]);
    });

    it('응답이 BoardData 전체다 — 4개 키가 모두 존재한다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.BACKLOG });

      const board = await (
        await reorder({ ticketId: seeded.id, status: TICKET_STATUS.TODO, position: 0 })
      ).json();

      expect(Object.keys(board).sort()).toEqual(
        ['BACKLOG', 'DONE', 'IN_PROGRESS', 'TODO'].sort(),
      );
    });

    // 007-N2
    it('같은 칼럼 내에서 순서를 바꿀 수 있다', async () => {
      await seedTicket({ title: '위', status: TICKET_STATUS.TODO, position: 0 });
      const mover = await seedTicket({ title: '아래', status: TICKET_STATUS.TODO, position: 1024 });

      const board = await (
        await reorder({ ticketId: mover.id, status: TICKET_STATUS.TODO, position: -1024 })
      ).json();

      expect(column(board, TICKET_STATUS.TODO)).toEqual([
        ['아래', -1024],
        ['위', 0],
      ]);
    });

    // 007-N3
    it('TODO로 이동하면 startedAt이 기록된다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.BACKLOG, startedAt: null });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.TODO, position: 0 });

      expect((await rowOf(seeded.id)).startedAt).not.toBeNull();
    });

    // 007-N4
    it('이미 startedAt이 있으면 TODO로 다시 들어와도 덮어쓰지 않는다', async () => {
      const startedAt = hoursAgo(5);
      const seeded = await seedTicket({ status: TICKET_STATUS.IN_PROGRESS, startedAt });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.TODO, position: 0 });

      expect((await rowOf(seeded.id)).startedAt?.getTime()).toBe(startedAt.getTime());
    });

    // 007-N5
    it('TODO에서 BACKLOG로 되돌리면 startedAt이 초기화된다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.TODO, startedAt: hoursAgo(2) });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.BACKLOG, position: 0 });

      expect((await rowOf(seeded.id)).startedAt).toBeNull();
    });

    it('IN_PROGRESS에서 BACKLOG로 가도 startedAt은 유지된다', async () => {
      // 명세는 "TODO에서 BACKLOG로"만 초기화한다 (FR-007)
      const startedAt = hoursAgo(4);
      const seeded = await seedTicket({ status: TICKET_STATUS.IN_PROGRESS, startedAt });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.BACKLOG, position: 0 });

      expect((await rowOf(seeded.id)).startedAt?.getTime()).toBe(startedAt.getTime());
    });

    // 007-N6
    it('두 카드 사이에 삽입하면 position이 두 값 사이에 놓인다', async () => {
      await seedTicket({ title: '첫번째', status: TICKET_STATUS.TODO, position: 0 });
      await seedTicket({ title: '세번째', status: TICKET_STATUS.TODO, position: 2048 });
      const mover = await seedTicket({ title: '끼어들기', status: TICKET_STATUS.BACKLOG });

      const board = await (
        await reorder({ ticketId: mover.id, status: TICKET_STATUS.TODO, position: 1024 })
      ).json();

      expect(column(board, TICKET_STATUS.TODO)).toEqual([
        ['첫번째', 0],
        ['끼어들기', 1024],
        ['세번째', 2048],
      ]);
    });

    // 007-N7
    it('position이 충돌하면 칼럼 전체가 1024 간격으로 재정렬된다', async () => {
      // INTEGER라 (5+6)/2는 5가 되어 앞 카드와 겹친다 (API_SPEC 9.2)
      await seedTicket({ title: 'A', status: TICKET_STATUS.TODO, position: 5 });
      await seedTicket({ title: 'B', status: TICKET_STATUS.TODO, position: 6 });
      const mover = await seedTicket({ title: '끼어들기', status: TICKET_STATUS.BACKLOG });

      const board = await (
        await reorder({ ticketId: mover.id, status: TICKET_STATUS.TODO, position: 5 })
      ).json();

      const todo = column(board, TICKET_STATUS.TODO);
      expect(todo.map(([title]) => title)).toEqual(['A', '끼어들기', 'B']);
      expect(todo.map(([, position]) => position)).toEqual([0, 1024, 2048]);
    });

    it('재정렬은 해당 칼럼에만 적용된다', async () => {
      await seedTicket({ title: 'A', status: TICKET_STATUS.TODO, position: 5 });
      await seedTicket({ title: 'B', status: TICKET_STATUS.TODO, position: 6 });
      await seedTicket({ title: '다른칼럼', status: TICKET_STATUS.IN_PROGRESS, position: 7 });
      const mover = await seedTicket({ title: '끼어들기', status: TICKET_STATUS.BACKLOG });

      const board = await (
        await reorder({ ticketId: mover.id, status: TICKET_STATUS.TODO, position: 5 })
      ).json();

      expect(column(board, TICKET_STATUS.IN_PROGRESS)).toEqual([['다른칼럼', 7]]);
    });

    // 007-N8
    it('역방향 이동도 허용된다', async () => {
      const seeded = await seedTicket({ title: '되돌리기', status: TICKET_STATUS.IN_PROGRESS });

      const board = await (
        await reorder({ ticketId: seeded.id, status: TICKET_STATUS.BACKLOG, position: 0 })
      ).json();

      expect(column(board, TICKET_STATUS.BACKLOG)).toEqual([['되돌리기', 0]]);
    });

    // 007-N9
    it('DONE에서 다른 칼럼으로 옮기면 완료가 해제된다', async () => {
      const seeded = await seedTicket({
        title: '완료 해제',
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(1),
      });

      const board = await (
        await reorder({ ticketId: seeded.id, status: TICKET_STATUS.IN_PROGRESS, position: 0 })
      ).json();

      expect(column(board, TICKET_STATUS.IN_PROGRESS)).toEqual([['완료 해제', 0]]);
      expect(board.DONE).toEqual([]);
      expect((await rowOf(seeded.id)).completedAt).toBeNull();
    });

    // 007-N10
    it('완료 해제해도 startedAt은 유지된다', async () => {
      const startedAt = hoursAgo(8);
      const seeded = await seedTicket({
        status: TICKET_STATUS.DONE,
        startedAt,
        completedAt: hoursAgo(1),
      });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.IN_PROGRESS, position: 0 });

      expect((await rowOf(seeded.id)).startedAt?.getTime()).toBe(startedAt.getTime());
    });

    it('DONE에서 TODO로 옮기면 완료 해제와 startedAt 유지가 함께 일어난다', async () => {
      const startedAt = hoursAgo(6);
      const seeded = await seedTicket({
        status: TICKET_STATUS.DONE,
        startedAt,
        completedAt: hoursAgo(2),
      });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.TODO, position: 0 });

      const row = await rowOf(seeded.id);
      expect(row.completedAt).toBeNull();
      expect(row.startedAt?.getTime()).toBe(startedAt.getTime());
    });

    it('이동하면 updatedAt이 갱신된다', async () => {
      const seeded = await seedTicket({
        status: TICKET_STATUS.BACKLOG,
        updatedAt: hoursAgo(3),
      });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.TODO, position: 0 });

      expect((await rowOf(seeded.id)).updatedAt.getTime()).toBeGreaterThan(
        seeded.updatedAt.getTime(),
      );
    });
  });

  describe('예외 케이스', () => {
    // 007-E1
    it('이동 대상이 DONE이면 400을 반환한다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.TODO });

      const res = await reorder({
        ticketId: seeded.id,
        status: TICKET_STATUS.DONE,
        position: 0,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'status',
          message: '상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요',
        }),
      );
    });

    // 007-E2
    it('정의되지 않은 status면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await reorder({ ticketId: seeded.id, status: 'ARCHIVED', position: 0 });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'status',
          message: '상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요',
        }),
      );
    });

    // 007-E3
    it('존재하지 않는 ticketId면 404를 반환한다', async () => {
      const res = await reorder({
        ticketId: 999999,
        status: TICKET_STATUS.TODO,
        position: 0,
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('티켓을 찾을 수 없습니다');
    });

    // 007-E4
    it.each([
      ['ticketId 누락', { status: TICKET_STATUS.TODO, position: 0 }],
      ['status 누락', { ticketId: 1, position: 0 }],
      ['position 누락', { ticketId: 1, status: TICKET_STATUS.TODO }],
    ])('%s이면 400을 반환한다', async (_label, body) => {
      const res = await reorder(body);

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });

    it('본문이 올바른 JSON이 아니면 400을 반환한다', async () => {
      const res = await PATCH(
        new Request('http://localhost/api/tickets/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{ "ticketId": ',
        }),
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });

    // 007-E5
    it('검증에 실패하면 아무것도 변경되지 않는다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.BACKLOG, position: 0 });

      await reorder({ ticketId: seeded.id, status: TICKET_STATUS.DONE, position: 999 });

      const row = await rowOf(seeded.id);
      expect(row.status).toBe(TICKET_STATUS.BACKLOG);
      expect(row.position).toBe(0);
    });

    it('존재하지 않는 티켓 요청은 다른 티켓에 영향을 주지 않는다', async () => {
      const kept = await seedTicket({ status: TICKET_STATUS.TODO, position: 0 });

      await reorder({ ticketId: 999999, status: TICKET_STATUS.BACKLOG, position: 512 });

      const row = await rowOf(kept.id);
      expect(row.status).toBe(TICKET_STATUS.TODO);
      expect(row.position).toBe(0);
    });
  });
});

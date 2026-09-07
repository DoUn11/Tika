/**
 * TC-API-008 · isOverdue 파생 판정 (FR-008)
 *
 * 관련 스토리: US-003(보드 현황 파악), US-004(마감 초과 인지)
 * 명세: docs/API_SPEC.md 10장, docs/REQUIREMENTS.md FR-008
 *
 * 전용 엔드포인트가 없다. 티켓을 반환하는 응답의 isOverdue 필드로 검증한다.
 *
 * 판정: isOverdue = (dueDate != null) AND (dueDate < 오늘) AND (status != 'DONE')
 *
 * 이 로직은 FR-002 구현 시 함께 만들어져 이미 동작한다. 본 스위트는
 * 판정 규칙의 경계를 명시적으로 고정하는 회귀 방지 테스트다.
 */
import { getDb } from '@/server/db';
import { TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { GET as getTicket } from '../../app/api/tickets/[id]/route';
import { GET as getBoard } from '../../app/api/tickets/route';
import { daysAgo, daysLater, hoursAgo, resetDatabase, seedTicket, today } from '../helpers';

/** 보드 응답에서 티켓 하나를 꺼낸다. */
const findOnBoard = (board: BoardData, id: number): Ticket | undefined =>
  Object.values(board)
    .flat()
    .find((ticket) => ticket.id === id);

const fetchDetail = (id: number) =>
  getTicket(new Request(`http://localhost/api/tickets/${id}`), {
    params: Promise.resolve({ id: String(id) }),
  });

describe('TC-API-008: isOverdue 파생 판정', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('판정 규칙', () => {
    // 008-N1 ~ 008-N5
    it.each<[string, string | null, TicketStatus, boolean]>([
      ['어제 마감이고 미완료면 초과다', daysAgo(1), TICKET_STATUS.TODO, true],
      ['한참 전 마감이고 미완료면 초과다', daysAgo(30), TICKET_STATUS.TODO, true],
      ['오늘 마감이면 초과가 아니다', today(), TICKET_STATUS.TODO, false],
      ['내일 마감이면 초과가 아니다', daysLater(1), TICKET_STATUS.TODO, false],
      ['먼 미래 마감이면 초과가 아니다', daysLater(30), TICKET_STATUS.TODO, false],
      ['종료예정일이 없으면 초과가 아니다', null, TICKET_STATUS.TODO, false],
    ])('%s', async (_label, dueDate, status, expected) => {
      const seeded = await seedTicket({ dueDate, status });

      const board = await (await getBoard()).json();

      expect(findOnBoard(board, seeded.id)?.isOverdue).toBe(expected);
    });

    it('오늘이 경계다 — 오늘은 false, 어제는 true', async () => {
      const dueToday = await seedTicket({ dueDate: today(), status: TICKET_STATUS.TODO });
      const dueYesterday = await seedTicket({ dueDate: daysAgo(1), status: TICKET_STATUS.TODO });

      const board = await (await getBoard()).json();

      expect(findOnBoard(board, dueToday.id)?.isOverdue).toBe(false);
      expect(findOnBoard(board, dueYesterday.id)?.isOverdue).toBe(true);
    });
  });

  describe('상태에 따른 판정', () => {
    it.each([[TICKET_STATUS.BACKLOG], [TICKET_STATUS.TODO], [TICKET_STATUS.IN_PROGRESS]])(
      '%s 상태에서 기한이 지나면 초과다',
      async (status) => {
        const seeded = await seedTicket({ dueDate: daysAgo(2), status });

        const board = await (await getBoard()).json();

        expect(findOnBoard(board, seeded.id)?.isOverdue).toBe(true);
      },
    );

    // 008-N4
    it('완료된 티켓은 기한이 지났어도 초과가 아니다', async () => {
      const seeded = await seedTicket({
        dueDate: daysAgo(5),
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(1),
      });

      const board = await (await getBoard()).json();

      expect(findOnBoard(board, seeded.id)?.isOverdue).toBe(false);
    });
  });

  describe('조회 경로에 관계없이 일관된다', () => {
    it('보드 조회와 상세 조회의 isOverdue가 같다', async () => {
      const seeded = await seedTicket({ dueDate: daysAgo(1), status: TICKET_STATUS.TODO });

      const board = await (await getBoard()).json();
      const detail = await (await fetchDetail(seeded.id)).json();

      expect(detail.isOverdue).toBe(true);
      expect(findOnBoard(board, seeded.id)?.isOverdue).toBe(detail.isOverdue);
    });

    it('보드에서 감춰진 오래된 완료 티켓도 상세에서 isOverdue가 false다', async () => {
      const seeded = await seedTicket({
        dueDate: daysAgo(10),
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(72),
      });

      const detail = await (await fetchDetail(seeded.id)).json();

      expect(detail.isOverdue).toBe(false);
    });
  });

  describe('파생 필드다 — 저장하지 않는다', () => {
    // 008-E1
    it('tickets 테이블에 isOverdue 컬럼이 없다', async () => {
      const result = await getDb().execute(
        `select column_name from information_schema.columns
         where table_name = 'tickets'`,
      );
      const columns = result.rows.map((r) => String(r.column_name));

      expect(columns).not.toContain('is_overdue');
      expect(columns).not.toContain('isOverdue');
    });

    it('DB에 저장된 값이 아니라 조회 시 계산된다', async () => {
      // 기한이 지난 티켓을 넣고, 저장된 컬럼만으로는 초과 여부를 알 수 없음을 확인한다
      const seeded = await seedTicket({ dueDate: daysAgo(1), status: TICKET_STATUS.TODO });

      const stored = await getDb().execute(
        `select * from tickets where id = ${seeded.id}`,
      );

      expect(stored.rows[0]).not.toHaveProperty('is_overdue');

      const board = await (await getBoard()).json();
      expect(findOnBoard(board, seeded.id)?.isOverdue).toBe(true);
    });
  });
});

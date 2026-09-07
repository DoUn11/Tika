/**
 * 컴포넌트·통합 테스트용 순수 팩토리 (TEST_CASES.md 6.1).
 *
 * helpers/index.ts와 분리한 이유: 그쪽은 @/server/db를 import하므로
 * pg 드라이버가 딸려 온다. jsdom 환경인 client project에서는 쓸 수 없다.
 * 이 파일은 @/shared/만 참조하므로 양쪽 환경에서 안전하다.
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';

let sequence = 0;

/**
 * API 응답 형태의 Ticket을 만든다. DB를 쓰지 않는다.
 *
 * isOverdue는 서버 계산값이므로 여기서도 dueDate로부터 유도하지 않는다.
 * 카드가 재판정하지 않는다는 규칙(COMPONENT_SPEC 4.4)을 테스트에서
 * 검증하려면 dueDate와 isOverdue를 독립적으로 지정할 수 있어야 한다.
 */
export const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: ++sequence,
  title: '테스트 티켓',
  description: null,
  status: TICKET_STATUS.BACKLOG,
  priority: TICKET_PRIORITY.MEDIUM,
  position: 0,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  isOverdue: false,
  ...overrides,
});

/** 4개 칼럼이 모두 비어 있는 보드. GET /api/tickets가 티켓 없이 반환하는 형태다. */
export const emptyBoard = (): BoardData => ({
  [TICKET_STATUS.BACKLOG]: [],
  [TICKET_STATUS.TODO]: [],
  [TICKET_STATUS.IN_PROGRESS]: [],
  [TICKET_STATUS.DONE]: [],
});

/**
 * 일부 칼럼만 채운 보드를 만든다.
 *
 * 티켓의 status를 보고 칼럼을 정하지 않는다. Board가 board를 그대로 받아
 * 그리는지(COMPONENT_SPEC 2.1) 검증하려면 둘을 어긋나게 줄 수 있어야 한다.
 */
export const boardWith = (columns: Partial<BoardData> = {}): BoardData => ({
  ...emptyBoard(),
  ...columns,
});

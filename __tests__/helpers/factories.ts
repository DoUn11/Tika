/**
 * 컴포넌트·통합 테스트용 순수 팩토리 (TEST_CASES.md 6.1).
 *
 * helpers/index.ts와 분리한 이유: 그쪽은 @/server/db를 import하므로
 * pg 드라이버가 딸려 온다. jsdom 환경인 client project에서는 쓸 수 없다.
 * 이 파일은 @/shared/만 참조하므로 양쪽 환경에서 안전하다.
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';

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

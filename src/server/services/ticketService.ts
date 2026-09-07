import { eq, min } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { tickets, type TicketRow } from '@/server/db/schema';
import {
  POSITION_GAP,
  TICKET_STATUS,
  type TicketPriority,
  type TicketStatus,
} from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';
import { isPastDue } from '@/shared/utils/date';
import type { CreateTicketInput } from '@/shared/validations/ticketSchema';

/** dueDate가 지났고 아직 완료되지 않았으면 초과다 (FR-008). 당일은 초과가 아니다. */
const computeIsOverdue = (row: TicketRow): boolean => {
  if (row.dueDate === null || row.status === TICKET_STATUS.DONE) return false;
  return isPastDue(row.dueDate);
};

/** DB 행을 API 응답 형태로 변환한다. isOverdue는 여기서 계산해 붙인다. */
const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status as TicketStatus,
  priority: row.priority as TicketPriority,
  position: row.position,
  plannedStartDate: row.plannedStartDate,
  dueDate: row.dueDate,
  startedAt: row.startedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  isOverdue: computeIsOverdue(row),
});

/**
 * 새 티켓이 놓일 position을 계산한다 (FR-001).
 * 항상 Backlog 최상단이므로 칼럼 최솟값보다 POSITION_GAP만큼 작다.
 * 칼럼이 비어 있으면 0이다.
 */
const nextBacklogPosition = async (): Promise<number> => {
  const [row] = await getDb()
    .select({ min: min(tickets.position) })
    .from(tickets)
    .where(eq(tickets.status, TICKET_STATUS.BACKLOG));

  const lowest = row?.min;
  return lowest === null || lowest === undefined ? 0 : lowest - POSITION_GAP;
};

/** FR-001 티켓 생성. status는 항상 BACKLOG이며 요청으로 지정할 수 없다. */
export const createTicket = async (input: CreateTicketInput): Promise<Ticket> => {
  const [row] = await getDb()
    .insert(tickets)
    .values({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      status: TICKET_STATUS.BACKLOG,
      position: await nextBacklogPosition(),
      plannedStartDate: input.plannedStartDate ?? null,
      dueDate: input.dueDate ?? null,
    })
    .returning();

  return toTicket(row!);
};

export { toTicket };

import { and, asc, eq, gte, min, ne, or } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { tickets, type NewTicketRow, type TicketRow } from '@/server/db/schema';
import {
  DONE_VISIBLE_HOURS,
  POSITION_GAP,
  TICKET_STATUS,
  type TicketPriority,
  type TicketStatus,
} from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { isPastDue } from '@/shared/utils/date';
import type { CreateTicketInput, UpdateTicketInput } from '@/shared/validations/ticketSchema';

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

  if (!row) {
    throw new Error('티켓 생성에 실패했습니다');
  }
  return toTicket(row);
};

/**
 * FR-002 보드 조회. 4개 칼럼별로 그룹화하여 반환한다.
 *
 * Done 칼럼은 completedAt 기준 24시간 이내 티켓만 포함한다 (FR-005).
 * 24시간이 지난 티켓은 삭제되지 않고 보드에서만 감춰진다.
 */
export const getBoard = async (): Promise<BoardData> => {
  const cutoff = new Date(Date.now() - DONE_VISIBLE_HOURS * 60 * 60 * 1000);

  const rows = await getDb()
    .select()
    .from(tickets)
    .where(
      or(
        ne(tickets.status, TICKET_STATUS.DONE),
        and(eq(tickets.status, TICKET_STATUS.DONE), gte(tickets.completedAt, cutoff)),
      ),
    )
    .orderBy(asc(tickets.position));

  // 티켓이 없는 칼럼도 빈 배열로 존재해야 한다 (API_SPEC 2.2).
  // BoardData가 Record<TicketStatus, Ticket[]>이므로 키가 빠지면 컴파일 에러가 난다.
  const board: BoardData = {
    [TICKET_STATUS.BACKLOG]: [],
    [TICKET_STATUS.TODO]: [],
    [TICKET_STATUS.IN_PROGRESS]: [],
    [TICKET_STATUS.DONE]: [],
  };

  // 변환 결과의 status는 이미 TicketStatus라 캐스트가 필요 없다
  for (const row of rows) {
    const ticket = toTicket(row);
    board[ticket.status].push(ticket);
  }

  return board;
};

/**
 * FR-003 티켓 상세 조회.
 *
 * 보드 조회(FR-002)와 달리 Done 24시간 필터를 적용하지 않는다.
 * 보드에서 감춰진 티켓도 상세로는 계속 조회할 수 있어야 한다.
 */
export const getTicketById = async (id: number): Promise<Ticket | null> => {
  const [row] = await getDb().select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return row ? toTicket(row) : null;
};

/**
 * FR-004 티켓 수정. 전송된 필드만 갱신한다.
 *
 * undefined(키 없음)와 null(삭제)을 구분해야 하므로 스프레드로 합치지 않고
 * 필드별로 undefined 여부를 확인한다. 스키마가 이미 셋을 구분해 통과시킨다.
 *
 * 존재하지 않는 ID면 null을 반환하며, 호출부가 404로 변환한다.
 */
export const updateTicket = async (
  id: number,
  input: UpdateTicketInput,
): Promise<Ticket | null> => {
  const updates: Partial<NewTicketRow> = { updatedAt: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.plannedStartDate !== undefined) updates.plannedStartDate = input.plannedStartDate;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;

  const [row] = await getDb()
    .update(tickets)
    .set(updates)
    .where(eq(tickets.id, id))
    .returning();

  return row ? toTicket(row) : null;
};

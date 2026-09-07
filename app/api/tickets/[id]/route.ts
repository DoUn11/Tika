import { notFoundError, withErrorHandling } from '@/server/middleware/errorHandler';
import { parseJsonBody, parseTicketId } from '@/server/middleware/request';
import { deleteTicket, getTicketById, updateTicket } from '@/server/services/ticketService';
import type { Ticket } from '@/shared/types/ticket';
import { updateTicketSchema } from '@/shared/validations/ticketSchema';

/** Drizzle의 pg 드라이버가 Node API에 의존하므로 Edge가 아닌 Node 런타임을 쓴다 (TRD 2.3). */
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/** 티켓이 없으면 404, 있으면 200으로 응답한다. */
const ticketOrNotFound = (ticket: Ticket | null): Response =>
  ticket === null
    ? Response.json(notFoundError(), { status: 404 })
    : Response.json(ticket, { status: 200 });

/** FR-003 티켓 상세 조회. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const ticketId = parseTicketId((await context.params).id);
  if (ticketId === null) {
    return Response.json(notFoundError(), { status: 404 });
  }

  return withErrorHandling(async () => ticketOrNotFound(await getTicketById(ticketId)));
}

/** FR-004 티켓 수정. 전송된 필드만 갱신한다. */
export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const ticketId = parseTicketId((await context.params).id);
  if (ticketId === null) {
    return Response.json(notFoundError(), { status: 404 });
  }

  const { data, error } = await parseJsonBody(request, updateTicketSchema);
  if (error) return error;

  return withErrorHandling(async () => ticketOrNotFound(await updateTicket(ticketId, data)));
}

/** FR-006 티켓 삭제. 하드 삭제이며 성공 시 본문 없이 204를 반환한다. */
export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  const ticketId = parseTicketId((await context.params).id);
  if (ticketId === null) {
    return Response.json(notFoundError(), { status: 404 });
  }

  return withErrorHandling(async () => {
    const deleted = await deleteTicket(ticketId);
    // 204는 본문이 없어야 하므로 ticketOrNotFound를 쓸 수 없다
    return deleted
      ? new Response(null, { status: 204 })
      : Response.json(notFoundError(), { status: 404 });
  });
}

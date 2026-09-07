import { notFoundError, withErrorHandling } from '@/server/middleware/errorHandler';
import { parseTicketId } from '@/server/middleware/request';
import { completeTicket } from '@/server/services/ticketService';

/** Drizzle의 pg 드라이버가 Node API에 의존하므로 Edge가 아닌 Node 런타임을 쓴다 (TRD 2.3). */
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * FR-005 티켓 완료. 요청 본문이 없다.
 *
 * 완료 해제는 이 엔드포인트가 아니라 PATCH /api/tickets/reorder를 쓴다.
 * 이동 대상이 DONE이 아니므로 reorder의 관할이다 (API_SPEC 13.1).
 */
export async function PATCH(_request: Request, context: RouteContext): Promise<Response> {
  const ticketId = parseTicketId((await context.params).id);

  if (ticketId === null) {
    return Response.json(notFoundError(), { status: 404 });
  }

  return withErrorHandling(async () => {
    const ticket = await completeTicket(ticketId);
    return ticket === null
      ? Response.json(notFoundError(), { status: 404 })
      : Response.json(ticket, { status: 200 });
  });
}

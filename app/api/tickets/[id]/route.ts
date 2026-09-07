import { notFoundError, withErrorHandling } from '@/server/middleware/errorHandler';
import { getTicketById } from '@/server/services/ticketService';

/** Drizzle의 pg 드라이버가 Node API에 의존하므로 Edge가 아닌 Node 런타임을 쓴다 (TRD 2.3). */
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 경로 파라미터를 티켓 ID로 해석한다.
 * 양의 정수가 아니면 null을 반환하며, 호출부는 이를 404로 처리한다.
 * "abc", "1.5", "-1" 같은 값이 NaN이나 음수로 서비스까지 흘러가지 않게 한다.
 */
const parseTicketId = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
};

/** FR-003 티켓 상세 조회. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const ticketId = parseTicketId(id);

  if (ticketId === null) {
    return Response.json(notFoundError(), { status: 404 });
  }

  return withErrorHandling(async () => {
    const ticket = await getTicketById(ticketId);
    return ticket === null
      ? Response.json(notFoundError(), { status: 404 })
      : Response.json(ticket, { status: 200 });
  });
}

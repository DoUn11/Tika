import { withErrorHandling } from '@/server/middleware/errorHandler';
import { parseJsonBody } from '@/server/middleware/request';
import { createTicket, getBoard } from '@/server/services/ticketService';
import { createTicketSchema } from '@/shared/validations/ticketSchema';

/** Drizzle의 pg 드라이버가 Node API에 의존하므로 Edge가 아닌 Node 런타임을 쓴다 (TRD 2.3). */
export const runtime = 'nodejs';

/** FR-002 보드 조회. 칼럼별로 그룹화된 티켓을 반환한다. */
export async function GET(): Promise<Response> {
  return withErrorHandling(async () => Response.json(await getBoard(), { status: 200 }));
}

/** FR-001 티켓 생성. 요청 파싱 → 검증 → 서비스 호출 → 응답. */
export async function POST(request: Request): Promise<Response> {
  const { data, error } = await parseJsonBody(request, createTicketSchema);
  if (error) return error;

  return withErrorHandling(async () =>
    Response.json(await createTicket(data), { status: 201 }),
  );
}

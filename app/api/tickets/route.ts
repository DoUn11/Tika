import {
  badRequestError,
  toValidationError,
  withErrorHandling,
} from '@/server/middleware/errorHandler';
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(badRequestError('요청 본문이 올바른 JSON이 아닙니다'), { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(toValidationError(parsed.error), { status: 400 });
  }

  const ticket = await createTicket(parsed.data);
  return Response.json(ticket, { status: 201 });
}

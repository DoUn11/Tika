import { notFoundError, withErrorHandling } from '@/server/middleware/errorHandler';
import { parseJsonBody } from '@/server/middleware/request';
import { reorderTicket } from '@/server/services/ticketService';
import { reorderSchema } from '@/shared/validations/ticketSchema';

/** Drizzle의 pg 드라이버가 Node API에 의존하므로 Edge가 아닌 Node 런타임을 쓴다 (TRD 2.3). */
export const runtime = 'nodejs';

/**
 * FR-007 상태·순서 변경 (드래그앤드롭).
 *
 * 이 파일은 [id]/route.ts보다 먼저 매칭된다. Next.js App Router가
 * 정적 세그먼트를 동적 세그먼트보다 우선하므로 id = "reorder"로
 * 잘못 해석되지 않는다 (TRD 1.4).
 *
 * 응답은 BoardData 전체다. 칼럼 간 이동은 두 칼럼이 함께 바뀌고
 * 재정렬은 칼럼 전체가 바뀌어 변경 범위를 열거하기 어렵다 (API_SPEC 13.2).
 */
export async function PATCH(request: Request): Promise<Response> {
  const { data, error } = await parseJsonBody(request, reorderSchema);
  if (error) return error;

  return withErrorHandling(async () => {
    const board = await reorderTicket(data);
    return board === null
      ? Response.json(notFoundError(), { status: 404 })
      : Response.json(board, { status: 200 });
  });
}

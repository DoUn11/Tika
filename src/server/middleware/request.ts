import type { TypeOf, ZodTypeAny } from 'zod';
import { badRequestError, toValidationError } from '@/server/middleware/errorHandler';

/**
 * 경로 파라미터를 티켓 ID로 해석한다.
 * 양의 정수가 아니면 null을 반환하며, 호출부는 이를 404로 처리한다.
 * "abc", "1.5", "-1" 같은 값이 NaN이나 음수로 서비스까지 흘러가지 않게 한다.
 */
export const parseTicketId = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
};

type ParseResult<T> = { data: T; error?: undefined } | { data?: undefined; error: Response };

/**
 * 요청 본문을 JSON으로 파싱하고 Zod 스키마로 검증한다.
 *
 * 실패하면 그대로 반환할 Response를, 성공하면 검증된 데이터를 돌려준다.
 * 본문 파싱 실패와 검증 실패 모두 400이며, 클라이언트 오류이므로
 * code는 VALIDATION_ERROR다 (API_SPEC 2.4).
 *
 * 반환 타입은 스키마의 출력 타입에서 추론한다. .default()가 붙은 필드는
 * 입력에서는 선택이지만 출력에서는 항상 존재하므로 둘을 구분해야 한다.
 */
export const parseJsonBody = async <S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ParseResult<TypeOf<S>>> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: Response.json(badRequestError('요청 본문이 올바른 JSON이 아닙니다'), { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: Response.json(toValidationError(parsed.error), { status: 400 }) };
  }

  return { data: parsed.data };
};

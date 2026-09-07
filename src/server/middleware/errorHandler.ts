import type { ZodError } from 'zod';

/** 모든 에러 응답의 공통 형식 (CLAUDE.md). */
export type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
};

export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Zod 검증 실패를 400 응답 본문으로 변환한다. */
export const toValidationError = (error: ZodError): ErrorBody => ({
  error: {
    code: ERROR_CODE.VALIDATION_ERROR,
    message: '입력값이 올바르지 않습니다',
    details: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  },
});

/**
 * Zod 검증 이전 단계의 클라이언트 오류 (본문 파싱 실패 등).
 * 400 응답이므로 code도 VALIDATION_ERROR여야 한다 (API_SPEC 2.4).
 */
export const badRequestError = (message: string): ErrorBody => ({
  error: { code: ERROR_CODE.VALIDATION_ERROR, message },
});

export const notFoundError = (message = '티켓을 찾을 수 없습니다'): ErrorBody => ({
  error: { code: ERROR_CODE.NOT_FOUND, message },
});

export const internalError = (message = '서버 오류가 발생했습니다'): ErrorBody => ({
  error: { code: ERROR_CODE.INTERNAL_ERROR, message },
});

/**
 * 서비스 계층에서 올라온 예외를 500 응답으로 변환한다.
 *
 * Route Handler가 정상 흐름에만 집중할 수 있게 하고,
 * 모든 엔드포인트가 같은 에러 형식을 내도록 한 곳에 모은다 (CLAUDE.md).
 */
export const withErrorHandling = async (
  handler: () => Promise<Response>,
): Promise<Response> => {
  try {
    return await handler();
  } catch {
    return Response.json(internalError(), { status: 500 });
  }
};

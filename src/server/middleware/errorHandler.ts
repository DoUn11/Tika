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

export const notFoundError = (message = '티켓을 찾을 수 없습니다'): ErrorBody => ({
  error: { code: ERROR_CODE.NOT_FOUND, message },
});

export const internalError = (message = '서버 오류가 발생했습니다'): ErrorBody => ({
  error: { code: ERROR_CODE.INTERNAL_ERROR, message },
});

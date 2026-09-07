import type { TicketStatus } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import type { CreateTicketInput, UpdateTicketInput } from '@/shared/validations/ticketSchema';

const BASE_URL = '/api/tickets';

/**
 * 2xx가 아닌 응답을 나타낸다 (COMPONENT_SPEC 6.4).
 *
 * message는 서버가 보낸 문구를 그대로 담는다. 화면은 이 값을 표시하면 되고,
 * "티켓을 찾을 수 없습니다" 같은 문구를 클라이언트에 다시 정의하지 않는다.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type ErrorBody = { error: { code: string; message: string } };

const isErrorBody = (value: unknown): value is ErrorBody => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  if (typeof error !== 'object' || error === null) return false;
  return (
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
};

/** 실패 응답을 ApiError로 바꿔 던진다. 본문을 읽을 수 없으면 기본 문구를 쓴다. */
const throwApiError = async (response: Response): Promise<never> => {
  let code = 'INTERNAL_ERROR';
  let message = '요청을 처리하지 못했습니다';

  try {
    const body: unknown = await response.json();
    if (isErrorBody(body)) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // 본문이 비었거나 JSON이 아니다 — 기본 문구를 쓴다
  }

  throw new ApiError(message, code, response.status);
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) await throwApiError(response);

  return (await response.json()) as T;
};

/** FR-002 보드 조회 */
export const getBoard = (): Promise<BoardData> => request<BoardData>(BASE_URL);

/** FR-003 티켓 상세 조회 */
export const getById = (id: number): Promise<Ticket> => request<Ticket>(`${BASE_URL}/${id}`);

/** FR-001 티켓 생성 */
export const create = (input: CreateTicketInput): Promise<Ticket> =>
  request<Ticket>(BASE_URL, { method: 'POST', body: JSON.stringify(input) });

/** FR-004 티켓 수정 */
export const update = (id: number, input: UpdateTicketInput): Promise<Ticket> =>
  request<Ticket>(`${BASE_URL}/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

/** FR-005 티켓 완료. 본문이 없다 (API_SPEC 13.1) */
export const complete = (id: number): Promise<Ticket> =>
  request<Ticket>(`${BASE_URL}/${id}/complete`, { method: 'PATCH' });

/** FR-007 상태·순서 변경. 응답은 BoardData 전체다 (API_SPEC 13.2) */
export const reorder = (
  ticketId: number,
  status: TicketStatus,
  position: number,
): Promise<BoardData> =>
  request<BoardData>(`${BASE_URL}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ ticketId, status, position }),
  });

/**
 * FR-006 티켓 삭제.
 * 204라 본문이 없으므로 request()를 쓰지 않는다 — json() 파싱이 실패한다.
 */
export const remove = async (id: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  if (!response.ok) await throwApiError(response);
};

import { z } from 'zod';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import { isPastDue } from '@/shared/utils/date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z.string().regex(DATE_PATTERN, '날짜 형식은 YYYY-MM-DD 입니다');

/**
 * 종료예정일은 오늘 이후여야 한다 (FR-001).
 * 당일은 허용한다 — 오버듀 판정(FR-008)과 같은 기준을 쓰기 위해
 * 두 곳 모두 isPastDue를 공유한다.
 */
const dueDateString = dateString.refine((value) => !isPastDue(value), {
  message: '종료예정일은 오늘 이후 날짜를 선택해주세요',
});

const priority = z.enum([TICKET_PRIORITY.LOW, TICKET_PRIORITY.MEDIUM, TICKET_PRIORITY.HIGH], {
  errorMap: () => ({ message: '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요' }),
});

/** FR-001 티켓 생성 요청 검증. status·position은 서버가 정하므로 입력받지 않는다. */
export const createTicketSchema = z.object({
  title: z
    .string({ required_error: '제목을 입력해주세요', invalid_type_error: '제목을 입력해주세요' })
    .trim()
    .min(1, '제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요'),
  description: z.string().max(1000, '설명은 1000자 이내로 입력해주세요').nullish(),
  priority: priority.default(TICKET_PRIORITY.MEDIUM),
  plannedStartDate: dateString.nullish(),
  dueDate: dueDateString.nullish(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/**
 * FR-004 티켓 수정 요청 검증. 부분 수정(PATCH)이다.
 *
 * 세 상태를 구분한다.
 *   키 없음(undefined) → 기존 값 유지
 *   null              → 값 삭제
 *   값                → 갱신
 *
 * title은 NOT NULL 컬럼이므로 삭제할 수 없다. nullable을 붙이지 않는다.
 * status·position·completedAt은 여기서 다루지 않으며(FR-005·FR-007),
 * Zod가 정의되지 않은 키를 걸러내므로 전송되어도 무시된다.
 */
export const updateTicketSchema = z.object({
  title: z
    .string({ invalid_type_error: '제목을 입력해주세요' })
    .trim()
    .min(1, '제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요')
    .optional(),
  description: z.string().max(1000, '설명은 1000자 이내로 입력해주세요').nullable().optional(),
  priority: priority.optional(),
  plannedStartDate: dateString.nullable().optional(),
  dueDate: dueDateString.nullable().optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/**
 * FR-007 상태·순서 변경 요청 검증.
 *
 * 이동 **대상**으로 DONE은 허용하지 않는다. Done으로 들어가는 것은
 * `/complete`가 담당한다. DONE에서 빠져나오는 이동은 대상이 DONE이
 * 아니므로 이 스키마를 통과한다 (API_SPEC 13.1).
 */
export const reorderSchema = z.object({
  ticketId: z.number({ required_error: '티켓을 선택해주세요' }).int().positive(),
  status: z.enum([TICKET_STATUS.BACKLOG, TICKET_STATUS.TODO, TICKET_STATUS.IN_PROGRESS], {
    errorMap: () => ({ message: '상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요' }),
  }),
  position: z.number({ required_error: '위치를 지정해주세요' }).int(),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

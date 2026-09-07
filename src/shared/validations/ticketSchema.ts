import { z } from 'zod';
import { TICKET_PRIORITY } from '@/shared/constants/ticket';
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

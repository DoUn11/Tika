/** 티켓 상태(칼럼). 고정 4종이며 사용자가 추가·변경할 수 없다. */
export const TICKET_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** 우선순위. */
export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type TicketPriority = (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];

/** 칼럼 표시 순서 (고정). */
export const COLUMN_ORDER = [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
] as const;

/** position 재계산 시 사용하는 기본 간격. */
export const POSITION_GAP = 1024;

/** Done 칼럼에 표시할 완료 티켓의 유효 시간 (시간 단위). */
export const DONE_VISIBLE_HOURS = 24;

import type { TicketPriority, TicketStatus } from '@/shared/constants/ticket';

/**
 * API가 반환하는 티켓 표현 (DATA_MODEL.md 4.2).
 * isOverdue는 DB 컬럼이 아니라 조회 시 계산하는 파생 필드다.
 */
export type Ticket = {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  position: number;
  /** YYYY-MM-DD */
  plannedStartDate: string | null;
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** ISO 8601 */
  startedAt: string | null;
  /** ISO 8601 */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
};

/** 칼럼별로 그룹화된 보드 데이터. 4개 키가 항상 존재한다. */
export type BoardData = Record<TicketStatus, Ticket[]>;

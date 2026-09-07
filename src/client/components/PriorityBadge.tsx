import { TICKET_PRIORITY, type TicketPriority } from '@/shared/constants/ticket';

type PriorityBadgeProps = {
  /** 표시할 우선순위 */
  priority: TicketPriority;
};

/** REQUIREMENTS.md 6장 · COMPONENT_SPEC 4.5의 색상 정의를 그대로 따른다. */
const BADGE_STYLE: Record<TicketPriority, string> = {
  [TICKET_PRIORITY.LOW]: 'bg-slate-200 text-slate-700',
  [TICKET_PRIORITY.MEDIUM]: 'bg-blue-100 text-blue-700',
  [TICKET_PRIORITY.HIGH]: 'bg-red-100 text-red-700',
};

/**
 * 우선순위를 색상 뱃지로 표시한다 (COMPONENT_SPEC 5.5).
 *
 * 오버듀와 색 계열이 겹치지만 표현 채널이 다르다. 우선순위는 카드 안쪽의
 * 뱃지 배경색으로, 오버듀는 카드 외곽의 띠·테두리로 드러난다 (4.3).
 */
export const PriorityBadge = ({ priority }: PriorityBadgeProps) => (
  <span
    className={`rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide ${BADGE_STYLE[priority]}`}
  >
    {priority}
  </span>
);

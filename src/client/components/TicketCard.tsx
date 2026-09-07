'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent } from 'react';
import { COLUMN_LABEL, TICKET_STATUS } from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';
import { PriorityBadge } from './PriorityBadge';

type TicketCardProps = {
  /** 표시할 티켓 */
  ticket: Ticket;
  /** 카드 클릭 시 호출 — 상세 모달을 연다 */
  onClick: () => void;
};

/** YYYY-MM-DD → MM/DD (COMPONENT_SPEC 4.2) */
const toMonthDay = (date: string): string => `${date.slice(5, 7)}/${date.slice(8, 10)}`;

/**
 * 스크린 리더가 읽을 이름 (COMPONENT_SPEC 4.7).
 * `"{제목}, {우선순위} 우선순위, {상태} 칼럼"` — 오버듀면 `", 일정 초과"`를 덧붙인다.
 */
const accessibleName = (ticket: Ticket): string => {
  const name = `${ticket.title}, ${ticket.priority} 우선순위, ${COLUMN_LABEL[ticket.status]} 칼럼`;
  return ticket.isOverdue ? `${name}, 일정 초과` : name;
};

/**
 * 개별 티켓 카드 (COMPONENT_SPEC 4장).
 *
 * `isOverdue`는 서버가 계산한 값이다. dueDate로 다시 판정하지 않는다 (4.4).
 *
 * 네이티브 `<button>`이 아니라 `div` + `role="button"`을 쓴다. 브라우저가
 * button의 Space를 click으로 바꾸는데, Space는 키보드 드래그의 집기 키라
 * 상세 열기와 겹치기 때문이다. 상세 열기는 클릭과 Enter만 받는다 (4.7).
 */
export const TicketCard = ({ ticket, onClick }: TicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  /**
   * Enter는 상세 열기, Space는 드래그 집기다 (4.7).
   * listeners를 그대로 펼치면 우리 onKeyDown이 덮이므로 Enter만 가로채고
   * 나머지는 @dnd-kit에 넘긴다.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onClick();
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  // 오버듀는 색상만으로 구분하지 않는다. 좌측 띠·테두리·⚠가 함께 드러난다 (4.4, NFR-003)
  const overdueStyle = ticket.isOverdue
    ? 'border-red-400 border-l-4 border-l-red-500'
    : 'border-slate-200 border-l-4 border-l-transparent';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={accessibleName(ticket)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-pointer rounded-md border bg-white p-3 shadow-sm transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${overdueStyle} ${isDragging ? 'opacity-50' : ''}`}
    >
      <p className="line-clamp-2 text-sm font-medium break-words text-slate-900">{ticket.title}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={ticket.priority} />

        <div className="flex items-center gap-2 text-xs">
          {ticket.status === TICKET_STATUS.DONE && (
            <span className="text-emerald-600">✓ 완료</span>
          )}

          {ticket.dueDate !== null && (
            <span className={ticket.isOverdue ? 'font-semibold text-red-600' : 'text-slate-500'}>
              {ticket.isOverdue && <span aria-hidden="true">⚠ </span>}
              {toMonthDay(ticket.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

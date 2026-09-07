'use client';

import { TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';
import { TicketCard } from './TicketCard';

type ColumnProps = {
  /** 이 칼럼이 담당하는 상태 */
  status: TicketStatus;
  /** 이 칼럼에 속한 티켓 (Board에서 그룹화하여 전달) */
  tickets: Ticket[];
  /** 칼럼 헤더에 표시할 이름 */
  title: string;
  /** 카드 클릭 시 호출 */
  onTicketClick: (id: number) => void;
};

/**
 * 빈 칼럼 안내 문구 (COMPONENT_SPEC 3.4).
 * 다음에 할 행동을 알려주어 처음 쓰는 사용자가 칸반 흐름을 익히게 한다.
 */
const EMPTY_MESSAGE: Record<TicketStatus, string> = {
  [TICKET_STATUS.BACKLOG]: '새 티켓을 추가해보세요',
  [TICKET_STATUS.TODO]: '착수할 티켓을 여기로 옮기세요',
  [TICKET_STATUS.IN_PROGRESS]: '진행 중인 티켓이 없습니다',
  [TICKET_STATUS.DONE]: '최근 24시간 내 완료한 티켓이 없습니다',
};

/**
 * 한 칼럼의 티켓 목록 (COMPONENT_SPEC 3장).
 *
 * 이름 있는 section이라 region 랜드마크가 된다. 스크린 리더 사용자가
 * 칼럼 단위로 건너뛸 수 있다 (3.5).
 *
 * Done 칼럼도 클라이언트가 따로 거르지 않는다. 서버가 completedAt 기준
 * 24시간 이내만 반환한다 (3.6).
 */
export const Column = ({ status, tickets, title, onTicketClick }: ColumnProps) => {
  const headingId = `column-${status}`;

  // 복사한 뒤 정렬한다. board 배열을 제자리에서 뒤집으면 Board가 쥔 단일
  // 기준이 소리 없이 바뀌어 낙관적 업데이트 롤백이 깨진다 (COMPONENT_SPEC 2.2).
  const ordered = [...tickets].sort((a, b) => a.position - b.position);

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full min-h-40 flex-col rounded-lg bg-slate-100 p-3"
    >
      {/* 카드 수는 h2 밖에 둔다. 안에 넣으면 랜드마크 이름이 "TODO 3"으로 읽힌다 (3.5) */}
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-slate-700">
          {title}
        </h2>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
          {ordered.length}
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{EMPTY_MESSAGE[status]}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 overflow-y-auto">
          {ordered.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} onClick={() => onTicketClick(ticket.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

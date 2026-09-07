'use client';

import { COLUMN_LABEL, COLUMN_ORDER, type TicketStatus } from '@/shared/constants/ticket';
import type { BoardData } from '@/shared/types/ticket';
import { Column } from './Column';

type BoardProps = {
  /** 칼럼별로 그룹화된 티켓. GET /api/tickets 응답을 그대로 받는다 */
  board: BoardData;
  /** 칼럼 이동 · 순서 변경 시 호출. DONE 포함 모든 대상을 동일하게 전달한다 */
  onMove: (id: number, status: TicketStatus, position: number) => void;
  /** 카드 클릭 시 호출 — 상세 모달 열기 */
  onTicketClick: (id: number) => void;
};

/**
 * 칸반 보드 컨테이너 (COMPONENT_SPEC 2장).
 *
 * board를 그대로 각 칼럼에 흘려보낸다. status로 다시 그룹화하지 않으므로
 * 서버 응답이 단일 기준이 되고, 낙관적 업데이트 롤백이 단순해진다 (2.1·2.2).
 *
 * 칼럼 순서는 COLUMN_ORDER로 고정한다 (3.2).
 *
 * onMove는 아직 호출되지 않는다. 드래그앤드롭 배선은 TC-INT-001이 이끈다.
 * Board가 어느 칼럼으로 드롭되든 onMove를 동일하게 호출하고, /complete와
 * /reorder의 분기는 useTickets가 맡는다는 것이 그때의 핵심이다 (2.4).
 */
export const Board = ({ board, onTicketClick }: BoardProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
    {COLUMN_ORDER.map((status) => (
      <Column
        key={status}
        status={status}
        title={COLUMN_LABEL[status]}
        tickets={board[status]}
        onTicketClick={onTicketClick}
      />
    ))}
  </div>
);

'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import {
  COLUMN_LABEL,
  COLUMN_ORDER,
  POSITION_GAP,
  type TicketStatus,
} from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { Column } from './Column';
import { TicketCardPreview } from './TicketCard';

type BoardProps = {
  /** 칼럼별로 그룹화된 티켓. GET /api/tickets 응답을 그대로 받는다 */
  board: BoardData;
  /** 칼럼 이동 · 순서 변경 시 호출. DONE 포함 모든 대상을 동일하게 전달한다 */
  onMove: (id: number, status: TicketStatus, position: number) => void;
  /** 카드 클릭 시 호출 — 상세 모달 열기 */
  onTicketClick: (id: number) => void;
};

const isStatus = (value: string | number): value is TicketStatus =>
  COLUMN_ORDER.some((status) => status === value);

const sortedByPosition = (tickets: Ticket[]): Ticket[] =>
  [...tickets].sort((a, b) => a.position - b.position);

/** 그 티켓이 속한 칼럼을 찾는다 */
const columnOfTicket = (board: BoardData, id: number): TicketStatus | null =>
  COLUMN_ORDER.find((status) => board[status].some((ticket) => ticket.id === id)) ?? null;

const findTicket = (board: BoardData, id: number): Ticket | null =>
  COLUMN_ORDER.flatMap((status) => board[status]).find((ticket) => ticket.id === id) ?? null;

/**
 * 끼워 넣을 자리의 position을 구한다 (COMPONENT_SPEC 2.3, DATA_MODEL 5.3).
 *
 * `tickets`는 옮기는 카드를 **뺀** 목록이고 `index`는 그 안에서 놓일 자리다.
 * 정수라서 (5+6)/2는 5가 되어 앞 카드와 겹치는데, 그 경우 서버가 칼럼 전체를
 * 다시 매긴다 (API_SPEC 9.2).
 */
const positionAt = (tickets: Ticket[], index: number): number => {
  const previous = tickets[index - 1];
  const next = tickets[index];

  if (previous === undefined && next === undefined) return 0;
  if (previous === undefined) return next!.position - POSITION_GAP;
  if (next === undefined) return previous.position + POSITION_GAP;

  return Math.floor((previous.position + next.position) / 2);
};

/**
 * 칸반 보드 컨테이너 (COMPONENT_SPEC 2장).
 *
 * board를 그대로 각 칼럼에 흘려보낸다. status로 다시 그룹화하지 않으므로
 * 서버 응답이 단일 기준이 되고, 낙관적 업데이트 롤백이 단순해진다 (2.1·2.2).
 *
 * 어느 칼럼으로 드롭되든 onMove를 똑같이 부른다. DONE이면 /complete로,
 * 아니면 /reorder로 가는 분기는 useTickets가 맡는다 (2.4).
 */
export const Board = ({ board, onMove, onTicketClick }: BoardProps) => {
  // 오버레이에 그릴 카드. 드래그 중 외에는 티켓 데이터를 복제해 두지 않는다 (2.2)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    // 제약이 없으면 pointerdown 즉시 드래그가 시작되어 뒤따르는 click이 삼켜진다.
    // 카드를 눌러 상세를 열 수 없게 되므로 8px 움직여야 드래그로 친다.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      // Enter는 카드 상세 열기가 쓰므로 집기는 Space만 받는다 (COMPONENT_SPEC 4.7)
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent): void => {
    setActiveTicket(findTicket(board, Number(active.id)));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveTicket(null);
    if (over === null) return;

    const id = Number(active.id);
    const from = columnOfTicket(board, id);
    if (from === null) return;

    // 빈 칼럼에 놓으면 over.id가 칼럼의 status이고,
    // 카드 위에 놓으면 그 카드의 id다.
    const target = isStatus(over.id) ? over.id : columnOfTicket(board, Number(over.id));
    if (target === null) return;

    const column = sortedByPosition(board[target]);
    const withoutMoved = column.filter((ticket) => ticket.id !== id);

    // 같은 칼럼이든 아니든, 뺀 목록에서 over 카드가 있던 자리에 끼워 넣으면
    // 위로 옮길 때와 아래로 옮길 때가 모두 맞는다 (arrayMove와 같은 규칙).
    const overIndex = isStatus(over.id)
      ? withoutMoved.length
      : column.findIndex((ticket) => ticket.id === Number(over.id));

    const index = overIndex < 0 ? withoutMoved.length : overIndex;
    const position = positionAt(withoutMoved, index);

    if (from === target && position === column.find((t) => t.id === id)?.position) return;

    onMove(id, target, position);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTicket(null)}
    >
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

      {/* 커서를 따라다니는 카드 미리보기. 원래 자리에는 반투명 placeholder가 남는다 (4.6) */}
      <DragOverlay>
        {activeTicket === null ? null : <TicketCardPreview ticket={activeTicket} />}
      </DragOverlay>
    </DndContext>
  );
};

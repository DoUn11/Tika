'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBoard, reorder } from '@/client/api/ticketApi';
import { COLUMN_ORDER, TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import type { BoardData } from '@/shared/types/ticket';

/** 4개 키가 항상 존재해야 한다 (API_SPEC 2.2) */
export const createEmptyBoard = (): BoardData => ({
  [TICKET_STATUS.BACKLOG]: [],
  [TICKET_STATUS.TODO]: [],
  [TICKET_STATUS.IN_PROGRESS]: [],
  [TICKET_STATUS.DONE]: [],
});

/**
 * 화면에 먼저 반영할 보드를 만든다 (COMPONENT_SPEC 6.5 낙관적 업데이트).
 * 서버 응답을 기다리지 않으므로 체감 지연이 없다.
 */
const applyMove = (
  board: BoardData,
  id: number,
  status: TicketStatus,
  position: number,
): BoardData => {
  const moved = COLUMN_ORDER.flatMap((column) => board[column]).find(
    (candidate) => candidate.id === id,
  );
  if (moved === undefined) return board;

  const next = createEmptyBoard();
  for (const column of COLUMN_ORDER) {
    next[column] = board[column].filter((candidate) => candidate.id !== id);
  }
  // Column이 position 오름차순으로 정렬해 그리므로 붙이는 위치는 상관없다
  next[status] = [...next[status], { ...moved, status, position }];

  return next;
};

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error('요청을 처리하지 못했습니다');

/**
 * 보드 상태와 API 호출을 관리한다 (COMPONENT_SPEC 6장).
 *
 * move의 complete/reorder 분기(6.2)와 실패 시 롤백(6.5)은 아직 없다.
 * 각각 TC-INT-002·TC-INT-003이 이끈다.
 */
export const useTickets = () => {
  const [board, setBoard] = useState<BoardData>(createEmptyBoard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setBoard(await getBoard());
      setError(null);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const move = useCallback(
    async (id: number, status: TicketStatus, position: number): Promise<void> => {
      setBoard((previous) => applyMove(previous, id, status, position));
      setBoard(await reorder(id, status, position));
    },
    [],
  );

  return { board, isLoading, error, move, refetch };
};

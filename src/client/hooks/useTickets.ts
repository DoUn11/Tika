'use client';

import { useCallback, useEffect, useState } from 'react';
import { complete, create, getBoard, remove, reorder, update } from '@/client/api/ticketApi';
import { COLUMN_ORDER, TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import type { BoardData } from '@/shared/types/ticket';
import type { CreateTicketInput, UpdateTicketInput } from '@/shared/validations/ticketSchema';

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
 * 실패 시 롤백(6.5)은 아직 없다. TC-INT-003이 이끈다.
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

  /**
   * FR-001 티켓 생성 · FR-004 티켓 수정 · FR-006 티켓 삭제.
   *
   * 낙관적 업데이트를 쓰지 않는다. 카드 위치가 바뀌지 않아 즉시 반영의
   * 이득이 작고, 응답 뒤 보드를 다시 읽는 편이 단순하다 (COMPONENT_SPEC 6.5).
   *
   * 실패해도 던지지 않고 문구만 남긴다. 보드를 건드리기 전에 멈추므로
   * 되돌릴 것이 없고, 실패는 ErrorBanner 한 곳으로 모은다 (5.5).
   */
  const createTicket = useCallback(
    async (input: CreateTicketInput): Promise<void> => {
      try {
        await create(input);
        setError(null);
        await refetch();
      } catch (cause) {
        setError(toError(cause));
      }
    },
    [refetch],
  );

  const updateTicket = useCallback(
    async (id: number, input: UpdateTicketInput): Promise<void> => {
      try {
        await update(id, input);
        setError(null);
        await refetch();
      } catch (cause) {
        setError(toError(cause));
      }
    },
    [refetch],
  );

  const removeTicket = useCallback(
    async (id: number): Promise<void> => {
      try {
        await remove(id);
        setError(null);
        await refetch();
      } catch (cause) {
        setError(toError(cause));
      }
    },
    [refetch],
  );

  /**
   * FR-007 상태·순서 변경. 응답이 BoardData 전체라 그대로 확정한다 (API_SPEC 13.2).
   */
  const reorderTicket = useCallback(
    async (id: number, status: TicketStatus, position: number): Promise<void> => {
      setBoard(await reorder(id, status, position));
    },
    [],
  );

  /**
   * FR-005 티켓 완료. 응답이 Ticket 하나뿐이라 보드를 다시 읽어 확정한다.
   */
  const completeTicket = useCallback(
    async (id: number): Promise<void> => {
      await complete(id);
      await refetch();
    },
    [refetch],
  );

  /**
   * 드래그앤드롭의 유일한 진입점 (COMPONENT_SPEC 6.2).
   *
   * **이동 대상만 본다.** DONE으로 들어가는 것은 completedAt 기록이 함께
   * 일어나야 해서 /complete가 맡고, 그 밖은 전부 /reorder다. DONE에서
   * 빠져나오는 이동도 대상이 DONE이 아니므로 reorder이며, completedAt
   * 초기화는 서버가 한다 (API_SPEC 13.1).
   *
   * 현재 상태를 조회할 필요가 없어 분기가 한 줄로 줄었다.
   *
   * 화면을 먼저 바꿔 두므로 실패하면 되돌려야 한다 (6.5). 되돌리기만 하면
   * 사용자에게는 카드가 저절로 튕겨 나온 것으로 보이므로 문구도 함께 남긴다.
   */
  const move = useCallback(
    async (id: number, status: TicketStatus, position: number): Promise<void> => {
      const snapshot = board;
      setBoard(applyMove(board, id, status, position));

      try {
        if (status === TICKET_STATUS.DONE) {
          await completeTicket(id);
        } else {
          await reorderTicket(id, status, position);
        }
        setError(null);
      } catch (cause) {
        setBoard(snapshot);
        setError(toError(cause));
      }
    },
    [board, completeTicket, reorderTicket],
  );

  return {
    board,
    isLoading,
    error,
    move,
    create: createTicket,
    update: updateTicket,
    remove: removeTicket,
    reorder: reorderTicket,
    complete: completeTicket,
    refetch,
  };
};

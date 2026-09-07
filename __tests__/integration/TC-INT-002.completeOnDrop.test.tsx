/**
 * TC-INT-002 · Done 드롭 → 완료 분기 (FR-005·FR-007)
 *
 * 관련 스토리: US-005(드래그앤드롭 상태 변경), US-006(할 일 완료 처리)
 * 명세: docs/TEST_CASES.md TC-INT-002, docs/COMPONENT_SPEC.md 2.4·6.2
 *
 * `useTickets.move()`가 이동 **대상**만 보고 두 엔드포인트로 갈라지는지 본다.
 * 현재 상태를 볼 필요가 없어 분기가 한 줄로 줄어든다는 것이 명세의 요지다.
 *
 * 이동 자체가 되는지는 TC-INT-001이 이미 봤다. 실패 롤백은 TC-INT-003의 몫이다.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import * as ticketApi from '@/client/api/ticketApi';
import { Board } from '@/client/components/Board';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { columnOf, dragCardToColumn, mockBoardLayout, renderApp } from '../helpers/app';
import { boardWith, ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi');

const mockApi = jest.mocked(ticketApi);

const noop = () => {};

/** 기본은 "응답이 아직 오지 않은 상태"다 (TC-INT-001과 같은 이유) */
beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockReturnValue(new Promise<BoardData>(() => {}));
  mockApi.complete.mockReturnValue(new Promise<Ticket>(() => {}));
});

describe('TC-INT-002: Done 드롭 → 완료 분기', () => {
  describe('002-N1 · Done 칼럼으로 이동', () => {
    it('reorder가 아니라 complete가 호출된다', async () => {
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      expect(mockApi.complete).toHaveBeenCalledWith(1);
      expect(mockApi.reorder).not.toHaveBeenCalled();
    });

    it('어느 칼럼에서 출발하든 Done으로 가면 complete다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.DONE);

      expect(mockApi.complete).toHaveBeenCalledWith(1);
      expect(mockApi.reorder).not.toHaveBeenCalled();
    });

    it('완료한 카드가 Done 칼럼에 보인다', async () => {
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
    });

    // complete는 Ticket 하나만 돌려준다. BoardData가 아니므로 보드를 다시 읽어야 한다
    it('완료한 뒤에는 보드를 다시 조회해 확정한다', async () => {
      mockApi.complete.mockResolvedValue(
        ticket({
          id: 1,
          title: '보드 구현',
          status: TICKET_STATUS.DONE,
          completedAt: '2026-09-07T10:00:00.000Z',
        }),
      );
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });
      await screen.findByText('보드 구현');
      expect(mockApi.getBoard).toHaveBeenCalledTimes(1);

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(mockApi.getBoard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('002-N2 · Done에서 나오는 이동', () => {
    it('complete가 아니라 reorder다', async () => {
      renderApp({
        [TICKET_STATUS.DONE]: [
          ticket({
            id: 1,
            title: '보드 구현',
            status: TICKET_STATUS.DONE,
            completedAt: '2026-09-07T10:00:00.000Z',
          }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.IN_PROGRESS);

      expect(mockApi.reorder).toHaveBeenCalledWith(
        1,
        TICKET_STATUS.IN_PROGRESS,
        expect.any(Number),
      );
      expect(mockApi.complete).not.toHaveBeenCalled();
    });

    it('Done에서 Backlog로 되돌릴 때도 reorder다', async () => {
      renderApp({
        [TICKET_STATUS.DONE]: [
          ticket({
            id: 1,
            title: '보드 구현',
            status: TICKET_STATUS.DONE,
            completedAt: '2026-09-07T10:00:00.000Z',
          }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.BACKLOG);

      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.BACKLOG, expect.any(Number));
      expect(mockApi.complete).not.toHaveBeenCalled();
    });
  });

  describe('002-N3 · Done에서 나온 뒤', () => {
    it('완료 표시가 사라진다', async () => {
      mockApi.reorder.mockResolvedValue(
        boardWith({
          [TICKET_STATUS.IN_PROGRESS]: [
            ticket({
              id: 1,
              title: '보드 구현',
              status: TICKET_STATUS.IN_PROGRESS,
              completedAt: null,
            }),
          ],
        }),
      );

      renderApp({
        [TICKET_STATUS.DONE]: [
          ticket({
            id: 1,
            title: '보드 구현',
            status: TICKET_STATUS.DONE,
            completedAt: '2026-09-07T10:00:00.000Z',
          }),
        ],
      });
      // "완료"만 찾으면 빈 Done 칼럼의 안내 문구
      // ("최근 24시간 내 완료한 티켓이 없습니다")까지 걸린다. 체크 표시로 좁힌다.
      expect(await screen.findByText('보드 구현')).toBeInTheDocument();
      expect(within(columnOf(TICKET_STATUS.DONE)).getByText(/✓ 완료/)).toBeInTheDocument();

      await dragCardToColumn('보드 구현', TICKET_STATUS.IN_PROGRESS);

      await waitFor(() => {
        expect(
          within(columnOf(TICKET_STATUS.IN_PROGRESS)).getByText('보드 구현'),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/✓ 완료/)).not.toBeInTheDocument();
    });
  });

  describe('002-N4 · Board 입장', () => {
    // Board는 어느 칼럼으로 드롭되든 onMove를 똑같이 부른다.
    // /complete와 /reorder가 있다는 사실 자체를 모른다 (명세 2.4).
    it('Done도 다른 칼럼과 똑같이 onMove로 알린다', async () => {
      const onMove = jest.fn();
      mockBoardLayout();
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.IN_PROGRESS]: [
              ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
            ],
          })}
          onMove={onMove}
          onTicketClick={noop}
        />,
      );

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      expect(onMove).toHaveBeenCalledWith(1, TICKET_STATUS.DONE, expect.any(Number));
    });

    it('Board만 렌더링하면 어떤 API도 호출되지 않는다', async () => {
      mockBoardLayout();
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.IN_PROGRESS]: [
              ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
            ],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      expect(mockApi.complete).not.toHaveBeenCalled();
      expect(mockApi.reorder).not.toHaveBeenCalled();
    });
  });

  describe('002-E1 · Done이 아닌 칼럼으로 이동', () => {
    it('Backlog에서 TODO로 옮기면 complete는 호출되지 않는다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.TODO, expect.any(Number));
      expect(mockApi.complete).not.toHaveBeenCalled();
    });
  });
});

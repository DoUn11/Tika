/**
 * TC-INT-004 · 완료는 삭제가 아니다 (FR-005)
 *
 * 관련 스토리: US-006(할 일 완료 처리)
 * 명세: docs/TEST_CASES.md TC-INT-004, docs/COMPONENT_SPEC.md 7.4
 *
 * DONE으로 옮기는 것과 지우는 것은 다른 동작이다. 완료는 status를 바꾸고
 * completedAt을 기록할 뿐 행은 그대로 남는다. 영구 삭제는 TC-INT-005다.
 *
 * 여기서 보드와 TicketModal이 처음 이어진다. 카드를 눌러 상세가 열려야
 * "완료된 티켓도 여전히 조회된다"를 확인할 수 있다.
 *
 * 쿼리는 칼럼이나 모달 버튼으로 범위를 좁힌다. 모달이 열리면 제목이
 * 카드와 모달 두 곳에 나타난다.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { columnOf, dragCardToColumn, renderApp } from '../helpers/app';
import { boardWith, ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi', () => ({
  ...jest.requireActual('@/client/api/ticketApi'),
  getBoard: jest.fn(),
  getById: jest.fn(),
  reorder: jest.fn(),
  complete: jest.fn(),
  remove: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const mockApi = jest.mocked(ticketApi);

const COMPLETED_AT = '2026-09-07T10:00:00.000Z';

const completedTicket = (): Ticket =>
  ticket({
    id: 1,
    title: '보드 구현',
    status: TICKET_STATUS.DONE,
    completedAt: COMPLETED_AT,
  });

/** 완료된 카드 하나만 있는 보드를 띄운다 */
const renderWithCompletedCard = () => {
  mockApi.getById.mockResolvedValue(completedTicket());
  return renderApp({ [TICKET_STATUS.DONE]: [completedTicket()] });
};

const clickCard = async (title: string): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${title},`) }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockReturnValue(new Promise<BoardData>(() => {}));
  mockApi.complete.mockReturnValue(new Promise<Ticket>(() => {}));
});

describe('TC-INT-004: 완료는 삭제가 아니다', () => {
  describe('004-N1 · Done으로 이동', () => {
    it('Done 칼럼에 카드가 남아 있다', async () => {
      mockApi.complete.mockResolvedValue(completedTicket());
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });
      await screen.findByText('보드 구현');

      // 완료 후 다시 읽는 보드는 그 티켓을 Done에 담고 있다
      mockApi.getBoard.mockResolvedValue(boardWith({ [TICKET_STATUS.DONE]: [completedTicket()] }));

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
      });
    });

    it('사라지지 않는다 — 어느 칼럼에도 없는 상태가 되지 않는다', async () => {
      mockApi.complete.mockResolvedValue(completedTicket());
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });
      await screen.findByText('보드 구현');
      mockApi.getBoard.mockResolvedValue(boardWith({ [TICKET_STATUS.DONE]: [completedTicket()] }));

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^보드 구현,/ })).toBeInTheDocument();
      });
    });
  });

  describe('004-N2 · 완료 후 카드 클릭', () => {
    it('상세 모달이 정상적으로 열린다', async () => {
      renderWithCompletedCard();

      await clickCard('보드 구현');

      expect(await screen.findByRole('button', { name: '편집' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    });

    it('그 티켓의 ID로 상세를 조회한다', async () => {
      renderWithCompletedCard();

      await clickCard('보드 구현');

      await waitFor(() => {
        expect(mockApi.getById).toHaveBeenCalledWith(1);
      });
    });

    it('완료된 티켓이라도 상세에서 계속 조회된다', async () => {
      renderWithCompletedCard();

      await clickCard('보드 구현');

      // 완료 시각이 상세에 보인다 — 행이 지워지지 않았다는 뜻이다
      expect(await screen.findByText('종료일')).toBeInTheDocument();
      expect(screen.getByText(/2026-09-07/)).toBeInTheDocument();
    });

    it('닫기를 누르면 모달이 사라진다', async () => {
      renderWithCompletedCard();

      await clickCard('보드 구현');
      await userEvent.click(await screen.findByRole('button', { name: '닫기' }));

      expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
      expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
    });

    it('모달을 열기 전에는 상세를 조회하지 않는다', async () => {
      renderWithCompletedCard();

      await screen.findByText('보드 구현');

      expect(mockApi.getById).not.toHaveBeenCalled();
    });
  });

  describe('004-N3 · 완료된 카드의 표시', () => {
    it('완료 표시가 보인다', async () => {
      renderWithCompletedCard();

      await screen.findByText('보드 구현');

      expect(within(columnOf(TICKET_STATUS.DONE)).getByText(/✓ 완료/)).toBeInTheDocument();
    });
  });

  describe('004-E1 · 완료만 하고 삭제 안 함', () => {
    it('remove가 호출되지 않는다', async () => {
      mockApi.complete.mockResolvedValue(completedTicket());
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });
      await screen.findByText('보드 구현');
      mockApi.getBoard.mockResolvedValue(boardWith({ [TICKET_STATUS.DONE]: [completedTicket()] }));

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(mockApi.complete).toHaveBeenCalledWith(1);
      });
      expect(mockApi.remove).not.toHaveBeenCalled();
    });

    it('모달을 열어 보기만 해도 삭제되지 않는다', async () => {
      renderWithCompletedCard();

      await clickCard('보드 구현');
      await screen.findByRole('button', { name: '편집' });

      expect(mockApi.remove).not.toHaveBeenCalled();
    });
  });
});

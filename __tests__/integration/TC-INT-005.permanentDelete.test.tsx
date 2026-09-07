/**
 * TC-INT-005 · 모달에서 영구 삭제 (FR-006)
 *
 * 관련 스토리: US-008(할 일 삭제)
 * 명세: docs/TEST_CASES.md TC-INT-005, docs/COMPONENT_SPEC.md 7.5
 *
 * 되돌릴 수 없는 경로다. 확인을 거쳐야만 지워지고, 지워지면 보드에서 사라진다.
 * TC-COMP-006이 모달 안에서의 확인 절차를 이미 봤으므로, 여기서는 그 확인이
 * 실제 삭제 요청과 보드 갱신까지 이어지는지를 본다.
 *
 * 화면에 "취소"가 둘일 수 있어(편집 취소·삭제 취소) 확인창 안쪽 버튼은
 * alertdialog 영역으로 좁혀서 찾는다.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/client/api/ticketApi';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { columnOf, renderApp } from '../helpers/app';
import { emptyBoard, ticket } from '../helpers/factories';

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

const doneTicket = (): Ticket =>
  ticket({
    id: 1,
    title: '보드 구현',
    status: TICKET_STATUS.DONE,
    completedAt: '2026-09-07T10:00:00.000Z',
  });

/** 완료된 카드 하나만 있는 보드를 띄운다 */
const renderWithCard = () => {
  mockApi.getById.mockResolvedValue(doneTicket());
  return renderApp({ [TICKET_STATUS.DONE]: [doneTicket()] });
};

/** 확인창 안쪽만 본다 — 바깥의 "취소"와 섞이지 않게 */
const dialog = () => within(screen.getByRole('alertdialog'));

/** 카드를 눌러 모달을 열고 "삭제"까지 누른다 */
const openDeleteConfirm = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: /^보드 구현,/ }));
  await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockReturnValue(new Promise<BoardData>(() => {}));
  mockApi.complete.mockReturnValue(new Promise<Ticket>(() => {}));
  mockApi.remove.mockResolvedValue(undefined);
});

describe('TC-INT-005: 모달에서 영구 삭제', () => {
  describe('005-N1 · 카드 클릭 → 삭제 → 확인', () => {
    it('remove가 호출된다', async () => {
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(mockApi.remove).toHaveBeenCalledWith(1);
      });
    });

    it('모달이 닫힌다', async () => {
      mockApi.getBoard.mockResolvedValue(emptyBoard());
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('005-N2 · 삭제 후 보드', () => {
    it('어느 칼럼에도 그 카드가 없다', async () => {
      renderWithCard();
      await screen.findByText('보드 구현');

      // 삭제 뒤 다시 읽는 보드에는 그 티켓이 없다
      mockApi.getBoard.mockResolvedValue(emptyBoard());

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^보드 구현,/ })).not.toBeInTheDocument();
      });
      expect(within(columnOf(TICKET_STATUS.DONE)).queryByText('보드 구현')).not.toBeInTheDocument();
    });
  });

  describe('005-N3 · 삭제 후 확정', () => {
    it('보드를 다시 조회한다', async () => {
      renderWithCard();
      await screen.findByText('보드 구현');
      expect(mockApi.getBoard).toHaveBeenCalledTimes(1);

      mockApi.getBoard.mockResolvedValue(emptyBoard());

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(mockApi.getBoard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('005-E1 · 확인창에서 취소', () => {
    it('remove가 호출되지 않는다', async () => {
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '취소' }));

      expect(mockApi.remove).not.toHaveBeenCalled();
    });

    it('카드가 그대로 남는다', async () => {
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '취소' }));

      expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument();
    });

    it('Esc로 취소해도 지워지지 않는다', async () => {
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.keyboard('{Escape}');

      expect(mockApi.remove).not.toHaveBeenCalled();
      expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
    });
  });

  describe('005-E2 · remove가 실패', () => {
    it('카드가 보드에 남는다', async () => {
      mockApi.remove.mockRejectedValue(new ApiError('서버 오류가 발생했습니다', 'INTERNAL_ERROR', 500));
      renderWithCard();

      await openDeleteConfirm();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(mockApi.remove).toHaveBeenCalledWith(1);
      });
      expect(within(columnOf(TICKET_STATUS.DONE)).getByText('보드 구현')).toBeInTheDocument();
    });
  });
});

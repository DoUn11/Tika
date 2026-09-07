/**
 * TC-INT-006 · 티켓 생성 → 보드 반영 (FR-001)
 *
 * 관련 스토리: US-001(새 할 일 등록), US-002(상세 정보 설정)
 * 명세: docs/TEST_CASES.md TC-INT-006, docs/COMPONENT_SPEC.md 5.1·5.2·7.2
 *
 * 헤더에서 폼을 열고, 만들고, 보드에 나타나는 데까지 이어지는지 본다.
 *
 * 폼 안에서의 입력·검증은 TC-COMP-004가 이미 봤다. 여기서 새로 확인하는
 * 것은 배선이다 — 헤더 버튼이 폼을 열고, 폼의 결과가 보드에 닿는지.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/client/api/ticketApi';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { columnOf, renderApp } from '../helpers/app';
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

const openForm = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: '새 티켓' }));
};

const titleInput = () => screen.getByLabelText('제목');

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockReturnValue(new Promise<BoardData>(() => {}));
  mockApi.complete.mockReturnValue(new Promise<Ticket>(() => {}));
  mockApi.create.mockResolvedValue(ticket({ id: 1, title: 'PRD 초안' }));
});

describe('TC-INT-006: 티켓 생성 → 보드 반영', () => {
  describe('006-N1 · "새 티켓" 클릭', () => {
    it('생성 폼이 열린다', async () => {
      renderApp();

      await openForm();

      expect(titleInput()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
    });

    it('처음에는 폼이 닫혀 있다', async () => {
      renderApp();

      await screen.findByRole('region', { name: 'Backlog' });

      expect(screen.queryByLabelText('제목')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
    });
  });

  describe('006-N2 · 제목만 입력하고 생성', () => {
    it('create가 호출된다', async () => {
      renderApp();

      await openForm();
      await userEvent.type(titleInput(), 'PRD 초안');
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(mockApi.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'PRD 초안', priority: 'MEDIUM' }),
        );
      });
    });

    it('폼이 닫힌다', async () => {
      renderApp();

      await openForm();
      await userEvent.type(titleInput(), 'PRD 초안');
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
      });
    });
  });

  describe('006-N3 · 생성 후', () => {
    it('보드를 다시 조회해 Backlog에 카드가 나타난다', async () => {
      renderApp();
      await screen.findByRole('region', { name: 'Backlog' });

      // 생성 뒤 다시 읽는 보드에는 그 티켓이 들어 있다
      mockApi.getBoard.mockResolvedValue(
        boardWith({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] }),
      );

      await openForm();
      await userEvent.type(titleInput(), 'PRD 초안');
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('PRD 초안')).toBeInTheDocument();
      });
    });

    it('보드 조회가 한 번 더 일어난다', async () => {
      renderApp();
      await screen.findByRole('region', { name: 'Backlog' });
      expect(mockApi.getBoard).toHaveBeenCalledTimes(1);

      await openForm();
      await userEvent.type(titleInput(), 'PRD 초안');
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(mockApi.getBoard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('006-N4 · 폼에서 취소', () => {
    it('폼이 닫히고 create는 호출되지 않는다', async () => {
      renderApp();

      await openForm();
      await userEvent.type(titleInput(), '쓰다 만 티켓');
      await userEvent.click(screen.getByRole('button', { name: '취소' }));

      expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
      expect(mockApi.create).not.toHaveBeenCalled();
    });

    it('다시 열면 입력 내용이 남아 있지 않다', async () => {
      renderApp();

      await openForm();
      await userEvent.type(titleInput(), '쓰다 만 티켓');
      await userEvent.click(screen.getByRole('button', { name: '취소' }));
      await openForm();

      expect(titleInput()).toHaveValue('');
    });
  });

  describe('006-E1 · 제목 없이 제출', () => {
    it('안내가 보이고 폼이 열린 채로 남는다', async () => {
      renderApp();

      await openForm();
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
      expect(mockApi.create).not.toHaveBeenCalled();
    });
  });

  describe('006-E2 · create가 실패', () => {
    it('실패가 안내되고 카드가 생기지 않는다', async () => {
      mockApi.create.mockRejectedValue(
        new ApiError('서버 오류가 발생했습니다', 'INTERNAL_ERROR', 500),
      );
      renderApp();

      await openForm();
      await userEvent.type(titleInput(), 'PRD 초안');
      await userEvent.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('서버 오류가 발생했습니다');
      });
      expect(
        within(columnOf(TICKET_STATUS.BACKLOG)).queryByText('PRD 초안'),
      ).not.toBeInTheDocument();
    });
  });
});

/**
 * TC-INT-003 · 이동 실패 → 롤백 (FR-007)
 *
 * 관련 스토리: US-005(드래그앤드롭 상태 변경)
 * 명세: docs/TEST_CASES.md TC-INT-003, docs/COMPONENT_SPEC.md 5.5·6.5
 *
 * 낙관적 업데이트의 뒷면이다. 화면을 먼저 바꿔 놓았으니, 요청이 실패하면
 * 되돌려야 한다. 그러지 않으면 화면이 서버에 없는 상태를 보여주게 된다.
 *
 * 되돌리는 것만으로는 부족하다. 안내가 없으면 사용자에게는 카드가 저절로
 * 튕겨 나온 것으로만 보인다 (명세 5.5).
 *
 * 쿼리는 칼럼이나 배너로 범위를 좁힌다. 화면 전체를 훑는 넓은 정규식은
 * 빈 칼럼 안내 문구 같은 엉뚱한 요소에 걸린다.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@/client/api/ticketApi';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData, Ticket } from '@/shared/types/ticket';
import { cancelDrag, columnOf, dragCardToColumn, renderApp } from '../helpers/app';
import { boardWith, ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi', () => ({
  ...jest.requireActual('@/client/api/ticketApi'),
  getBoard: jest.fn(),
  reorder: jest.fn(),
  complete: jest.fn(),
  remove: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
}));

const mockApi = jest.mocked(ticketApi);

const SERVER_MESSAGE = '서버 오류가 발생했습니다';

const serverError = () => new ApiError(SERVER_MESSAGE, 'INTERNAL_ERROR', 500);

/** 안내 배너 안에서만 찾는다 */
const banner = () => screen.getByRole('alert');

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockReturnValue(new Promise<BoardData>(() => {}));
  mockApi.complete.mockReturnValue(new Promise<Ticket>(() => {}));
});

describe('TC-INT-003: 이동 실패 → 롤백', () => {
  describe('003-N1 · 드래그 중 Esc', () => {
    it('아무것도 변경되지 않는다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await cancelDrag('PRD 초안');

      expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('PRD 초안')).toBeInTheDocument();
      expect(within(columnOf(TICKET_STATUS.TODO)).queryByText('PRD 초안')).not.toBeInTheDocument();
    });

    it('요청도 나가지 않는다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await cancelDrag('PRD 초안');

      expect(mockApi.reorder).not.toHaveBeenCalled();
      expect(mockApi.complete).not.toHaveBeenCalled();
    });
  });

  describe('003-E1 · reorder 실패', () => {
    it('카드가 원래 칼럼으로 돌아간다', async () => {
      mockApi.reorder.mockRejectedValue(serverError());
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('PRD 초안')).toBeInTheDocument();
      });
      expect(within(columnOf(TICKET_STATUS.TODO)).queryByText('PRD 초안')).not.toBeInTheDocument();
    });

    it('원래 자리의 순서까지 그대로 돌아온다', async () => {
      mockApi.reorder.mockRejectedValue(serverError());
      renderApp({
        [TICKET_STATUS.BACKLOG]: [
          ticket({ id: 1, title: '첫째', position: 0 }),
          ticket({ id: 2, title: '둘째', position: 1024 }),
        ],
      });

      await dragCardToColumn('첫째', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('첫째')).toBeInTheDocument();
      });

      const titles = within(columnOf(TICKET_STATUS.BACKLOG))
        .getAllByRole('button')
        .map((card) => card.textContent ?? '');
      expect(titles[0]).toContain('첫째');
      expect(titles[1]).toContain('둘째');
    });
  });

  describe('003-E2 · 롤백 안내', () => {
    it('서버가 보낸 문구가 안내된다', async () => {
      mockApi.reorder.mockRejectedValue(serverError());
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(banner()).toHaveTextContent(SERVER_MESSAGE);
      });
    });

    it('실패 전에는 안내가 없다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      expect(await screen.findByText('PRD 초안')).toBeInTheDocument();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('다음 이동이 성공하면 안내가 사라진다', async () => {
      mockApi.reorder.mockRejectedValueOnce(serverError());
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);
      await waitFor(() => {
        expect(banner()).toHaveTextContent(SERVER_MESSAGE);
      });

      mockApi.reorder.mockResolvedValue(
        boardWith({
          [TICKET_STATUS.TODO]: [
            ticket({ id: 1, title: 'PRD 초안', status: TICKET_STATUS.TODO }),
          ],
        }),
      );
      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('003-E3 · complete 실패', () => {
    it('카드가 원래 칼럼으로 돌아간다', async () => {
      mockApi.complete.mockRejectedValue(serverError());
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(
          within(columnOf(TICKET_STATUS.IN_PROGRESS)).getByText('보드 구현'),
        ).toBeInTheDocument();
      });
      expect(within(columnOf(TICKET_STATUS.DONE)).queryByText('보드 구현')).not.toBeInTheDocument();
    });

    it('완료에 실패해도 안내가 보인다', async () => {
      mockApi.complete.mockRejectedValue(serverError());
      renderApp({
        [TICKET_STATUS.IN_PROGRESS]: [
          ticket({ id: 1, title: '보드 구현', status: TICKET_STATUS.IN_PROGRESS }),
        ],
      });

      await dragCardToColumn('보드 구현', TICKET_STATUS.DONE);

      await waitFor(() => {
        expect(banner()).toHaveTextContent(SERVER_MESSAGE);
      });
    });
  });

  describe('003-E4 · 롤백 후 다시 이동', () => {
    it('스냅샷이 남지 않아 다음 이동이 정상 동작한다', async () => {
      mockApi.reorder.mockRejectedValueOnce(serverError());
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);
      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('PRD 초안')).toBeInTheDocument();
      });

      mockApi.reorder.mockResolvedValue(
        boardWith({
          [TICKET_STATUS.TODO]: [
            ticket({ id: 1, title: 'PRD 초안', status: TICKET_STATUS.TODO }),
          ],
        }),
      );
      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(within(columnOf(TICKET_STATUS.TODO)).getByText('PRD 초안')).toBeInTheDocument();
      });
      expect(mockApi.reorder).toHaveBeenCalledTimes(2);
    });
  });
});

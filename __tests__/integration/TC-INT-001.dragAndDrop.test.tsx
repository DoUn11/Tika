/**
 * TC-INT-001 · 드래그앤드롭 → 이동 반영 (FR-007)
 *
 * 관련 스토리: US-005(드래그앤드롭 상태 변경)
 * 명세: docs/TEST_CASES.md TC-INT-001, docs/COMPONENT_SPEC.md 2·6·7.1
 *
 * 카드를 옮기면 화면이 즉시 바뀌고 서버에 요청이 나가는지만 본다.
 * 완료 분기는 TC-INT-002, 실패 롤백은 TC-INT-003의 몫이다.
 *
 * ticketApi 모듈을 목킹한다. URL·메서드가 아니라 어떤 동작이 요청되었는지를
 * 검증한다. HTTP 형태는 TC-API-007이 이미 덮는다.
 */
import { screen, waitFor, within } from '@testing-library/react';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import type { BoardData } from '@/shared/types/ticket';
import {
  columnOf,
  dragCardToColumn,
  moveCardDown,
  renderApp,
} from '../helpers/app';
import { boardWith, emptyBoard, ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi');

const mockApi = jest.mocked(ticketApi);

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.reorder.mockResolvedValue(emptyBoard());
});

describe('TC-INT-001: 드래그앤드롭 → 이동 반영', () => {
  describe('001-N1 · 앱을 연다', () => {
    it('조회한 보드가 4칼럼에 그려진다', async () => {
      renderApp({
        [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })],
        [TICKET_STATUS.TODO]: [ticket({ id: 2, title: 'API 설계', status: TICKET_STATUS.TODO })],
      });

      expect(await screen.findByText('PRD 초안')).toBeInTheDocument();
      expect(screen.getAllByRole('region')).toHaveLength(4);
      expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('PRD 초안')).toBeInTheDocument();
      expect(within(columnOf(TICKET_STATUS.TODO)).getByText('API 설계')).toBeInTheDocument();
    });

    it('보드를 한 번 조회한다', async () => {
      renderApp();

      await screen.findByRole('region', { name: 'Backlog' });

      expect(mockApi.getBoard).toHaveBeenCalledTimes(1);
    });
  });

  describe('001-N2 · Backlog 카드를 TODO로 이동', () => {
    it('카드가 TODO에 나타나고 reorder가 호출된다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      expect(within(columnOf(TICKET_STATUS.TODO)).getByText('PRD 초안')).toBeInTheDocument();
      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.TODO, expect.any(Number));
    });

    it('원래 칼럼에서는 사라진다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      expect(
        within(columnOf(TICKET_STATUS.BACKLOG)).queryByText('PRD 초안'),
      ).not.toBeInTheDocument();
    });

    it('두 칼럼을 건너뛰는 이동도 된다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.IN_PROGRESS);

      expect(mockApi.reorder).toHaveBeenCalledWith(
        1,
        TICKET_STATUS.IN_PROGRESS,
        expect.any(Number),
      );
    });
  });

  describe('001-N3 · 낙관적 업데이트', () => {
    it('응답이 오기 전에 이미 이동되어 보인다', async () => {
      // 응답을 붙잡아 둔다. 이 사이에 화면이 이미 바뀌어 있어야 한다
      let settle: (board: BoardData) => void = () => {};
      mockApi.reorder.mockReturnValue(
        new Promise<BoardData>((resolve) => {
          settle = resolve;
        }),
      );

      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      expect(within(columnOf(TICKET_STATUS.TODO)).getByText('PRD 초안')).toBeInTheDocument();

      settle(emptyBoard());
    });
  });

  describe('001-N4 · 같은 칼럼 내 순서 변경', () => {
    it('순서가 바뀌고 reorder가 호출된다', async () => {
      renderApp({
        [TICKET_STATUS.BACKLOG]: [
          ticket({ id: 1, title: '첫째', position: 0 }),
          ticket({ id: 2, title: '둘째', position: 1024 }),
        ],
      });

      await moveCardDown('첫째');

      const titles = within(columnOf(TICKET_STATUS.BACKLOG))
        .getAllByRole('button')
        .map((card) => card.textContent ?? '');

      expect(titles[0]).toContain('둘째');
      expect(titles[1]).toContain('첫째');
      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.BACKLOG, expect.any(Number));
    });
  });

  describe('001-N5 · 역방향 이동', () => {
    it('TODO에서 Backlog로 되돌릴 수 있다', async () => {
      renderApp({
        [TICKET_STATUS.TODO]: [ticket({ id: 1, title: 'API 설계', status: TICKET_STATUS.TODO })],
      });

      await dragCardToColumn('API 설계', TICKET_STATUS.BACKLOG);

      expect(within(columnOf(TICKET_STATUS.BACKLOG)).getByText('API 설계')).toBeInTheDocument();
      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.BACKLOG, expect.any(Number));
    });
  });

  describe('001-N6 · 응답 도착', () => {
    it('서버가 준 BoardData로 확정된다', async () => {
      // 서버는 클라이언트가 놓은 자리와 다른 결과를 줄 수 있다.
      // 확정은 언제나 서버 응답이 기준이다.
      mockApi.reorder.mockResolvedValue(
        boardWith({
          [TICKET_STATUS.IN_PROGRESS]: [
            ticket({ id: 1, title: 'PRD 초안', status: TICKET_STATUS.IN_PROGRESS }),
          ],
        }),
      );

      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      await waitFor(() => {
        expect(
          within(columnOf(TICKET_STATUS.IN_PROGRESS)).getByText('PRD 초안'),
        ).toBeInTheDocument();
      });
      expect(within(columnOf(TICKET_STATUS.TODO)).queryByText('PRD 초안')).not.toBeInTheDocument();
    });
  });

  describe('001-E1 · 빈 칼럼으로 이동', () => {
    it('position 0으로 요청된다', async () => {
      renderApp({ [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })] });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      expect(mockApi.reorder).toHaveBeenCalledWith(1, TICKET_STATUS.TODO, 0);
    });

    it('카드가 있는 칼럼의 맨 앞으로 가면 그 카드보다 작은 position이다', async () => {
      renderApp({
        [TICKET_STATUS.BACKLOG]: [ticket({ id: 1, title: 'PRD 초안' })],
        [TICKET_STATUS.TODO]: [
          ticket({ id: 2, title: 'API 설계', status: TICKET_STATUS.TODO, position: 0 }),
        ],
      });

      await dragCardToColumn('PRD 초안', TICKET_STATUS.TODO);

      const [, , position] = mockApi.reorder.mock.calls[0] ?? [];
      expect(position).toBeLessThan(0);
    });
  });
});

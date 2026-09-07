/**
 * TC-COMP-002 · Board — 4칼럼 렌더링 (FR-002)
 *
 * 관련 스토리: US-003(보드 현황 파악)
 * 명세: docs/COMPONENT_SPEC.md 2·3장, docs/TEST_CASES.md TC-COMP-002
 *
 * 칼럼 내부의 카드 수·정렬은 TC-COMP-003의 몫이다. 여기서는 Board가
 * 4칼럼을 고정 순서로 세우고, 받은 board를 그대로 각 칼럼에 흘려보내는지만 본다.
 *
 * 드래그(COMPONENT_SPEC 2.3)는 TC-INT-001에서 다룬다.
 *
 * 칼럼 제목은 명세 3.2의 문구를 그대로 쓴다. COLUMN_LABEL 상수를 재사용하면
 * 상수가 틀려도 테스트가 통과하므로 리터럴로 적는다.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TICKET_STATUS } from '@/shared/constants/ticket';
import { Board } from '@/client/components/Board';
import { boardWith, emptyBoard, ticket } from '../helpers/factories';

const noop = () => {};

/** 명세 3.2의 칼럼 정의 — 순서는 COLUMN_ORDER를 따른다 */
const COLUMN_TITLES = ['Backlog', 'TODO', 'In Progress', 'Done'];

/** 명세 3.4의 빈 칼럼 안내 문구 */
const EMPTY_MESSAGE = {
  BACKLOG: '새 티켓을 추가해보세요',
  TODO: '착수할 티켓을 여기로 옮기세요',
  IN_PROGRESS: '진행 중인 티켓이 없습니다',
  DONE: '최근 24시간 내 완료한 티켓이 없습니다',
} as const;

/** 칼럼은 이름 있는 section이라 region 랜드마크가 된다 (명세 3.5) */
const column = (title: string) => within(screen.getByRole('region', { name: title }));

describe('TC-COMP-002: Board — 4칼럼 렌더링', () => {
  describe('002-N1 · 보드를 연다', () => {
    it('Backlog, TODO, In Progress, Done 4칼럼이 보인다', () => {
      render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

      const headings = screen.getAllByRole('heading');

      expect(headings.map((heading) => heading.textContent)).toEqual(
        expect.arrayContaining(COLUMN_TITLES),
      );
    });

    it('각 칼럼이 이름 있는 영역으로 구분된다', () => {
      render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

      for (const title of COLUMN_TITLES) {
        expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
      }
    });
  });

  describe('002-N2 · 칼럼 순서', () => {
    it('항상 Backlog → TODO → In Progress → Done 순으로 나열된다', () => {
      render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

      const headings = screen.getAllByRole('heading');

      expect(headings.map((heading) => heading.textContent)).toEqual(COLUMN_TITLES);
    });

    // 카드가 있어도 순서는 흔들리지 않는다
    it('티켓이 있어도 칼럼 순서는 그대로다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.DONE]: [ticket({ title: '끝난 일', status: TICKET_STATUS.DONE })],
            [TICKET_STATUS.TODO]: [ticket({ title: '할 일', status: TICKET_STATUS.TODO })],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      const headings = screen.getAllByRole('heading');

      expect(headings.map((heading) => heading.textContent)).toEqual(COLUMN_TITLES);
    });
  });

  describe('002-N3 · 티켓이 있는 보드', () => {
    it('각 티켓이 해당 칼럼에 표시된다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.BACKLOG]: [ticket({ title: '아이디어 정리' })],
            [TICKET_STATUS.TODO]: [ticket({ title: 'API 설계', status: TICKET_STATUS.TODO })],
            [TICKET_STATUS.IN_PROGRESS]: [
              ticket({ title: '스키마 작성', status: TICKET_STATUS.IN_PROGRESS }),
            ],
            [TICKET_STATUS.DONE]: [ticket({ title: '명세 리뷰', status: TICKET_STATUS.DONE })],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(column('Backlog').getByText('아이디어 정리')).toBeInTheDocument();
      expect(column('TODO').getByText('API 설계')).toBeInTheDocument();
      expect(column('In Progress').getByText('스키마 작성')).toBeInTheDocument();
      expect(column('Done').getByText('명세 리뷰')).toBeInTheDocument();
    });

    it('한 칼럼의 티켓이 다른 칼럼에 새어 나오지 않는다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.BACKLOG]: [ticket({ title: '아이디어 정리' })],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(column('TODO').queryByText('아이디어 정리')).not.toBeInTheDocument();
      expect(column('In Progress').queryByText('아이디어 정리')).not.toBeInTheDocument();
      expect(column('Done').queryByText('아이디어 정리')).not.toBeInTheDocument();
    });

    it('한 칼럼에 여러 티켓이 모두 표시된다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.TODO]: [
              ticket({ title: '첫째', status: TICKET_STATUS.TODO }),
              ticket({ title: '둘째', status: TICKET_STATUS.TODO }),
              ticket({ title: '셋째', status: TICKET_STATUS.TODO }),
            ],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      const todo = column('TODO');
      expect(todo.getByText('첫째')).toBeInTheDocument();
      expect(todo.getByText('둘째')).toBeInTheDocument();
      expect(todo.getByText('셋째')).toBeInTheDocument();
    });

    // Board는 board를 그대로 받는다. status로 다시 그룹화하지 않는다 (명세 2.1)
    it('티켓의 status가 아니라 board의 칼럼 키를 따라 배치한다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.BACKLOG]: [
              ticket({ title: '엉뚱한 티켓', status: TICKET_STATUS.IN_PROGRESS }),
            ],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(column('Backlog').getByText('엉뚱한 티켓')).toBeInTheDocument();
      expect(column('In Progress').queryByText('엉뚱한 티켓')).not.toBeInTheDocument();
    });

    // 클라이언트는 Done 24시간 필터를 추가로 적용하지 않는다 (명세 3.6)
    it('Done 칼럼의 티켓을 클라이언트가 걸러내지 않는다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.DONE]: [
              ticket({
                title: '한참 전에 끝낸 일',
                status: TICKET_STATUS.DONE,
                completedAt: '2020-01-01T00:00:00.000Z',
              }),
            ],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(column('Done').getByText('한참 전에 끝낸 일')).toBeInTheDocument();
    });
  });

  describe('002-N4 · 티켓이 없는 보드', () => {
    it('4칼럼이 모두 보인다', () => {
      render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

      expect(screen.getAllByRole('region')).toHaveLength(4);
    });

    it('칼럼마다 서로 다른 안내 문구가 보인다', () => {
      render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

      expect(column('Backlog').getByText(EMPTY_MESSAGE.BACKLOG)).toBeInTheDocument();
      expect(column('TODO').getByText(EMPTY_MESSAGE.TODO)).toBeInTheDocument();
      expect(column('In Progress').getByText(EMPTY_MESSAGE.IN_PROGRESS)).toBeInTheDocument();
      expect(column('Done').getByText(EMPTY_MESSAGE.DONE)).toBeInTheDocument();
    });
  });

  describe('002-E1 · 특정 칼럼만 비어 있음', () => {
    it('비어 있는 칼럼에만 안내 문구가 보인다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.TODO]: [ticket({ title: 'API 설계', status: TICKET_STATUS.TODO })],
            [TICKET_STATUS.IN_PROGRESS]: [
              ticket({ title: '스키마 작성', status: TICKET_STATUS.IN_PROGRESS }),
            ],
            [TICKET_STATUS.DONE]: [ticket({ title: '명세 리뷰', status: TICKET_STATUS.DONE })],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(screen.getByText(EMPTY_MESSAGE.BACKLOG)).toBeInTheDocument();
      expect(screen.queryByText(EMPTY_MESSAGE.TODO)).not.toBeInTheDocument();
      expect(screen.queryByText(EMPTY_MESSAGE.IN_PROGRESS)).not.toBeInTheDocument();
      expect(screen.queryByText(EMPTY_MESSAGE.DONE)).not.toBeInTheDocument();
    });

    it('티켓이 있는 칼럼에는 안내 문구가 보이지 않는다', () => {
      render(
        <Board
          board={boardWith({
            [TICKET_STATUS.BACKLOG]: [ticket({ title: '아이디어 정리' })],
          })}
          onMove={noop}
          onTicketClick={noop}
        />,
      );

      expect(column('Backlog').queryByText(EMPTY_MESSAGE.BACKLOG)).not.toBeInTheDocument();
      expect(column('TODO').getByText(EMPTY_MESSAGE.TODO)).toBeInTheDocument();
    });
  });

  describe('카드 클릭 전달 (COMPONENT_SPEC 2.1)', () => {
    it('카드를 클릭하면 그 티켓의 ID로 상세 보기를 요청한다', async () => {
      const onTicketClick = jest.fn();
      const target = ticket({ id: 42, title: 'API 설계', status: TICKET_STATUS.TODO });

      render(
        <Board
          board={boardWith({ [TICKET_STATUS.TODO]: [target] })}
          onMove={noop}
          onTicketClick={onTicketClick}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /API 설계/ }));

      expect(onTicketClick).toHaveBeenCalledWith(42);
    });
  });
});

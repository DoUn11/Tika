/**
 * TC-COMP-003 · Column — 카드 수·정렬·빈 상태 (FR-002)
 *
 * 관련 스토리: US-003(보드 현황 파악)
 * 명세: docs/COMPONENT_SPEC.md 3장, docs/TEST_CASES.md TC-COMP-003
 *
 * TC-COMP-002가 Board 수준에서 "4칼럼이 선다"를 봤다면, 여기서는 칼럼
 * 하나가 목록을 어떻게 다루는지를 본다 — 개수, 정렬, 빈 상태.
 *
 * 안내 문구는 명세 3.4의 문구를 그대로 쓴다. 상수를 재사용하면 상수가
 * 틀려도 테스트가 통과하므로 리터럴로 적는다.
 */
import { render, screen, within } from '@testing-library/react';
import { TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import { Column } from '@/client/components/Column';
import { ticket } from '../helpers/factories';

const noop = () => {};

/** 카드에 보이는 제목 순서 — TicketCard가 role="button"이다 */
const renderedTitles = (): string[] =>
  screen.getAllByRole('button').map((card) => card.textContent ?? '');

describe('TC-COMP-003: Column — 카드 수·정렬·빈 상태', () => {
  describe('003-N1 · 카드 수', () => {
    it('티켓 3개가 있으면 헤더에 3이 보인다', () => {
      render(
        <Column
          status={TICKET_STATUS.TODO}
          title="TODO"
          tickets={[ticket(), ticket(), ticket()]}
          onTicketClick={noop}
        />,
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it.each([[0], [1], [5]])('티켓이 %i개면 그 수가 보인다', (count) => {
      render(
        <Column
          status={TICKET_STATUS.TODO}
          title="TODO"
          tickets={Array.from({ length: count }, () => ticket())}
          onTicketClick={noop}
        />,
      );

      expect(screen.getByText(String(count))).toBeInTheDocument();
    });

    // 카드 수를 제목 안에 넣으면 랜드마크 이름이 "TODO 3"으로 읽힌다 (명세 3.5)
    it('카드 수는 칼럼 제목 밖에 있어 랜드마크 이름을 흐리지 않는다', () => {
      render(
        <Column
          status={TICKET_STATUS.TODO}
          title="TODO"
          tickets={[ticket(), ticket(), ticket()]}
          onTicketClick={noop}
        />,
      );

      expect(screen.getByRole('heading')).toHaveTextContent(/^TODO$/);
      expect(screen.getByRole('region', { name: 'TODO' })).toBeInTheDocument();
    });
  });

  describe('003-N2 · 정렬', () => {
    it('position 오름차순으로 위에서 아래로 배치된다', () => {
      render(
        <Column
          status={TICKET_STATUS.TODO}
          title="TODO"
          tickets={[
            ticket({ title: '셋째', position: 2048 }),
            ticket({ title: '첫째', position: -1024 }),
            ticket({ title: '둘째', position: 0 }),
          ]}
          onTicketClick={noop}
        />,
      );

      const titles = renderedTitles();

      expect(titles[0]).toContain('첫째');
      expect(titles[1]).toContain('둘째');
      expect(titles[2]).toContain('셋째');
    });

    it('음수 position도 순서에 맞게 놓인다', () => {
      render(
        <Column
          status={TICKET_STATUS.BACKLOG}
          title="Backlog"
          tickets={[
            ticket({ title: '아래', position: -1024 }),
            ticket({ title: '위', position: -3072 }),
            ticket({ title: '가운데', position: -2048 }),
          ]}
          onTicketClick={noop}
        />,
      );

      const titles = renderedTitles();

      expect(titles[0]).toContain('위');
      expect(titles[1]).toContain('가운데');
      expect(titles[2]).toContain('아래');
    });

    // 정렬하느라 board 배열을 뒤집으면 Board의 낙관적 업데이트 롤백이 깨진다 (명세 2.2)
    it('전달받은 배열 자체를 바꾸지 않는다', () => {
      const tickets = [
        ticket({ title: '셋째', position: 2048 }),
        ticket({ title: '첫째', position: -1024 }),
        ticket({ title: '둘째', position: 0 }),
      ];

      render(
        <Column
          status={TICKET_STATUS.TODO}
          title="TODO"
          tickets={tickets}
          onTicketClick={noop}
        />,
      );

      expect(tickets.map((t) => t.title)).toEqual(['셋째', '첫째', '둘째']);
    });
  });

  describe('003-N3~N6 · 빈 칼럼 안내 문구', () => {
    it.each<[TicketStatus, string, string]>([
      [TICKET_STATUS.BACKLOG, 'Backlog', '새 티켓을 추가해보세요'],
      [TICKET_STATUS.TODO, 'TODO', '착수할 티켓을 여기로 옮기세요'],
      [TICKET_STATUS.IN_PROGRESS, 'In Progress', '진행 중인 티켓이 없습니다'],
      [TICKET_STATUS.DONE, 'Done', '최근 24시간 내 완료한 티켓이 없습니다'],
    ])('빈 %s 칼럼에는 "%s" 안내가 보인다', (status, title, message) => {
      render(<Column status={status} title={title} tickets={[]} onTicketClick={noop} />);

      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('칼럼마다 자기 문구만 보인다', () => {
      render(
        <Column
          status={TICKET_STATUS.BACKLOG}
          title="Backlog"
          tickets={[]}
          onTicketClick={noop}
        />,
      );

      expect(screen.getByText('새 티켓을 추가해보세요')).toBeInTheDocument();
      expect(screen.queryByText('착수할 티켓을 여기로 옮기세요')).not.toBeInTheDocument();
      expect(screen.queryByText('진행 중인 티켓이 없습니다')).not.toBeInTheDocument();
      expect(screen.queryByText('최근 24시간 내 완료한 티켓이 없습니다')).not.toBeInTheDocument();
    });

    // 사라진 완료 티켓을 삭제로 오해하지 않게 "최근 24시간 내"를 밝힌다 (명세 3.4)
    it('빈 Done 칼럼은 24시간 기준임을 밝힌다', () => {
      render(<Column status={TICKET_STATUS.DONE} title="Done" tickets={[]} onTicketClick={noop} />);

      expect(screen.getByText(/최근 24시간 내/)).toBeInTheDocument();
    });

    it('빈 칼럼에는 카드가 하나도 없다', () => {
      render(<Column status={TICKET_STATUS.TODO} title="TODO" tickets={[]} onTicketClick={noop} />);

      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('003-E1 · 티켓이 있는 칼럼', () => {
    it('안내 문구가 보이지 않는다', () => {
      render(
        <Column
          status={TICKET_STATUS.BACKLOG}
          title="Backlog"
          tickets={[ticket({ title: '아이디어 정리' })]}
          onTicketClick={noop}
        />,
      );

      expect(screen.queryByText('새 티켓을 추가해보세요')).not.toBeInTheDocument();
      expect(screen.getByText('아이디어 정리')).toBeInTheDocument();
    });

    it('티켓이 하나만 있어도 안내 문구는 사라진다', () => {
      render(
        <Column
          status={TICKET_STATUS.DONE}
          title="Done"
          tickets={[ticket({ title: '명세 리뷰', status: TICKET_STATUS.DONE })]}
          onTicketClick={noop}
        />,
      );

      expect(screen.queryByText('최근 24시간 내 완료한 티켓이 없습니다')).not.toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Done' })).getByText('명세 리뷰')).toBeInTheDocument();
    });
  });
});

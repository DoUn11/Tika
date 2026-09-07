/**
 * TC-COMP-001 · TicketCard — 오버듀 표시 (FR-008)
 *
 * 관련 스토리: US-004(마감 초과 인지)
 * 명세: docs/COMPONENT_SPEC.md 4장, docs/TEST_CASES.md TC-COMP-001
 *
 * 사용자가 보는 것과 하는 행동만 검증한다 (TEST_CASES 4.1).
 * CSS 클래스명·DOM 구조·내부 상태는 검증하지 않는다. 좌측 띠·테두리·
 * 글자색 같은 순수 시각 표현은 jsdom에서 확인할 수 없으므로,
 * 같은 정보를 담는 ⚠ 아이콘과 접근 가능한 이름으로 검증한다.
 *
 * 드래그(COMPONENT_SPEC 4.6)는 여기서 다루지 않는다. TC-INT-001의 몫이다.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TICKET_PRIORITY, TICKET_STATUS, type TicketStatus } from '@/shared/constants/ticket';
import { TicketCard } from '@/client/components/TicketCard';
import { ticket } from '../helpers/factories';

const noop = () => {};

describe('TC-COMP-001: TicketCard — 오버듀 표시', () => {
  describe('001-N1 · 일반 티켓 카드', () => {
    it('제목, 우선순위, 종료예정일이 보인다', () => {
      render(
        <TicketCard
          ticket={ticket({ title: 'API 설계', priority: TICKET_PRIORITY.HIGH, dueDate: '2026-09-03' })}
          onClick={noop}
        />,
      );

      expect(screen.getByText('API 설계')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText(/09\/03/)).toBeInTheDocument();
    });

    it('종료예정일은 MM/DD 형식으로 보인다', () => {
      render(<TicketCard ticket={ticket({ dueDate: '2026-12-25' })} onClick={noop} />);

      expect(screen.getByText(/12\/25/)).toBeInTheDocument();
      expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
    });
  });

  describe('001-N2 · 오버듀 티켓 카드', () => {
    it('일정이 초과된 티켓에는 경고 표시가 보인다', () => {
      render(
        <TicketCard ticket={ticket({ isOverdue: true, dueDate: '2026-09-01' })} onClick={noop} />,
      );

      expect(screen.getByLabelText(/일정 초과/)).toBeInTheDocument();
    });

    it('일정이 남은 티켓에는 경고 표시가 보이지 않는다', () => {
      render(<TicketCard ticket={ticket({ isOverdue: false })} onClick={noop} />);

      expect(screen.queryByLabelText(/일정 초과/)).not.toBeInTheDocument();
    });

    // 색상만으로 구분하지 않는다 (NFR-003, COMPONENT_SPEC 4.4)
    it('종료예정일 앞에 ⚠ 아이콘이 함께 보인다', () => {
      render(
        <TicketCard ticket={ticket({ isOverdue: true, dueDate: '2026-09-01' })} onClick={noop} />,
      );

      expect(screen.getByText(/⚠/)).toBeInTheDocument();
      expect(screen.getByText(/09\/01/)).toBeInTheDocument();
    });

    it('일정이 남은 티켓에는 ⚠ 아이콘이 보이지 않는다', () => {
      render(
        <TicketCard ticket={ticket({ isOverdue: false, dueDate: '2026-12-25' })} onClick={noop} />,
      );

      expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    });

    // isOverdue는 서버 계산값이다. 카드는 dueDate로 다시 판정하지 않는다 (4.4)
    it('종료예정일이 지났어도 isOverdue가 false면 경고하지 않는다', () => {
      render(
        <TicketCard ticket={ticket({ isOverdue: false, dueDate: '2020-01-01' })} onClick={noop} />,
      );

      expect(screen.queryByLabelText(/일정 초과/)).not.toBeInTheDocument();
      expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    });

    it('종료예정일이 미래여도 isOverdue가 true면 경고한다', () => {
      render(
        <TicketCard ticket={ticket({ isOverdue: true, dueDate: '2099-12-31' })} onClick={noop} />,
      );

      expect(screen.getByLabelText(/일정 초과/)).toBeInTheDocument();
    });

    // 우선순위와 오버듀는 다른 표현 채널을 쓴다 (4.3)
    it('오버듀 카드에서도 우선순위 뱃지는 그대로 보인다', () => {
      render(
        <TicketCard
          ticket={ticket({ isOverdue: true, priority: TICKET_PRIORITY.HIGH, dueDate: '2026-09-01' })}
          onClick={noop}
        />,
      );

      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByLabelText(/일정 초과/)).toBeInTheDocument();
    });
  });

  describe('001-N3 · 종료예정일이 없는 카드', () => {
    it('날짜가 보이지 않는다', () => {
      render(<TicketCard ticket={ticket({ dueDate: null, title: '날짜 없음' })} onClick={noop} />);

      expect(screen.getByText('날짜 없음')).toBeInTheDocument();
      expect(screen.queryByText(/\d{2}\/\d{2}/)).not.toBeInTheDocument();
    });

    it('종료예정일이 없으면 ⚠도 보이지 않는다', () => {
      render(<TicketCard ticket={ticket({ dueDate: null, isOverdue: false })} onClick={noop} />);

      expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    });
  });

  describe('001-N4 · 우선순위별 카드', () => {
    it.each([[TICKET_PRIORITY.LOW], [TICKET_PRIORITY.MEDIUM], [TICKET_PRIORITY.HIGH]])(
      '%s 우선순위가 카드에 표시된다',
      (priority) => {
        render(<TicketCard ticket={ticket({ priority })} onClick={noop} />);

        expect(screen.getByText(priority)).toBeInTheDocument();
      },
    );

    it('우선순위마다 서로 다른 값이 보인다', () => {
      const { unmount } = render(
        <TicketCard ticket={ticket({ priority: TICKET_PRIORITY.LOW })} onClick={noop} />,
      );
      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
      unmount();

      render(<TicketCard ticket={ticket({ priority: TICKET_PRIORITY.HIGH })} onClick={noop} />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.queryByText('LOW')).not.toBeInTheDocument();
    });
  });

  describe('001-N5 · 스크린 리더 사용자', () => {
    // aria-label: "{제목}, {우선순위} 우선순위, {상태} 칼럼" (COMPONENT_SPEC 4.7)
    it('제목·우선순위·상태를 읽을 수 있다', () => {
      render(
        <TicketCard
          ticket={ticket({
            title: '테스트 작성',
            priority: TICKET_PRIORITY.HIGH,
            status: TICKET_STATUS.BACKLOG,
          })}
          onClick={noop}
        />,
      );

      expect(
        screen.getByRole('button', { name: '테스트 작성, HIGH 우선순위, Backlog 칼럼' }),
      ).toBeInTheDocument();
    });

    it.each<[TicketStatus, string]>([
      [TICKET_STATUS.BACKLOG, 'Backlog'],
      [TICKET_STATUS.TODO, 'TODO'],
      [TICKET_STATUS.IN_PROGRESS, 'In Progress'],
      [TICKET_STATUS.DONE, 'Done'],
    ])('%s 상태는 "%s 칼럼"으로 읽힌다', (status, label) => {
      render(<TicketCard ticket={ticket({ title: '티켓', status })} onClick={noop} />);

      expect(
        screen.getByRole('button', { name: `티켓, MEDIUM 우선순위, ${label} 칼럼` }),
      ).toBeInTheDocument();
    });

    it('오버듀 티켓은 초과 여부까지 읽을 수 있다', () => {
      render(
        <TicketCard
          ticket={ticket({
            title: '테스트 케이스 작성',
            priority: TICKET_PRIORITY.HIGH,
            status: TICKET_STATUS.BACKLOG,
            dueDate: '2026-09-01',
            isOverdue: true,
          })}
          onClick={noop}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: '테스트 케이스 작성, HIGH 우선순위, Backlog 칼럼, 일정 초과',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('완료 표시 (COMPONENT_SPEC 4.2)', () => {
    it('DONE 상태이면 완료 표시가 보인다', () => {
      render(
        <TicketCard
          ticket={ticket({
            status: TICKET_STATUS.DONE,
            completedAt: '2026-09-02T10:00:00.000Z',
          })}
          onClick={noop}
        />,
      );

      expect(screen.getByText(/완료/)).toBeInTheDocument();
    });

    it('DONE이 아니면 완료 표시가 보이지 않는다', () => {
      render(<TicketCard ticket={ticket({ status: TICKET_STATUS.IN_PROGRESS })} onClick={noop} />);

      expect(screen.queryByText(/완료/)).not.toBeInTheDocument();
    });
  });

  describe('상세 보기 요청 (COMPONENT_SPEC 4.7)', () => {
    it('카드를 클릭하면 상세 보기를 요청한다', async () => {
      const onClick = jest.fn();
      render(<TicketCard ticket={ticket()} onClick={onClick} />);

      await userEvent.click(screen.getByRole('button', { name: /테스트 티켓/ }));

      expect(onClick).toHaveBeenCalled();
    });

    it('카드에 포커스를 두고 Enter를 누르면 상세 보기를 요청한다', async () => {
      const onClick = jest.fn();
      render(<TicketCard ticket={ticket()} onClick={onClick} />);

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /테스트 티켓/ })).toHaveFocus();

      await userEvent.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalled();
    });

    // Space는 키보드 드래그의 "집기"가 쓴다. 상세 열기는 Enter만이다 (4.7).
    it('Space는 상세 보기를 요청하지 않는다 — 드래그 집기용이다', async () => {
      const onClick = jest.fn();
      render(<TicketCard ticket={ticket()} onClick={onClick} />);

      await userEvent.tab();
      await userEvent.keyboard('[Space]');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('001-E1 · 제목이 매우 긴 카드', () => {
    // 2줄 말줄임은 CSS라 jsdom에서 확인할 수 없다.
    // 텍스트가 잘리지 않고 다른 요소도 함께 남는지로 대신 검증한다.
    it('긴 제목이 잘리지 않고 다른 정보도 함께 보인다', () => {
      const longTitle = '가'.repeat(200);

      render(
        <TicketCard
          ticket={ticket({
            title: longTitle,
            priority: TICKET_PRIORITY.HIGH,
            dueDate: '2026-09-03',
          })}
          onClick={noop}
        />,
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText(/09\/03/)).toBeInTheDocument();
    });

    it('긴 제목도 접근 가능한 이름에 온전히 담긴다', () => {
      const longTitle = '가'.repeat(200);

      render(<TicketCard ticket={ticket({ title: longTitle })} onClick={noop} />);

      expect(
        screen.getByRole('button', { name: `${longTitle}, MEDIUM 우선순위, Backlog 칼럼` }),
      ).toBeInTheDocument();
    });
  });
});

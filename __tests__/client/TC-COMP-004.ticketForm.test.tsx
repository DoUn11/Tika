/**
 * TC-COMP-004 · TicketForm — 티켓 생성 (FR-001)
 *
 * 관련 스토리: US-001(할 일 등록), US-002(상세 정보 설정)
 * 명세: docs/COMPONENT_SPEC.md 5.2, docs/TEST_CASES.md TC-COMP-004
 *
 * 폼은 HTTP를 모른다. onSubmit 콜백에 무엇을 넘기는지가 계약이다.
 * 실제 요청은 useTickets가 만든다.
 *
 * 에러 문구는 REQUIREMENTS.md FR-001의 문구를 리터럴로 적는다.
 * createTicketSchema에서 가져오면 스키마가 틀려도 테스트가 통과한다.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketForm } from '@/client/components/TicketForm';

const noop = () => {};

/** 검증 결과가 오늘 날짜에 흔들리지 않도록 충분히 먼 값을 쓴다 */
const FUTURE_DATE = '2099-12-31';
const PAST_DATE = '2020-01-01';

const submitButton = () => screen.getByRole('button', { name: '생성' });

describe('TC-COMP-004: TicketForm — 티켓 생성', () => {
  describe('폼 표시', () => {
    it('isOpen이 false면 아무것도 보이지 않는다', () => {
      render(<TicketForm isOpen={false} onClose={noop} onSubmit={jest.fn()} />);

      expect(screen.queryByLabelText('제목')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '생성' })).not.toBeInTheDocument();
    });

    it('열리면 다섯 개 입력과 생성·취소 버튼이 보인다', () => {
      render(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      expect(screen.getByLabelText('제목')).toBeInTheDocument();
      expect(screen.getByLabelText('설명')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: '우선순위' })).toBeInTheDocument();
      expect(screen.getByLabelText('시작예정일')).toBeInTheDocument();
      expect(screen.getByLabelText('종료예정일')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    });

    it('우선순위는 MEDIUM이 미리 선택되어 있다', () => {
      render(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      expect(screen.getByRole('radio', { name: 'MEDIUM' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'LOW' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'HIGH' })).not.toBeChecked();
    });
  });

  describe('004-N1 · 제목만 입력하고 생성', () => {
    it('제목만 입력해도 티켓을 만들 수 있다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), 'PRD 초안');
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'PRD 초안', priority: 'MEDIUM' }),
      );
    });

    // 빈 날짜를 ''로 넘기면 YYYY-MM-DD 형식 검증에 걸려 생성이 막힌다 (명세 5.2)
    it('입력하지 않은 선택 필드는 빈 문자열이 아니라 값 없이 전송된다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), 'PRD 초안');
      await userEvent.click(submitButton());

      const input = onSubmit.mock.calls[0]?.[0];
      expect(input.description ?? undefined).toBeUndefined();
      expect(input.plannedStartDate ?? undefined).toBeUndefined();
      expect(input.dueDate ?? undefined).toBeUndefined();
    });
  });

  describe('004-N2 · 우선순위 선택', () => {
    it('고르지 않으면 MEDIUM으로 전송된다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '우선순위 미선택');
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priority: 'MEDIUM' }));
    });

    it.each([['LOW'], ['HIGH']])('%s를 고르면 그 값이 전송된다', async (priority) => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '우선순위 선택');
      await userEvent.click(screen.getByRole('radio', { name: priority }));
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priority }));
    });
  });

  describe('004-N3 · 모든 필드 입력 후 생성', () => {
    it('입력값이 그대로 전송된다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), 'API 설계');
      await userEvent.type(screen.getByLabelText('설명'), '엔드포인트 정의');
      await userEvent.click(screen.getByRole('radio', { name: 'HIGH' }));
      await userEvent.type(screen.getByLabelText('시작예정일'), '2099-12-01');
      await userEvent.type(screen.getByLabelText('종료예정일'), FUTURE_DATE);
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'API 설계',
          description: '엔드포인트 정의',
          priority: 'HIGH',
          plannedStartDate: '2099-12-01',
          dueDate: FUTURE_DATE,
        }),
      );
    });
  });

  describe('004-N4 · 생성 성공', () => {
    it('폼이 닫힌다', async () => {
      const onClose = jest.fn();
      render(
        <TicketForm isOpen onClose={onClose} onSubmit={jest.fn().mockResolvedValue(undefined)} />,
      );

      await userEvent.type(screen.getByLabelText('제목'), 'PRD 초안');
      await userEvent.click(submitButton());

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('004-E1 · 제목 없이 제출', () => {
    it('안내 메시지가 보이고 전송되지 않는다', async () => {
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.click(submitButton());

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('제목이 공백뿐이어도 막힌다', async () => {
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '   ');
      await userEvent.click(submitButton());

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('검증에 걸리면 폼이 닫히지 않는다', async () => {
      const onClose = jest.fn();
      render(<TicketForm isOpen onClose={onClose} onSubmit={jest.fn()} />);

      await userEvent.click(submitButton());

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('004-E2 · 길이 제한', () => {
    it('제목이 201자면 길이 안내가 보인다', async () => {
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '가'.repeat(201));
      await userEvent.click(submitButton());

      expect(await screen.findByText('제목은 200자 이내로 입력해주세요')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('제목이 정확히 200자면 통과한다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '가'.repeat(200));
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalled();
    });

    it('설명이 1000자를 넘으면 안내가 보인다', async () => {
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '긴 설명');
      await userEvent.type(screen.getByLabelText('설명'), '가'.repeat(1001));
      await userEvent.click(submitButton());

      expect(await screen.findByText('설명은 1000자 이내로 입력해주세요')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('004-E3 · 과거 날짜를 종료예정일로 선택', () => {
    it('안내가 보이고 전송되지 않는다', async () => {
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '지난 마감');
      await userEvent.type(screen.getByLabelText('종료예정일'), PAST_DATE);
      await userEvent.click(submitButton());

      expect(
        await screen.findByText('종료예정일은 오늘 이후 날짜를 선택해주세요'),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    // 시작예정일에는 과거 제한이 없다 (FR-001)
    it('시작예정일은 과거여도 통과한다', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '예전에 시작');
      await userEvent.type(screen.getByLabelText('시작예정일'), PAST_DATE);
      await userEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ plannedStartDate: PAST_DATE }),
      );
    });
  });

  describe('004-E4 · 취소', () => {
    it('전송하지 않고 폼이 닫힌다', async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();
      render(<TicketForm isOpen onClose={onClose} onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText('제목'), '쓰다 만 티켓');
      await userEvent.click(screen.getByRole('button', { name: '취소' }));

      expect(onClose).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('다시 열면 입력 내용이 남아 있지 않다', async () => {
      const { rerender } = render(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      await userEvent.type(screen.getByLabelText('제목'), '쓰다 만 티켓');
      await userEvent.click(screen.getByRole('radio', { name: 'HIGH' }));
      await userEvent.click(screen.getByRole('button', { name: '취소' }));

      rerender(<TicketForm isOpen={false} onClose={noop} onSubmit={jest.fn()} />);
      rerender(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      expect(screen.getByLabelText('제목')).toHaveValue('');
      expect(screen.getByRole('radio', { name: 'MEDIUM' })).toBeChecked();
    });

    it('검증 에러가 보인 뒤 취소했다가 다시 열면 에러도 사라진다', async () => {
      const { rerender } = render(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      await userEvent.click(submitButton());
      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: '취소' }));
      rerender(<TicketForm isOpen={false} onClose={noop} onSubmit={jest.fn()} />);
      rerender(<TicketForm isOpen onClose={noop} onSubmit={jest.fn()} />);

      expect(screen.queryByText('제목을 입력해주세요')).not.toBeInTheDocument();
    });
  });
});

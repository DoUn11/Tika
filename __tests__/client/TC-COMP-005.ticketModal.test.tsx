/**
 * TC-COMP-005 · TicketModal — 조회·수정 (FR-003, FR-004)
 *
 * 관련 스토리: US-007(할 일 수정)
 * 명세: docs/COMPONENT_SPEC.md 5.3, docs/TEST_CASES.md TC-COMP-005
 *
 * 모달은 ticketId만 받고 상세를 직접 조회한다. 보드의 Ticket을 재사용하지
 * 않으므로 보드가 낡았어도 항상 최신값을 보여준다 (명세 5.3).
 *
 * 그래서 ticketApi를 모킹한다. 전송 계층은 얇은 fetch 래퍼라 여기서
 * 검증하지 않고, 모달이 그 결과로 무엇을 그리는지만 본다.
 *
 * 삭제(005의 "삭제" 버튼)는 TC-COMP-006의 몫이라 여기서는 존재만 확인한다.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/client/api/ticketApi';
import * as ticketApi from '@/client/api/ticketApi';
import { TICKET_PRIORITY } from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';
import { TicketModal } from '@/client/components/TicketModal';
import { ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi', () => ({
  ...jest.requireActual('@/client/api/ticketApi'),
  getById: jest.fn(),
}));

const getById = jest.mocked(ticketApi.getById);

const noop = () => {};
const asyncNoop = async () => {};

/** 상세 조회가 이 티켓을 돌려주게 한다 */
const mockGetById = (overrides: Partial<Ticket> = {}): Ticket => {
  const found = ticket({ id: 1, title: 'API 설계', ...overrides });
  getById.mockResolvedValue(found);
  return found;
};

const renderModal = (props: Partial<Parameters<typeof TicketModal>[0]> = {}) =>
  render(
    <TicketModal
      ticketId={1}
      onClose={noop}
      onUpdate={asyncNoop}
      onDelete={asyncNoop}
      {...props}
    />,
  );

const clickEdit = async () => {
  await userEvent.click(await screen.findByRole('button', { name: '편집' }));
};

const titleInput = () => screen.getByRole('textbox', { name: '제목' });

beforeEach(() => {
  getById.mockReset();
});

describe('TC-COMP-005: TicketModal — 조회·수정', () => {
  describe('005-N1 · 모달을 연다', () => {
    it('ticketId가 null이면 아무것도 보이지 않는다', () => {
      renderModal({ ticketId: null });

      expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
      expect(getById).not.toHaveBeenCalled();
    });

    it('열리면 그 ID로 상세를 조회한다', async () => {
      mockGetById();
      renderModal({ ticketId: 7 });

      expect(await screen.findByText('API 설계')).toBeInTheDocument();
      expect(getById).toHaveBeenCalledWith(7);
    });

    it('조회하는 동안 불러오는 중임을 알린다', async () => {
      mockGetById();
      renderModal();

      expect(screen.getByRole('status')).toBeInTheDocument();

      expect(await screen.findByText('API 설계')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('로딩이 끝나면 읽기 전용으로 상세가 보인다', async () => {
      mockGetById({
        title: 'API 설계',
        description: '엔드포인트 정의',
        priority: TICKET_PRIORITY.HIGH,
        dueDate: '2099-09-03',
      });
      renderModal();

      expect(await screen.findByText('API 설계')).toBeInTheDocument();
      expect(screen.getByText('엔드포인트 정의')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: '제목' })).not.toBeInTheDocument();
    });

    it('읽기 전용에서는 삭제·편집·닫기 버튼이 보인다', async () => {
      mockGetById();
      renderModal();

      expect(await screen.findByRole('button', { name: '편집' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    });

    it('닫기를 누르면 닫힘을 요청한다', async () => {
      mockGetById();
      const onClose = jest.fn();
      renderModal({ onClose });

      await userEvent.click(await screen.findByRole('button', { name: '닫기' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('005-N2 · 시작일·종료일', () => {
    it('표시되지만 편집할 수 없다', async () => {
      mockGetById({
        startedAt: '2026-09-02T10:14:00.000Z',
        completedAt: null,
      });
      renderModal();

      expect(await screen.findByText('시작일')).toBeInTheDocument();
      expect(screen.getByText('종료일')).toBeInTheDocument();
      expect(screen.getByText(/2026-09-02/)).toBeInTheDocument();

      await clickEdit();

      expect(screen.queryByRole('textbox', { name: '시작일' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: '종료일' })).not.toBeInTheDocument();
    });

    it('값이 없으면 -로 보인다', async () => {
      mockGetById({ startedAt: null, completedAt: null });
      renderModal();

      expect(await screen.findByText('시작일')).toBeInTheDocument();
      expect(screen.getAllByText('-')).toHaveLength(2);
    });
  });

  describe('005-N3 · 편집 클릭', () => {
    it('입력 필드로 바뀌고 저장·취소 버튼이 보인다', async () => {
      mockGetById({ title: 'API 설계' });
      renderModal();

      await clickEdit();

      expect(titleInput()).toHaveValue('API 설계');
      expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
    });

    it('편집 가능한 다섯 필드가 모두 입력으로 바뀐다', async () => {
      mockGetById();
      renderModal();

      await clickEdit();

      expect(screen.getByRole('textbox', { name: '제목' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: '설명' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: '우선순위' })).toBeInTheDocument();
      expect(screen.getByLabelText('시작예정일')).toBeInTheDocument();
      expect(screen.getByLabelText('종료예정일')).toBeInTheDocument();
    });

    it('삭제 버튼은 편집 모드에서도 남아 있다', async () => {
      mockGetById();
      renderModal();

      await clickEdit();

      expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    });

    it('현재 값이 입력에 채워져 있다', async () => {
      mockGetById({
        title: 'API 설계',
        description: '엔드포인트 정의',
        priority: TICKET_PRIORITY.HIGH,
        dueDate: '2099-09-03',
      });
      renderModal();

      await clickEdit();

      expect(titleInput()).toHaveValue('API 설계');
      expect(screen.getByRole('textbox', { name: '설명' })).toHaveValue('엔드포인트 정의');
      expect(screen.getByRole('radio', { name: 'HIGH' })).toBeChecked();
      expect(screen.getByLabelText('종료예정일')).toHaveValue('2099-09-03');
    });
  });

  describe('005-N4 · 값 수정 후 저장', () => {
    it('수정이 요청되고 읽기 전용으로 돌아간다', async () => {
      mockGetById({ title: 'API 설계' });
      const onUpdate = jest.fn().mockResolvedValue(undefined);
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), 'API 명세');
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(onUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'API 명세' }));
      expect(await screen.findByRole('button', { name: '편집' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: '제목' })).not.toBeInTheDocument();
    });

    // 손대지 않은 필드를 되돌려 보내면 오버듀 티켓은 제목조차 못 고친다 (명세 5.3)
    it('바꾸지 않은 필드는 보내지 않는다', async () => {
      mockGetById({ title: 'API 설계', description: '엔드포인트 정의' });
      const onUpdate = jest.fn().mockResolvedValue(undefined);
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), 'API 명세');
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      const input = onUpdate.mock.calls[0]?.[1];
      expect(input).toEqual({ title: 'API 명세' });
    });

    it('종료예정일이 지난 티켓도 제목만 고쳐 저장할 수 있다', async () => {
      mockGetById({ title: '늦은 티켓', dueDate: '2020-01-01', isOverdue: true });
      const onUpdate = jest.fn().mockResolvedValue(undefined);
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), '고친 제목');
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(onUpdate).toHaveBeenCalledWith(1, { title: '고친 제목' });
      expect(
        screen.queryByText('종료예정일은 오늘 이후 날짜를 선택해주세요'),
      ).not.toBeInTheDocument();
    });

    it('아무것도 바꾸지 않고 저장해도 읽기 전용으로 돌아간다', async () => {
      mockGetById();
      const onUpdate = jest.fn().mockResolvedValue(undefined);
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(await screen.findByRole('button', { name: '편집' })).toBeInTheDocument();
    });
  });

  describe('005-N5 · 편집 중 취소', () => {
    it('변경이 버려지고 원래 값이 보인다', async () => {
      mockGetById({ title: 'API 설계' });
      const onUpdate = jest.fn();
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), '버려질 제목');
      await userEvent.click(screen.getByRole('button', { name: '취소' }));

      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByText('API 설계')).toBeInTheDocument();
      expect(screen.queryByText('버려질 제목')).not.toBeInTheDocument();
    });

    it('취소한 뒤 다시 편집하면 원래 값이 채워져 있다', async () => {
      mockGetById({ title: 'API 설계' });
      renderModal();

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), '버려질 제목');
      await userEvent.click(screen.getByRole('button', { name: '취소' }));
      await clickEdit();

      expect(titleInput()).toHaveValue('API 설계');
    });

    it('취소는 모달을 닫지 않는다', async () => {
      mockGetById();
      const onClose = jest.fn();
      renderModal({ onClose });

      await clickEdit();
      await userEvent.click(screen.getByRole('button', { name: '취소' }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument();
    });
  });

  describe('005-E1 · 제목을 비우고 저장', () => {
    it('안내가 보이고 전송되지 않는다', async () => {
      mockGetById({ title: 'API 설계' });
      const onUpdate = jest.fn();
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('검증에 걸리면 편집 모드에 머문다', async () => {
      mockGetById({ title: 'API 설계' });
      renderModal({ onUpdate: jest.fn() });

      await clickEdit();
      await userEvent.clear(titleInput());
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    });

    it('종료예정일을 과거로 고치면 막힌다', async () => {
      mockGetById({ title: 'API 설계', dueDate: null });
      const onUpdate = jest.fn();
      renderModal({ onUpdate });

      await clickEdit();
      await userEvent.type(screen.getByLabelText('종료예정일'), '2020-01-01');
      await userEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(
        await screen.findByText('종료예정일은 오늘 이후 날짜를 선택해주세요'),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('005-E2 · 조회가 404', () => {
    it('서버가 보낸 문구가 보인다', async () => {
      getById.mockRejectedValue(new ApiError('티켓을 찾을 수 없습니다', 'NOT_FOUND', 404));
      renderModal();

      expect(await screen.findByText('티켓을 찾을 수 없습니다')).toBeInTheDocument();
    });

    it('모달이 저절로 닫히지 않고 닫기만 남는다', async () => {
      getById.mockRejectedValue(new ApiError('티켓을 찾을 수 없습니다', 'NOT_FOUND', 404));
      const onClose = jest.fn();
      renderModal({ onClose });

      expect(await screen.findByText('티켓을 찾을 수 없습니다')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
    });

    it('조회에 실패하면 로딩 표시가 사라진다', async () => {
      getById.mockRejectedValue(new ApiError('서버 오류가 발생했습니다', 'INTERNAL_ERROR', 500));
      renderModal();

      expect(await screen.findByText('서버 오류가 발생했습니다')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});

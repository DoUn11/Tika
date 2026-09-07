/**
 * TC-COMP-006 · TicketModal + ConfirmDialog — 삭제 (FR-006)
 *
 * 관련 스토리: US-008(할 일 삭제)
 * 명세: docs/COMPONENT_SPEC.md 5.3·5.4, docs/TEST_CASES.md TC-COMP-006
 *
 * 삭제는 하드 삭제라 되돌릴 수 없다. 그래서 이 스위트의 중심은 "삭제된다"가
 * 아니라 **확인 없이는 삭제되지 않는다**이다.
 *
 * "취소"라는 이름의 버튼이 두 곳에 있다 — 편집 취소와 삭제 취소.
 * 그래서 다이얼로그 안쪽 버튼은 alertdialog 영역으로 좁혀서 찾는다 (명세 5.4).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ticketApi from '@/client/api/ticketApi';
import type { Ticket } from '@/shared/types/ticket';
import { ConfirmDialog } from '@/client/components/ConfirmDialog';
import { TicketModal } from '@/client/components/TicketModal';
import { ticket } from '../helpers/factories';

jest.mock('@/client/api/ticketApi', () => ({
  ...jest.requireActual('@/client/api/ticketApi'),
  getById: jest.fn(),
}));

const getById = jest.mocked(ticketApi.getById);

const noop = () => {};
const asyncNoop = async () => {};

const CONFIRM_MESSAGE = '정말 삭제하시겠습니까?';

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

/** 확인창 안쪽만 본다 — 바깥의 "취소"와 섞이지 않게 */
const dialog = () => within(screen.getByRole('alertdialog'));

const clickDelete = async () => {
  await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
};

beforeEach(() => {
  getById.mockReset();
});

describe('TC-COMP-006: TicketModal + ConfirmDialog — 삭제', () => {
  describe('ConfirmDialog 자체 (명세 5.4)', () => {
    it('isOpen이 false면 아무것도 보이지 않는다', () => {
      render(
        <ConfirmDialog
          isOpen={false}
          message={CONFIRM_MESSAGE}
          onConfirm={noop}
          onCancel={noop}
        />,
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument();
    });

    it('열리면 메시지와 확인·취소 버튼이 보인다', () => {
      render(
        <ConfirmDialog isOpen message={CONFIRM_MESSAGE} onConfirm={noop} onCancel={noop} />,
      );

      expect(screen.getByRole('alertdialog', { name: CONFIRM_MESSAGE })).toBeInTheDocument();
      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
      expect(dialog().getByRole('button', { name: '확인' })).toBeInTheDocument();
      expect(dialog().getByRole('button', { name: '취소' })).toBeInTheDocument();
    });

    it('확인을 누르면 진행을 알린다', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      render(
        <ConfirmDialog
          isOpen
          message={CONFIRM_MESSAGE}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      expect(onConfirm).toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('취소를 누르면 취소를 알린다', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      render(
        <ConfirmDialog
          isOpen
          message={CONFIRM_MESSAGE}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      await userEvent.click(dialog().getByRole('button', { name: '취소' }));

      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('Esc는 취소와 같다', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      render(
        <ConfirmDialog
          isOpen
          message={CONFIRM_MESSAGE}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      await userEvent.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('닫혀 있으면 Esc에 반응하지 않는다', async () => {
      const onCancel = jest.fn();
      render(
        <ConfirmDialog
          isOpen={false}
          message={CONFIRM_MESSAGE}
          onConfirm={noop}
          onCancel={onCancel}
        />,
      );

      await userEvent.keyboard('{Escape}');

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('006-N1 · 모달에서 삭제 클릭', () => {
    it('확인창이 보인다', async () => {
      mockGetById();
      renderModal();

      await clickDelete();

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
    });

    it('처음에는 확인창이 떠 있지 않다', async () => {
      mockGetById();
      renderModal();

      expect(await screen.findByRole('button', { name: '삭제' })).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('편집 모드에서 삭제해도 같은 확인창이 뜬다', async () => {
      mockGetById();
      renderModal();

      await userEvent.click(await screen.findByRole('button', { name: '편집' }));
      await clickDelete();

      expect(screen.getByRole('alertdialog', { name: CONFIRM_MESSAGE })).toBeInTheDocument();
    });
  });

  describe('006-N2 · 확인창에서 확인', () => {
    it('삭제가 요청된다', async () => {
      mockGetById({ id: 1 });
      const onDelete = jest.fn().mockResolvedValue(undefined);
      renderModal({ onDelete });

      await clickDelete();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      expect(onDelete).toHaveBeenCalledWith(1);
    });

    it('모달이 닫힌다', async () => {
      mockGetById();
      const onClose = jest.fn();
      renderModal({ onClose, onDelete: jest.fn().mockResolvedValue(undefined) });

      await clickDelete();
      await userEvent.click(dialog().getByRole('button', { name: '확인' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('006-N3 · 확인창에서 취소', () => {
    it('삭제되지 않는다', async () => {
      mockGetById();
      const onDelete = jest.fn();
      renderModal({ onDelete });

      await clickDelete();
      await userEvent.click(dialog().getByRole('button', { name: '취소' }));

      expect(onDelete).not.toHaveBeenCalled();
    });

    it('모달이 유지되고 확인창만 사라진다', async () => {
      mockGetById();
      const onClose = jest.fn();
      renderModal({ onClose, onDelete: jest.fn() });

      await clickDelete();
      await userEvent.click(dialog().getByRole('button', { name: '취소' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument();
    });

    it('취소한 뒤 다시 삭제를 누르면 확인창이 또 뜬다', async () => {
      mockGetById();
      renderModal({ onDelete: jest.fn() });

      await clickDelete();
      await userEvent.click(dialog().getByRole('button', { name: '취소' }));
      await clickDelete();

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('006-N4 · 확인창에서 Esc', () => {
    it('취소와 동일하게 동작한다', async () => {
      mockGetById();
      const onClose = jest.fn();
      const onDelete = jest.fn();
      renderModal({ onClose, onDelete });

      await clickDelete();
      await userEvent.keyboard('{Escape}');

      expect(onDelete).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('006-E1 · 확인 없이 삭제', () => {
    it('삭제 버튼만으로는 삭제되지 않는다', async () => {
      mockGetById();
      const onDelete = jest.fn();
      const onClose = jest.fn();
      renderModal({ onDelete, onClose });

      await clickDelete();

      expect(onDelete).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('확인창이 떠 있는 동안에는 아직 삭제되지 않았다', async () => {
      mockGetById();
      const onDelete = jest.fn();
      renderModal({ onDelete });

      await clickDelete();

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('삭제를 눌러도 티켓 내용은 그대로 보인다', async () => {
      mockGetById({ title: 'API 설계' });
      renderModal({ onDelete: jest.fn() });

      await clickDelete();

      expect(screen.getByText('API 설계')).toBeInTheDocument();
    });
  });
});

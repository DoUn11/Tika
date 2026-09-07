'use client';

import { useEffect } from 'react';

type ConfirmDialogProps = {
  /** false면 아무것도 렌더링하지 않는다 */
  isOpen: boolean;
  /** 확인 문구. 다이얼로그의 접근 가능한 이름으로도 쓴다 */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 되돌릴 수 없는 작업 전 확인을 받는다 (COMPONENT_SPEC 5.4).
 *
 * role="alertdialog"로 독립된 영역이 되는 것이 중요하다. TicketModal의
 * 편집 모드에도 "취소" 버튼이 있어, 편집 중 삭제를 누르면 화면에 같은 이름의
 * 버튼이 둘이 되기 때문이다.
 */
export const ConfirmDialog = ({ isOpen, message, onConfirm, onCancel }: ConfirmDialogProps) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={message}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
    >
      <p className="text-sm text-slate-900">{message}</p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
};

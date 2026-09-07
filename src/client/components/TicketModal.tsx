'use client';

import { useEffect, useState } from 'react';
import { getById } from '@/client/api/ticketApi';
import { TICKET_PRIORITY, type TicketPriority } from '@/shared/constants/ticket';
import type { Ticket } from '@/shared/types/ticket';
import { updateTicketSchema, type UpdateTicketInput } from '@/shared/validations/ticketSchema';
import { ConfirmDialog } from './ConfirmDialog';
import { PriorityBadge } from './PriorityBadge';

/** 삭제는 하드 삭제라 복구할 수 없다 (COMPONENT_SPEC 5.4) */
const DELETE_CONFIRM_MESSAGE = '정말 삭제하시겠습니까?';

type TicketModalProps = {
  /** null이면 닫힘. ID만 받고 상세는 모달이 직접 조회한다 */
  ticketId: number | null;
  onClose: () => void;
  onUpdate: (id: number, input: UpdateTicketInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

type FieldName = 'title' | 'description' | 'priority' | 'plannedStartDate' | 'dueDate';
type FieldErrors = Partial<Record<FieldName, string>>;

/** 편집 폼의 값. 비어 있는 입력은 ''로 두고 전송 직전에 null로 바꾼다. */
type FormValues = {
  title: string;
  description: string;
  priority: TicketPriority;
  plannedStartDate: string;
  dueDate: string;
};

const PRIORITY_OPTIONS = [
  TICKET_PRIORITY.LOW,
  TICKET_PRIORITY.MEDIUM,
  TICKET_PRIORITY.HIGH,
] as const;

const EMPTY_FORM: FormValues = {
  title: '',
  description: '',
  priority: TICKET_PRIORITY.MEDIUM,
  plannedStartDate: '',
  dueDate: '',
};

const toForm = (ticket: Ticket): FormValues => ({
  title: ticket.title,
  description: ticket.description ?? '',
  priority: ticket.priority,
  plannedStartDate: ticket.plannedStartDate ?? '',
  dueDate: ticket.dueDate ?? '',
});

/** 빈 입력은 "값 삭제"를 뜻한다. PATCH에서 null이 삭제다 (FR-004). */
const toNullable = (value: string): string | null => (value === '' ? null : value);

const pad = (value: number): string => String(value).padStart(2, '0');

/** startedAt·completedAt 표시 형식 — YYYY-MM-DD HH:mm (COMPONENT_SPEC 5.3) */
const formatDateTime = (iso: string | null): string => {
  if (iso === null) return '-';
  const at = new Date(iso);
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${date} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/**
 * 손대지 않은 필드는 제외하고 바뀐 값만 모은다 (COMPONENT_SPEC 5.3).
 *
 * PATCH 규약이기도 하지만, 그보다 updateTicketSchema의 dueDate가 오늘 이후만
 * 허용하기 때문이다. 값을 그대로 되돌려 보내면 오버듀 티켓은 제목조차 고칠 수 없다.
 */
const diff = (original: Ticket, form: FormValues): UpdateTicketInput => {
  const changes: UpdateTicketInput = {};

  if (form.title !== original.title) changes.title = form.title;
  if (toNullable(form.description) !== original.description) {
    changes.description = toNullable(form.description);
  }
  if (form.priority !== original.priority) changes.priority = form.priority;
  if (toNullable(form.plannedStartDate) !== original.plannedStartDate) {
    changes.plannedStartDate = toNullable(form.plannedStartDate);
  }
  if (toNullable(form.dueDate) !== original.dueDate) changes.dueDate = toNullable(form.dueDate);

  return changes;
};

/**
 * 티켓 상세·편집 모달 (COMPONENT_SPEC 5.3).
 *
 * 보드에 있는 Ticket을 재사용하지 않고 GET /api/tickets/:id로 직접 조회한다.
 * 보드 데이터가 낡았어도 모달은 항상 최신값을 보여준다 (FR-003).
 *
 * 조회에 실패해도 닫지 않는다. 닫아 버리면 사용자가 왜 열리지 않았는지 알 수 없다.
 *
 * 삭제는 반드시 ConfirmDialog를 거친다. 하드 삭제라 되돌릴 수 없으므로
 * "삭제" 버튼 자체는 onDelete를 호출하지 않는다 (FR-006).
 */
export const TicketModal = ({ ticketId, onClose, onUpdate, onDelete }: TicketModalProps) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(ticketId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (ticketId === null) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setTicket(null);
    setMode('view');

    getById(ticketId)
      .then((found) => {
        if (!cancelled) setTicket(found);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (ticketId === null) return null;

  const startEdit = (current: Ticket): void => {
    setForm(toForm(current));
    setErrors({});
    setMode('edit');
  };

  const cancelEdit = (): void => {
    setErrors({});
    setMode('view');
  };

  const save = async (current: Ticket): Promise<void> => {
    const result = updateTicketSchema.safeParse(diff(current, form));

    if (!result.success) {
      const { fieldErrors } = result.error.flatten();
      setErrors({
        title: fieldErrors.title?.[0],
        description: fieldErrors.description?.[0],
        priority: fieldErrors.priority?.[0],
        plannedStartDate: fieldErrors.plannedStartDate?.[0],
        dueDate: fieldErrors.dueDate?.[0],
      });
      return;
    }

    setErrors({});
    await onUpdate(current.id, result.data);

    // 편집한 값을 화면에 반영한다. 부모는 보드만 갱신하고 티켓을 돌려주지 않는다.
    setTicket({
      ...current,
      title: form.title.trim(),
      description: toNullable(form.description),
      priority: form.priority,
      plannedStartDate: toNullable(form.plannedStartDate),
      dueDate: toNullable(form.dueDate),
    });
    setMode('view');
  };

  /** 확인을 받은 뒤에만 실제로 지운다 */
  const confirmDelete = async (current: Ticket): Promise<void> => {
    await onDelete(current.id);
    onClose();
  };

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
    >
      닫기
    </button>
  );

  // 여기서는 확인창을 띄우기만 한다. 삭제 자체는 confirmDelete가 한다.
  const deleteButton = (
    <button
      type="button"
      onClick={() => setIsConfirmingDelete(true)}
      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600"
    >
      삭제
    </button>
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
      {isLoading && (
        <p role="status" className="text-sm text-slate-500">
          불러오는 중입니다
        </p>
      )}

      {loadError !== null && (
        <>
          <p className="text-sm text-red-600">{loadError}</p>
          <div className="flex justify-end">{closeButton}</div>
        </>
      )}

      {ticket !== null && mode === 'view' && (
        <>
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-slate-500">제목</dt>
              <dd className="text-slate-900">{ticket.title}</dd>
            </div>
            <div>
              <dt className="text-slate-500">설명</dt>
              <dd className="text-slate-900">{ticket.description}</dd>
            </div>
            <div>
              <dt className="text-slate-500">우선순위</dt>
              <dd>
                <PriorityBadge priority={ticket.priority} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">시작예정일</dt>
              <dd className="text-slate-900">{ticket.plannedStartDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">종료예정일</dt>
              <dd className="text-slate-900">{ticket.dueDate}</dd>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <dt className="text-slate-500">시작일</dt>
              <dd className="text-slate-900">{formatDateTime(ticket.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">종료일</dt>
              <dd className="text-slate-900">{formatDateTime(ticket.completedAt)}</dd>
            </div>
          </dl>

          <div className="flex justify-between gap-2">
            {deleteButton}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(ticket)}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
              >
                편집
              </button>
              {closeButton}
            </div>
          </div>
        </>
      )}

      {ticket !== null && mode === 'edit' && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="modal-title" className="text-sm text-slate-500">
              제목
            </label>
            <input
              id="modal-title"
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            {errors.title !== undefined && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="modal-description" className="text-sm text-slate-500">
              설명
            </label>
            <textarea
              id="modal-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            {errors.description !== undefined && (
              <p className="text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm text-slate-500">우선순위</legend>
            <div className="flex gap-4">
              {PRIORITY_OPTIONS.map((option) => (
                <div key={option} className="flex items-center gap-1">
                  <input
                    id={`modal-priority-${option}`}
                    type="radio"
                    name="modal-priority"
                    value={option}
                    checked={form.priority === option}
                    onChange={() => setForm({ ...form, priority: option })}
                  />
                  <label htmlFor={`modal-priority-${option}`} className="text-sm text-slate-700">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor="modal-planned-start-date" className="text-sm text-slate-500">
              시작예정일
            </label>
            <input
              id="modal-planned-start-date"
              type="date"
              value={form.plannedStartDate}
              onChange={(event) => setForm({ ...form, plannedStartDate: event.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            {errors.plannedStartDate !== undefined && (
              <p className="text-xs text-red-600">{errors.plannedStartDate}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="modal-due-date" className="text-sm text-slate-500">
              종료예정일
            </label>
            <input
              id="modal-due-date"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            {errors.dueDate !== undefined && (
              <p className="text-xs text-red-600">{errors.dueDate}</p>
            )}
          </div>

          {/* 시작일·종료일은 편집 모드에서도 읽기 전용이다 (5.3) */}
          <dl className="flex flex-col gap-3 border-t border-slate-200 pt-3 text-sm">
            <div>
              <dt className="text-slate-500">시작일</dt>
              <dd className="text-slate-900">{formatDateTime(ticket.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">종료일</dt>
              <dd className="text-slate-900">{formatDateTime(ticket.completedAt)}</dd>
            </div>
          </dl>

          <div className="flex justify-between gap-2">
            {deleteButton}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void save(ticket)}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
              >
                저장
              </button>
            </div>
          </div>
        </>
      )}

      {ticket !== null && (
        <ConfirmDialog
          isOpen={isConfirmingDelete}
          message={DELETE_CONFIRM_MESSAGE}
          onConfirm={() => void confirmDelete(ticket)}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
};

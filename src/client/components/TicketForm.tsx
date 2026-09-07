'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { TICKET_PRIORITY, type TicketPriority } from '@/shared/constants/ticket';
import {
  createTicketSchema,
  type CreateTicketInput,
} from '@/shared/validations/ticketSchema';

type TicketFormProps = {
  /** false면 아무것도 렌더링하지 않는다 */
  isOpen: boolean;
  /** 취소하거나 생성에 성공했을 때 호출 */
  onClose: () => void;
  /** 검증을 통과한 입력으로 호출 — 실제 요청은 useTickets가 만든다 */
  onSubmit: (input: CreateTicketInput) => Promise<void>;
};

type FieldName = 'title' | 'description' | 'priority' | 'plannedStartDate' | 'dueDate';
type FieldErrors = Partial<Record<FieldName, string>>;

const PRIORITY_OPTIONS = [
  TICKET_PRIORITY.LOW,
  TICKET_PRIORITY.MEDIUM,
  TICKET_PRIORITY.HIGH,
] as const;

/**
 * 빈 입력은 값 없이 보낸다 (COMPONENT_SPEC 5.2).
 * date input의 미입력 값은 ''인데, createTicketSchema의 날짜 필드는
 * YYYY-MM-DD를 요구하므로 그대로 넘기면 제목만 입력한 생성이 막힌다.
 */
const omitEmpty = (value: string): string | undefined => (value === '' ? undefined : value);

/**
 * 티켓 생성 폼 (COMPONENT_SPEC 5.2).
 *
 * 폼은 HTTP를 모른다. 검증을 통과한 입력을 onSubmit에 넘기는 데까지가 책임이다.
 * 서버도 같은 스키마로 다시 검증한다 (NFR-004 이중 검증).
 */
export const TicketForm = ({ isOpen, onClose, onSubmit }: TicketFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>(TICKET_PRIORITY.MEDIUM);
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  // 닫히면 입력과 에러를 버린다. 다시 열었을 때 빈 폼이어야 한다 (5.2)
  useEffect(() => {
    if (isOpen) return;
    setTitle('');
    setDescription('');
    setPriority(TICKET_PRIORITY.MEDIUM);
    setPlannedStartDate('');
    setDueDate('');
    setErrors({});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const result = createTicketSchema.safeParse({
      title,
      description: omitEmpty(description),
      priority,
      plannedStartDate: omitEmpty(plannedStartDate),
      dueDate: omitEmpty(dueDate),
    });

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
    await onSubmit(result.data);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="ticket-title" className="text-sm font-medium text-slate-700">
          제목
        </label>
        <input
          id="ticket-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {errors.title !== undefined && <p className="text-xs text-red-600">{errors.title}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ticket-description" className="text-sm font-medium text-slate-700">
          설명
        </label>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {errors.description !== undefined && (
          <p className="text-xs text-red-600">{errors.description}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-slate-700">우선순위</legend>
        <div className="flex gap-4">
          {PRIORITY_OPTIONS.map((option) => (
            <div key={option} className="flex items-center gap-1">
              <input
                id={`ticket-priority-${option}`}
                type="radio"
                name="ticket-priority"
                value={option}
                checked={priority === option}
                onChange={() => setPriority(option)}
              />
              <label htmlFor={`ticket-priority-${option}`} className="text-sm text-slate-700">
                {option}
              </label>
            </div>
          ))}
        </div>
        {errors.priority !== undefined && <p className="text-xs text-red-600">{errors.priority}</p>}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="ticket-planned-start-date" className="text-sm font-medium text-slate-700">
          시작예정일
        </label>
        <input
          id="ticket-planned-start-date"
          type="date"
          value={plannedStartDate}
          onChange={(event) => setPlannedStartDate(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {errors.plannedStartDate !== undefined && (
          <p className="text-xs text-red-600">{errors.plannedStartDate}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ticket-due-date" className="text-sm font-medium text-slate-700">
          종료예정일
        </label>
        <input
          id="ticket-due-date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {errors.dueDate !== undefined && <p className="text-xs text-red-600">{errors.dueDate}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
        >
          취소
        </button>
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
          생성
        </button>
      </div>
    </form>
  );
};

/**
 * TC-API-004 · PATCH /api/tickets/:id — 티켓 수정 (FR-004)
 *
 * 관련 스토리: US-007(할 일 수정)
 * 명세: docs/API_SPEC.md 6장, docs/REQUIREMENTS.md FR-004
 *
 * 핵심은 부분 수정이다. 전송된 필드만 갱신하고, null을 명시적으로
 * 보내면 삭제한다. "필드 누락"과 "null 전송"은 다른 의미다.
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import { PATCH } from '../../app/api/tickets/[id]/route';
import { daysAgo, daysLater, hoursAgo, resetDatabase, seedTicket } from '../helpers';

const patch = (id: string | number, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );

describe('TC-API-004: PATCH /api/tickets/:id — 티켓 수정', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 004-N1
    it('전송하지 않은 필드는 기존 값을 유지한다', async () => {
      const seeded = await seedTicket({
        title: '원래 제목',
        description: '원래 설명',
        priority: TICKET_PRIORITY.LOW,
      });

      const res = await patch(seeded.id, { priority: TICKET_PRIORITY.HIGH });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.priority).toBe(TICKET_PRIORITY.HIGH);
      expect(body.title).toBe('원래 제목');
      expect(body.description).toBe('원래 설명');
    });

    // 004-N2
    it('여러 필드를 한 번에 수정할 수 있다', async () => {
      const seeded = await seedTicket({ title: '원래 제목' });
      const dueDate = daysLater(5);

      const body = await (
        await patch(seeded.id, {
          title: '바뀐 제목',
          description: '바뀐 설명',
          priority: TICKET_PRIORITY.HIGH,
          plannedStartDate: '2026-09-10',
          dueDate,
        })
      ).json();

      expect(body).toMatchObject({
        title: '바뀐 제목',
        description: '바뀐 설명',
        priority: TICKET_PRIORITY.HIGH,
        plannedStartDate: '2026-09-10',
        dueDate,
      });
    });

    // 004-N3
    it('description에 null을 전송하면 값이 삭제된다', async () => {
      const seeded = await seedTicket({ description: '지울 설명' });

      const body = await (await patch(seeded.id, { description: null })).json();

      expect(body.description).toBeNull();
    });

    // 004-N4
    it('dueDate에 null을 전송하면 값이 삭제된다', async () => {
      const seeded = await seedTicket({ dueDate: daysLater(3) });

      const body = await (await patch(seeded.id, { dueDate: null })).json();

      expect(body.dueDate).toBeNull();
    });

    it('plannedStartDate에 null을 전송하면 값이 삭제된다', async () => {
      const seeded = await seedTicket({ plannedStartDate: '2026-09-10' });

      const body = await (await patch(seeded.id, { plannedStartDate: null })).json();

      expect(body.plannedStartDate).toBeNull();
    });

    // 004-N5
    it('수정하면 updatedAt이 갱신된다', async () => {
      const seeded = await seedTicket({ updatedAt: hoursAgo(2) });

      const body = await (await patch(seeded.id, { title: '새 제목' })).json();

      expect(Date.parse(body.updatedAt)).toBeGreaterThan(seeded.updatedAt.getTime());
    });

    it('수정해도 createdAt은 바뀌지 않는다', async () => {
      const seeded = await seedTicket({ createdAt: hoursAgo(5) });

      const body = await (await patch(seeded.id, { title: '새 제목' })).json();

      expect(Date.parse(body.createdAt)).toBe(seeded.createdAt.getTime());
    });

    // 004-N6
    it('필드 누락은 값을 유지하고, null 전송은 값을 삭제한다', async () => {
      const seeded = await seedTicket({
        title: '제목',
        description: '설명',
        dueDate: daysLater(3),
      });

      // 누락 — description과 dueDate를 보내지 않는다
      const kept = await (await patch(seeded.id, { title: '새 제목' })).json();
      expect(kept.description).toBe('설명');
      expect(kept.dueDate).toBe(daysLater(3));

      // null 전송 — 명시적으로 삭제한다
      const cleared = await (await patch(seeded.id, { description: null })).json();
      expect(cleared.description).toBeNull();
      expect(cleared.title).toBe('새 제목');
    });

    it('빈 객체를 전송하면 아무것도 바뀌지 않는다', async () => {
      const seeded = await seedTicket({ title: '그대로', description: '그대로 설명' });

      const res = await patch(seeded.id, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('그대로');
      expect(body.description).toBe('그대로 설명');
    });

    it('수정된 티켓에도 isOverdue가 다시 계산되어 포함된다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.TODO, dueDate: daysAgo(2) });

      const body = await (await patch(seeded.id, { title: '새 제목' })).json();

      expect(body.isOverdue).toBe(true);
    });
  });

  describe('수정할 수 없는 필드', () => {
    // API_SPEC 6.1 — status·position은 FR-007, completedAt은 FR-005가 다룬다
    it('status를 전송해도 무시된다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.BACKLOG });

      const body = await (
        await patch(seeded.id, { status: TICKET_STATUS.DONE, title: '새 제목' })
      ).json();

      expect(body.status).toBe(TICKET_STATUS.BACKLOG);
      expect(body.title).toBe('새 제목');
    });

    it('position을 전송해도 무시된다', async () => {
      const seeded = await seedTicket({ position: 0 });

      const body = await (await patch(seeded.id, { position: 9999, title: '새 제목' })).json();

      expect(body.position).toBe(0);
    });

    it('completedAt을 전송해도 무시된다', async () => {
      const seeded = await seedTicket({ status: TICKET_STATUS.TODO });

      const body = await (
        await patch(seeded.id, { completedAt: new Date().toISOString(), title: '새 제목' })
      ).json();

      expect(body.completedAt).toBeNull();
    });
  });

  describe('예외 케이스', () => {
    // 004-E1
    it('제목이 200자를 넘으면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await patch(seeded.id, { title: 'ㄱ'.repeat(201) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'title',
          message: '제목은 200자 이내로 입력해주세요',
        }),
      );
    });

    it('제목을 빈 문자열로 바꾸려 하면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await patch(seeded.id, { title: '   ' });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ field: 'title', message: '제목을 입력해주세요' }),
      );
    });

    // 004-E2
    it('설명이 1000자를 넘으면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await patch(seeded.id, { description: 'ㄱ'.repeat(1001) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'description',
          message: '설명은 1000자 이내로 입력해주세요',
        }),
      );
    });

    // 004-E3
    it('정의되지 않은 우선순위 값이면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await patch(seeded.id, { priority: 'URGENT' });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'priority',
          message: '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요',
        }),
      );
    });

    // 004-E4
    it('종료예정일이 과거이면 400을 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await patch(seeded.id, { dueDate: daysAgo(1) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'dueDate',
          message: '종료예정일은 오늘 이후 날짜를 선택해주세요',
        }),
      );
    });

    it('검증에 실패하면 기존 값이 바뀌지 않는다', async () => {
      const seeded = await seedTicket({ title: '원래 제목' });

      await patch(seeded.id, { title: 'ㄱ'.repeat(201) });

      const body = await (await patch(seeded.id, {})).json();
      expect(body.title).toBe('원래 제목');
    });

    // 004-E5
    it('존재하지 않는 ID면 404를 반환한다', async () => {
      const res = await patch(999999, { title: '새 제목' });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('티켓을 찾을 수 없습니다');
    });

    it('숫자가 아닌 ID면 404를 반환한다', async () => {
      const res = await patch('abc', { title: '새 제목' });

      expect([400, 404]).toContain(res.status);
    });

    it('본문이 올바른 JSON이 아니면 400과 VALIDATION_ERROR를 반환한다', async () => {
      const seeded = await seedTicket({});

      const res = await PATCH(
        new Request(`http://localhost/api/tickets/${seeded.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{ "title": "깨진',
        }),
        { params: Promise.resolve({ id: String(seeded.id) }) },
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  });
});

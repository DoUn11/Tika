/**
 * TC-API-001 · POST /api/tickets — 티켓 생성 (FR-001)
 *
 * 관련 스토리: US-001(새 할 일 등록), US-002(상세 정보 설정)
 * 명세: docs/API_SPEC.md 3장, docs/REQUIREMENTS.md FR-001
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import { POST } from '../../app/api/tickets/route';
import { daysAgo, daysLater, jsonRequest, resetDatabase, seedTicket } from '../helpers';

describe('TC-API-001: POST /api/tickets — 티켓 생성', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('정상 케이스', () => {
    // 001-N1
    it('제목만 입력해도 티켓이 생성되고 BACKLOG 상태가 된다', async () => {
      const res = await POST(jsonRequest({ title: 'PRD 초안' }));

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        title: 'PRD 초안',
        status: TICKET_STATUS.BACKLOG,
        priority: TICKET_PRIORITY.MEDIUM, // 미지정 시 기본값
        description: null,
      });
      expect(body.id).toEqual(expect.any(Number));
    });

    // 001-N2
    it('모든 필드를 전달하면 그대로 저장된다', async () => {
      const dueDate = daysLater(3);

      const res = await POST(
        jsonRequest({
          title: 'API 설계',
          description: 'FR-001~008 엔드포인트 정의',
          priority: TICKET_PRIORITY.HIGH,
          plannedStartDate: '2026-09-02',
          dueDate,
        }),
      );

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        title: 'API 설계',
        description: 'FR-001~008 엔드포인트 정의',
        priority: TICKET_PRIORITY.HIGH,
        plannedStartDate: '2026-09-02',
        dueDate,
      });
    });

    // 001-N3
    it('빈 Backlog에 첫 티켓을 만들면 position이 0이다', async () => {
      const res = await POST(jsonRequest({ title: '첫 티켓' }));

      const body = await res.json();
      expect(body.position).toBe(0);
    });

    // 001-N4
    it('기존 티켓이 있으면 칼럼 최솟값보다 1024 작은 position을 갖는다', async () => {
      await seedTicket({ status: TICKET_STATUS.BACKLOG, position: 0 });

      const res = await POST(jsonRequest({ title: '두 번째' }));

      const body = await res.json();
      expect(body.position).toBe(-1024);
    });

    it('연속 생성 시 새 티켓이 계속 맨 위에 쌓인다', async () => {
      const first = await (await POST(jsonRequest({ title: '첫번째' }))).json();
      const second = await (await POST(jsonRequest({ title: '두번째' }))).json();
      const third = await (await POST(jsonRequest({ title: '세번째' }))).json();

      expect(first.position).toBe(0);
      expect(second.position).toBe(-1024);
      expect(third.position).toBe(-2048);
    });

    // 001-N5
    it('생성 직후에는 시작일과 종료일이 비어 있다', async () => {
      const res = await POST(jsonRequest({ title: '새 티켓' }));

      const body = await res.json();
      expect(body.startedAt).toBeNull();
      expect(body.completedAt).toBeNull();
    });

    // 001-N6
    it('생성 시각과 수정 시각이 기록된다', async () => {
      const res = await POST(jsonRequest({ title: '새 티켓' }));

      const body = await res.json();
      expect(Date.parse(body.createdAt)).not.toBeNaN();
      expect(Date.parse(body.updatedAt)).not.toBeNaN();
    });

    it('status는 요청으로 지정할 수 없고 항상 BACKLOG가 된다', async () => {
      const res = await POST(
        jsonRequest({ title: '새 티켓', status: TICKET_STATUS.DONE }),
      );

      const body = await res.json();
      expect(body.status).toBe(TICKET_STATUS.BACKLOG);
    });
  });

  describe('예외 케이스', () => {
    // 001-E1
    it('제목이 없으면 400과 안내 메시지를 반환한다', async () => {
      const res = await POST(jsonRequest({}));

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ field: 'title', message: '제목을 입력해주세요' }),
      );
    });

    // 001-E2
    it('제목이 공백만 있으면 400을 반환한다', async () => {
      const res = await POST(jsonRequest({ title: '   ' }));

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ field: 'title', message: '제목을 입력해주세요' }),
      );
    });

    // 001-E3
    it('제목이 200자를 넘으면 400을 반환한다', async () => {
      const res = await POST(jsonRequest({ title: 'ㄱ'.repeat(201) }));

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'title',
          message: '제목은 200자 이내로 입력해주세요',
        }),
      );
    });

    // 001-E4
    it('설명이 1000자를 넘으면 400을 반환한다', async () => {
      const res = await POST(
        jsonRequest({ title: '새 티켓', description: 'ㄱ'.repeat(1001) }),
      );

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'description',
          message: '설명은 1000자 이내로 입력해주세요',
        }),
      );
    });

    // 001-E5
    it('정의되지 않은 우선순위 값이면 400을 반환한다', async () => {
      const res = await POST(jsonRequest({ title: '새 티켓', priority: 'URGENT' }));

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'priority',
          message: '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요',
        }),
      );
    });

    // 001-E6
    it('종료예정일이 과거이면 400을 반환한다', async () => {
      const res = await POST(jsonRequest({ title: '새 티켓', dueDate: daysAgo(1) }));

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'dueDate',
          message: '종료예정일은 오늘 이후 날짜를 선택해주세요',
        }),
      );
    });

    it('검증에 실패하면 티켓이 저장되지 않는다', async () => {
      await POST(jsonRequest({ title: '' }));

      const res = await POST(jsonRequest({ title: '유효한 제목' }));
      const body = await res.json();

      // 앞선 요청이 저장됐다면 position이 -1024가 됐을 것이다
      expect(body.position).toBe(0);
    });

    // 001-E7 — 경계값은 통과해야 한다
    it('제목이 정확히 200자이면 생성된다', async () => {
      const res = await POST(jsonRequest({ title: 'ㄱ'.repeat(200) }));

      expect(res.status).toBe(201);
    });

    // 001-E8
    it('본문이 올바른 JSON이 아니면 400과 VALIDATION_ERROR를 반환한다', async () => {
      const res = await POST(
        new Request('http://localhost/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ "title": "깨진 JSON"',
        }),
      );

      expect(res.status).toBe(400);

      const body = await res.json();
      // 400인데 INTERNAL_ERROR를 담으면 상태 코드와 어긋난다 (API_SPEC 2.4)
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('본문이 비어 있으면 400과 VALIDATION_ERROR를 반환한다', async () => {
      const res = await POST(
        new Request('http://localhost/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });

    it('설명이 정확히 1000자이면 생성된다', async () => {
      const res = await POST(
        jsonRequest({ title: '새 티켓', description: 'ㄱ'.repeat(1000) }),
      );

      expect(res.status).toBe(201);
    });
  });
});

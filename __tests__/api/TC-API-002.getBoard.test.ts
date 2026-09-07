/**
 * TC-API-002 · GET /api/tickets — 보드 조회 (FR-002)
 *
 * 관련 스토리: US-003(칸반 보드 현황 파악)
 * 명세: docs/API_SPEC.md 4장, docs/REQUIREMENTS.md FR-002
 *
 * isOverdue의 판정 규칙 자체는 TC-API-008이 다룬다.
 * 여기서는 응답에 필드가 포함되는지까지만 확인한다.
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants/ticket';
import * as ticketService from '@/server/services/ticketService';
import { GET } from '../../app/api/tickets/route';
import { daysAgo, daysLater, hoursAgo, resetDatabase, seedTicket } from '../helpers';

/**
 * getBoard를 처음부터 jest.fn으로 감싼다.
 * route.ts가 `import { getBoard }`로 바인딩을 가져가므로,
 * 나중에 jest.spyOn을 걸면 이미 캡처된 원본이 호출되어 목이 무시된다.
 * 모듈 팩토리 시점에 목을 자리잡게 해야 route가 목을 집어간다.
 * 기본 동작은 실제 구현을 그대로 위임한다.
 */
jest.mock('@/server/services/ticketService', () => {
  const actual = jest.requireActual('@/server/services/ticketService');
  return { ...actual, getBoard: jest.fn(actual.getBoard) };
});

describe('TC-API-002: GET /api/tickets — 보드 조회', () => {
  beforeEach(async () => {
    await resetDatabase();
    jest.restoreAllMocks();
  });

  describe('정상 케이스', () => {
    // 002-N1
    it('티켓이 하나도 없어도 4개 칼럼 키가 빈 배열로 반환된다', async () => {
      const res = await GET();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        BACKLOG: [],
        TODO: [],
        IN_PROGRESS: [],
        DONE: [],
      });
    });

    // 002-N2
    it('티켓이 status별로 정확히 그룹화된다', async () => {
      await seedTicket({ title: '백로그', status: TICKET_STATUS.BACKLOG });
      await seedTicket({ title: '할일', status: TICKET_STATUS.TODO });
      await seedTicket({ title: '진행중', status: TICKET_STATUS.IN_PROGRESS });

      const body = await (await GET()).json();

      expect(body.BACKLOG.map((t: { title: string }) => t.title)).toEqual(['백로그']);
      expect(body.TODO.map((t: { title: string }) => t.title)).toEqual(['할일']);
      expect(body.IN_PROGRESS.map((t: { title: string }) => t.title)).toEqual(['진행중']);
      expect(body.DONE).toEqual([]);
    });

    // 002-N3
    it('칼럼 내 티켓이 position 오름차순으로 정렬된다', async () => {
      await seedTicket({ title: '세번째', status: TICKET_STATUS.TODO, position: 1024 });
      await seedTicket({ title: '첫번째', status: TICKET_STATUS.TODO, position: -1024 });
      await seedTicket({ title: '두번째', status: TICKET_STATUS.TODO, position: 0 });

      const body = await (await GET()).json();

      expect(body.TODO.map((t: { title: string }) => t.title)).toEqual([
        '첫번째',
        '두번째',
        '세번째',
      ]);
    });

    it('음수 position도 순서대로 정렬된다', async () => {
      await seedTicket({ title: '아래', status: TICKET_STATUS.BACKLOG, position: 0 });
      await seedTicket({ title: '위', status: TICKET_STATUS.BACKLOG, position: -2048 });
      await seedTicket({ title: '가운데', status: TICKET_STATUS.BACKLOG, position: -1024 });

      const body = await (await GET()).json();

      expect(body.BACKLOG.map((t: { title: string }) => t.title)).toEqual([
        '위',
        '가운데',
        '아래',
      ]);
    });

    // 002-N4
    it('각 티켓에 isOverdue 파생 필드가 포함된다', async () => {
      await seedTicket({ status: TICKET_STATUS.BACKLOG, dueDate: daysLater(3) });

      const body = await (await GET()).json();

      expect(body.BACKLOG[0]).toHaveProperty('isOverdue');
      expect(typeof body.BACKLOG[0].isOverdue).toBe('boolean');
    });

    it('종료예정일이 지난 미완료 티켓은 isOverdue가 true다', async () => {
      await seedTicket({ status: TICKET_STATUS.TODO, dueDate: daysAgo(1) });

      const body = await (await GET()).json();

      expect(body.TODO[0].isOverdue).toBe(true);
    });

    it('응답 티켓이 API 명세의 필드를 모두 갖는다', async () => {
      await seedTicket({
        title: 'API 설계',
        status: TICKET_STATUS.TODO,
        priority: TICKET_PRIORITY.HIGH,
        position: 0,
      });

      const body = await (await GET()).json();

      expect(body.TODO[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          title: 'API 설계',
          description: null,
          status: TICKET_STATUS.TODO,
          priority: TICKET_PRIORITY.HIGH,
          position: 0,
          plannedStartDate: null,
          dueDate: null,
          startedAt: null,
          completedAt: null,
          isOverdue: false,
        }),
      );
    });

    // 002-N5
    it('완료된 지 24시간이 지나지 않은 티켓은 Done 칼럼에 표시된다', async () => {
      await seedTicket({
        title: '최근 완료',
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(23),
      });

      const body = await (await GET()).json();

      expect(body.DONE.map((t: { title: string }) => t.title)).toEqual(['최근 완료']);
    });

    // 002-N6
    it('완료된 지 24시간이 지난 티켓은 Done 칼럼에서 제외된다', async () => {
      await seedTicket({
        title: '오래된 완료',
        status: TICKET_STATUS.DONE,
        completedAt: hoursAgo(25),
      });

      const body = await (await GET()).json();

      expect(body.DONE).toEqual([]);
    });

    it('Done 칼럼은 24시간 이내 완료분만 남기고 나머지는 걸러낸다', async () => {
      await seedTicket({ title: '최근', status: TICKET_STATUS.DONE, completedAt: hoursAgo(1) });
      await seedTicket({ title: '경계 밖', status: TICKET_STATUS.DONE, completedAt: hoursAgo(30) });
      await seedTicket({ title: '아주 오래', status: TICKET_STATUS.DONE, completedAt: hoursAgo(72) });

      const body = await (await GET()).json();

      expect(body.DONE.map((t: { title: string }) => t.title)).toEqual(['최근']);
    });

    it('종료예정일이 지났어도 완료된 티켓은 isOverdue가 false다', async () => {
      await seedTicket({
        status: TICKET_STATUS.DONE,
        dueDate: daysAgo(3),
        completedAt: hoursAgo(1),
      });

      const body = await (await GET()).json();

      expect(body.DONE[0].isOverdue).toBe(false);
    });
  });

  describe('예외 케이스', () => {
    // 002-E1
    it('조회 중 오류가 나면 500과 INTERNAL_ERROR를 반환한다', async () => {
      (ticketService.getBoard as jest.Mock).mockRejectedValueOnce(
        new Error('connection terminated'),
      );

      const res = await GET();

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

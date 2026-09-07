# Tika - 테스트 케이스 (TEST_CASES.md)

> 요구사항은 [REQUIREMENTS.md](./REQUIREMENTS.md), API는 [API_SPEC.md](./API_SPEC.md),
> 컴포넌트는 [COMPONENT_SPEC.md](./COMPONENT_SPEC.md)를 기준으로 한다.
>
> **새 기능 구현 전 이 문서의 해당 테스트부터 작성한다** (CLAUDE.md).

---

## 1. 추적 매트릭스

요구사항에서 테스트로 이어지는 경로를 한눈에 확인하기 위해 문서 최상단에 둔다.

### 1.1 사용자 스토리 → FR → 테스트

| 사용자 스토리 | 관련 FR | API 테스트 | 컴포넌트 테스트 | 통합 테스트 |
|--------------|---------|-----------|----------------|------------|
| US-001: 새 할 일 등록 | FR-001 | TC-API-001 | TC-COMP-004 | - |
| US-002: 상세 정보 설정 | FR-001 | TC-API-001 | TC-COMP-004 | - |
| US-003: 칸반 보드 현황 파악 | FR-002, FR-008 | TC-API-002, TC-API-008 | TC-COMP-002, TC-COMP-003 | - |
| US-004: 마감 초과 인지 | FR-008 | TC-API-008 | TC-COMP-001 | - |
| US-005: 드래그앤드롭 상태 변경 | FR-007 | TC-API-007 | - | TC-INT-001 |
| US-006: 할 일 완료 처리 | FR-005 | TC-API-005 | - | TC-INT-001, TC-INT-002 |
| US-007: 할 일 수정 | FR-003, FR-004 | TC-API-003, TC-API-004 | TC-COMP-005 | - |
| US-008: 할 일 삭제 | FR-006 | TC-API-006 | TC-COMP-006 | TC-INT-002 |

### 1.2 테스트 → 요구사항 (역방향)

| 테스트 ID | 대상 | FR | US |
|-----------|------|-----|-----|
| TC-API-001 | `POST /api/tickets` | FR-001 | US-001, US-002 |
| TC-API-002 | `GET /api/tickets` | FR-002 | US-003 |
| TC-API-003 | `GET /api/tickets/:id` | FR-003 | US-007 |
| TC-API-004 | `PATCH /api/tickets/:id` | FR-004 | US-007 |
| TC-API-005 | `PATCH /api/tickets/:id/complete` | FR-005 | US-006 |
| TC-API-006 | `DELETE /api/tickets/:id` | FR-006 | US-008 |
| TC-API-007 | `PATCH /api/tickets/reorder` | FR-007 | US-005 |
| TC-API-008 | `isOverdue` 파생 판정 | FR-008 | US-003, US-004 |
| TC-COMP-001 | `TicketCard` — 오버듀 표시 | FR-008 | US-004 |
| TC-COMP-002 | `Board` — 4칼럼 렌더링 | FR-002 | US-003 |
| TC-COMP-003 | `Column` — 카드 수·정렬·빈 상태 | FR-002 | US-003 |
| TC-COMP-004 | `TicketForm` — 티켓 생성 | FR-001 | US-001, US-002 |
| TC-COMP-005 | `TicketModal` — 조회·수정 | FR-003, FR-004 | US-007 |
| TC-COMP-006 | `TicketModal` + `ConfirmDialog` — 삭제 | FR-006 | US-008 |
| TC-INT-001 | 드래그앤드롭 → 상태 변경 → 롤백 | FR-005, FR-007 | US-005, US-006 |
| TC-INT-002 | 완료 처리 → 영구 삭제 | FR-005, FR-006 | US-006, US-008 |

### 1.3 커버리지 확인

| FR | 테스트 | 상태 |
|----|--------|------|
| FR-001 티켓 생성 | TC-API-001, TC-COMP-004 | ✓ |
| FR-002 목록 조회 | TC-API-002, TC-COMP-002, TC-COMP-003 | ✓ |
| FR-003 상세 조회 | TC-API-003, TC-COMP-005 | ✓ |
| FR-004 티켓 수정 | TC-API-004, TC-COMP-005 | ✓ |
| FR-005 티켓 완료 | TC-API-005, TC-INT-001, TC-INT-002 | ✓ |
| FR-006 티켓 삭제 | TC-API-006, TC-COMP-006, TC-INT-002 | ✓ |
| FR-007 상태/순서 변경 | TC-API-007, TC-INT-001 | ✓ |
| FR-008 오버듀 판정 | TC-API-008, TC-COMP-001 | ✓ |

---

## 2. 테스트 개요

### 2.1 도구 및 위치

| 구분 | 도구 | 위치 |
|------|------|------|
| API | Jest | `__tests__/api/` |
| 서비스 유닛 | Jest | `__tests__/server/` |
| 컴포넌트 | Jest + React Testing Library | `__tests__/client/` |
| 통합 | Jest + RTL | `__tests__/integration/` |

### 2.2 ID 체계

```
TC-{계층}-{일련번호}

TC-API-001    API 테스트
TC-COMP-001   컴포넌트 테스트
TC-INT-001    통합 테스트
```

하위 케이스는 `TC-API-001-N`(정상), `TC-API-001-E`(예외)로 구분한다.

### 2.3 테스트 이름 작성 규칙

`it()`의 설명은 **무엇을 검증하는지 한국어 문장으로** 쓴다.

```typescript
// 지향
it('제목만 입력해도 티켓이 생성되고 BACKLOG 상태가 된다', ...)

// 지양 — 무엇을 확인하는지 알 수 없다
it('createTicket works', ...)
```

### 2.4 TDD 사이클 (CLAUDE.md)

| 단계 | 규칙 |
|------|------|
| **Red** | 테스트만 작성한다. 구현 코드를 만들지 않는다 |
| **Green** | 테스트를 통과하는 최소한의 코드만 작성한다. 테스트를 수정하지 않는다 |
| **Refactor** | 코드 개선만 한다. 새 기능을 추가하지 않고 테스트는 통과를 유지한다 |

테스트가 실패하면 **구현을 고친다.** 테스트를 고치지 않는다.
명세 자체가 잘못된 경우에만 명세를 먼저 수정하고 테스트를 따라 바꾼다.

**테스트 코드 삭제 및 `skip` 금지.**

---

## 3. API 테스트 케이스

각 케이스는 **정상 케이스 + 예외 케이스**로 구성한다.

### 3.1 공통 구조

```typescript
describe('TC-API-00N: {METHOD} {경로} — {기능}', () => {
  beforeEach(async () => { await resetDatabase(); });

  describe('정상 케이스', () => { /* ... */ });
  describe('예외 케이스', () => { /* ... */ });
});
```

---

### TC-API-001 · `POST /api/tickets` (FR-001)

**정상 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 001-N1 | 제목만으로 생성 | 201, `status = BACKLOG`, `priority = MEDIUM` |
| 001-N2 | 모든 필드로 생성 | 201, 전달한 값이 그대로 저장 |
| 001-N3 | 빈 Backlog에 첫 생성 | `position = 0` |
| 001-N4 | 기존 티켓이 있는 상태에서 생성 | `position = 기존 최솟값 - 1024` |
| 001-N5 | 생성 직후 상태 확인 | `startedAt`·`completedAt`이 `null` |
| 001-N6 | 시각 기록 | `createdAt`·`updatedAt`이 설정됨 |

**예외 케이스**

| ID | 입력 | 기대 결과 |
|----|------|-----------|
| 001-E1 | `title` 누락 | 400, `제목을 입력해주세요` |
| 001-E2 | `title`이 공백만 (`"   "`) | 400, `제목을 입력해주세요` |
| 001-E3 | `title` 201자 | 400, `제목은 200자 이내로 입력해주세요` |
| 001-E4 | `description` 1001자 | 400, `설명은 1000자 이내로 입력해주세요` |
| 001-E5 | `priority: "URGENT"` | 400, `우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요` |
| 001-E6 | `dueDate`가 어제 | 400, `종료예정일은 오늘 이후 날짜를 선택해주세요` |
| 001-E7 | `title` 200자 (경계) | **201** — 통과해야 한다 |
| 001-E8 | 본문이 올바른 JSON이 아님 | 400, `VALIDATION_ERROR` — 상태 코드와 에러 코드가 일치해야 한다 |

```typescript
describe('TC-API-001: POST /api/tickets — 티켓 생성', () => {
  beforeEach(async () => { await resetDatabase(); });

  describe('정상 케이스', () => {
    it('제목만 입력해도 티켓이 생성되고 BACKLOG 상태가 된다', async () => {
      const res = await POST(jsonRequest({ title: 'PRD 초안' }));

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        title: 'PRD 초안',
        status: 'BACKLOG',
        priority: 'MEDIUM',   // 미지정 시 기본값
        startedAt: null,
        completedAt: null,
      });
    });

    it('빈 Backlog에 첫 티켓을 만들면 position이 0이다', async () => {
      const res = await POST(jsonRequest({ title: '첫 티켓' }));
      expect((await res.json()).position).toBe(0);
    });

    it('기존 티켓이 있으면 최솟값보다 1024 작은 position을 갖는다', async () => {
      await seedTicket({ status: 'BACKLOG', position: 0 });

      const res = await POST(jsonRequest({ title: '두 번째' }));
      expect((await res.json()).position).toBe(-1024);
    });
  });

  describe('예외 케이스', () => {
    it('제목이 없으면 400과 안내 메시지를 반환한다', async () => {
      const res = await POST(jsonRequest({}));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ field: 'title', message: '제목을 입력해주세요' }),
      );
    });

    it('제목이 공백만 있으면 400을 반환한다', async () => {
      const res = await POST(jsonRequest({ title: '   ' }));
      expect(res.status).toBe(400);
    });

    it('제목이 정확히 200자이면 생성된다', async () => {
      const res = await POST(jsonRequest({ title: 'あ'.repeat(200) }));
      expect(res.status).toBe(201);
    });
  });
});
```

---

### TC-API-002 · `GET /api/tickets` (FR-002)

**정상 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 002-N1 | 티켓이 없는 상태 | 200, 4개 키가 모두 존재하고 각각 빈 배열 |
| 002-N2 | 여러 칼럼에 티켓 존재 | `status`별로 정확히 그룹화 |
| 002-N3 | 한 칼럼에 여러 티켓 | `position` 오름차순 정렬 |
| 002-N4 | 응답 필드 | 각 티켓에 `isOverdue` 포함 |
| 002-N5 | Done 24시간 이내 완료분 | `DONE` 배열에 포함 |
| 002-N6 | Done 24시간 초과 완료분 | `DONE` 배열에서 **제외** |

**예외 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 002-E1 | DB 조회 실패 | 500, `{ error: { code: 'INTERNAL_ERROR' } }` |

```typescript
it('티켓이 하나도 없어도 4개 칼럼 키가 빈 배열로 반환된다', async () => {
  const body = await (await GET()).json();
  expect(body).toEqual({ BACKLOG: [], TODO: [], IN_PROGRESS: [], DONE: [] });
});

it('칼럼 내 티켓이 position 오름차순으로 정렬된다', async () => {
  await seedTicket({ title: '세번째', status: 'TODO', position: 1024 });
  await seedTicket({ title: '첫번째', status: 'TODO', position: -1024 });
  await seedTicket({ title: '두번째', status: 'TODO', position: 0 });

  const body = await (await GET()).json();
  expect(body.TODO.map((t) => t.title)).toEqual(['첫번째', '두번째', '세번째']);
});

it('완료된 지 24시간이 지난 티켓은 Done 칼럼에서 제외된다', async () => {
  await seedTicket({ status: 'DONE', completedAt: hoursAgo(23) });
  await seedTicket({ status: 'DONE', completedAt: hoursAgo(25) });

  const body = await (await GET()).json();
  expect(body.DONE).toHaveLength(1);
});
```

---

### TC-API-003 · `GET /api/tickets/:id` (FR-003)

| 구분 | ID | 시나리오 | 기대 결과 |
|------|----|----------|-----------|
| 정상 | 003-N1 | 존재하는 ID 조회 | 200, 티켓 전체 데이터 |
| 정상 | 003-N2 | Done 24시간 초과 티켓 조회 | **200** — 보드에서 감춰져도 조회된다 |
| 예외 | 003-E1 | 존재하지 않는 ID | 404, `티켓을 찾을 수 없습니다` |
| 예외 | 003-E2 | 숫자가 아닌 ID (`/api/tickets/abc`) | 400 또는 404 |

---

### TC-API-004 · `PATCH /api/tickets/:id` (FR-004)

**정상 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 004-N1 | `priority`만 전송 | 200, 다른 필드는 기존 값 유지 |
| 004-N2 | 여러 필드 동시 수정 | 200, 전달한 값이 모두 반영 |
| 004-N3 | `description: null` 전송 | `null`로 삭제 |
| 004-N4 | `dueDate: null` 전송 | `null`로 삭제 |
| 004-N5 | 수정 후 `updatedAt` | 이전 값보다 이후 시각 |
| 004-N6 | 필드 누락 vs `null` 구분 | 누락은 유지, `null`은 삭제 |

**예외 케이스**

| ID | 입력 | 기대 결과 |
|----|------|-----------|
| 004-E1 | `title` 201자 | 400, `제목은 200자 이내로 입력해주세요` |
| 004-E2 | `description` 1001자 | 400, `설명은 1000자 이내로 입력해주세요` |
| 004-E3 | 잘못된 `priority` | 400, `우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요` |
| 004-E4 | 과거 `dueDate` | 400, `종료예정일은 오늘 이후 날짜를 선택해주세요` |
| 004-E5 | 존재하지 않는 ID | 404 |

```typescript
it('전송하지 않은 필드는 기존 값을 유지한다', async () => {
  const { id } = await seedTicket({ title: '원래 제목', description: '원래 설명' });

  const body = await (await PATCH(jsonRequest({ priority: 'HIGH' }), { params: { id } })).json();

  expect(body.priority).toBe('HIGH');
  expect(body.title).toBe('원래 제목');        // 유지
  expect(body.description).toBe('원래 설명');  // 유지
});

it('description에 null을 전송하면 값이 삭제된다', async () => {
  const { id } = await seedTicket({ description: '지울 설명' });

  const body = await (await PATCH(jsonRequest({ description: null }), { params: { id } })).json();
  expect(body.description).toBeNull();
});
```

---

### TC-API-005 · `PATCH /api/tickets/:id/complete` (FR-005)

**요청 본문이 없다.** 이 엔드포인트는 완료 처리 한 가지만 수행한다.
완료 **해제**는 `/reorder`의 관할이므로 TC-API-007이 다룬다 (API_SPEC 13.1).

**정상 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 005-N1 | 본문 없이 호출 | 200, `status = DONE`, `completedAt` 설정 |
| 005-N2 | 완료 시 `startedAt` | 기존 값 **유지** |
| 005-N3 | 어느 칼럼에서든 완료 | BACKLOG·TODO·IN_PROGRESS 모두 DONE이 된다 |
| 005-N4 | 이미 DONE인 티켓을 재호출 | `completedAt`이 현재 시각으로 갱신된다 |
| 005-N5 | `updatedAt` | 갱신된다 |
| 005-N6 | 완료 후 보드 조회 | Done 칼럼에 나타난다 (24시간 이내) |

**예외 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 005-E1 | 존재하지 않는 ID | 404, `티켓을 찾을 수 없습니다` |
| 005-E2 | 숫자가 아닌 ID | 404 |

```typescript
it('완료 처리하면 status가 DONE이 되고 completedAt이 기록된다', async () => {
  const seeded = await seedTicket({ status: 'IN_PROGRESS', completedAt: null });

  const body = await (await complete(seeded.id)).json();

  expect(body.status).toBe('DONE');
  expect(body.completedAt).not.toBeNull();
});

it('완료해도 시작일은 유지된다', async () => {
  const startedAt = hoursAgo(3);
  const seeded = await seedTicket({ status: 'IN_PROGRESS', startedAt });

  const body = await (await complete(seeded.id)).json();

  expect(Date.parse(body.startedAt)).toBe(startedAt.getTime());
});
```

> 완료 해제(`Done → 다른 칼럼`)는 TC-API-007에서 검증한다.
> 이동 대상이 DONE이 아니므로 `/reorder`가 담당하며, 그때 `completedAt`이 초기화된다.

---

### TC-API-006 · `DELETE /api/tickets/:id` (FR-006)

| 구분 | ID | 시나리오 | 기대 결과 |
|------|----|----------|-----------|
| 정상 | 006-N1 | 존재하는 티켓 삭제 | 204, 본문 없음 |
| 정상 | 006-N2 | 삭제 후 재조회 | `GET /:id`가 404 |
| 정상 | 006-N3 | 삭제 후 보드 조회 | 해당 티켓이 목록에서 사라짐 |
| 정상 | 006-N4 | 하드 삭제 확인 | DB에 행이 남아 있지 않음 |
| 예외 | 006-E1 | 존재하지 않는 ID | 404 |
| 예외 | 006-E2 | 같은 ID 두 번 삭제 | 첫 번째 204, 두 번째 404 |

---

### TC-API-007 · `PATCH /api/tickets/reorder` (FR-007)

**정상 케이스**

| ID | 시나리오 | 기대 결과 |
|----|----------|-----------|
| 007-N1 | 다른 칼럼으로 이동 | 200, `status`·`position` 반영 |
| 007-N2 | 같은 칼럼 내 순서 변경 | 200, `position`만 변경 |
| 007-N3 | BACKLOG → TODO | `startedAt`에 현재 시각 기록 |
| 007-N4 | 이미 `startedAt`이 있는 티켓이 TODO 진입 | 기존 값 **유지** (덮어쓰지 않음) |
| 007-N5 | TODO → BACKLOG | `startedAt = null` |
| 007-N6 | 두 카드 사이 삽입 | `position`이 두 값 사이 |
| 007-N7 | 간격이 1 미만인 칼럼 | 칼럼 전체가 1024 간격으로 재정렬 |
| 007-N8 | 역방향 이동 (IN_PROGRESS → BACKLOG) | 허용됨 |
| 007-N9 | **DONE → 다른 칼럼 (완료 해제)** | `completedAt = null`, `status` 반영 |
| 007-N10 | 완료 해제 시 `startedAt` | 기존 값 **유지** |

**예외 케이스**

| ID | 입력 | 기대 결과 |
|----|------|-----------|
| 007-E1 | `status: 'DONE'` | 400, `상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요` |
| 007-E2 | 잘못된 `status` 문자열 | 400, 동일 메시지 |
| 007-E3 | 존재하지 않는 `ticketId` | 404, `티켓을 찾을 수 없습니다` |
| 007-E4 | `ticketId` 누락 | 400 |
| 007-E5 | 트랜잭션 중 실패 | 상태·순서 **모두 롤백** (부분 반영 없음) |

```typescript
it('TODO로 이동하면 startedAt이 기록된다', async () => {
  const { id } = await seedTicket({ status: 'BACKLOG', startedAt: null });

  const [ticket] = await (await PATCH(
    jsonRequest({ ticketId: id, status: 'TODO', position: 0 }),
  )).json();

  expect(ticket.startedAt).not.toBeNull();
});

it('이미 startedAt이 있으면 TODO로 다시 들어와도 덮어쓰지 않는다', async () => {
  const original = new Date('2026-09-01T10:00:00Z');
  const { id } = await seedTicket({ status: 'IN_PROGRESS', startedAt: original });

  const [ticket] = await (await PATCH(
    jsonRequest({ ticketId: id, status: 'TODO', position: 0 }),
  )).json();

  expect(new Date(ticket.startedAt)).toEqual(original);
});

it('DONE으로의 이동은 거부된다', async () => {
  const { id } = await seedTicket({ status: 'TODO' });

  const res = await PATCH(jsonRequest({ ticketId: id, status: 'DONE', position: 0 }));

  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error.details[0].message).toBe('상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요');
});
```

---

### TC-API-008 · `isOverdue` 파생 판정 (FR-008)

전용 엔드포인트가 없으므로 `GET /api/tickets` 응답의 `isOverdue`를 검증한다.

| 구분 | ID | 조건 | `isOverdue` |
|------|----|------|-------------|
| 정상 | 008-N1 | `dueDate` = 어제, `status = TODO` | **`true`** |
| 정상 | 008-N2 | `dueDate` = 오늘 | `false` (당일은 초과 아님) |
| 정상 | 008-N3 | `dueDate` = 내일 | `false` |
| 정상 | 008-N4 | `dueDate` = 어제, `status = DONE` | `false` |
| 정상 | 008-N5 | `dueDate = null` | `false` |
| 예외 | 008-E1 | DB에 `isOverdue` 컬럼 존재 | **없어야 한다** (파생 필드) |

```typescript
it.each([
  ['어제 마감이고 미완료면',        daysAgo(1),   'TODO', true],
  ['오늘 마감이면',                today(),      'TODO', false],
  ['내일 마감이면',                daysLater(1), 'TODO', false],
  ['어제 마감이지만 완료 상태면',   daysAgo(1),   'DONE', false],
  ['종료예정일이 없으면',          null,         'TODO', false],
])('%s isOverdue는 %s가 아니라 정의대로 판정된다', async (_, dueDate, status, expected) => {
  await seedTicket({ dueDate, status });

  const board = await (await GET()).json();
  expect(findTicket(board).isOverdue).toBe(expected);
});
```

---

## 4. 컴포넌트 테스트 케이스

### 4.1 작성 원칙 — 사용자 관점

**사용자가 보는 것**과 **사용자가 하는 행동**만 검증한다. 내부 구현은 검증 대상이 아니다.

| 검증한다 | 검증하지 않는다 |
|----------|----------------|
| 화면에 보이는 텍스트·아이콘 | `useState` 값, 내부 변수 |
| 클릭·입력·키보드 조작의 결과 | 함수 호출 횟수 자체 |
| 접근 가능한 이름(`role`, `label`) | CSS 클래스명, DOM 구조 |
| 사용자에게 노출되는 에러 메시지 | 컴포넌트 내부 메서드 |

```typescript
// 지향 — 사용자가 보고 하는 것
await userEvent.click(screen.getByRole('button', { name: '새 티켓' }));
expect(screen.getByText('제목을 입력해주세요')).toBeInTheDocument();

// 지양 — 내부 구현에 결합
expect(wrapper.state('isModalOpen')).toBe(true);
expect(container.querySelector('.ticket-card--overdue')).toBeTruthy();
```

**쿼리 우선순위**: `getByRole` → `getByLabelText` → `getByText` → (최후) `getByTestId`

---

### TC-COMP-001 · `TicketCard` — 오버듀 표시 (FR-008, US-004)

| ID | 사용자가 보는 것 | 기대 |
|----|-----------------|------|
| 001-N1 | 일반 티켓 카드 | 제목, 우선순위, 종료예정일이 보인다 |
| 001-N2 | 오버듀 티켓 카드 | 경고 표시가 함께 보인다 |
| 001-N3 | 종료예정일이 없는 카드 | 날짜 영역이 보이지 않는다 |
| 001-N4 | 우선순위별 카드 | LOW/MEDIUM/HIGH가 각각 구분되어 보인다 |
| 001-N5 | 스크린 리더 사용자 | 제목·우선순위·상태·초과 여부를 읽을 수 있다 |
| 001-E1 | 제목이 매우 긴 카드 | 레이아웃이 깨지지 않는다 |

```typescript
describe('TC-COMP-001: TicketCard — 오버듀 표시', () => {
  it('일정이 초과된 티켓에는 경고 표시가 보인다', () => {
    render(<TicketCard ticket={ticket({ isOverdue: true, dueDate: '2026-09-01' })} onClick={noop} />);

    expect(screen.getByLabelText(/일정 초과/)).toBeInTheDocument();
  });

  it('일정이 남은 티켓에는 경고 표시가 보이지 않는다', () => {
    render(<TicketCard ticket={ticket({ isOverdue: false })} onClick={noop} />);

    expect(screen.queryByLabelText(/일정 초과/)).not.toBeInTheDocument();
  });

  it('스크린 리더가 제목·우선순위·상태를 읽을 수 있다', () => {
    render(<TicketCard ticket={ticket({ title: '테스트 작성', priority: 'HIGH', status: 'BACKLOG' })} onClick={noop} />);

    expect(screen.getByRole('button', { name: /테스트 작성.*HIGH.*Backlog/ })).toBeInTheDocument();
  });

  it('카드를 클릭하면 상세 보기를 요청한다', async () => {
    const onClick = jest.fn();
    render(<TicketCard ticket={ticket()} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: /테스트/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

### TC-COMP-002 · `Board` — 4칼럼 렌더링 (FR-002, US-003)

| ID | 사용자가 보는 것 | 기대 |
|----|-----------------|------|
| 002-N1 | 보드를 연다 | Backlog, TODO, In Progress, Done 4칼럼이 보인다 |
| 002-N2 | 칼럼 순서 | 항상 고정 순서로 나열된다 |
| 002-N3 | 티켓이 있는 보드 | 각 티켓이 해당 칼럼에 표시된다 |
| 002-N4 | 티켓이 없는 보드 | 4칼럼이 모두 보이고 각각 안내 문구가 있다 |
| 002-E1 | 특정 칼럼만 비어 있음 | 그 칼럼에만 안내 문구가 보인다 |

```typescript
it('보드를 열면 4개 칼럼이 정해진 순서로 보인다', () => {
  render(<Board board={emptyBoard()} onMove={noop} onTicketClick={noop} />);

  const headings = screen.getAllByRole('heading');
  expect(headings.map((h) => h.textContent)).toEqual(
    expect.arrayContaining(['Backlog', 'TODO', 'In Progress', 'Done']),
  );
});
```

---

### TC-COMP-003 · `Column` — 카드 수·정렬·빈 상태 (FR-002, US-003)

| ID | 사용자가 보는 것 | 기대 |
|----|-----------------|------|
| 003-N1 | 티켓 3개가 있는 칼럼 | 헤더에 카드 수 `3`이 보인다 |
| 003-N2 | 정렬 | `position` 순서대로 위에서 아래로 배치된다 |
| 003-N3 | 빈 Backlog | `새 티켓을 추가해보세요` |
| 003-N4 | 빈 TODO | `착수할 티켓을 여기로 옮기세요` |
| 003-N5 | 빈 In Progress | `진행 중인 티켓이 없습니다` |
| 003-N6 | 빈 Done | `최근 24시간 내 완료한 티켓이 없습니다` |
| 003-E1 | 티켓이 있는 칼럼 | 안내 문구가 보이지 않는다 |

```typescript
it('칼럼 헤더에 카드 수가 표시된다', () => {
  render(<Column status="TODO" title="TODO" tickets={[ticket(), ticket(), ticket()]} onTicketClick={noop} />);

  expect(screen.getByText('3')).toBeInTheDocument();
});

it('빈 Backlog 칼럼에는 티켓 추가를 안내한다', () => {
  render(<Column status="BACKLOG" title="Backlog" tickets={[]} onTicketClick={noop} />);

  expect(screen.getByText('새 티켓을 추가해보세요')).toBeInTheDocument();
});

it('카드가 position 순서대로 보인다', () => {
  render(
    <Column status="TODO" title="TODO" onTicketClick={noop}
      tickets={[ticket({ title: '첫번째', position: -1024 }), ticket({ title: '두번째', position: 0 })]} />,
  );

  const titles = screen.getAllByRole('button').map((el) => el.textContent);
  expect(titles[0]).toContain('첫번째');
});
```

---

### TC-COMP-004 · `TicketForm` — 티켓 생성 (FR-001, US-001·US-002)

| ID | 사용자 행동 | 기대 |
|----|------------|------|
| 004-N1 | 제목만 입력하고 생성 | 생성이 요청되고 폼이 닫힌다 |
| 004-N2 | 우선순위를 고르지 않음 | `MEDIUM`으로 전송된다 |
| 004-N3 | 모든 필드 입력 후 생성 | 입력값이 그대로 전송된다 |
| 004-N4 | 생성 성공 | 폼이 닫힌다 |
| 004-E1 | 제목 없이 제출 | `제목을 입력해주세요`가 보이고 전송되지 않는다 |
| 004-E2 | 제목 201자 입력 후 제출 | `제목은 200자 이내로 입력해주세요` |
| 004-E3 | 과거 날짜를 종료예정일로 선택 | `종료예정일은 오늘 이후 날짜를 선택해주세요` |
| 004-E4 | 취소 클릭 | 입력 내용이 사라지고 폼이 닫힌다 |

```typescript
describe('TC-COMP-004: TicketForm — 티켓 생성', () => {
  it('제목만 입력해도 티켓을 만들 수 있다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('제목'), 'PRD 초안');
    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'PRD 초안', priority: 'MEDIUM' }),
    );
  });

  it('제목 없이 제출하면 안내 메시지가 보이고 전송되지 않는다', async () => {
    const onSubmit = jest.fn();
    render(<TicketForm isOpen onClose={noop} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

---

### TC-COMP-005 · `TicketModal` — 조회·수정 (FR-003·FR-004, US-007)

| ID | 사용자 행동 | 기대 |
|----|------------|------|
| 005-N1 | 모달을 연다 | 로딩 후 티켓 상세가 읽기 전용으로 보인다 |
| 005-N2 | 시작일·종료일 확인 | 표시되지만 편집할 수 없다 |
| 005-N3 | "편집" 클릭 | 입력 필드로 바뀌고 저장/취소 버튼이 보인다 |
| 005-N4 | 값 수정 후 저장 | 수정이 요청되고 읽기 전용으로 돌아간다 |
| 005-N5 | 편집 중 "취소" | 변경이 버려지고 원래 값이 보인다 |
| 005-E1 | 제목을 비우고 저장 | `제목을 입력해주세요`가 보이고 전송되지 않는다 |
| 005-E2 | 조회가 404 | `티켓을 찾을 수 없습니다`가 보인다 |

```typescript
it('모달을 열면 읽기 전용으로 상세가 보인다', async () => {
  mockGetById({ title: 'API 설계', priority: 'HIGH' });
  render(<TicketModal ticketId={1} onClose={noop} onUpdate={noop} onDelete={noop} />);

  expect(await screen.findByText('API 설계')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '제목' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument();
});

it('편집을 누르면 값을 고칠 수 있고 저장하면 반영을 요청한다', async () => {
  mockGetById({ title: 'API 설계' });
  const onUpdate = jest.fn().mockResolvedValue(undefined);
  render(<TicketModal ticketId={1} onClose={noop} onUpdate={onUpdate} onDelete={noop} />);

  await userEvent.click(await screen.findByRole('button', { name: '편집' }));
  await userEvent.clear(screen.getByRole('textbox', { name: '제목' }));
  await userEvent.type(screen.getByRole('textbox', { name: '제목' }), 'API 명세');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));

  expect(onUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'API 명세' }));
});

it('시작일과 종료일은 편집 모드에서도 고칠 수 없다', async () => {
  mockGetById({ startedAt: '2026-09-02T10:14:00.000Z' });
  render(<TicketModal ticketId={1} onClose={noop} onUpdate={noop} onDelete={noop} />);

  await userEvent.click(await screen.findByRole('button', { name: '편집' }));
  expect(screen.queryByRole('textbox', { name: '시작일' })).not.toBeInTheDocument();
});
```

---

### TC-COMP-006 · `TicketModal` + `ConfirmDialog` — 삭제 (FR-006, US-008)

| ID | 사용자 행동 | 기대 |
|----|------------|------|
| 006-N1 | 모달에서 "삭제" 클릭 | `정말 삭제하시겠습니까?` 확인창이 보인다 |
| 006-N2 | 확인창에서 "확인" | 삭제가 요청되고 모달이 닫힌다 |
| 006-N3 | 확인창에서 "취소" | 삭제되지 않고 모달이 유지된다 |
| 006-N4 | 확인창에서 `Esc` | 취소와 동일하게 동작한다 |
| 006-E1 | 확인 없이 삭제 | 확인 절차를 건너뛸 수 없다 |

```typescript
it('삭제를 누르면 곧바로 지우지 않고 확인을 먼저 받는다', async () => {
  mockGetById({ title: 'API 설계' });
  const onDelete = jest.fn();
  render(<TicketModal ticketId={1} onClose={noop} onUpdate={noop} onDelete={onDelete} />);

  await userEvent.click(await screen.findByRole('button', { name: '삭제' }));

  expect(screen.getByText('정말 삭제하시겠습니까?')).toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();   // 아직 삭제되지 않았다
});

it('확인을 누르면 삭제가 요청된다', async () => {
  mockGetById({ title: 'API 설계' });
  const onDelete = jest.fn().mockResolvedValue(undefined);
  render(<TicketModal ticketId={1} onClose={noop} onUpdate={noop} onDelete={onDelete} />);

  await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
  await userEvent.click(screen.getByRole('button', { name: '확인' }));

  expect(onDelete).toHaveBeenCalledWith(1);
});
```

---

## 5. 통합 테스트 케이스

여러 계층을 가로지르는 흐름을 검증한다. API는 목킹하고 UI부터 Hook까지를 실제로 동작시킨다.

### 5.1 드래그앤드롭 테스트 방법

jsdom은 포인터 이벤트를 완전히 재현하지 못한다.
@dnd-kit의 **`KeyboardSensor`를 사용해 키보드로 드래그를 수행**한다. 접근성(NFR-003) 검증을 겸한다.

```
Tab / 방향키로 카드에 포커스
Space         집기
방향키         이동
Space         놓기
Esc           취소
```

---

### TC-INT-001 · 드래그앤드롭 → 상태 변경 → 롤백 (FR-005·FR-007, US-005·US-006)

| ID | 시나리오 | 기대 |
|----|----------|------|
| 001-N1 | Backlog 카드를 TODO로 이동 | 카드가 TODO에 나타나고 `/reorder` 호출 |
| 001-N2 | 이동 직후 화면 | API 응답 전에 이미 이동되어 보인다 (낙관적 업데이트) |
| 001-N3 | 같은 칼럼 내 순서 변경 | 순서가 바뀌고 `/reorder` 호출 |
| 001-N4 | Done 칼럼으로 이동 | **`/complete` 호출** (`/reorder` 아님) |
| 001-N5 | Done에서 In Progress로 이동 | **`/complete` 호출** (completedAt 초기화) |
| 001-N6 | 역방향 이동 | 허용된다 |
| 001-E1 | API가 500 반환 | 카드가 **원래 칼럼으로 롤백**된다 |
| 001-E2 | 롤백 시 | 사용자에게 에러가 안내된다 |
| 001-E3 | 드래그 중 `Esc` | 아무것도 변경되지 않는다 |

```typescript
describe('TC-INT-001: 드래그앤드롭 상태 변경', () => {
  it('카드를 TODO로 옮기면 화면에 즉시 반영되고 reorder가 호출된다', async () => {
    const reorder = mockApi.reorder.mockResolvedValue([]);
    renderApp({ BACKLOG: [ticket({ id: 1, title: 'PRD 초안' })], TODO: [] });

    await dragCardToColumn('PRD 초안', 'TODO');

    expect(within(columnOf('TODO')).getByText('PRD 초안')).toBeInTheDocument();
    expect(reorder).toHaveBeenCalledWith(1, 'TODO', expect.any(Number));
  });

  it('Done 칼럼으로 옮기면 reorder가 아니라 complete가 호출된다', async () => {
    renderApp({ IN_PROGRESS: [ticket({ id: 1, title: '보드 구현' })], DONE: [] });

    await dragCardToColumn('보드 구현', 'Done');

    expect(mockApi.complete).toHaveBeenCalledWith(1);
    expect(mockApi.reorder).not.toHaveBeenCalled();
  });

  it('API가 실패하면 카드가 원래 칼럼으로 돌아간다', async () => {
    mockApi.reorder.mockRejectedValue(new Error('500'));
    renderApp({ BACKLOG: [ticket({ id: 1, title: 'PRD 초안' })], TODO: [] });

    await dragCardToColumn('PRD 초안', 'TODO');

    await waitFor(() => {
      expect(within(columnOf('BACKLOG')).getByText('PRD 초안')).toBeInTheDocument();
    });
    expect(within(columnOf('TODO')).queryByText('PRD 초안')).not.toBeInTheDocument();
  });
});
```

---

### TC-INT-002 · 완료 처리 → 영구 삭제 (FR-005·FR-006, US-006·US-008)

완료와 삭제가 **다른 동작**임을 검증한다.

| ID | 시나리오 | 기대 |
|----|----------|------|
| 002-N1 | Done으로 이동 | Done 칼럼에 카드가 남아 있다 (사라지지 않음) |
| 002-N2 | 완료 후 카드 클릭 | 상세 모달이 정상적으로 열린다 |
| 002-N3 | 완료된 카드를 모달에서 삭제 | 확인 후 보드에서 사라진다 |
| 002-N4 | 삭제 후 | `DELETE` 호출, 어느 칼럼에도 없다 |
| 002-E1 | 완료만 하고 삭제 안 함 | `DELETE`가 호출되지 않는다 |
| 002-E2 | 삭제 확인창에서 취소 | 카드가 그대로 남는다 |

```typescript
it('완료는 삭제가 아니다 — Done으로 옮겨도 카드가 남는다', async () => {
  renderApp({ IN_PROGRESS: [ticket({ id: 1, title: '보드 구현' })], DONE: [] });

  await dragCardToColumn('보드 구현', 'Done');

  expect(within(columnOf('DONE')).getByText('보드 구현')).toBeInTheDocument();
  expect(mockApi.remove).not.toHaveBeenCalled();
});

it('완료된 카드를 삭제하면 보드에서 완전히 사라진다', async () => {
  renderApp({ DONE: [ticket({ id: 1, title: '보드 구현', status: 'DONE' })] });

  await userEvent.click(screen.getByRole('button', { name: /보드 구현/ }));
  await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
  await userEvent.click(screen.getByRole('button', { name: '확인' }));

  expect(mockApi.remove).toHaveBeenCalledWith(1);
  await waitFor(() => {
    expect(screen.queryByText('보드 구현')).not.toBeInTheDocument();
  });
});
```

---

## 6. 테스트 환경

### 6.1 공통 유틸

`__tests__/helpers/`에 둔다.

| 유틸 | 용도 |
|------|------|
| 유틸 | 용도 | 상태 |
|------|------|------|
| `resetDatabase()` | 각 테스트 전 `tickets` 테이블 초기화 | 구현됨 |
| `seedTicket(overrides)` | 테스트용 티켓 생성. 기본값 + 부분 덮어쓰기 | 구현됨 |
| `jsonRequest(body)` | Route Handler에 넘길 `Request` 생성 | 구현됨 |
| `daysAgo(n)` / `daysLater(n)` / `hoursAgo(n)` / `today()` | 날짜 헬퍼 | 구현됨 |
| `closePool()` | 커넥션 풀 종료 | 구현됨 |
| `ticket(overrides)` | 컴포넌트용 `Ticket` 객체 팩토리 (DB 미사용) | 컴포넌트 테스트 시 |
| `renderApp(board)` | 통합 테스트용 전체 앱 렌더링 | 통합 테스트 시 |
| `dragCardToColumn(title, column)` | 키보드 센서 기반 드래그 헬퍼 | 통합 테스트 시 |

### 6.2 테스트 DB

API·서비스 테스트는 **로컬 PostgreSQL**에 붙는다. 접속 정보는 `.env.test`에 둔다 (TRD 5.2).

```
POSTGRES_URL=postgresql://tika:<password>@localhost:5432/tika_test
```

- `resetDatabase()`가 매 테스트 전 `tickets` 테이블을 비우므로 **반드시 테스트 전용 DB여야 한다**
- 커넥션 풀은 `jest.teardown.ts`가 `afterAll`에서 닫는다. 닫지 않으면 Jest가 종료되지 않는다
- 실행 환경은 `jest.config.ts`가 `projects`로 분리한다 — `api`·`server`는 node, `client`·`integration`은 jsdom

### 6.3 날짜 고정

`isOverdue`와 24시간 필터는 현재 시각에 의존하므로, 시간에 민감한 테스트는 시각을 고정한다.

```typescript
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-02T12:00:00Z'));
});
afterEach(() => {
  jest.useRealTimers();
});
```

### 6.4 실행

```bash
npm test                    # 전체
npm test -- --watch         # 감시 모드 (TDD Red → Green)
npm test -- --coverage      # 커버리지
npm test TC-API-001         # 특정 케이스
```

### 6.5 커버리지 기준

| 대상 | 기준 |
|------|------|
| `src/server/services/` | 90% 이상 — 비즈니스 로직이 집중된 곳 |
| `app/api/` | 80% 이상 |
| `src/client/components/` | 70% 이상 |
| `src/shared/validations/` | 100% — 검증 규칙은 전부 검증한다 |

숫자보다 **1장 추적 매트릭스의 모든 FR이 테스트로 덮여 있는지**를 우선한다.

---

## 7. 참고 문서

| 문서 | 내용 |
|------|------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | FR/NFR, 사용자 스토리, 인수 조건 |
| [API_SPEC.md](./API_SPEC.md) | 엔드포인트별 요청/응답, 에러 메시지 |
| [COMPONENT_SPEC.md](./COMPONENT_SPEC.md) | 컴포넌트 Props 및 동작 |
| [DATA_MODEL.md](./DATA_MODEL.md) | 필드 정의, 비즈니스 규칙 |
| [TRD.md](./TRD.md) | 테스트 계층 구분, 개발 환경 |

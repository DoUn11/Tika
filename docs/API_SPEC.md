# Tika - API 명세 (API_SPEC.md)

> 기능 정의는 [REQUIREMENTS.md](./REQUIREMENTS.md)의 FR-001~008,
> 필드 정의는 [DATA_MODEL.md](./DATA_MODEL.md)를 기준으로 한다.
> 구현 시 본 문서의 명세를 정확히 따른다 (CLAUDE.md).

---

## 1. 공통 규칙

### 1.1 기본 정보

| 항목 | 값 |
|------|-----|
| Base URL (로컬) | `http://localhost:3000` |
| Base URL (배포) | `https://<vercel-domain>` |
| 리소스 경로 | `/api/tickets` |
| 요청 Content-Type | `application/json` |
| 응답 Content-Type | `application/json` (204는 본문 없음) |
| 인증 | **없음** (단일 사용자 MVP — PRD 3.1.1) |

### 1.2 명명 및 형식

| 항목 | 규칙 | 예시 |
|------|------|------|
| JSON 필드명 | `camelCase` | `plannedStartDate` |
| 날짜 (DATE) | `YYYY-MM-DD` | `"2026-09-05"` |
| 시각 (TIMESTAMP) | ISO 8601 | `"2026-09-02T10:14:00.000Z"` |
| 상태 | 대문자 상수 | `BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE` |
| 우선순위 | 대문자 상수 | `LOW`, `MEDIUM`, `HIGH` |

> DB 컬럼은 `snake_case`이지만 API는 `camelCase`로 노출한다 (DATA_MODEL 3.1).

### 1.3 엔드포인트 목록

| FR | Method | URL | 설명 | 성공 |
|----|--------|-----|------|------|
| FR-001 | `POST` | `/api/tickets` | 티켓 생성 | 201 |
| FR-002 | `GET` | `/api/tickets` | 보드 조회 (칼럼별 그룹화) | 200 |
| FR-003 | `GET` | `/api/tickets/:id` | 티켓 상세 조회 | 200 |
| FR-004 | `PATCH` | `/api/tickets/:id` | 티켓 수정 | 200 |
| FR-005 | `PATCH` | `/api/tickets/:id/complete` | 완료 처리 | 200 |
| FR-006 | `DELETE` | `/api/tickets/:id` | 티켓 삭제 | 204 |
| FR-007 | `PATCH` | `/api/tickets/reorder` | 상태·순서 변경 (드래그앤드롭) | 200 |
| FR-008 | — | — | 일정 초과 판정 (파생 필드, 전용 엔드포인트 없음) | — |

---

## 2. 공통 데이터 구조

### 2.1 Ticket 객체

모든 티켓 응답에 사용되는 형태다. DATA_MODEL 4.2의 `Ticket` 타입과 일치한다.

```json
{
  "id": 4,
  "title": "API 설계",
  "description": "FR-001~008 엔드포인트 정의",
  "status": "TODO",
  "priority": "HIGH",
  "position": 0,
  "plannedStartDate": "2026-09-02",
  "dueDate": "2026-09-03",
  "startedAt": "2026-09-02T09:10:00.000Z",
  "completedAt": null,
  "createdAt": "2026-09-01T13:05:00.000Z",
  "updatedAt": "2026-09-02T09:10:00.000Z",
  "isOverdue": false
}
```

| 필드 | 타입 | Nullable | 설명 |
|------|------|----------|------|
| `id` | number | X | 티켓 고유 식별자 |
| `title` | string | X | 제목 (1~200자) |
| `description` | string | O | 상세 설명 (최대 1000자) |
| `status` | string | X | `BACKLOG` \| `TODO` \| `IN_PROGRESS` \| `DONE` |
| `priority` | string | X | `LOW` \| `MEDIUM` \| `HIGH` |
| `position` | number | X | 칼럼 내 표시 순서 (작을수록 위) |
| `plannedStartDate` | string | O | 시작예정일 `YYYY-MM-DD` |
| `dueDate` | string | O | 종료예정일 `YYYY-MM-DD` |
| `startedAt` | string | O | 시작일. TODO 이동 시 자동 기록 |
| `completedAt` | string | O | 종료일. Done 이동 시 자동 기록 |
| `createdAt` | string | X | 생성 시각 |
| `updatedAt` | string | X | 수정 시각 |
| `isOverdue` | boolean | X | **파생 필드.** `dueDate < 오늘 AND status != DONE` (FR-008) |

> `isOverdue`는 DB에 저장하지 않고 조회 시 계산하여 응답에 포함한다.

### 2.2 BoardData 객체

`GET /api/tickets`의 응답 형태다.

```json
{
  "BACKLOG":     [ Ticket, ... ],
  "TODO":        [ Ticket, ... ],
  "IN_PROGRESS": [ Ticket, ... ],
  "DONE":        [ Ticket, ... ]
}
```

- 4개 키가 **항상 존재한다.** 해당 칼럼이 비어 있으면 빈 배열 `[]`이다
- 각 배열은 `position` **오름차순**으로 정렬된다
- `DONE` 배열에는 `completedAt` 기준 **24시간 이내** 티켓만 포함된다

### 2.3 에러 응답

모든 에러는 아래 형식으로 통일한다 (CLAUDE.md).

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "티켓을 찾을 수 없습니다"
  }
}
```

검증 실패(400)의 경우 필드별 상세를 `details`로 추가한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값이 올바르지 않습니다",
    "details": [
      { "field": "title",   "message": "제목을 입력해주세요" },
      { "field": "dueDate", "message": "종료예정일은 오늘 이후 날짜를 선택해주세요" }
    ]
  }
}
```

### 2.4 에러 코드

| code | HTTP | 발생 상황 |
|------|------|-----------|
| `VALIDATION_ERROR` | 400 | Zod 검증 실패 |
| `NOT_FOUND` | 404 | 존재하지 않는 티켓 ID |
| `INTERNAL_ERROR` | 500 | 예기치 못한 서버 오류 |

### 2.5 HTTP 상태 코드

| 코드 | 사용처 |
|------|--------|
| 200 OK | 조회·수정 성공 |
| 201 Created | 티켓 생성 성공 |
| 204 No Content | 티켓 삭제 성공 (본문 없음) |
| 400 Bad Request | 검증 실패 |
| 404 Not Found | 리소스 없음 |
| 500 Internal Server Error | 서버 오류 |

---

## 3. FR-001 · 티켓 생성

```
POST /api/tickets
```

새 티켓을 생성하여 Backlog 최상단에 추가한다.

### 3.1 요청 본문

| 필드 | 타입 | 필수 | 제약조건 | 기본값 |
|------|------|------|----------|--------|
| `title` | string | **O** | 1~200자, 공백만 불가 | - |
| `description` | string | X | 최대 1000자 | `null` |
| `priority` | string | X | `LOW` \| `MEDIUM` \| `HIGH` | `MEDIUM` |
| `plannedStartDate` | string | X | `YYYY-MM-DD` | `null` |
| `dueDate` | string | X | `YYYY-MM-DD`, 오늘 이후 | `null` |

**최소 요청**

```json
{ "title": "PRD 초안 작성" }
```

**전체 요청**

```json
{
  "title": "API 설계",
  "description": "FR-001~008 엔드포인트 정의",
  "priority": "HIGH",
  "plannedStartDate": "2026-09-02",
  "dueDate": "2026-09-05"
}
```

### 3.2 처리 규칙

- `status`는 항상 `BACKLOG`로 설정된다 (요청으로 지정할 수 없다)
- `position`은 Backlog 칼럼의 **최솟값 - 1024**로 설정된다. 칼럼이 비어 있으면 `0`
- `createdAt`, `updatedAt`이 자동 설정된다
- `startedAt`, `completedAt`은 `null`이다

### 3.3 응답

**201 Created**

```json
{
  "id": 9,
  "title": "API 설계",
  "description": "FR-001~008 엔드포인트 정의",
  "status": "BACKLOG",
  "priority": "HIGH",
  "position": -3072,
  "plannedStartDate": "2026-09-02",
  "dueDate": "2026-09-05",
  "startedAt": null,
  "completedAt": null,
  "createdAt": "2026-09-02T12:00:00.000Z",
  "updatedAt": "2026-09-02T12:00:00.000Z",
  "isOverdue": false
}
```

**400 Bad Request** — 검증 실패

| 조건 | message |
|------|---------|
| 제목 누락 | `제목을 입력해주세요` |
| 제목 공백만 입력 | `제목을 입력해주세요` |
| 제목 200자 초과 | `제목은 200자 이내로 입력해주세요` |
| 설명 1000자 초과 | `설명은 1000자 이내로 입력해주세요` |
| 잘못된 우선순위 값 | `우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요` |
| 과거 종료예정일 | `종료예정일은 오늘 이후 날짜를 선택해주세요` |
| 본문이 올바른 JSON이 아님 | `요청 본문이 올바른 JSON이 아닙니다` |

> 잘못된 JSON도 클라이언트 오류이므로 `code`는 `VALIDATION_ERROR`다.
> 400 응답에 `INTERNAL_ERROR`를 담으면 상태 코드와 어긋난다 (2.4).

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값이 올바르지 않습니다",
    "details": [
      { "field": "title", "message": "제목을 입력해주세요" }
    ]
  }
}
```

### 3.4 예시

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"API 설계","priority":"HIGH","dueDate":"2026-09-05"}'
```

---

## 4. FR-002 · 보드 조회

```
GET /api/tickets
```

칸반 보드에 표시할 전체 티켓을 칼럼별로 그룹화하여 반환한다.

### 4.1 요청

파라미터가 없다.

### 4.2 처리 규칙

- 4개 칼럼(`BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`)별로 그룹화한다
- 각 칼럼 내부는 `position` **오름차순** 정렬이다
- 각 티켓에 `isOverdue` 파생 필드를 포함한다 (FR-008)
- `DONE` 칼럼은 `completedAt` 기준 **24시간 이내** 티켓만 포함한다 (FR-005)

### 4.3 응답

**200 OK**

```json
{
  "BACKLOG": [
    {
      "id": 1, "title": "배포 파이프라인", "description": null,
      "status": "BACKLOG", "priority": "MEDIUM", "position": -2048,
      "plannedStartDate": null, "dueDate": null,
      "startedAt": null, "completedAt": null,
      "createdAt": "2026-09-01T10:00:00.000Z",
      "updatedAt": "2026-09-01T10:00:00.000Z",
      "isOverdue": false
    },
    {
      "id": 2, "title": "테스트 작성", "description": null,
      "status": "BACKLOG", "priority": "LOW", "position": -1024,
      "plannedStartDate": null, "dueDate": "2026-09-01",
      "startedAt": null, "completedAt": null,
      "createdAt": "2026-09-01T09:00:00.000Z",
      "updatedAt": "2026-09-01T09:00:00.000Z",
      "isOverdue": true
    }
  ],
  "TODO": [
    {
      "id": 4, "title": "API 설계", "description": "엔드포인트 정의",
      "status": "TODO", "priority": "HIGH", "position": 0,
      "plannedStartDate": "2026-09-02", "dueDate": "2026-09-03",
      "startedAt": "2026-09-02T09:10:00.000Z", "completedAt": null,
      "createdAt": "2026-09-01T13:05:00.000Z",
      "updatedAt": "2026-09-02T09:10:00.000Z",
      "isOverdue": false
    }
  ],
  "IN_PROGRESS": [],
  "DONE": [
    {
      "id": 7, "title": "스키마 정의", "description": null,
      "status": "DONE", "priority": "LOW", "position": 0,
      "plannedStartDate": null, "dueDate": "2026-09-02",
      "startedAt": "2026-09-01T14:00:00.000Z",
      "completedAt": "2026-09-02T11:20:00.000Z",
      "createdAt": "2026-08-31T10:00:00.000Z",
      "updatedAt": "2026-09-02T11:20:00.000Z",
      "isOverdue": false
    }
  ]
}
```

> `id: 2`는 `dueDate`가 지났고 `DONE`이 아니므로 `isOverdue: true`다.
> `id: 7`은 `dueDate`가 지났지만 `DONE`이므로 `isOverdue: false`다.

### 4.4 예시

```bash
curl http://localhost:3000/api/tickets
```

---

## 5. FR-003 · 티켓 상세 조회

```
GET /api/tickets/:id
```

특정 티켓의 전체 정보를 조회한다. 카드 클릭 시 상세 모달에서 사용한다.

### 5.1 요청

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `id` | path | number | 티켓 ID |

### 5.2 응답

**200 OK** — [2.1 Ticket 객체](#21-ticket-객체)

```json
{
  "id": 4,
  "title": "API 설계",
  "description": "FR-001~008 엔드포인트 정의",
  "status": "TODO",
  "priority": "HIGH",
  "position": 0,
  "plannedStartDate": "2026-09-02",
  "dueDate": "2026-09-03",
  "startedAt": "2026-09-02T09:10:00.000Z",
  "completedAt": null,
  "createdAt": "2026-09-01T13:05:00.000Z",
  "updatedAt": "2026-09-02T09:10:00.000Z",
  "isOverdue": false
}
```

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "티켓을 찾을 수 없습니다"
  }
}
```

> Done 칼럼에서 24시간이 지나 보드에 표시되지 않는 티켓도 이 엔드포인트로는 조회된다 (DATA_MODEL 6.5).

### 5.3 예시

```bash
curl http://localhost:3000/api/tickets/4
```

---

## 6. FR-004 · 티켓 수정

```
PATCH /api/tickets/:id
```

티켓의 제목, 설명, 우선순위, 시작예정일, 종료예정일을 수정한다.

### 6.1 요청

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `id` | path | number | 티켓 ID |

**본문** — 수정할 필드만 전송한다 (부분 수정).

| 필드 | 타입 | 제약조건 |
|------|------|----------|
| `title` | string | 1~200자 |
| `description` | string \| null | 최대 1000자. `null` 전송 시 삭제 |
| `priority` | string | `LOW` \| `MEDIUM` \| `HIGH` |
| `plannedStartDate` | string \| null | `YYYY-MM-DD`. `null` 전송 시 삭제 |
| `dueDate` | string \| null | `YYYY-MM-DD`, 오늘 이후. `null` 전송 시 삭제 |

**수정 불가 필드**: `id`, `status`, `position`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`
`status`와 `position`은 FR-007, `completedAt`은 FR-005에서 다룬다.

**일부 수정**

```json
{ "priority": "HIGH" }
```

**값 삭제**

```json
{ "description": null, "dueDate": null }
```

### 6.2 처리 규칙

- **전송된 필드만** 업데이트한다. 누락된 필드는 기존 값을 유지한다
- `null`을 명시적으로 전송하면 해당 값을 삭제한다 (필드 누락과 구분된다)
- `updatedAt`을 자동 갱신한다

### 6.3 응답

**200 OK** — 수정된 티켓 전체 데이터

```json
{
  "id": 4,
  "title": "API 설계",
  "description": null,
  "status": "TODO",
  "priority": "HIGH",
  "position": 0,
  "plannedStartDate": "2026-09-02",
  "dueDate": null,
  "startedAt": "2026-09-02T09:10:00.000Z",
  "completedAt": null,
  "createdAt": "2026-09-01T13:05:00.000Z",
  "updatedAt": "2026-09-02T14:30:00.000Z",
  "isOverdue": false
}
```

**400 Bad Request**

| 조건 | message |
|------|---------|
| 제목 200자 초과 | `제목은 200자 이내로 입력해주세요` |
| 설명 1000자 초과 | `설명은 1000자 이내로 입력해주세요` |
| 잘못된 우선순위 값 | `우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요` |
| 과거 종료예정일 | `종료예정일은 오늘 이후 날짜를 선택해주세요` |

**404 Not Found** — 존재하지 않는 ID

### 6.4 예시

```bash
curl -X PATCH http://localhost:3000/api/tickets/4 \
  -H "Content-Type: application/json" \
  -d '{"priority":"HIGH","dueDate":"2026-09-10"}'
```

---

## 7. FR-005 · 완료 처리

```
PATCH /api/tickets/:id/complete
```

티켓을 Done 칼럼으로 이동하여 완료 처리하고 종료일을 자동 설정한다.

> **Done으로의 이동은 FR-007(`/reorder`)이 아닌 이 엔드포인트를 사용한다.**
> `completedAt` 기록이 상태 변경과 함께 일어나야 하기 때문이다.
>
> **완료 해제는 반대로 `/reorder`가 담당한다** (9장). Done에서 빠져나오는 이동은
> 대상이 DONE이 아니므로 `/reorder`로 표현되며, 그때 `completedAt`이 초기화된다.
> 각 엔드포인트가 한 방향만 책임진다.

### 7.1 요청

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `id` | path | number | 티켓 ID |

**본문 없음.** 이 엔드포인트는 완료 처리 한 가지만 수행한다.

### 7.2 처리 규칙

| 필드 | 처리 |
|------|------|
| `status` | `DONE`으로 설정 |
| `completedAt` | 현재 시각 기록 |
| `startedAt` | **유지** — 착수 시각은 완료해도 바뀌지 않는다 |
| `updatedAt` | 자동 갱신 |

- 이미 `DONE`인 티켓을 다시 호출하면 `completedAt`이 현재 시각으로 갱신된다
- 완료 처리된 티켓은 `completedAt` 기준 24시간 동안만 Done 칼럼에 표시된다 (FR-002)

### 7.3 응답

**200 OK** — 업데이트된 티켓 데이터

```json
{
  "id": 6,
  "title": "보드 구현",
  "description": null,
  "status": "DONE",
  "priority": "HIGH",
  "position": 0,
  "plannedStartDate": "2026-09-02",
  "dueDate": "2026-09-06",
  "startedAt": "2026-09-02T10:00:00.000Z",
  "completedAt": "2026-09-02T16:45:00.000Z",
  "createdAt": "2026-09-01T11:00:00.000Z",
  "updatedAt": "2026-09-02T16:45:00.000Z",
  "isOverdue": false
}
```

**404 Not Found** — 존재하지 않는 ID

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "티켓을 찾을 수 없습니다"
  }
}
```

### 7.4 예시

```bash
# 완료 처리 — 본문 없음
curl -X PATCH http://localhost:3000/api/tickets/6/complete

# 완료 해제는 /reorder 를 쓴다 (9장)
curl -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":6,"status":"IN_PROGRESS","position":0}'
```

---

## 8. FR-006 · 티켓 삭제

```
DELETE /api/tickets/:id
```

티켓을 영구 삭제한다.

### 8.1 요청

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `id` | path | number | 티켓 ID |

### 8.2 처리 규칙

- **하드 삭제**다. soft delete를 사용하지 않는다 (MVP 기준)
- 삭제된 티켓은 복구할 수 없다. 프론트엔드에서 확인 다이얼로그를 거친다 (US-008)
- 같은 칼럼의 나머지 티켓 `position`은 재계산하지 않는다. 상대 순서가 유지되기 때문이다

### 8.3 응답

**204 No Content** — 본문 없음

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "티켓을 찾을 수 없습니다"
  }
}
```

### 8.4 예시

```bash
curl -X DELETE http://localhost:3000/api/tickets/4
```

---

## 9. FR-007 · 상태·순서 변경 (드래그앤드롭)

```
PATCH /api/tickets/reorder
```

티켓을 다른 칼럼으로 이동하거나 같은 칼럼 내에서 순서를 변경한다.

> **라우트 우선순위**: Next.js App Router는 정적 세그먼트를 동적 세그먼트보다 먼저 매칭하므로,
> `/api/tickets/reorder`가 `/api/tickets/[id]`로 잘못 해석되지 않는다 (TRD 1.4).

### 9.1 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ticketId` | number | **O** | 이동할 티켓 ID |
| `status` | string | **O** | 이동 대상 칼럼. `BACKLOG` \| `TODO` \| `IN_PROGRESS` |
| `position` | number | **O** | 칼럼 내 새 위치 |

```json
{
  "ticketId": 4,
  "status": "IN_PROGRESS",
  "position": 512
}
```

> **이동 대상으로 `DONE`은 허용하지 않는다.** Done으로의 이동은 FR-005(`PATCH /api/tickets/:id/complete`)를 사용한다.
> 다만 DONE에서 **빠져나오는** 이동은 대상이 DONE이 아니므로 이 API로 처리하며, 이때 `completedAt`이 초기화된다.

### 9.2 처리 규칙

- `status`와 `position`을 **하나의 트랜잭션**으로 동시 업데이트하여 원자성을 보장한다 (NFR-004)
- `updatedAt`을 자동 갱신한다

**position 재계산**

| 상황 | 계산식 |
|------|--------|
| 두 카드 사이 삽입 | `(prev + next) / 2` |
| 맨 앞 삽입 | `first.position - 1024` |
| 맨 뒤 삽입 | `last.position + 1024` |
| 간격이 1 미만 | 해당 칼럼 전체를 1024 간격으로 **재정렬** |

**날짜 필드 자동 처리**

| 이동 | `startedAt` | `completedAt` |
|------|------------|--------------|
| → TODO | `now()` (이미 값이 있으면 유지) | 유지 |
| TODO → BACKLOG | `null` | 유지 |
| **DONE → 다른 칼럼** | 유지 | **`null`** (완료 해제) |
| 그 외 | 유지 | 유지 |

> 완료 해제가 여기 있는 이유: 이동 대상이 DONE이 아니므로 `/reorder`의 관할이다.
> `/complete`는 완료 처리만 담당한다 (7장).

### 9.3 응답

**200 OK** — 업데이트된 티켓 목록

재정렬이 발생하면 해당 칼럼의 다른 티켓 `position`도 함께 변경되므로,
**영향을 받은 티켓 전체**를 배열로 반환한다.

```json
[
  {
    "id": 4, "title": "API 설계", "description": "엔드포인트 정의",
    "status": "IN_PROGRESS", "priority": "HIGH", "position": 512,
    "plannedStartDate": "2026-09-02", "dueDate": "2026-09-03",
    "startedAt": "2026-09-02T09:10:00.000Z", "completedAt": null,
    "createdAt": "2026-09-01T13:05:00.000Z",
    "updatedAt": "2026-09-02T15:00:00.000Z",
    "isOverdue": false
  }
]
```

**400 Bad Request**

| 조건 | message |
|------|---------|
| 잘못된 status (`DONE` 포함) | `상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요` |

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값이 올바르지 않습니다",
    "details": [
      { "field": "status", "message": "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" }
    ]
  }
}
```

**404 Not Found** — 존재하지 않는 `ticketId`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "티켓을 찾을 수 없습니다"
  }
}
```

### 9.4 클라이언트 연동 (낙관적 업데이트)

```
① UI 즉시 반영 + 이전 상태 스냅샷 보관
② PATCH /api/tickets/reorder 호출
③ 200 → 응답으로 상태 확정
   4xx/5xx → 스냅샷으로 롤백 + 에러 표시
```

### 9.5 예시

```bash
curl -X PATCH http://localhost:3000/api/tickets/reorder \
  -H "Content-Type: application/json" \
  -d '{"ticketId":4,"status":"IN_PROGRESS","position":512}'
```

---

## 10. FR-008 · 일정 초과 판정

**전용 엔드포인트가 없다.** 티켓을 반환하는 모든 응답의 `isOverdue` 필드로 제공된다.

### 10.1 판정 규칙

```
isOverdue = (dueDate != null) AND (dueDate < 오늘) AND (status != 'DONE')
```

| 조건 | 결과 |
|------|------|
| `dueDate`가 `null` | `false` |
| `dueDate`가 오늘 | `false` (당일은 초과가 아니다) |
| `dueDate`가 어제 이전, `status != DONE` | **`true`** |
| `dueDate`가 어제 이전, `status == DONE` | `false` |

### 10.2 특성

- DB에 저장하지 않는 **파생 필드**다. 조회 시 계산한다
- 날짜가 바뀌면 판정이 달라지므로 저장하면 즉시 낡은 값이 된다
- 서버가 계산해 응답에 포함하며, 프론트엔드도 동일 로직으로 재계산할 수 있다

---

## 11. 검증 규칙 요약

| 필드 | 규칙 | 에러 메시지 |
|------|------|------------|
| `title` | 필수, 1~200자, 공백만 불가 | `제목을 입력해주세요` / `제목은 200자 이내로 입력해주세요` |
| `description` | 최대 1000자 | `설명은 1000자 이내로 입력해주세요` |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` | `우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요` |
| `dueDate` | 오늘 이후 | `종료예정일은 오늘 이후 날짜를 선택해주세요` |
| `status` (reorder) | `BACKLOG` \| `TODO` \| `IN_PROGRESS` | `상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요` |
| `ticketId` | 존재하는 티켓 | `티켓을 찾을 수 없습니다` |

검증은 `src/shared/validations/ticketSchema.ts`의 Zod 스키마로 수행하며,
프론트엔드와 백엔드가 **동일한 스키마**를 사용한다 (NFR-004 이중 검증).

---

## 12. 상태 코드 매트릭스

| 엔드포인트 | 200 | 201 | 204 | 400 | 404 | 500 |
|-----------|-----|-----|-----|-----|-----|-----|
| `POST /api/tickets` | | ✓ | | ✓ | | ✓ |
| `GET /api/tickets` | ✓ | | | | | ✓ |
| `GET /api/tickets/:id` | ✓ | | | | ✓ | ✓ |
| `PATCH /api/tickets/:id` | ✓ | | | ✓ | ✓ | ✓ |
| `PATCH /api/tickets/:id/complete` | ✓ | | | | ✓ | ✓ |
| `DELETE /api/tickets/:id` | | | ✓ | | ✓ | ✓ |
| `PATCH /api/tickets/reorder` | ✓ | | | ✓ | ✓ | ✓ |

---

## 13. 확인 필요 사항

### 13.1 `/complete`의 요청 본문 — 해소됨

REQUIREMENTS.md FR-005가 요청 본문을 명시하지 않아 정리가 필요했다.
**엔드포인트별 책임 분리**로 확정했다.

| 방향 | 엔드포인트 | 근거 |
|------|-----------|------|
| 완료 (→ DONE) | `PATCH /:id/complete` (본문 없음) | `completedAt` 기록이 필요 |
| 완료 해제 (DONE →) | `PATCH /reorder` | 이동 **대상**이 DONE이 아니므로 reorder의 관할 |

FR-007의 제약은 "이동 대상이 DONE이면 안 된다"이지 "DONE인 티켓을 옮길 수 없다"가
아니다. 따라서 완료 해제는 원래부터 `/reorder`로 표현 가능하며, 이렇게 나누면
각 엔드포인트가 한 방향만 책임진다.

`/complete`는 본문이 필요 없어지고, 클라이언트의 분기도 단순해진다.

### 13.2 `reorder` 응답 범위

FR-007의 성공 응답은 "업데이트된 티켓 목록"이다. 재정렬(rebalancing)이 발생하면 칼럼 전체가 갱신되므로 본 문서는 **영향을 받은 티켓 배열**을 반환하는 것으로 정의했다(9.3).

칼럼 간 이동 시 두 칼럼이 모두 바뀌는 점을 고려하면, 응답을 `BoardData` 전체로 두는 편이 클라이언트 상태 동기화가 단순해진다. 어느 쪽을 택할지 구현 전에 확정하는 것이 좋다.

### 13.3 `position`을 클라이언트가 보내는 구조

FR-007의 입력에는 `position`이 포함되지만, 처리 규칙에는 서버의 재계산 로직이 함께 정의되어 있다. 본 문서는 **클라이언트가 목표 위치를 계산해 전송하고, 서버가 이를 저장하되 간격이 무너지면 재정렬**하는 것으로 해석했다.

클라이언트가 인접 카드 ID(`beforeId`/`afterId`)만 보내고 서버가 값을 전적으로 계산하는 방식이 경합에 더 안전하지만, 본 문서는 명세를 그대로 따랐다.

---

## 14. 참고 문서

| 문서 | 내용 |
|------|------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | FR/NFR 상세, 사용자 스토리 |
| [DATA_MODEL.md](./DATA_MODEL.md) | 테이블 정의, 컬럼 제약, 비즈니스 규칙 |
| [TRD.md](./TRD.md) | 아키텍처, 데이터 흐름, 계층 경계 |
| [PRD.md](./PRD.md) | 제품 요구사항, MVP 범위 |
| [TEST_CASES.md](./TEST_CASES.md) | 테스트 케이스 목록 |

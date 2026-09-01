# Tika - 데이터 모델 (DATA_MODEL.md)

> 기능 명세는 [REQUIREMENTS.md](./REQUIREMENTS.md), 기술 구조는 [TRD.md](./TRD.md)를 참조한다.
> 본 문서는 **데이터가 어떤 모양으로 저장되는가**를 다룬다.

---

## 1. 개요

### 1.1 엔티티 목록

MVP는 **단일 테이블** 구조다.

| 엔티티 | 테이블명 | 설명 |
|--------|----------|------|
| Ticket | `tickets` | 할 일 하나를 나타내는 티켓 |

인증·커스텀 칼럼·라벨·코멘트·파일 업로드는 2차 스펙이므로 관련 테이블을 만들지 않는다 (PRD 4장).
칼럼(상태)은 고정 4종이므로 별도 `columns` 테이블 없이 `status` 컬럼의 값으로 표현한다.

### 1.2 설계 원칙

| 원칙 | 내용 |
|------|------|
| 계획과 실적 분리 | 사용자가 입력하는 예정일(`planned_start_date`, `due_date`)과 시스템이 기록하는 실적일(`started_at`, `completed_at`)을 별도 컬럼으로 둔다 |
| 파생 값 비저장 | 일정 초과 여부는 컬럼으로 두지 않고 조회 시 계산한다 (FR-008) |
| 순서는 명시적 관리 | 칼럼 내 순서를 배열 인덱스가 아닌 `position` 정수 컬럼으로 관리한다 |
| enum 타입 미사용 | `status`·`priority`는 Postgres ENUM 대신 `VARCHAR` + `CHECK`로 정의한다. 값 추가 시 마이그레이션 부담이 적고, CLAUDE.md의 "enum 대신 const 객체 + typeof 패턴" 원칙과도 맞는다 |

---

## 2. tickets 테이블

### 2.1 컬럼 정의

| 컬럼 | 타입 | 제약 조건 | 기본값 | 설명 |
|------|------|-----------|--------|------|
| `id` | SERIAL | PK, auto-increment | - | 티켓 고유 식별자 |
| `title` | VARCHAR(200) | NOT NULL | - | 티켓 제목 |
| `description` | TEXT | NULLABLE | NULL | 티켓 상세 설명 |
| `status` | VARCHAR(20) | NOT NULL, CHECK | `'BACKLOG'` | 현재 상태(칼럼) |
| `priority` | VARCHAR(10) | NOT NULL, CHECK | `'MEDIUM'` | 우선순위 |
| `position` | INTEGER | NOT NULL | `1` | 칼럼 내 표시 순서 |
| `planned_start_date` | DATE | NULLABLE | NULL | 시작예정일 (사용자 입력) |
| `due_date` | DATE | NULLABLE | NULL | 종료예정일 (사용자 입력) |
| `started_at` | TIMESTAMP | NULLABLE | NULL | 시작일 (TODO 이동 시 자동) |
| `completed_at` | TIMESTAMP | NULLABLE | NULL | 종료일 (Done 이동 시 자동) |
| `created_at` | TIMESTAMP | NOT NULL | `now()` | 생성 시각 |
| `updated_at` | TIMESTAMP | NOT NULL | `now()` | 수정 시각 |

### 2.2 컬럼 상세

#### `id`
- `SERIAL`(= `INTEGER` + 시퀀스)로 자동 증가한다
- API 경로 파라미터(`/api/tickets/:id`)로 사용된다

#### `title`
- 필수 값이며 1~200자다
- **공백만 입력하는 것은 허용하지 않는다.** DB는 길이만 강제하므로, 공백 제거(`trim`) 후 빈 문자열 검사는 Zod 스키마가 담당한다

#### `description`
- 최대 1000자다. `TEXT` 타입이므로 DB 레벨 길이 제한은 없고 Zod가 검증한다
- 수정 시 `null`을 전송하면 삭제된다 (FR-004)

#### `status`
- 4개 값만 허용한다: `BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`
- 생성 시 항상 `BACKLOG`다 (FR-001)

#### `priority`
- 3개 값만 허용한다: `LOW`, `MEDIUM`, `HIGH`
- 미지정 시 `MEDIUM`이다

#### `position`
- 칼럼 **내부**의 정렬 순서다. 값이 작을수록 위에 표시된다
- 전역 유일하지 않다. 서로 다른 칼럼의 티켓이 같은 `position`을 가질 수 있다
- 음수를 가질 수 있다 (최상단 삽입이 반복되는 경우). 상세는 5장 참조

#### `planned_start_date` / `due_date`
- 시각이 아닌 **날짜**이므로 `DATE` 타입이다
- `due_date`는 생성·수정 시 오늘 이후여야 한다 (Zod 검증). 시간이 지나 과거가 되는 것은 정상이며, 이때 일정 초과로 판정된다
- `null` 전송 시 삭제된다

#### `started_at` / `completed_at`
- 사용자가 직접 입력하지 않는다. 칼럼 이동에 따라 시스템이 기록한다
- 정확한 시각이 필요하므로 `TIMESTAMP` 타입이다. 특히 `completed_at`은 Done 칼럼의 24시간 필터에 사용된다

> **타임존 주의**: `completed_at` 기준 "24시간 이내" 필터가 정확히 동작하려면 저장 시각의 기준이 일관돼야 한다.
> `TIMESTAMPTZ`(`timestamp with time zone`)를 사용하고 UTC로 저장한 뒤 표시 시점에 변환하는 것을 권장한다.

#### `created_at` / `updated_at`
- `created_at`은 생성 후 변경되지 않는다
- `updated_at`은 모든 수정(FR-004, FR-005, FR-007)에서 갱신한다. 서비스 계층에서 명시적으로 설정한다

### 2.3 제약 조건

| 종류 | 대상 | 내용 |
|------|------|------|
| PRIMARY KEY | `id` | 기본 키 |
| NOT NULL | `title`, `status`, `priority`, `position`, `created_at`, `updated_at` | 필수 값 |
| CHECK | `status` | `IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')` |
| CHECK | `priority` | `IN ('LOW', 'MEDIUM', 'HIGH')` |

**외래 키 없음**: 단일 테이블이므로 참조 관계가 존재하지 않는다.

**애플리케이션이 담당하는 검증** (DB 제약으로 표현하지 않는 것)

| 규칙 | 담당 |
|------|------|
| 제목 공백만 입력 불가 | Zod (`trim().min(1)`) |
| 설명 1000자 이내 | Zod |
| 종료예정일은 오늘 이후 | Zod (기준 시점이 변하므로 DB CHECK로 표현할 수 없다) |

### 2.4 DDL (참고)

실제 스키마는 Drizzle로 정의하고 `drizzle-kit`이 마이그레이션을 생성한다.
아래는 결과물의 형태를 이해하기 위한 참고용이다.

```sql
CREATE TABLE tickets (
  id                  SERIAL       PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  status              VARCHAR(20)  NOT NULL DEFAULT 'BACKLOG',
  priority            VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM',
  position            INTEGER      NOT NULL DEFAULT 1,
  planned_start_date  DATE,
  due_date            DATE,
  started_at          TIMESTAMP,
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT now(),

  CONSTRAINT tickets_status_check
    CHECK (status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT tickets_priority_check
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
);
```

### 2.5 인덱스

| 인덱스 | 컬럼 | 목적 |
|--------|------|------|
| `tickets_pkey` | `id` | PK 자동 생성. 상세 조회·수정·삭제 (FR-003, FR-004, FR-006) |
| `tickets_status_position_idx` | `(status, position)` | 보드 조회 시 칼럼별 그룹화 + 순서 정렬 (FR-002). `position` 재계산 시 인접 카드 조회에도 사용된다 |
| `tickets_completed_at_idx` | `completed_at` | Done 칼럼의 24시간 필터 (FR-005) |

```sql
CREATE INDEX tickets_status_position_idx ON tickets (status, position);
CREATE INDEX tickets_completed_at_idx    ON tickets (completed_at);
```

> `due_date` 인덱스는 두지 않는다. 일정 초과 판정은 전체 조회 후 애플리케이션에서 계산하며,
> 단일 사용자 규모에서 전체 행 수가 인덱스 이득을 낼 만큼 크지 않다.

---

## 3. Drizzle 스키마

`src/server/db/schema.ts`에 정의한다. 이 파일이 스키마의 **단일 기준**이다.

```typescript
import { pgTable, serial, varchar, text, integer, date, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('BACKLOG'),
    priority: varchar('priority', { length: 10 }).notNull().default('MEDIUM'),
    position: integer('position').notNull().default(1),
    plannedStartDate: date('planned_start_date'),
    dueDate: date('due_date'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('tickets_status_position_idx').on(table.status, table.position),
    index('tickets_completed_at_idx').on(table.completedAt),
    check('tickets_status_check', sql`${table.status} IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')`),
    check('tickets_priority_check', sql`${table.priority} IN ('LOW', 'MEDIUM', 'HIGH')`),
  ],
);

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
```

### 3.1 명명 규칙

| 계층 | 규칙 | 예시 |
|------|------|------|
| DB 컬럼 | `snake_case` | `planned_start_date` |
| TypeScript 필드 | `camelCase` | `plannedStartDate` |

Drizzle의 컬럼 정의에서 두 이름을 함께 선언하므로 매핑 코드를 따로 작성하지 않는다.

---

## 4. 공유 타입 및 상수

`src/shared/`에 정의하여 프론트엔드와 백엔드가 동일한 계약을 참조한다 (TRD 4.1).

### 4.1 상수 — `src/shared/constants/ticket.ts`

CLAUDE.md에 따라 `enum` 대신 const 객체 + `typeof` 패턴을 사용한다.

```typescript
export const TICKET_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TicketStatus = typeof TICKET_STATUS[keyof typeof TICKET_STATUS];

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type TicketPriority = typeof TICKET_PRIORITY[keyof typeof TICKET_PRIORITY];

/** 칼럼 표시 순서 (고정) */
export const COLUMN_ORDER = [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
] as const;

/** position 재계산 시 사용하는 기본 간격 */
export const POSITION_GAP = 1024;

/** Done 칼럼에 표시할 완료 티켓의 유효 시간 (시간 단위) */
export const DONE_VISIBLE_HOURS = 24;
```

### 4.2 도메인 타입 — `src/shared/types/ticket.ts`

```typescript
export type Ticket = {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  position: number;
  plannedStartDate: string | null;   // YYYY-MM-DD
  dueDate: string | null;            // YYYY-MM-DD
  startedAt: string | null;          // ISO 8601
  completedAt: string | null;        // ISO 8601
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;                // 파생 필드 — DB에 저장하지 않음
};

export type BoardData = Record<TicketStatus, Ticket[]>;
```

`isOverdue`는 DB 컬럼이 아니라 조회 시 계산해 응답에 포함하는 값이다 (6장).

---

## 5. position 관리

### 5.1 기본 개념

`position`은 **칼럼 내부의 상대 순서**만 나타낸다. 값 자체에 의미는 없고 대소 관계만 의미가 있다.
카드 사이에 삽입할 때 뒤따르는 카드를 전부 갱신하지 않기 위해, 값 사이에 **`POSITION_GAP`(1024)만큼 간격**을 둔다.

```
칼럼 내부:   [ -2048 ]  [ -1024 ]  [ 0 ]  [ 1024 ]
              맨 위                          맨 아래
```

### 5.2 신규 생성 시 (FR-001)

새 티켓은 **Backlog 최상단**에 놓인다.

| 상황 | `position` |
|------|-----------|
| Backlog가 비어 있음 | `0` |
| Backlog에 티켓이 있음 | `해당 칼럼의 최솟값 - 1024` |

```
빈 보드에 3개를 연속 생성한 결과

생성 #1 → position    0        [최신] 티켓 #3  (-2048)
생성 #2 → position -1024              티켓 #2  (-1024)
생성 #3 → position -2048              티켓 #1  (    0)
```

> DDL의 `DEFAULT 1`은 `position`을 명시하지 않고 INSERT하는 경우를 위한 **DB 레벨 최후 기본값**이다.
> 서비스 계층(`ticketService.createTicket`)은 위 규칙으로 계산한 값을 **항상 명시적으로 전달**하므로,
> 정상 흐름에서 기본값 `1`이 사용되지는 않는다. (9.1의 확인 필요 항목 참조)

### 5.3 드래그앤드롭 재계산 (FR-007)

| 상황 | 계산식 |
|------|--------|
| 두 카드 사이 삽입 | `(prev.position + next.position) / 2` |
| 맨 앞 삽입 | `first.position - 1024` |
| 맨 뒤 삽입 | `last.position + 1024` |
| 빈 칼럼으로 이동 | `0` |

`position`이 `INTEGER`이므로 나눗셈 결과는 **정수로 내림**한다.

### 5.4 재정렬 (Rebalancing)

이분 삽입을 반복하면 간격이 좁아진다. 간격 1024는 약 10회 연속 삽입까지 버틴다.

```
1024 → 512 → 256 → 128 → 64 → 32 → 16 → 8 → 4 → 2 → 1 → 0 (삽입 불가)
```

**간격이 1 미만이 되면** 해당 칼럼 전체를 1024 간격으로 다시 매긴다.

```
재정렬 전:  [0]  [1]  [2]  [1024]
재정렬 후:  [0]  [1024]  [2048]  [3072]
```

재정렬은 해당 칼럼의 행만 갱신하며, 상태 변경과 **동일한 트랜잭션** 안에서 수행한다 (NFR-004).

---

## 6. 비즈니스 규칙

### 6.1 규칙 목록

| # | 규칙 | 적용 시점 | 관련 FR |
|---|------|-----------|---------|
| BR-01 | 신규 생성 시 `status = 'BACKLOG'`, `position`은 Backlog 최상단 값 | 티켓 생성 | FR-001 |
| BR-02 | TODO로 이동 시 `started_at = now()`. **최초 1회만 기록하며, 이미 값이 있으면 유지한다** | 칼럼 이동 | FR-007 |
| BR-03 | TODO에서 BACKLOG로 되돌리면 `started_at = NULL` | 칼럼 이동 | FR-007 |
| BR-04 | Done으로 이동 시 `completed_at = now()`, `status = 'DONE'` | 완료 처리 | FR-005 |
| BR-05 | Done에서 다른 칼럼으로 복귀 시 `completed_at = NULL` | 칼럼 이동 | FR-005 |
| BR-06 | 일정 초과 판정: `due_date < 오늘 AND status != 'DONE'` | 조회 시 계산 | FR-008 |
| BR-07 | 칼럼 내 순서 변경 시 해당 칼럼의 `position` 재계산 | 드래그앤드롭 | FR-007 |
| BR-08 | Done 칼럼에는 `completed_at` 기준 24시간 이내 티켓만 표시 | 보드 조회 | FR-005 |
| BR-09 | 모든 수정에서 `updated_at` 갱신 | 생성 외 모든 쓰기 | FR-004~007 |

### 6.2 BR-02 상세 — `started_at`은 최초 1회만

`started_at`은 "이 일에 처음 착수한 시각"을 의미하므로, 칼럼을 오갈 때마다 덮어쓰지 않는다.

```
BACKLOG → TODO            started_at = 2026-09-02 10:00   ← 최초 기록
TODO    → IN_PROGRESS     started_at = 2026-09-02 10:00   ← 유지
IN_PROGRESS → TODO        started_at = 2026-09-02 10:00   ← 유지 (덮어쓰지 않음)
TODO    → BACKLOG         started_at = NULL               ← BR-03으로 초기화
BACKLOG → TODO            started_at = 2026-09-02 15:00   ← 초기화됐으므로 다시 기록
```

`started_at`을 초기화하는 경로는 **BR-03(TODO → BACKLOG)뿐이다.**
초기화된 뒤 다시 TODO로 진입하면 그 시점이 새로운 착수 시각이 된다.

### 6.3 상태 전이와 날짜 필드

| 이동 | `started_at` | `completed_at` | 사용 API |
|------|-------------|---------------|----------|
| BACKLOG → TODO | `now()` (없을 때만) | - | `PATCH /api/tickets/reorder` |
| TODO → IN_PROGRESS | 유지 | - | `PATCH /api/tickets/reorder` |
| IN_PROGRESS → TODO | 유지 | - | `PATCH /api/tickets/reorder` |
| TODO → BACKLOG | `NULL` | - | `PATCH /api/tickets/reorder` |
| 임의 칼럼 → DONE | 유지 | `now()` | `PATCH /api/tickets/:id/complete` |
| DONE → 임의 칼럼 | 유지 | `NULL` | `PATCH /api/tickets/:id/complete` |
| 같은 칼럼 내 순서 변경 | 유지 | 유지 | `PATCH /api/tickets/reorder` |

> Done으로의 이동은 `reorder`가 아닌 `/complete` 엔드포인트를 사용한다 (FR-007 단서 조항).
> `reorder`가 허용하는 `status`는 `BACKLOG`, `TODO`, `IN_PROGRESS` 세 가지다.

### 6.4 파생 필드 — `isOverdue` (BR-06)

DB에 저장하지 않고 조회 시 계산한다.

```typescript
const isOverdue =
  ticket.dueDate !== null &&
  ticket.status !== TICKET_STATUS.DONE &&
  new Date(ticket.dueDate) < startOfToday();
```

| 판정 요소 | 내용 |
|-----------|------|
| 비교 기준 | **날짜** 단위. 오늘이 종료예정일이면 초과가 아니다 |
| 제외 대상 | `status = 'DONE'`인 티켓, `due_date`가 `NULL`인 티켓 |
| 저장 여부 | 저장하지 않는다. 날짜가 바뀌면 판정이 달라지므로 저장하면 즉시 낡은 값이 된다 |
| 계산 위치 | 서버(`getBoard()`)에서 계산해 응답에 포함한다. 프론트엔드도 동일 로직으로 재계산할 수 있다 |

### 6.5 Done 칼럼 24시간 필터 (BR-08)

```sql
-- 개념적 조건 (실제 구현은 Drizzle로 작성)
status = 'DONE' AND completed_at >= now() - INTERVAL '24 hours'
```

24시간이 지난 완료 티켓은 **삭제되지 않는다.** 보드에서 보이지 않을 뿐 DB에는 그대로 남아 있다.
`GET /api/tickets/:id`로는 계속 조회할 수 있다.

---

## 7. 샘플 데이터

```
 id │ title           │ status      │ priority │ position │ due_date   │ started_at       │ completed_at     │ isOverdue
────┼─────────────────┼─────────────┼──────────┼──────────┼────────────┼──────────────────┼──────────────────┼──────────
  1 │ 배포 파이프라인 │ BACKLOG     │ MEDIUM   │    -2048 │ NULL       │ NULL             │ NULL             │ false
  2 │ 테스트 작성     │ BACKLOG     │ LOW      │    -1024 │ 2026-09-01 │ NULL             │ NULL             │ true   ← 초과
  3 │ PRD 초안        │ BACKLOG     │ MEDIUM   │        0 │ 2026-09-05 │ NULL             │ NULL             │ false
  4 │ API 설계        │ TODO        │ HIGH     │        0 │ 2026-09-03 │ 2026-09-02 09:10 │ NULL             │ false
  5 │ 모달 UI         │ TODO        │ MEDIUM   │     1024 │ 2026-09-04 │ 2026-09-02 09:30 │ NULL             │ false
  6 │ 보드 구현       │ IN_PROGRESS │ HIGH     │        0 │ 2026-09-06 │ 2026-09-02 10:00 │ NULL             │ false
  7 │ 스키마 정의     │ DONE        │ LOW      │        0 │ 2026-09-02 │ 2026-09-01 14:00 │ 2026-09-02 11:20 │ false
  8 │ 초기 설정       │ DONE        │ MEDIUM   │     1024 │ NULL       │ 2026-08-30 09:00 │ 2026-08-31 17:00 │ false  ← 24h 경과, 보드 미표시
```

읽는 방법:
- **#2**: 종료예정일이 지났고 `DONE`이 아니므로 `isOverdue = true` (BR-06)
- **#3**: 가장 먼저 만든 티켓이라 `position = 0`. 이후 생성분이 위로 쌓였다 (BR-01)
- **#7**: `DONE`이므로 `due_date`가 지났어도 `isOverdue = false`
- **#8**: `completed_at`이 24시간을 넘어 Done 칼럼에 표시되지 않는다. 데이터는 남아 있다 (BR-08)

---

## 8. 명세 정합성

| 항목 | 근거 | 확인 |
|------|------|------|
| 상태 4종 / 우선순위 3종 | REQUIREMENTS 5·6장 | ✓ |
| 날짜 4필드 (예정 2 + 실적 2) | PRD 3.1.5 | ✓ |
| `title` 200자 / `description` 1000자 | FR-001, FR-004 | ✓ |
| 생성 시 `status = BACKLOG` | FR-001 | ✓ |
| `position` 1024 간격, 이분 삽입, 재정렬 | FR-007, NFR-004 | ✓ |
| `started_at` / `completed_at` 자동 기록·초기화 | FR-005, FR-007 | ✓ |
| `isOverdue` 파생 (비저장) | FR-008 | ✓ |
| Done 24시간 필터 | FR-005 | ✓ |
| Drizzle 전용, raw SQL 없음 | CLAUDE.md | ✓ |
| const 객체 + typeof (enum 미사용) | CLAUDE.md | ✓ |

---

## 9. 확인 필요 사항

문서화 과정에서 기존 명세와 대조했을 때 정리가 필요한 지점이다.

### 9.1 `position` 기본값 `1` vs FR-001의 계산 규칙

- 주신 컬럼 정의: `position`의 기본값은 `1`이며 "정렬 1번"을 의미한다
- REQUIREMENTS.md FR-001: 생성 시 `position = 해당 칼럼의 최솟값 - 1024`이며, 칼럼이 비어 있으면 `0`이다

두 규칙은 서로 다른 값을 만든다. 본 문서는 **DDL 기본값은 `1`로 두되, 서비스가 FR-001의 규칙으로 계산한 값을 항상 명시적으로 넣는 것**으로 정리했다(5.2). 즉 기본값 `1`은 실제로 사용되지 않는 안전장치다.

`position`을 매번 `1`로 두면 같은 칼럼의 모든 티켓이 동일한 값을 갖게 되어 순서를 정할 수 없으므로, FR-001 규칙을 실제 동작으로 채택했다. 의도가 다르다면 알려주기 바란다.

### 9.2 TODO를 거치지 않고 IN_PROGRESS로 이동하는 경우

REQUIREMENTS.md는 칼럼 간 이동에 제약이 없다고 명시하지만(5장), `started_at` 기록 규칙은 **TODO 진입 시점만** 정의한다.
따라서 `BACKLOG → IN_PROGRESS`로 바로 이동하면 진행 중인데도 `started_at`이 `NULL`로 남는다.

선택지는 두 가지다.
1. 현행 유지 — TODO 진입 시에만 기록한다
2. `TODO` 또는 `IN_PROGRESS` 진입 시 기록한다 (`started_at`이 비어 있을 때만)

본 문서는 명세를 그대로 따라 **1번**으로 작성했다.

### 9.3 `DONE → BACKLOG` 복귀 시 `started_at`

BR-03은 초기화 조건을 "TODO에서 BACKLOG로 이동"으로 한정한다.
`DONE → BACKLOG`는 이 조건에 해당하지 않으므로 `started_at`이 유지되며, Backlog에 있는 티켓이 착수 시각을 갖게 된다.
6.3 표에는 명세대로 "유지"로 기록했다.

---

## 10. 참고 문서

| 문서 | 내용 |
|------|------|
| [PRD.md](./PRD.md) | 제품 요구사항, MVP 범위 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | FR/NFR 상세, 사용자 스토리 |
| [TRD.md](./TRD.md) | 아키텍처, 기술 선정, 계층 경계 |
| [API_SPEC.md](./API_SPEC.md) | 엔드포인트별 요청/응답 스키마 |
| [TEST_CASES.md](./TEST_CASES.md) | 테스트 케이스 목록 |

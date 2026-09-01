# Tika - 기술 요구사항 명세 (TRD.md)

> 제품 요구사항은 [PRD.md](./PRD.md), 기능 상세는 [REQUIREMENTS.md](./REQUIREMENTS.md)를 참조한다.
> 본 문서는 **어떻게 만들 것인가**를 다룬다.

---

## 1. 시스템 아키텍처

### 1.1 전체 구조

**Vercel 단일 배포**를 채택한다.
Next.js 애플리케이션 하나에 프론트엔드와 백엔드(Route Handlers)를 함께 담고, Vercel Postgres를 연결한다.

```
┌─────────────────────────────────────────────────────────┐
│                        Vercel                            │
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │           Next.js 15 (App Router)               │    │
│   │                                                 │    │
│   │   ┌──────────────┐      ┌──────────────────┐   │    │
│   │   │   Frontend   │      │  API Routes      │   │    │
│   │   │  (React 19)  │─────▶│ (Route Handlers) │   │    │
│   │   │  Edge/CDN    │ HTTP │  Serverless Fn   │   │    │
│   │   └──────────────┘      └────────┬─────────┘   │    │
│   └───────────────────────────────────┼────────────┘    │
│                                       │                  │
│                              ┌────────▼─────────┐        │
│                              │ Vercel Postgres  │        │
│                              │  (Neon 기반)      │        │
│                              └──────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**단일 배포를 선택한 이유**

| 항목 | 근거 |
|------|------|
| 단일 사용자 MVP | 별도 백엔드 서버를 운영할 트래픽·복잡도가 아니다 (PRD 3.1.1) |
| 타입 공유 | 프론트·백엔드가 같은 저장소에 있어 `src/shared/`의 타입과 Zod 스키마를 그대로 공유한다 |
| 배포 단순화 | git push 한 번으로 프론트·백엔드·DB 연결이 함께 배포된다 (NFR-006) |
| CORS 불필요 | 동일 오리진이므로 인증·CORS 설정이 없다 |

> **디렉터리 분리는 유지한다.** 단일 배포이지만 `app/api/`·`src/server/`와 `src/client/`는
> 디렉터리 수준에서 분리하여, 이후 백엔드를 별도 서비스로 떼어낼 수 있는 구조를 유지한다.

### 1.2 아키텍처 다이어그램 (요청 흐름)

```
 ┌──────────────────────────────────────────────────────────────┐
 │  src/client/                                                 │
 │                                                              │
 │   components/          hooks/            api/                │
 │   ┌──────────┐       ┌────────────┐    ┌──────────────┐     │
 │   │ Board    │──────▶│ useTickets │───▶│ ticketApi.ts │     │
 │   │ Card     │       │            │    │              │     │
 │   └──────────┘       └────────────┘    └──────┬───────┘     │
 └───────────────────────────────────────────────┼─────────────┘
                                                 │ fetch (HTTP)
                                                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  app/api/tickets/                            ① Route Handler │
 │                                                              │
 │   route.ts / [id]/route.ts / reorder/route.ts                │
 │   ─────────────────────────────────────────                  │
 │   요청 파싱 → Zod 검증 → 서비스 호출 → 응답 반환             │
 │   (비즈니스 로직 없음)                                        │
 └───────────────────────────────┬──────────────────────────────┘
                                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  src/server/services/                        ② Service       │
 │                                                              │
 │   ticketService.ts                                           │
 │   ─────────────────                                          │
 │   비즈니스 로직: position 재계산, startedAt/completedAt 설정, │
 │                  isOverdue 파생, 트랜잭션 경계                │
 └───────────────────────────────┬──────────────────────────────┘
                                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  src/server/db/                              ③ Drizzle ORM   │
 │                                                              │
 │   schema.ts (테이블 정의) / index.ts (커넥션)                 │
 │   ─────────────────────────────────────────                  │
 │   타입 안전 쿼리 빌더 → SQL 생성                              │
 └───────────────────────────────┬──────────────────────────────┘
                                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  Vercel Postgres (Neon)                      ④ Database      │
 │   tickets 테이블                                              │
 └──────────────────────────────────────────────────────────────┘

        ▲                                                   ▲
        └───────────── src/shared/ (타입 · Zod 스키마 · 상수) ┘
                       양쪽 계층이 동일한 계약을 참조한다
```

### 1.3 계층별 책임

| 계층 | 위치 | 책임 | 금지 사항 |
|------|------|------|-----------|
| Presentation | `src/client/components/` | 렌더링, 사용자 입력 수집 | 직접 `fetch` 호출, DB 접근 |
| Client State | `src/client/hooks/` | 보드 상태, 낙관적 업데이트, 롤백 | 비즈니스 규칙 판단 |
| API Client | `src/client/api/ticketApi.ts` | HTTP 호출, 응답 역직렬화 | 비즈니스 로직 |
| Route Handler | `app/api/` | 요청 파싱, Zod 검증, 상태 코드 결정 | 비즈니스 로직, 직접 DB 쿼리 |
| Service | `src/server/services/` | 비즈니스 로직, 트랜잭션 경계 | HTTP 객체(`Request`/`Response`) 의존 |
| Data Access | `src/server/db/` | 스키마 정의, 커넥션, 쿼리 실행 | 비즈니스 규칙 |
| Shared | `src/shared/` | 타입, Zod 스키마, 상수 | 런타임 의존성(React, DB 클라이언트) |

### 1.4 디렉터리 구조

```
tika/
├── app/                              # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                      # 보드 페이지 (src/client 컴포넌트 조립)
│   └── api/                          # ① 백엔드 진입점
│       └── tickets/
│           ├── route.ts              # GET(FR-002) / POST(FR-001)
│           ├── reorder/
│           │   └── route.ts          # PATCH(FR-007)
│           └── [id]/
│               ├── route.ts          # GET(FR-003) / PATCH(FR-004) / DELETE(FR-006)
│               └── complete/
│                   └── route.ts      # PATCH(FR-005)
│
├── src/
│   ├── server/                       # ② 백엔드 로직 — React import 금지
│   │   ├── services/
│   │   │   └── ticketService.ts      # 비즈니스 로직
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle 커넥션
│   │   │   └── schema.ts             # 테이블 정의
│   │   └── middleware/
│   │       └── errorHandler.ts       # 에러 → { error: { code, message } } 변환
│   │
│   ├── client/                       # ③ 프론트엔드 로직 — DB 접근 금지
│   │   ├── components/
│   │   │   ├── Board.tsx
│   │   │   ├── Column.tsx
│   │   │   ├── TicketCard.tsx
│   │   │   ├── TicketModal.tsx
│   │   │   └── TicketForm.tsx
│   │   ├── hooks/
│   │   │   └── useTickets.ts     # 보드 상태 + CRUD + move (분기)
│   │   └── api/
│   │       └── ticketApi.ts          # 유일한 HTTP 호출 지점
│   │
│   └── shared/                       # ④ 양쪽에서 참조 가능
│       ├── types/
│       │   └── ticket.ts             # Ticket, BoardData, TicketStatus
│       ├── validations/
│       │   └── ticketSchema.ts       # Zod 스키마
│       └── constants/
│           └── ticket.ts             # TICKET_STATUS, TICKET_PRIORITY
│
├── __tests__/                        # Jest + RTL
├── drizzle/                          # 마이그레이션 산출물
├── drizzle.config.ts
├── .env.local                        # vercel env pull 결과 (git 제외)
└── docs/
```

> **라우트 우선순위 주의**: Next.js App Router는 정적 세그먼트를 동적 세그먼트보다 먼저 매칭한다.
> 따라서 `app/api/tickets/reorder/route.ts`가 `app/api/tickets/[id]/route.ts`보다 우선 해석되어,
> `PATCH /api/tickets/reorder`가 `id = "reorder"`로 잘못 처리되지 않는다.

---

## 2. 기술 스택 상세

### 2.1 버전 요약

| 구분 | 기술 | 목표 버전 |
|------|------|-----------|
| Framework | Next.js (App Router) | 15.x |
| Runtime | Node.js (Vercel Serverless Functions) | 20.x LTS |
| Language | TypeScript (strict) | 5.x |
| UI | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable | 6.x / 8.x |
| ORM | Drizzle ORM (+ drizzle-kit) | 0.3x |
| DB | Vercel Postgres (Neon) | PostgreSQL 15+ |
| Validation | Zod | 3.x |
| Test | Jest, React Testing Library | 29.x / 16.x |
| Lint / Format | ESLint, Prettier | 9.x / 3.x |

> 정확한 버전은 `package.json`을 단일 기준으로 삼는다. 위 표는 도입 시 목표 라인이다.

### 2.2 Framework — Next.js 15 (App Router)

**선정 이유**
- 프론트엔드와 Route Handlers를 한 프로젝트에서 운영하여 별도 백엔드 서버가 필요 없다
- Vercel 배포와 네이티브로 통합되며, 파일 시스템 기반 라우팅이 `app/api/` 구조와 그대로 대응한다
- App Router의 Route Handler는 Web 표준 `Request`/`Response`를 사용하여 테스트 시 목킹이 단순하다

**대안 비교**

| 대안 | 장점 | 채택하지 않은 이유 |
|------|------|-------------------|
| **Next.js Pages Router** | 자료가 많고 안정적 | 레이아웃 중첩·서버 컴포넌트 등 신규 기능 미지원. 신규 프로젝트에서 굳이 선택할 이유가 없다 |
| **React(Vite) + Express 분리** | 프론트·백엔드 완전 독립 | 배포 대상이 2개가 되고 CORS·타입 공유 설정이 추가된다. 단일 사용자 MVP에 과하다 |
| **Remix** | 폼 중심 데이터 흐름이 우수 | Vercel Postgres·Drizzle 조합의 레퍼런스가 Next.js 대비 적다 |

### 2.3 Runtime — Node.js (Vercel Serverless Functions)

**선정 이유**
- Route Handler는 **Node.js 런타임**으로 실행한다. Edge 런타임이 아니다
- Drizzle의 Postgres 드라이버가 Node.js API(TCP 소켓 등)에 의존하므로 Edge 런타임에서는 제약이 있다
- 트랜잭션(FR-007의 position 재계산)을 사용하려면 Node.js 런타임이 필요하다

```typescript
// app/api/tickets/route.ts
export const runtime = 'nodejs'; // 명시적으로 선언
```

**대안 비교**

| 대안 | 채택하지 않은 이유 |
|------|-------------------|
| **Edge Runtime** | 콜드 스타트는 빠르나 Node API 사용이 제한되고 트랜잭션 지원이 까다롭다. NFR-001(300ms)은 Node 런타임으로 충족 가능하다 |
| **장기 실행 서버(Fly.io 등)** | 커넥션 풀을 직접 관리해야 하고 인프라 운영 부담이 생긴다 |

### 2.4 ORM — Drizzle ORM

**선정 이유**
- **코드 생성 단계가 없다.** 스키마를 TypeScript로 정의하면 타입이 곧바로 추론된다
- Vercel Postgres를 공식 지원한다 (`drizzle-orm/vercel-postgres`)
- 번들 크기가 작아 서버리스 콜드 스타트에 유리하다
- SQL에 가까운 API로 `position` 재계산 같은 쿼리를 의도대로 표현할 수 있다

**Drizzle vs Prisma 비교**

| 항목 | Drizzle ORM | Prisma |
|------|-------------|--------|
| 스키마 정의 | TypeScript 파일 | 별도 DSL(`schema.prisma`) |
| 타입 생성 | **불필요** (스키마에서 직접 추론) | `prisma generate` 필요. 스키마 변경 시마다 재실행 |
| 런타임 구성 | 순수 JS 쿼리 빌더 | Query Engine 바이너리 동봉 |
| 번들 크기 | 작음 | 상대적으로 큼 → 서버리스 콜드 스타트에 불리 |
| 쿼리 스타일 | SQL 유사 (`select().from().where()`) | 추상화된 객체 API (`findMany`) |
| 마이그레이션 | drizzle-kit (SQL 파일 생성) | Prisma Migrate (성숙도 높음) |
| 학습 곡선 | SQL을 알면 낮음 | 자체 DSL 학습 필요 |

**결론**: 서버리스 환경의 **콜드 스타트**와 CLAUDE.md의 **"타입은 `src/shared/`에서 공유"** 원칙을 고려할 때,
코드 생성 단계 없이 TypeScript 타입이 곧 스키마인 Drizzle이 적합하다.
Prisma의 성숙한 마이그레이션은 장점이지만, 테이블 1개 규모의 MVP에서는 결정 요인이 되지 못한다.

| 기타 대안 | 채택하지 않은 이유 |
|-----------|-------------------|
| **TypeORM** | 데코레이터·`experimentalDecorators` 의존. 타입 추론이 Drizzle보다 약하다 |
| **Raw SQL (pg)** | 타입 안전성이 없다. CLAUDE.md가 raw SQL을 금지한다 |
| **Kysely** | 타입 안전성은 유사하나 Vercel Postgres 공식 통합과 마이그레이션 도구가 Drizzle만큼 정비되어 있지 않다 |

### 2.5 Database — Vercel Postgres (Neon 기반)

**선정 이유**
- **서버리스 커넥션 풀을 자동 관리한다.** Vercel Function이 요청마다 생성/소멸되어도 커넥션이 고갈되지 않는다
- Vercel 프로젝트에 연결하면 환경 변수(`POSTGRES_URL` 등)가 자동 주입된다
- 관계형 DB이므로 `position` 기반 정렬, 트랜잭션, 인덱스를 그대로 활용한다

**서버리스 커넥션 문제와 해결**

```
일반 Postgres:  Function 100개 동시 실행 → 커넥션 100개 요청 → 상한 초과 → 실패
Neon:           Function → Connection Pooler(PgBouncer) → 소수의 물리 커넥션 재사용
```

**대안 비교**

| 대안 | 채택하지 않은 이유 |
|------|-------------------|
| **Supabase** | Postgres + 인증/스토리지/실시간을 함께 제공하나, MVP는 인증·파일 업로드를 제외한다(PRD 4장). 사용하지 않을 기능이 대부분이다 |
| **PlanetScale (MySQL)** | 외래 키 제약 사용에 제한이 있고 Vercel 통합 수준이 Vercel Postgres보다 낮다 |
| **SQLite / Turso** | 로컬 개발은 편하나 Vercel 서버리스 환경에서 쓰기 일관성 관리가 복잡하다 |
| **MongoDB** | `position` 정렬·트랜잭션 요구에 관계형이 더 적합하다 |

### 2.6 Validation — Zod

**선정 이유**
- 하나의 스키마를 `src/shared/validations/`에 두고 **프론트엔드 폼 검증과 백엔드 요청 검증에 함께 사용**한다 (NFR-004 이중 검증)
- `z.infer<>`로 스키마에서 타입을 추론하여 타입과 검증 규칙이 분리되지 않는다
- REQUIREMENTS.md에 정의된 한글 에러 메시지를 스키마에 직접 선언할 수 있다

```typescript
// src/shared/validations/ticketSchema.ts
export const createTicketSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이내로 입력해주세요'),
  description: z.string().max(1000, '설명은 1000자 이내로 입력해주세요').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    message: '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요',
  }).default('MEDIUM'),
  plannedStartDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

**대안 비교**

| 대안 | 채택하지 않은 이유 |
|------|-------------------|
| **Yup** | 타입 추론이 Zod보다 약하고 TypeScript 지원이 후행적이다 |
| **class-validator** | 데코레이터·클래스 기반. 함수형 위주인 프로젝트 스타일과 맞지 않는다 |
| **수동 검증** | 프론트·백엔드에 규칙이 중복되어 불일치가 발생한다 |

### 2.7 Drag & Drop — @dnd-kit

**선정 이유**
- 칼럼 간 이동(`@dnd-kit/core`)과 칼럼 내 정렬(`@dnd-kit/sortable`)을 모두 지원한다
- **터치 이벤트와 키보드 조작을 기본 제공**하여 NFR-002(모바일 터치)와 NFR-003(접근성)을 함께 충족한다
- React 19를 지원하며 활발히 유지보수되고 있다

**대안 비교**

| 대안 | 채택하지 않은 이유 |
|------|-------------------|
| **react-beautiful-dnd** | 유지보수가 중단되었고 React 19 호환이 보장되지 않는다 |
| **HTML5 Drag and Drop API** | 모바일 터치를 지원하지 않아 NFR-002를 충족할 수 없다 |
| **react-dnd** | 백엔드 추상화가 유연하나 정렬 기능을 직접 구현해야 한다 |

### 2.8 Styling — Tailwind CSS 4

**선정 이유**
- 반응형 분기(NFR-002: 360 / 768 / 1024px)를 컴포넌트 파일 안에서 유틸리티 클래스로 처리한다
- 우선순위 뱃지 색상 등 디자인 토큰을 설정 파일에서 일괄 관리한다

| 대안 | 채택하지 않은 이유 |
|------|-------------------|
| **CSS Modules** | 반응형 분기마다 별도 파일 관리가 필요하다 |
| **styled-components** | 런타임 CSS-in-JS로 서버 컴포넌트 환경에서 설정이 번거롭다 |

### 2.9 Testing — Jest + React Testing Library

**선정 이유**
- CLAUDE.md의 TDD 사이클(Red → Green → Refactor)을 수행하는 기본 러너다
- RTL은 구현 세부가 아닌 **사용자 관점의 동작**을 검증하므로, REQUIREMENTS.md의 인수 조건을 테스트로 그대로 옮길 수 있다

| 대안 | 비고 |
|------|------|
| **Vitest** | 실행 속도가 빠르나 CLAUDE.md가 Jest를 지정한다 |
| **Playwright** | E2E용. MVP 범위에서는 도입하지 않으며 필요 시 2차에 추가한다 |

---

## 3. 데이터 흐름

### 3.1 읽기 흐름 (FR-002 보드 조회)

```
 [Board.tsx]
      │  마운트
      ▼
 [useTickets.ts]
      │  ticketApi.getBoard()
      ▼
 [ticketApi.ts]              src/client/api/
      │  GET /api/tickets
      ▼
 [app/api/tickets/route.ts]  ① Route Handler
      │  ticketService.getBoard()
      ▼
 [ticketService.ts]          ② Service
      │  · 4개 칼럼별 그룹화
      │  · position 오름차순 정렬
      │  · isOverdue 파생 계산 (FR-008)
      │  · Done은 completedAt 24시간 이내만 필터 (FR-005)
      ▼
 [Drizzle]                   ③ ORM
      │  SELECT ... FROM tickets ORDER BY position ASC
      ▼
 [Vercel Postgres]           ④ DB
      │
      ▼  BoardData
 200 OK → 컴포넌트 렌더링
```

**응답 형태 (`BoardData`)**

```typescript
{
  BACKLOG:     Ticket[],  // position 오름차순
  TODO:        Ticket[],
  IN_PROGRESS: Ticket[],
  DONE:        Ticket[],  // completedAt 24시간 이내만
}
```

`isOverdue`는 DB 컬럼이 아니라 조회 시 계산하는 **파생 필드**다 (FR-008).

### 3.2 쓰기 흐름 (FR-001 티켓 생성)

```
 [TicketForm.tsx]
      │  제출
      ▼
 [Zod 검증 — 클라이언트]      src/shared/validations/ticketSchema.ts
      │  실패 → 폼에 에러 메시지 표시, 요청 전송 안 함
      │  성공
      ▼
 [ticketApi.ts]
      │  POST /api/tickets  { title, description?, priority?, ... }
      ▼
 [app/api/tickets/route.ts]  ① Route Handler
      │  · await request.json()
      │  · createTicketSchema.safeParse()   ← 동일 스키마로 재검증
      │      실패 → 400 { error: { code, message } }
      │  · ticketService.createTicket(input)
      ▼
 [ticketService.ts]          ② Service
      │  · status = BACKLOG 고정
      │  · position = 칼럼 최솟값 - 1024 (비어 있으면 0)
      │  · createdAt / updatedAt 설정
      ▼
 [Drizzle] → [Postgres]      ③④
      │
      ▼
 201 Created + 생성된 티켓 → 보드 상태 갱신
```

**이중 검증(NFR-004)**: 클라이언트 검증은 즉각적인 피드백을 위한 것이고,
서버 검증은 신뢰 경계를 지키기 위한 것이다. **동일한 Zod 스키마**를 양쪽에서 사용하므로 규칙이 어긋나지 않는다.

### 3.3 드래그 앤 드롭 흐름 (FR-007)

```
 [사용자가 카드를 드롭]
      │
      ▼
 [useTickets.ts] — move()
      │  ① 낙관적 업데이트 — UI 즉시 반영 (체감 지연 0ms)
      │  ② 이전 보드 상태를 스냅샷으로 보관
      │  ③ 대상이 DONE이면 /complete로 분기 (COMPONENT_SPEC 6.2)
      ▼
 [ticketApi.ts]
      │  PATCH /api/tickets/reorder
      │  { ticketId, status, position }
      ▼
 [app/api/tickets/reorder/route.ts]
      │  Zod 검증 → ticketService.reorderTicket()
      ▼
 [ticketService.ts]  ── 트랜잭션 시작 ──────────────────┐
      │  · position 재계산                              │
      │  · status 변경                                  │
      │  · TODO 진입 시   startedAt = now()             │
      │  · TODO→BACKLOG 시 startedAt = null             │
      └── 커밋 ─────────────────────────────────────────┘
      │
      ├─ 성공(200) → 서버 응답으로 상태 확정
      └─ 실패(4xx/5xx) → ③ 스냅샷으로 롤백 + 에러 표시
```

**position 재계산 규칙**

| 상황 | 계산식 |
|------|--------|
| 두 카드 사이 삽입 | `(prev.position + next.position) / 2` |
| 맨 앞 삽입 | `first.position - 1024` |
| 맨 뒤 삽입 | `last.position + 1024` |
| 간격이 1 미만 | 해당 칼럼 전체를 1024 간격으로 **재정렬** |

간격을 1024로 두는 이유는 이분 삽입을 반복해도 재정렬 없이 약 10회까지 버티기 위해서다.
상태와 position을 **하나의 트랜잭션**으로 갱신하여, 중간 실패로 순서만 바뀌고 상태는 그대로인 상황을 방지한다.

**Done 이동은 별도 엔드포인트다.**
`/api/tickets/reorder`는 `BACKLOG`, `TODO`, `IN_PROGRESS`만 허용한다.
Done으로의 이동은 `completedAt` 기록이 함께 일어나야 하므로 `PATCH /api/tickets/:id/complete`(FR-005)를 사용한다.

### 3.4 엔드포인트 ↔ 서비스 매핑

| FR | 엔드포인트 | 서비스 메서드 | 성공 응답 |
|----|-----------|--------------|----------|
| FR-001 | `POST /api/tickets` | `createTicket()` | 201 |
| FR-002 | `GET /api/tickets` | `getBoard()` | 200 |
| FR-003 | `GET /api/tickets/:id` | `getTicketById()` | 200 |
| FR-004 | `PATCH /api/tickets/:id` | `updateTicket()` | 200 |
| FR-005 | `PATCH /api/tickets/:id/complete` | `completeTicket()` | 200 |
| FR-006 | `DELETE /api/tickets/:id` | `deleteTicket()` | 204 |
| FR-007 | `PATCH /api/tickets/reorder` | `reorderTicket()` | 200 |
| FR-008 | — (파생 필드) | `getBoard()` 내부 계산 | — |

### 3.5 에러 응답 형식

모든 에러는 아래 형식으로 통일한다 (CLAUDE.md).

```typescript
{ error: { code: string, message: string } }
```

| 상태 코드 | 사용 상황 |
|-----------|-----------|
| 400 | Zod 검증 실패 |
| 404 | 존재하지 않는 티켓 ID |
| 500 | 예기치 못한 서버 오류 |

서비스 계층은 도메인 에러를 던지고, `src/server/middleware/errorHandler.ts`가 이를 HTTP 상태 코드로 변환한다.
서비스는 `Response` 객체를 알지 못한다.

---

## 4. 계층 간 경계 규칙

### 4.1 import 방향

```
        ┌──────────────────┐
        │   src/shared/    │   ← 양쪽에서 참조 가능 (의존성 없음)
        └────────┬─────────┘
           ┌─────┴─────┐
           ▼           ▼
   ┌──────────────┐  ┌──────────────┐
   │ src/client/  │  │ src/server/  │
   └──────────────┘  └──────▲───────┘
                            │
                     ┌──────┴───────┐
                     │   app/api/   │
                     └──────────────┘

   ✕ src/client/  ──✕──▶  src/server/     상호 import 금지
   ✕ src/server/  ──✕──▶  src/client/
```

| 규칙 | 내용 |
|------|------|
| **상호 import 금지** | `src/client/`와 `src/server/`는 서로를 import하지 않는다 |
| **shared만 공유** | 양쪽이 공유하는 것은 `src/shared/`의 타입·Zod 스키마·상수뿐이다 |
| **shared는 순수하게** | `src/shared/`는 React도 DB 클라이언트도 import하지 않는다. 런타임 의존성이 없어야 양쪽에서 안전하다 |
| **client에서 DB 접근 금지** | 프론트엔드는 반드시 `ticketApi.ts` → HTTP를 경유한다 |
| **server에서 React 금지** | `src/server/`에 React 관련 코드를 작성하지 않는다 |

### 4.2 Route Handler는 얇게 유지

Route Handler의 역할은 **요청 파싱 → 서비스 호출 → 응답 반환** 세 가지뿐이다.

```typescript
// app/api/tickets/route.ts — 지향하는 형태
export async function POST(request: Request) {
  const body = await request.json();                      // ① 파싱
  const parsed = createTicketSchema.safeParse(body);      // ② 검증
  if (!parsed.success) {
    return Response.json(toValidationError(parsed.error), { status: 400 });
  }
  const ticket = await ticketService.createTicket(parsed.data);  // ③ 서비스 호출
  return Response.json(ticket, { status: 201 });          // ④ 응답
}
```

| Route Handler에 두는 것 | 서비스에 두는 것 |
|------------------------|-----------------|
| 요청 본문/쿼리 파싱 | position 재계산 |
| Zod 검증 호출 | startedAt / completedAt 설정 |
| HTTP 상태 코드 결정 | isOverdue 파생 계산 |
| 응답 직렬화 | 트랜잭션 경계 |

**판단 기준**: Route Handler에 `if` 분기가 검증 실패 처리 외에 생긴다면, 그 로직은 서비스로 내려야 한다.

### 4.3 작업 경계 (CLAUDE.md)

- 백엔드 작업 시(`app/api/`, `src/server/`)에는 `src/client/`를 수정하지 않는다
- 프론트엔드 작업 시(`src/client/`)에는 `app/api/`, `src/server/`를 수정하지 않는다
- 양쪽에 영향을 주는 변경은 **`src/shared/`를 먼저 수정한 뒤** 각각에 반영한다

---

## 5. 개발 환경 설정

### 5.1 초기 셋업

```bash
# 1. 의존성 설치
npm install

# 2. Vercel 프로젝트 연결
npx vercel link

# 3. 환경 변수 가져오기 → .env.local 생성
npx vercel env pull .env.local

# 4. 스키마를 DB에 반영
npx drizzle-kit push        # 개발 중 빠른 반영
# 또는
npx drizzle-kit generate    # 마이그레이션 파일 생성
npx drizzle-kit migrate     # 마이그레이션 적용

# 5. 개발 서버
npm run dev
```

### 5.2 환경 변수

`vercel env pull`로 받아오며, **`.env.local`은 git에 커밋하지 않는다.**

| 변수 | 용도 |
|------|------|
| `POSTGRES_URL` | 커넥션 풀링 연결 문자열 (애플리케이션 런타임) |
| `POSTGRES_URL_NON_POOLING` | 직접 연결 (마이그레이션 실행 시) |
| `POSTGRES_PRISMA_URL` | Vercel이 함께 주입 (본 프로젝트는 미사용) |

> 마이그레이션은 커넥션 풀러를 우회해야 하므로 `POSTGRES_URL_NON_POOLING`을 사용한다.

### 5.3 테스트 — Jest + React Testing Library

| 구분 | 대상 | 위치 |
|------|------|------|
| 유닛 | `ticketService` 비즈니스 로직 (position 재계산, 날짜 자동 설정) | `__tests__/server/` |
| API | Route Handler 요청/응답, 상태 코드 | `__tests__/api/` |
| 컴포넌트 | RTL 기반 렌더링·상호작용 | `__tests__/client/` |
| 통합 | 드래그앤드롭 → 상태 변경 → 롤백 | `__tests__/integration/` |

```bash
npm test                # 전체 실행
npm test -- --watch     # 감시 모드 (TDD Red→Green 사이클)
npm test -- --coverage  # 커버리지
```

**TDD 규칙 (CLAUDE.md)**
- Red: 테스트만 작성한다. 구현 코드를 만들지 않는다
- Green: 테스트를 통과하는 최소한의 코드만 작성한다. 테스트를 수정하지 않는다
- Refactor: 코드 개선만 한다. 새 기능을 추가하지 않는다
- 테스트가 실패하면 **구현을 고친다.** 테스트를 고치지 않는다 (명세 오류인 경우 명세를 먼저 수정한다)

### 5.4 Lint / Format — ESLint + Prettier

```bash
npm run lint          # ESLint 검사
npm run lint:fix      # 자동 수정
npm run format        # Prettier 포맷팅
npm run typecheck     # tsc --noEmit
```

**핵심 ESLint 규칙**

| 규칙 | 목적 |
|------|------|
| `@typescript-eslint/no-explicit-any` | `any` 금지 (CLAUDE.md) |
| `no-console` | `console.log` 커밋 방지 |
| `no-restricted-imports` | `src/client/` ↔ `src/server/` 상호 import 차단 (4.1 경계 규칙 강제) |

`no-restricted-imports`로 경계 규칙을 **자동 검증**하여, 규칙이 문서에만 남지 않도록 한다.

### 5.5 TypeScript 설정

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/shared/*": ["./src/shared/*"],
      "@/server/*": ["./src/server/*"],
      "@/client/*": ["./src/client/*"]
    }
  }
}
```

공유 타입은 반드시 `@/shared/types`에서 import한다 (CLAUDE.md).

---

## 6. 배포 전략

### 6.1 배포 파이프라인

```
  로컬 개발
     │  git push
     ▼
  ┌─────────────────────────────────────────────┐
  │  GitHub                                     │
  └───────┬─────────────────────────┬───────────┘
          │ PR 생성/갱신             │ main 병합
          ▼                         ▼
  ┌────────────────┐        ┌────────────────┐
  │ Preview 배포   │        │ Production 배포 │
  │ 고유 URL 생성  │        │ 프로덕션 도메인 │
  │ PR에 링크 코멘트│        │                │
  └────────────────┘        └────────────────┘
```

| 트리거 | 결과 |
|--------|------|
| `main` 브랜치 push / 병합 | **Production 자동 배포** |
| PR 생성 및 커밋 추가 | **Preview 배포** — PR별 고유 URL 생성, PR에 자동 코멘트 |

빌드 전 `npm run lint`와 `npm test`가 통과해야 배포되도록 구성한다.
빌드 실패 시 기존 배포가 유지되므로 프로덕션이 깨지지 않는다.

### 6.2 환경 변수 관리

**Vercel Dashboard**에서 관리하며, 코드 저장소에 저장하지 않는다.

| 환경 | 용도 |
|------|------|
| Production | `main` 브랜치 배포 |
| Preview | PR 배포 |
| Development | `vercel env pull`로 로컬에 내려받는 값 |

- Vercel Postgres를 프로젝트에 연결하면 `POSTGRES_*` 변수가 세 환경에 자동 주입된다
- 변수를 변경한 뒤에는 **재배포해야** 반영된다 (빌드 시점에 주입되기 때문)
- 로컬은 `vercel env pull .env.local`로 동기화하며, `.env.local`은 `.gitignore`에 포함한다

### 6.3 DB 마이그레이션

| 환경 | 방법 |
|------|------|
| 로컬 | `drizzle-kit push`로 빠르게 반영 |
| Production | `drizzle-kit generate`로 마이그레이션 파일을 생성해 커밋하고, 배포 시 `drizzle-kit migrate` 실행 |

마이그레이션 파일은 `drizzle/` 디렉터리에 커밋하여 스키마 변경 이력을 추적한다.

### 6.4 롤백

Vercel은 배포 이력을 보관하므로, 문제가 발생하면 Dashboard에서 이전 배포를 **Promote to Production**하여 즉시 되돌린다.
단, **DB 마이그레이션은 자동 롤백되지 않는다.** 파괴적 스키마 변경(컬럼 삭제 등)은 별도 절차로 다룬다.

---

## 7. PRD 정합성 확인

본 TRD는 아래 항목에서 PRD·REQUIREMENTS와 일치한다.

### 7.1 기술 스택 (PRD 7장 ↔ TRD 2장)

| PRD 7장 | TRD 2장 | 일치 |
|---------|---------|------|
| Next.js 15 (App Router) | 2.2 | ✓ |
| TypeScript strict | 5.5 | ✓ |
| React 19 | 2.1 | ✓ |
| Tailwind CSS 4 | 2.8 | ✓ |
| @dnd-kit/core + sortable | 2.7 | ✓ |
| Drizzle ORM | 2.4 | ✓ |
| Vercel Postgres (Neon) | 2.5 | ✓ |
| Zod | 2.6 | ✓ |
| Jest + RTL | 2.9, 5.3 | ✓ |
| Vercel | 6장 | ✓ |

### 7.2 기능 목록 (PRD 6장 ↔ TRD 3.4)

FR-001 ~ FR-008의 엔드포인트가 PRD 6장 표와 일치한다.
드래그앤드롭(FR-007)은 `PATCH /api/tickets/reorder`이며, Done 이동은 FR-005의 `/complete`로 분리되어 있다.

### 7.3 비기능 요구사항 대응

| NFR | TRD 대응 |
|-----|----------|
| NFR-001 성능 | 2.3 Node 런타임, 2.5 커넥션 풀링 |
| NFR-002 반응형 | 2.7 @dnd-kit 터치 지원, 2.8 Tailwind 브레이크포인트 |
| NFR-003 접근성 | 2.7 @dnd-kit 키보드 조작 |
| NFR-004 데이터 무결성 | 3.2 이중 검증, 3.3 낙관적 업데이트·롤백·트랜잭션 |
| NFR-006 배포 환경 | 6장 전체 |

---

## 8. 참고 문서

| 문서 | 내용 |
|------|------|
| [PRD.md](./PRD.md) | 제품 요구사항, MVP 범위, 기술 스택 요약 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | FR/NFR 상세, 사용자 스토리, 추적 매트릭스 |
| [API_SPEC.md](./API_SPEC.md) | 엔드포인트별 요청/응답 스키마 |
| [DATA_MODEL.md](./DATA_MODEL.md) | 테이블 정의, 컬럼 제약, 인덱스 |
| [COMPONENT_SPEC.md](./COMPONENT_SPEC.md) | 컴포넌트 Props 및 동작 명세 |
| [TEST_CASES.md](./TEST_CASES.md) | 테스트 케이스 목록 |

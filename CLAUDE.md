# CLAUDE.md - Tika Project

## 프로젝트 개요
Tika는 티켓 기반 칸반 보드 TODO 앱이다.
Next.js App Router 기반으로, 프론트엔드와 백엔드를 디렉토리 수준에서 분리한다.
src/shared/에서 타입과 검증 스키마를 공유한다.

## 프로젝트 구조
- app/api/       : 백엔드 진입점 (Route Handlers, 요청 파싱 + 응답만)
- src/server/    : 백엔드 로직 (services, db, middleware)
- src/client/    : 프론트엔드 로직 (components, hooks, api 호출)
- src/shared/    : 공유 타입, Zod 스키마, 상수
- docs/          : 프로젝트 명세 문서

## 아키텍처 핵심

### 요청 흐름
```
컴포넌트 → useTickets → ticketApi.ts → app/api/ → src/server/services/ → Drizzle → Postgres
```
각 계층의 책임은 TRD 1.3 참조. src/client/와 src/server/는 서로 import하지 않으며
src/shared/(타입·Zod 스키마·상수)를 통해서만 결합한다.

### 엔드포인트 ↔ 기능
```
POST   /api/tickets              FR-001 생성
GET    /api/tickets              FR-002 보드 조회 (BoardData)
GET    /api/tickets/:id          FR-003 상세
PATCH  /api/tickets/:id          FR-004 수정
PATCH  /api/tickets/:id/complete FR-005 완료 / 완료 해제
DELETE /api/tickets/:id          FR-006 삭제
PATCH  /api/tickets/reorder      FR-007 상태·순서 변경
```

### 틀리기 쉬운 규칙
- **Done 이동은 /reorder가 아니라 /complete를 쓴다.** /reorder는 status로
  BACKLOG·TODO·IN_PROGRESS만 허용한다. completedAt 기록이 상태 변경과
  함께 일어나야 하기 때문이다.
- 이 분기는 useTickets.move()가 담당한다. Board 컴포넌트는 onMove 하나만
  노출하고 두 엔드포인트의 존재를 모른다.
- position은 1024 간격으로 관리하고 카드 사이 삽입 시 (prev+next)/2로
  계산한다. 간격이 1 미만이면 칼럼 전체를 재정렬한다.
- isOverdue는 DB 컬럼이 아니다. 조회 시 계산하는 파생 필드다.
- startedAt은 TODO 최초 진입 시에만 기록하고 이미 값이 있으면 유지한다.
- app/api/tickets/reorder/route.ts는 [id]/route.ts보다 먼저 매칭된다
  (Next.js는 정적 세그먼트 우선).

## 기술 스택
- Framework: Next.js 15 (App Router)
- Language: TypeScript (strict mode)
- Frontend: React 19
- Styling: Tailwind CSS 4
- Drag & Drop: @dnd-kit/core + @dnd-kit/sortable
- ORM: Drizzle ORM
- DB 드라이버: node-postgres (pg) — 로컬·배포 공통
- DB: 로컬/테스트는 PostgreSQL, 배포는 Vercel Postgres (Neon)
- Validation: Zod
- Testing: Jest + React Testing Library
- Deployment: Vercel

> @vercel/postgres는 Neon 전용이라 로컬 PostgreSQL에 붙지 못한다. pg로 통일한다 (TRD 2.5).
> 테스트는 .env.test(로컬 DB), 개발 서버는 .env.local(vercel env pull)을 쓴다.

## 프로젝트 문서 (반드시 참조)
- 제품 요구사항: /docs/PRD.md
- 기술 요구사항: /docs/TRD.md
- 상세 요구사항: /docs/REQUIREMENTS.md
- API 명세: /docs/API_SPEC.md
- 데이터 모델: /docs/DATA_MODEL.md
- 컴포넌트 명세: /docs/COMPONENT_SPEC.md
- 테스트 케이스: /docs/TEST_CASES.md

## 코딩 컨벤션

### TypeScript (공통)
- strict 모드 사용
- any 사용 금지, unknown 사용 후 타입 가드
- 인터페이스는 I 접두사 없이 명사로 (예: Ticket, BoardData)
- enum 대신 const 객체 + typeof 패턴 사용
- 공유 타입은 반드시 @/shared/types에서 import

### 백엔드 (app/api/ + src/server/)
- Route Handler는 얇게: 요청 파싱 → 서비스 호출 → 응답 반환
- 비즈니스 로직은 src/server/services/에 작성
- Zod로 요청 검증 (shared/validations에서 import)
- 에러 응답 형식 통일: { error: { code, message } }
- HTTP 상태 코드: 200, 201, 204, 400, 404, 500
- DB 쿼리는 Drizzle ORM으로만 작성 (raw SQL 금지)

### 프론트엔드 (src/client/)
- 함수 컴포넌트 + 화살표 함수
- Props 타입은 컴포넌트 파일 내 정의
- API 호출은 src/client/api/ticketApi.ts를 통해서만
- 파일명: PascalCase (예: TicketCard.tsx)

## 개발 규칙

### 반드시 지켜야 할 것
- 새 기능 구현 전 TEST_CASES.md의 해당 테스트부터 작성
- API 구현 시 API_SPEC.md의 명세를 정확히 따르기
- 컴포넌트 구현 시 COMPONENT_SPEC.md의 Props와 동작 준수
- 타입 변경 시 src/shared/types 먼저 수정

### 하지 말아야 할 것
- 명세에 없는 기능 임의 추가 금지
- 테스트 코드 삭제 또는 skip 금지
- any 타입 사용 금지
- console.log 커밋 금지 (디버깅 후 제거)
- src/client/에서 직접 DB 접근 금지
- src/server/에서 React 관련 코드 작성 금지

### 경계 규칙
- 백엔드 작업 시(app/api/, src/server/) 프론트엔드(src/client/) 코드 수정 금지
- 프론트엔드 작업 시(src/client/) 백엔드(app/api/, src/server/) 코드 수정 금지
- 양쪽에 영향을 주는 변경은 src/shared/ 먼저 수정 후 각각 반영

### TDD 사이클 규칙
- Red 단계: 테스트 코드만 작성, 구현 코드 생성 금지
- Green 단계: 테스트를 통과하는 최소한의 코드만 작성, 테스트 코드 수정 금지
- Refactor 단계: 코드 개선만, 새 기능 추가 금지, 테스트는 반드시 통과 유지
- 테스트와 구현을 한 번에 작성하지 말 것 — 반드시 단계별로 진행
- 테스트 실패 시 구현을 수정할 것, 테스트를 수정하지 말 것 (명세 오류인 경우 명세 먼저 수정)
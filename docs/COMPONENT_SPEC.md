# Tika - 컴포넌트 명세 (COMPONENT_SPEC.md)

> 기능 정의는 [REQUIREMENTS.md](./REQUIREMENTS.md), API는 [API_SPEC.md](./API_SPEC.md)를 기준으로 한다.
> 구현 시 본 문서의 Props와 동작을 준수한다 (CLAUDE.md).

---

## 1. 개요

### 1.1 작성 규칙

CLAUDE.md의 프론트엔드 컨벤션을 따른다.

| 항목 | 규칙 |
|------|------|
| 위치 | `src/client/components/` |
| 파일명 | PascalCase (`TicketCard.tsx`) |
| 정의 | 함수 컴포넌트 + 화살표 함수 |
| Props 타입 | 컴포넌트 파일 내에 정의 |
| 도메인 타입 | `@/shared/types`에서 import |
| API 호출 | `src/client/api/ticketApi.ts`를 통해서만 |
| DB 접근 | 금지 |

### 1.2 컴포넌트 트리

```
app/page.tsx
│
├── Header                        헤더 · "새 티켓" 버튼
│
├── Board                         DnD 컨텍스트 · 4칼럼 렌더링
│   └── Column × 4                BACKLOG / TODO / IN_PROGRESS / DONE
│       └── TicketCard × N        개별 티켓 카드
│
├── TicketForm                    생성 모달
│
└── TicketModal                   상세 · 편집 모달
    └── ConfirmDialog             삭제 확인
```

### 1.3 컴포넌트 목록

| 컴포넌트 | 구분 | 책임 |
|----------|------|------|
| `Board` | 핵심 | 4칼럼 렌더링, 드래그앤드롭 관리 |
| `Column` | 핵심 | 상태별 티켓 목록 렌더링, 드롭 영역 제공 |
| `TicketCard` | 핵심 | 개별 티켓 표시, 드래그 기능 |
| `Header` | 보조 | 제품명, 티켓 생성 진입점 |
| `TicketForm` | 보조 | 티켓 생성 폼 |
| `TicketModal` | 보조 | 티켓 상세 조회 및 수정 |
| `ConfirmDialog` | 보조 | 삭제 확인 다이얼로그 |
| `PriorityBadge` | 표시 | 우선순위 뱃지 |

---

## 2. Board — 칸반 보드 컨테이너

| 항목 | 내용 |
|------|------|
| **책임** | 4개 칼럼을 렌더링하고, 칼럼 간/칼럼 내 드래그 앤 드롭을 관리 |
| **Props** | `board: BoardData`, `onMove: (id, status, position) => void` |
| **내부 상태** | DnD 관련 상태 (@dnd-kit) |
| **핵심 동작** | 드래그 시작 → 오버레이 표시 → 드롭 → `onMove` 호출 → 낙관적 업데이트 |
| **하위 컴포넌트** | `Column` × 4 |

### 2.1 Props

```typescript
type BoardProps = {
  /** 칼럼별로 그룹화된 티켓. GET /api/tickets 응답을 그대로 받는다 */
  board: BoardData;
  /** 칼럼 이동 · 순서 변경 시 호출. DONE 포함 모든 대상을 동일하게 전달한다 */
  onMove: (id: number, status: TicketStatus, position: number) => void;
  /** 카드 클릭 시 호출 — 상세 모달 열기 */
  onTicketClick: (id: number) => void;
};
```

`board`는 서버 응답(`BoardData`)을 그대로 받는다. Board가 `status`로 그룹화하지 않는다.

### 2.2 내부 상태

| 상태 | 타입 | 용도 |
|------|------|------|
| `activeId` | `number \| null` | 현재 드래그 중인 티켓 ID. `DragOverlay` 렌더링에 사용 |
| `activeTicket` | `Ticket \| null` | 오버레이에 표시할 티켓 데이터 |

드래그 중 상태 외에는 티켓 데이터를 복제해 두지 않는다.
`board` Props가 단일 기준이 되어야 낙관적 업데이트 롤백이 단순해진다.

### 2.3 핵심 동작

```
① onDragStart   activeId 설정 → DragOverlay에 카드 미리보기 표시
② onDragOver    드롭 대상 칼럼 하이라이트
③ onDragEnd     드롭 위치로부터 targetStatus · newPosition 계산
                → onMove(id, targetStatus, newPosition)
④ onDragCancel  activeId 초기화, 변경 없음
```

`newPosition` 계산은 DATA_MODEL 5.3의 규칙을 따른다.

| 상황 | 계산식 |
|------|--------|
| 두 카드 사이 | `(prev.position + next.position) / 2` (정수 내림) |
| 맨 앞 | `first.position - 1024` |
| 맨 뒤 | `last.position + 1024` |
| 빈 칼럼 | `0` |

### 2.4 Done 드롭 처리 — Board는 관여하지 않는다

`PATCH /api/tickets/reorder`는 `status`로 `BACKLOG`, `TODO`, `IN_PROGRESS`만 허용한다.
Done으로의 이동은 `completedAt` 기록이 함께 일어나야 하므로 `PATCH /api/tickets/:id/complete`를 사용한다 (API_SPEC 7·9장).

이 분기는 **`useTickets` Hook이 담당한다.** Board는 어느 칼럼으로 드롭되든 `onMove`를 동일하게 호출하며, 두 엔드포인트의 존재를 알지 못한다.

```
Board                          useTickets.move()
─────                          ─────────────────
어느 칼럼이든                   status === 'DONE'  → complete()  → PATCH /:id/complete
onMove(id, status, position)   그 외               → reorder()   → PATCH /reorder
                                                                   (DONE에서 나오면
                                                                    서버가 completedAt 초기화)
```

**이렇게 나눈 이유**: Board는 화면 좌표를 상태·순서로 번역하는 것까지만 책임진다.
어떤 HTTP 요청으로 표현되는지는 데이터 계층의 관심사이므로, API 엔드포인트가 바뀌어도 Board는 수정되지 않는다.

### 2.5 @dnd-kit 구성

| 요소 | 용도 |
|------|------|
| `DndContext` | 드래그 컨텍스트. `onDragStart`/`onDragOver`/`onDragEnd` 핸들러 등록 |
| `SortableContext` | 칼럼별로 하나씩. 칼럼 내 정렬 담당 |
| `DragOverlay` | 드래그 중 커서를 따라다니는 카드 미리보기 |
| `PointerSensor` | 마우스·터치 입력 (NFR-002) |
| `KeyboardSensor` | 키보드 조작 (NFR-003) |

### 2.6 반응형 (NFR-002)

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| 360px~ | 1칼럼 세로 스크롤 |
| 768px~ | 2칼럼 그리드 |
| 1024px~ | 4칼럼 가로 배치 |

---

## 3. Column — 칼럼

| 항목 | 내용 |
|------|------|
| **책임** | 해당 상태의 티켓 목록을 렌더링, 드롭 영역 제공 |
| **Props** | `status: TicketStatus`, `tickets: Ticket[]`, `title: string` |
| **핵심 동작** | 티켓을 `position` 순으로 정렬, 빈 칼럼 시 안내 메시지 |
| **하위 컴포넌트** | `TicketCard` × N |

### 3.1 Props

```typescript
type ColumnProps = {
  /** 이 칼럼이 담당하는 상태 */
  status: TicketStatus;
  /** 이 칼럼에 속한 티켓 (Board에서 그룹화하여 전달) */
  tickets: Ticket[];
  /** 칼럼 헤더에 표시할 이름 */
  title: string;
  /** 카드 클릭 시 호출 */
  onTicketClick: (id: number) => void;
};
```

> `onTicketClick`은 원 명세에 없으나, `TicketCard`의 `onClick`을 전달하기 위해 필요하다.

### 3.2 칼럼 정의

| `status` | `title` |
|----------|---------|
| `BACKLOG` | Backlog |
| `TODO` | TODO |
| `IN_PROGRESS` | In Progress |
| `DONE` | Done |

칼럼 순서는 `@/shared/constants/ticket`의 `COLUMN_ORDER`를 따른다 (고정).

### 3.3 핵심 동작

- 티켓을 `position` **오름차순**으로 정렬하여 렌더링한다
- 칼럼 헤더에 **카드 수**를 표시한다 (US-003 인수 조건)
- 빈 칼럼일 때 안내 메시지를 표시한다
- `useDroppable`로 드롭 영역을 등록한다. 드래그가 위에 있으면 배경을 하이라이트한다
- 칼럼별로 독립 세로 스크롤을 가진다

### 3.4 빈 칼럼 안내 메시지

칼럼마다 **다음에 할 행동을 알려주는** 문구를 사용한다. 처음 쓰는 사용자가 칸반 흐름을 익히는 데 도움이 된다.

| 칼럼 | 메시지 |
|------|--------|
| BACKLOG | 새 티켓을 추가해보세요 |
| TODO | 착수할 티켓을 여기로 옮기세요 |
| IN_PROGRESS | 진행 중인 티켓이 없습니다 |
| DONE | 최근 24시간 내 완료한 티켓이 없습니다 |

Done의 문구는 "완료한 티켓이 없다"가 아니라 **"최근 24시간 내"**임을 명시한다.
24시간이 지난 완료 티켓이 사라진 것을 삭제로 오해하지 않게 하기 위해서다 (3.5).

### 3.5 Done 칼럼 특이사항

- 서버가 `completedAt` 기준 24시간 이내 티켓만 반환한다 (API_SPEC 4.2). **클라이언트는 추가 필터링을 하지 않는다**
- 24시간이 지나 사라진 티켓은 삭제된 것이 아니라 표시에서 제외된 것이다

---

## 4. TicketCard — 티켓 카드

| 항목 | 내용 |
|------|------|
| **책임** | 개별 티켓 정보 표시, 드래그 기능 |
| **Props** | `ticket: Ticket`, `onClick: () => void` |
| **핵심 동작** | 제목·우선순위 뱃지·종료예정일 표시, 오버듀 시 빨간색 강조. 클릭 시 상세 모달 |
| **접근성** | 키보드 내비게이션, `aria-label`, 드래그 핸들에 `role="button"` |

### 4.1 Props

```typescript
type TicketCardProps = {
  /** 표시할 티켓 */
  ticket: Ticket;
  /** 카드 클릭 시 호출 — 상세 모달을 연다 */
  onClick: () => void;
};
```

### 4.2 표시 항목

```
 정상 카드                        오버듀 카드
 ┌──────────────────────────┐    ┃┌──────────────────────────┐
 │  API 설계                │    ┃│  테스트 케이스 작성      │
 │                          │    ┃│                          │
 │  [ HIGH ]        09/03   │    ┃│  [ HIGH ]      ⚠ 09/01   │
 └──────────────────────────┘    ┃└──────────────────────────┘
                                  ▲
                            좌측 띠 + 테두리 = 오버듀
```

| 요소 | 소스 | 동작 |
|------|------|------|
| 제목 | `ticket.title` | 2줄 초과 시 말줄임 |
| 우선순위 뱃지 | `ticket.priority` | `PriorityBadge` 사용 |
| 종료예정일 | `ticket.dueDate` | `MM/DD` 형식. `null`이면 미표시 |
| 오버듀 표시 | `ticket.isOverdue` | `true`이면 좌측 띠 + 테두리 + ⚠ 아이콘 |
| 완료 표시 | `ticket.completedAt` | `DONE` 상태이면 ✓ 완료로 표시 |

### 4.3 표현 채널 분리 — 우선순위와 오버듀

두 신호가 모두 빨간색을 쓰더라도 **서로 다른 표현 채널**을 사용하여 섞이지 않게 한다.

| 신호 | 채널 | 위치 |
|------|------|------|
| 우선순위 | **뱃지 배경색** | 카드 하단 좌측 |
| 오버듀 | **카드 좌측 띠 + 테두리 + ⚠ 아이콘** | 카드 외곽, 날짜 앞 |

우선순위는 카드 **안쪽의 뱃지**로, 오버듀는 카드 **외곽 형태**로 드러나므로
`HIGH`이면서 오버듀인 카드에서도 두 정보를 각각 읽을 수 있다.

### 4.4 오버듀 강조 (FR-008 · US-004)

`ticket.isOverdue`가 `true`일 때:

| 적용 | 내용 |
|------|------|
| 좌측 띠 | 카드 왼쪽 세로 띠를 빨간색으로 표시 |
| 테두리 | 카드 테두리를 빨간색으로 표시 |
| 아이콘 | 종료예정일 앞에 ⚠ 노출 |
| 날짜 색 | 종료예정일 텍스트를 빨간색으로 표시 |

`isOverdue`는 서버가 계산해 응답에 포함하므로 **카드에서 다시 판정하지 않는다** (API_SPEC 10장).

색상만으로 구분하지 않고 ⚠ 아이콘과 형태 변화를 함께 제공하므로,
색각 이상 사용자도 오버듀를 인지할 수 있다 (NFR-003).

### 4.5 우선순위 뱃지 색상

REQUIREMENTS.md 6장의 정의를 그대로 따른다.

| `priority` | 색상 |
|------------|------|
| `LOW` | 회색 |
| `MEDIUM` | 파란색 |
| `HIGH` | 빨간색 |

오버듀와 색 계열이 겹치지만 4.3의 채널 분리로 구분되므로 뱃지 색상은 변경하지 않는다.

### 4.6 드래그 동작

`useSortable`로 등록한다.

| 상태 | 표현 |
|------|------|
| 기본 | 일반 렌더링 |
| 드래그 중 | 원래 자리는 반투명 placeholder, 커서에는 `DragOverlay`가 표시 |
| 드롭 | 새 위치로 이동 |

### 4.7 접근성 (NFR-003)

| 항목 | 구현 |
|------|------|
| 키보드 내비게이션 | `Tab`으로 카드 이동, `Enter`/`Space`로 상세 모달 열기 |
| 키보드 드래그 | @dnd-kit `KeyboardSensor` — `Space`로 집고, 방향키로 이동, `Space`로 놓기, `Esc`로 취소 |
| `aria-label` | `"{제목}, {우선순위} 우선순위, {상태} 칼럼"` (오버듀 시 `", 일정 초과"` 추가) |
| `role` | 드래그 핸들에 `role="button"` |
| 색상 대비 | 오버듀·우선순위를 색상만으로 구분하지 않는다. 오버듀는 ⚠ 아이콘과 형태(띠·테두리)로도 드러난다 (4.3) |

```
aria-label 예시:
"테스트 케이스 작성, HIGH 우선순위, Backlog 칼럼, 일정 초과"
```

---

## 5. 보조 컴포넌트

### 5.1 Header

| 항목 | 내용 |
|------|------|
| **책임** | 제품명 표시, 티켓 생성 진입점 제공 |
| **Props** | `onCreateClick: () => void` |
| **핵심 동작** | 버튼 클릭 시 `TicketForm` 모달을 연다 |

```typescript
type HeaderProps = {
  onCreateClick: () => void;
};
```

> 버튼 라벨은 **"새 티켓"**으로 확정한다 (PRD 8.2 와이어프레임 · US-001과 일치).

### 5.2 TicketForm — 생성 폼 (US-001, US-002)

| 항목 | 내용 |
|------|------|
| **책임** | 신규 티켓 입력 폼 |
| **Props** | `isOpen: boolean`, `onClose: () => void`, `onSubmit: (input: CreateTicketInput) => Promise<void>` |
| **핵심 동작** | Zod 검증 → `useTickets.create()` → `POST /api/tickets` → 폼 닫기 |

```typescript
type TicketFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTicketInput) => Promise<void>;
};
```

**입력 필드**

| 필드 | 컨트롤 | 필수 | 기본값 |
|------|--------|------|--------|
| `title` | text input | **O** | - |
| `description` | textarea | X | - |
| `priority` | select / radio | X | `MEDIUM` |
| `plannedStartDate` | date picker | X | - |
| `dueDate` | date picker | X | - |

**검증** — `@/shared/validations`의 `createTicketSchema`를 사용한다 (NFR-004 이중 검증).
에러 메시지는 REQUIREMENTS.md의 문구를 그대로 표시한다.

**인수 조건 (US-001)**
- 제목만 입력해도 생성된다
- 우선순위 미선택 시 `MEDIUM`이 적용된다
- 생성 완료 후 폼이 닫힌다
- 생성된 카드는 Backlog 최상단에 추가된다

### 5.3 TicketModal — 상세·편집 모달 (US-007)

| 항목 | 내용 |
|------|------|
| **책임** | 티켓 상세 조회 및 수정, 삭제 진입점 |
| **Props** | `ticketId: number \| null`, `onClose`, `onUpdate`, `onDelete` |
| **내부 상태** | `ticket: Ticket \| null`, `isLoading: boolean`, `mode: 'view' \| 'edit'`, 편집 중 폼 값 |
| **하위 컴포넌트** | `ConfirmDialog` |

```typescript
type TicketModalProps = {
  /** null이면 닫힘. ID만 받고 상세는 모달이 직접 조회한다 */
  ticketId: number | null;
  onClose: () => void;
  onUpdate: (id: number, input: UpdateTicketInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};
```

**데이터 조회**

모달은 `ticketId`만 받고 **`GET /api/tickets/:id`로 상세를 직접 조회한다** (FR-003).
보드에 이미 있는 `Ticket` 객체를 재사용하지 않는다.

```typescript
useEffect(() => {
  if (ticketId === null) return;
  setIsLoading(true);
  ticketApi.getById(ticketId).then(setTicket).finally(() => setIsLoading(false));
}, [ticketId]);
```

| 항목 | 내용 |
|------|------|
| 이유 | 보드 데이터가 낡았어도 모달은 항상 최신값을 보여준다. 명세된 FR-003이 실제 사용처를 갖는다 |
| 비용 | 모달이 열릴 때 짧은 로딩 상태가 존재한다 |
| 로딩 표현 | 스켈레톤 또는 스피너를 모달 본문에 표시한다 |
| 실패 처리 | 404이면 "티켓을 찾을 수 없습니다"를 표시하고 모달을 닫는다 |

**보기 / 편집 모드**

기본은 **읽기 전용(`view`)**이며, "편집" 버튼을 눌러야 `edit` 모드로 전환된다.
실수로 값을 바꿔 저장하는 상황을 막기 위해서다.

```
[view 모드]                        [edit 모드]
 제목    API 설계                   제목    [ API 설계          ]
 설명    엔드포인트 정의            설명    [ 엔드포인트 정의   ]
 우선순위 HIGH                      우선순위 ( )( )(●HIGH)
 종료예정일 2026-09-03              종료예정일 [ 2026-09-03 ]
 ───────────────────               ───────────────────
 시작일  2026-09-02 10:14 (자동)    시작일  2026-09-02 10:14 (읽기 전용)
 종료일  -                (자동)    종료일  -               (읽기 전용)

 [삭제]        [편집] [닫기]        [삭제]        [취소] [저장]
```

| 모드 | 전환 | 버튼 |
|------|------|------|
| `view` | 모달 최초 표시 | 삭제 / 편집 / 닫기 |
| `edit` | "편집" 클릭 | 삭제 / 취소 / 저장 |

- `edit`에서 "취소"를 누르면 변경을 버리고 `view`로 돌아간다
- `edit`에서 "저장" → Zod 검증(`updateTicketSchema`) → `PATCH /api/tickets/:id` → 보드 갱신 → `view` 복귀

**필드별 편집 가능 여부**

| 구분 | 필드 | 편집 |
|------|------|------|
| 편집 가능 | `title`, `description`, `priority`, `plannedStartDate`, `dueDate` | O |
| 읽기 전용 | `startedAt`, `completedAt` | **X** — 칼럼 이동으로 자동 기록 |
| 읽기 전용 | `status`, `createdAt`, `updatedAt` | X |

**삭제**
- "삭제" 버튼은 두 모드 모두에서 노출된다
- 클릭 시 `ConfirmDialog`를 표시한다 (5.4)

### 5.4 ConfirmDialog — 확인 다이얼로그 (US-008)

| 항목 | 내용 |
|------|------|
| **책임** | 되돌릴 수 없는 작업 전 확인 |
| **Props** | `isOpen`, `message`, `onConfirm`, `onCancel` |

```typescript
type ConfirmDialogProps = {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};
```

- 삭제 시 메시지: `정말 삭제하시겠습니까?`
- 삭제는 **하드 삭제**이므로 복구할 수 없다 (FR-006)
- `Esc` 키로 취소할 수 있다

### 5.5 PriorityBadge

| 항목 | 내용 |
|------|------|
| **책임** | 우선순위를 색상 뱃지로 표시 |
| **Props** | `priority: TicketPriority` |

```typescript
type PriorityBadgeProps = {
  priority: TicketPriority;
};
```

---

## 6. useTickets Hook

`src/client/hooks/useTickets.ts`에 정의한다. 보드 상태와 API 호출을 관리한다.

### 6.1 인터페이스

```typescript
type UseTicketsReturn = {
  /** 칼럼별 그룹화된 티켓. Board에 그대로 전달한다 */
  board: BoardData;
  isLoading: boolean;
  error: Error | null;

  /** 드래그앤드롭 진입점. 대상에 따라 reorder / complete로 분기한다 */
  move:     (id: number, status: TicketStatus, position: number) => Promise<void>;

  create:   (input: CreateTicketInput) => Promise<void>;
  update:   (id: number, input: UpdateTicketInput) => Promise<void>;
  remove:   (id: number) => Promise<void>;
  reorder:  (id: number, status: TicketStatus, position: number) => Promise<void>;
  complete: (id: number) => Promise<void>;
  refetch:  () => Promise<void>;
};
```

### 6.2 `move` — 엔드포인트 분기 (2.4)

Board의 `onMove`에 연결되는 유일한 진입점이다.

```typescript
const move = async (id: number, status: TicketStatus, position: number) => {
  if (status === TICKET_STATUS.DONE) {
    await complete(id);                   // PATCH /api/tickets/:id/complete
  } else {
    await reorder(id, status, position);  // PATCH /api/tickets/reorder
  }
};
```

| 조건 | 호출 | 이유 |
|------|------|------|
| 대상이 `DONE` | `complete()` | `completedAt` 기록이 필요하다 |
| 그 외 (DONE에서 나오는 경우 포함) | `reorder()` | 대상이 DONE이 아니므로 reorder의 관할이며, 서버가 `completedAt`을 초기화한다 |

**이동 대상만 보면 된다.** 현재 상태를 조회할 필요가 없어 분기가 한 줄로 줄었다.
Done에서 빠져나오는 이동도 대상이 DONE이 아니므로 `reorder()`가 처리한다 (API_SPEC 13.1).

### 6.3 메서드 ↔ API 매핑

| 메서드 | API | FR |
|--------|-----|-----|
| 초기 조회 | `GET /api/tickets` | FR-002 |
| `create` | `POST /api/tickets` | FR-001 |
| `update` | `PATCH /api/tickets/:id` | FR-004 |
| `remove` | `DELETE /api/tickets/:id` | FR-006 |
| `reorder` | `PATCH /api/tickets/reorder` | FR-007 |
| `complete` | `PATCH /api/tickets/:id/complete` | FR-005 |
| `move` | 위 두 가지로 분기 | FR-005, FR-007 |

모든 호출은 `src/client/api/ticketApi.ts`를 경유한다. Hook이 직접 `fetch`하지 않는다.

### 6.4 낙관적 업데이트 (NFR-004)

`move`(및 그 하위의 `reorder`·`complete`)에 적용한다.

```
① 이전 board 상태를 스냅샷으로 보관
② board 상태를 즉시 갱신 → UI 반영 (체감 지연 0ms)
③ API 호출
   ├─ 성공 → 서버 응답으로 상태 확정
   └─ 실패 → 스냅샷으로 롤백 + 에러 메시지 표시
```

`create`·`update`·`remove`는 낙관적 업데이트를 적용하지 않고 응답 후 갱신한다.
카드 위치 변화가 없어 즉시 반영의 이득이 작기 때문이다.

---

## 7. 이벤트 흐름

### 7.1 드래그 앤 드롭 (US-005)

```
TicketCard (드래그 시작)
   → Board (DndContext)
   → Column (드롭)
   → Board.onMove(id, newStatus, newPosition)
   → useTickets.move()
   → 낙관적 UI 업데이트
   → useTickets.reorder() → PATCH /api/tickets/reorder
   → 성공: 확정 / 실패: 롤백
```

### 7.2 티켓 생성 (US-001)

```
Header ("새 티켓" 클릭)
   → TicketForm (모달 열림)
   → 폼 입력
   → Zod 검증 (createTicketSchema)
   → useTickets.create()
   → POST /api/tickets
   → 보드 갱신 (Backlog 최상단에 추가)
   → 폼 닫기
```

### 7.3 티켓 수정 (US-007)

```
TicketCard (클릭)
   → TicketModal 열림 (ticketId 전달)
   → GET /api/tickets/:id → view 모드로 상세 표시
   → "편집" 클릭 → edit 모드
   → Zod 검증 (updateTicketSchema)
   → useTickets.update()
   → PATCH /api/tickets/:id
   → 보드 갱신 → view 모드 복귀
```

### 7.4 티켓 완료 (US-006)

```
Done 칼럼으로 드래그
   → Board.onMove(id, 'DONE', position)     ← Board는 DONE을 특별 취급하지 않는다
   → useTickets.move()
   → 대상이 DONE임을 감지 → useTickets.complete()
   → PATCH /api/tickets/:id/complete
   → completedAt 자동 설정
   → Done 칼럼에 표시 (24시간 동안)
```

> **완료는 삭제가 아니다.** `status`를 `DONE`으로 바꾸고 `completedAt`을 기록할 뿐,
> 행은 그대로 남는다. 24시간이 지나면 보드에서만 감춰지고 `GET /api/tickets/:id`로는 계속 조회된다.
> 영구 삭제는 7.5의 `DELETE`이며, 이쪽이 하드 삭제다 (FR-006).

### 7.5 티켓 영구 삭제 (US-008)

```
TicketModal (삭제 클릭)
   → ConfirmDialog ("정말 삭제하시겠습니까?")
   → 확인
   → useTickets.remove()
   → DELETE /api/tickets/:id
   → 보드 갱신 (카드 제거)
```

---

## 8. 사용자 스토리 ↔ 컴포넌트 매핑

| 사용자 스토리 | 주요 컴포넌트 | 사용하는 Hook | FR |
|--------------|--------------|--------------|-----|
| US-001: 새 할 일 등록 | `TicketForm` | `useTickets.create` | FR-001 |
| US-002: 상세 정보 설정 | `TicketForm` | `useTickets.create` | FR-001 |
| US-003: 칸반 보드 현황 파악 | `Board`, `Column`, `TicketCard` | `useTickets` (조회) | FR-002 |
| US-004: 마감 초과 인지 | `TicketCard` | `useTickets` (조회) | FR-008 |
| US-005: 드래그앤드롭 상태 변경 | `Board` (DnD), `Column` | `useTickets.move` → `reorder` | FR-007 |
| US-006: 할 일 완료 처리 | `Board` (DnD → Done) | `useTickets.move` → `complete` | FR-005 |
| US-007: 할 일 수정 | `TicketModal` | `useTickets.update` | FR-003, FR-004 |
| US-008: 할 일 삭제 | `TicketModal`, `ConfirmDialog` | `useTickets.remove` | FR-006 |

---

## 9. 확정된 설계 결정

| # | 쟁점 | 결정 | 반영 위치 |
|---|------|------|----------|
| 1 | Board Props 형태 | `board: BoardData` — 서버 응답을 그대로 전달하고 Board는 그룹화하지 않는다 | 2.1 |
| 2 | Done 드롭 분기 위치 | **Hook**이 분기한다. Board는 `onMove` 하나만 노출한다 | 2.4, 6.2 |
| 3 | 생성 버튼 라벨 | **"새 티켓"** (PRD 8.2·US-001과 일치) | 5.1, 7.2 |
| 4 | Hook 구성 | `useTickets` 하나로 통합한다 | 6장 |
| 5 | 우선순위 · 오버듀 구분 | **표현 채널 분리** — 우선순위는 뱃지 색, 오버듀는 좌측 띠·테두리·아이콘 | 4.3, 4.4 |
| 6 | 빈 칼럼 문구 | **칼럼별 맞춤 안내** — 다음 행동을 알려주는 문구 | 3.4 |
| 7 | TicketModal 데이터 소스 | **`GET /api/tickets/:id` 재호출** — 보드 데이터를 재사용하지 않는다 | 5.3 |
| 8 | TicketModal 편집 방식 | **보기/편집 모드 분리** — 기본 읽기 전용, "편집" 클릭 시 전환 | 5.3 |

---

## 10. 남은 확인 사항

### 10.1 미명세 컴포넌트의 Props

원 명세에 없어 이벤트 흐름에서 추론해 작성한 컴포넌트다.
`TicketModal`은 9장의 결정 7·8로 확정되었고, 나머지는 초안 상태다.

| 컴포넌트 | 상태 | 근거 |
|----------|------|------|
| `TicketModal` | **확정** | 결정 7, 8 |
| `Header` | 초안 | 티켓 생성 흐름의 진입점 |
| `TicketForm` | 초안 | 티켓 생성 흐름 |
| `ConfirmDialog` | 초안 | 티켓 삭제 흐름 |
| `PriorityBadge` | 초안 | `TicketCard`의 우선순위 뱃지 표시 |

### 10.2 모달 로딩 중 표현

`TicketModal`이 `GET /api/tickets/:id`를 기다리는 동안의 표현을 스켈레톤과 스피너 중 무엇으로 할지 확정이 필요하다 (5.3).

---

## 11. 참고 문서

| 문서 | 내용 |
|------|------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | FR/NFR, 사용자 스토리, 인수 조건 |
| [API_SPEC.md](./API_SPEC.md) | 엔드포인트별 요청/응답 |
| [DATA_MODEL.md](./DATA_MODEL.md) | 필드 정의, position 규칙 |
| [PRD.md](./PRD.md) | 와이어프레임, 레이아웃 |
| [TEST_CASES.md](./TEST_CASES.md) | 테스트 케이스 목록 |

/**
 * 통합 테스트용 헬퍼 (TEST_CASES.md 5.3).
 *
 * 이 파일을 쓰는 테스트는 반드시 먼저 ticketApi를 목킹해야 한다.
 *
 *   jest.mock('@/client/api/ticketApi');
 *
 * fetch가 아니라 모듈을 목킹하므로 URL·메서드가 아니라 어떤 동작이
 * 요청되었는지를 검증한다. HTTP 형태는 TC-API가 이미 덮는다.
 */
import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getBoard } from '@/client/api/ticketApi';
import { COLUMN_LABEL, COLUMN_ORDER, type TicketStatus } from '@/shared/constants/ticket';
import type { BoardData } from '@/shared/types/ticket';
import Page from '../../app/page';
import { boardWith } from './factories';

const COLUMN_WIDTH = 300;
const CARD_HEIGHT = 80;
const COLUMN_HEIGHT = 600;

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect;

/**
 * jsdom은 레이아웃이 없어 모든 getBoundingClientRect가 0을 돌려준다.
 * @dnd-kit은 이 사각형으로 충돌을 판정하므로, 그대로 두면 어느 칼럼에
 * 놓든 드롭 대상이 자기 자신으로 잡힌다.
 *
 * DOM 구조만 보고 칼럼은 가로로, 카드는 세로로 늘어놓은 것처럼 흉내 낸다.
 * 실제 CSS와 무관하며, 방향키가 옆 칼럼을 찾아갈 수 있을 정도면 충분하다.
 */
export const mockBoardLayout = (): void => {
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const columns = Array.from(document.querySelectorAll('section'));
    const column = this.tagName === 'SECTION' ? this : this.closest('section');
    if (column === null) return rect(0, 0, 0, 0);

    const x = columns.indexOf(column as HTMLElement) * COLUMN_WIDTH;
    if (this === column) return rect(x, 0, COLUMN_WIDTH - 20, COLUMN_HEIGHT);

    const cards = Array.from(column.querySelectorAll('[role="button"]'));
    const index = cards.indexOf(this);
    if (index >= 0) return rect(x, index * CARD_HEIGHT, COLUMN_WIDTH - 20, CARD_HEIGHT - 10);

    return rect(x, 0, 0, 0);
  };
};

/** GET /api/tickets가 이 보드를 반환하도록 하고 앱 전체를 렌더링한다. */
export const renderApp = (columns: Partial<BoardData> = {}): RenderResult => {
  mockBoardLayout();
  jest.mocked(getBoard).mockResolvedValue(boardWith(columns));
  return render(<Page />);
};

/** 그 칼럼의 region 랜드마크 (COMPONENT_SPEC 3.5) */
export const columnOf = (status: TicketStatus): HTMLElement =>
  screen.getByRole('region', { name: COLUMN_LABEL[status] });

/** 제목으로 카드를 찾는다. 접근 가능한 이름이 "{제목}, ..." 형태다 */
const findCard = (title: string): Promise<HTMLElement> =>
  screen.findByRole('button', { name: new RegExp(`^${title},`) });

/** 카드가 지금 몇 번째 칼럼에 있는지 */
const columnIndexOf = (card: HTMLElement): number => {
  const column = card.closest('section');
  if (column === null) return -1;
  return Array.from(document.querySelectorAll('section')).indexOf(column);
};

/**
 * 키보드 센서로 카드를 다른 칼럼으로 옮긴다 (TEST_CASES 5.2).
 * Space로 집고, 방향키로 옮기고, Space로 놓는다.
 */
export const dragCardToColumn = async (title: string, target: TicketStatus): Promise<void> => {
  const card = await findCard(title);
  const steps = COLUMN_ORDER.indexOf(target) - columnIndexOf(card);

  card.focus();
  await userEvent.keyboard('[Space]');
  for (let moved = 0; moved < Math.abs(steps); moved += 1) {
    await userEvent.keyboard(steps > 0 ? '{ArrowRight}' : '{ArrowLeft}');
  }
  await userEvent.keyboard('[Space]');
};

/** 같은 칼럼 안에서 한 칸 아래로 옮긴다 */
export const moveCardDown = async (title: string): Promise<void> => {
  const card = await findCard(title);
  card.focus();
  await userEvent.keyboard('[Space]');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('[Space]');
};

/** 집었다가 Esc로 취소한다 */
export const cancelDrag = async (title: string): Promise<void> => {
  const card = await findCard(title);
  card.focus();
  await userEvent.keyboard('[Space]');
  await userEvent.keyboard('{ArrowRight}');
  await userEvent.keyboard('{Escape}');
};

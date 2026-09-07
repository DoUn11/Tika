'use client';

import { Board } from '@/client/components/Board';
import { useTickets } from '@/client/hooks/useTickets';

/**
 * 보드 화면 (COMPONENT_SPEC 1.2).
 *
 * Header·TicketForm·TicketModal은 아직 붙이지 않았다. 각각을 이끄는
 * 통합 테스트가 TC-INT-004·005에 있으므로 그때 배선한다.
 */
const Page = () => {
  const { board, move } = useTickets();

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Board board={board} onMove={move} onTicketClick={() => {}} />
    </main>
  );
};

export default Page;

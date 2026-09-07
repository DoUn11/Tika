'use client';

import { useState } from 'react';
import { Board } from '@/client/components/Board';
import { ErrorBanner } from '@/client/components/ErrorBanner';
import { TicketModal } from '@/client/components/TicketModal';
import { useTickets } from '@/client/hooks/useTickets';

/**
 * 보드 화면 (COMPONENT_SPEC 1.2).
 *
 * 모달에는 ID만 넘긴다. 상세는 모달이 직접 조회하므로 보드가 낡았어도
 * 항상 최신값을 보여준다 (5.3).
 *
 * Header·TicketForm은 아직 붙이지 않았다. 생성 흐름(7.2)을 이끄는
 * 통합 테스트가 없다.
 */
const Page = () => {
  const { board, error, move, update, remove } = useTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const closeModal = (): void => setSelectedTicketId(null);

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <ErrorBanner message={error?.message ?? null} />

      <Board board={board} onMove={move} onTicketClick={setSelectedTicketId} />

      <TicketModal
        ticketId={selectedTicketId}
        onClose={closeModal}
        onUpdate={update}
        onDelete={remove}
      />
    </main>
  );
};

export default Page;

'use client';

import { useState } from 'react';
import { Board } from '@/client/components/Board';
import { ErrorBanner } from '@/client/components/ErrorBanner';
import { Header } from '@/client/components/Header';
import { TicketForm } from '@/client/components/TicketForm';
import { TicketModal } from '@/client/components/TicketModal';
import { useTickets } from '@/client/hooks/useTickets';

/**
 * 보드 화면 (COMPONENT_SPEC 1.2).
 *
 * 모달에는 ID만 넘긴다. 상세는 모달이 직접 조회하므로 보드가 낡았어도
 * 항상 최신값을 보여준다 (5.3).
 */
const Page = () => {
  const { board, error, move, create, update, remove } = useTickets();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Header onCreateClick={() => setIsFormOpen(true)} />

      <ErrorBanner message={error?.message ?? null} />

      <Board board={board} onMove={move} onTicketClick={setSelectedTicketId} />

      <TicketForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={create}
      />

      <TicketModal
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onUpdate={update}
        onDelete={remove}
      />
    </main>
  );
};

export default Page;

'use client';

type HeaderProps = {
  /** "새 티켓" 클릭 시 호출 — 생성 폼을 연다 */
  onCreateClick: () => void;
};

/**
 * 제품명과 티켓 생성 진입점 (COMPONENT_SPEC 5.1).
 *
 * 버튼 라벨은 "새 티켓"으로 확정되어 있다 (PRD 8.2 와이어프레임 · US-001).
 */
export const Header = ({ onCreateClick }: HeaderProps) => (
  <header className="mb-4 flex items-center justify-between">
    <h1 className="text-lg font-semibold text-slate-900">Tika</h1>
    <button
      type="button"
      onClick={onCreateClick}
      className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
    >
      새 티켓
    </button>
  </header>
);

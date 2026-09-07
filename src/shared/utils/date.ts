/**
 * 날짜 유틸. 프론트·백엔드가 같은 기준으로 날짜를 다루도록 한 곳에 둔다.
 *
 * DB의 DATE 컬럼과 API는 모두 YYYY-MM-DD 문자열을 쓰며,
 * ISO 형식이라 문자열 비교만으로 날짜 대소를 판단할 수 있다.
 */

/** 로컬 시각 기준으로 Date를 YYYY-MM-DD 문자열로 변환한다. */
export const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** 로컬 시각 기준 오늘 날짜 (YYYY-MM-DD). */
export const today = (): string => toDateString(new Date());

/**
 * 종료예정일이 지났는지 판단한다.
 * 당일은 초과가 아니다 (FR-008, DATA_MODEL 6.4).
 *
 * dueDate 검증(FR-001)과 오버듀 판정(FR-008)이 같은 기준을 쓰도록
 * 두 곳에서 이 함수를 공유한다.
 */
export const isPastDue = (dueDate: string, from: string = today()): boolean => dueDate < from;

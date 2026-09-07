type ErrorBannerProps = {
  /** null이면 아무것도 렌더링하지 않는다 */
  message: string | null;
};

/**
 * 요청 실패를 알린다 (COMPONENT_SPEC 5.5).
 *
 * 낙관적 업데이트가 실패하면 카드를 원래 자리로 되돌린다. 안내가 없으면
 * 사용자에게는 카드가 저절로 튕겨 나온 것으로만 보인다.
 *
 * 문구는 서버가 보낸 message를 그대로 쓴다. 다음 요청이 성공하면
 * message가 null이 되어 사라지므로 닫기 버튼이 필요 없다.
 */
export const ErrorBanner = ({ message }: ErrorBannerProps) => {
  if (message === null) return null;

  return (
    <p
      role="alert"
      className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
};

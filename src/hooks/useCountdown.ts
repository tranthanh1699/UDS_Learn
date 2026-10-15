import { useEffect, useState } from 'react';

/** Trả về số ms còn lại tới `deadline` (cập nhật mỗi 100 ms), hoặc null nếu không có deadline. */
export function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, deadline - now);
}

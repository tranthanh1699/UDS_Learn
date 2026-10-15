import { useEffect } from 'react';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';

const TICK_MS = 100;
const TESTER_PRESENT_MS = 2000;

/** Đồng hồ của ECU mô phỏng: kiểm tra S3 định kỳ và tự gửi TesterPresent khi được bật. */
export function useEcuClock(): void {
  const tick = useEcuRuntimeStore((s) => s.tick);
  const autoTp = useEcuRuntimeStore((s) => s.autoTesterPresent);
  const send = useEcuRuntimeStore((s) => s.send);

  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (!autoTp) return;
    // Functional 3E 80: giữ session cho mọi ECU mà không sinh response
    const id = window.setInterval(() => send([0x3e, 0x80], 'functional', { auto: true }), TESTER_PRESENT_MS);
    return () => window.clearInterval(id);
  }, [autoTp, send]);
}

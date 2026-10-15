import { create } from 'zustand';

import type { SessionKind } from '@/core/vehicle/types';

export type { SessionKind };

/** Trạng thái chạy của ECU mô phỏng. Engine UDS (giai đoạn 3) sẽ cập nhật store này. */
interface EcuRuntimeState {
  session: SessionKind;
  /** null = đang khóa; số = security level đã mở */
  unlockedLevel: number | null;
  /** Thời điểm (ms, Date.now) S3 hết hạn; null khi ở default session */
  s3ExpiresAt: number | null;
  rebooting: boolean;
}

export const useEcuRuntimeStore = create<EcuRuntimeState>(() => ({
  session: 'default',
  unlockedLevel: null,
  s3ExpiresAt: null,
  rebooting: false,
}));

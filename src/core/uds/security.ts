import type { EcuState } from './types';

/**
 * Trạng thái security access. Giai đoạn 6 sẽ bổ sung seed/key, bộ đếm số lần thử và delay timer.
 * Level được đánh số theo sub-function requestSeed (lẻ): level 1 ↔ 0x27 01/02, level 3 ↔ 0x27 03/04.
 */
export function isLevelUnlocked(state: Pick<EcuState, 'unlockedLevel'>, level: number | null): boolean {
  return level === null || state.unlockedLevel === level;
}

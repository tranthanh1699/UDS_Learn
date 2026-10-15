import type { SessionKind, TimingConfig } from '../vehicle/types';

/** Giá trị sub-function của 0x10 cho từng session. */
export const SESSION_IDS: Record<SessionKind, number> = {
  default: 0x01,
  programming: 0x02,
  extended: 0x03,
};

export function sessionFromId(id: number): SessionKind | null {
  const entry = Object.entries(SESSION_IDS).find(([, v]) => v === id);
  return entry ? (entry[0] as SessionKind) : null;
}

export const ALL_SESSIONS: readonly SessionKind[] = ['default', 'programming', 'extended'];
export const NON_DEFAULT_SESSIONS: readonly SessionKind[] = ['programming', 'extended'];

/** Deadline S3 mới sau khi xử lý một request: chỉ chạy khi ở session khác default. */
export function nextS3Deadline(session: SessionKind, now: number, timing: TimingConfig): number | null {
  return session === 'default' ? null : now + timing.s3Ms;
}

export function isS3Expired(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}

/**
 * Tham số timing trong positive response của 0x10:
 * P2 2 byte (đơn vị 1 ms), P2* 2 byte (đơn vị 10 ms).
 */
export function encodeSessionTiming(timing: TimingConfig): number[] {
  const p2 = Math.min(0xffff, Math.round(timing.p2Ms));
  const p2Star = Math.min(0xffff, Math.round(timing.p2StarMs / 10));
  return [p2 >> 8, p2 & 0xff, p2Star >> 8, p2Star & 0xff];
}

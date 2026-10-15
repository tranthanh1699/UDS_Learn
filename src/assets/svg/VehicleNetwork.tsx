import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import type { UdsOutcome } from '@/core/uds/types';
import type { SessionKind } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';

type Pt = [number, number];

/** Tọa độ các nút trên sơ đồ (viewBox 640 × 320, đầu xe hướng sang phải). */
const NODES = {
  tester: [62, 160] as Pt,
  obd: [430, 232] as Pt,
  gateway: [335, 160] as Pt,
  engine: [520, 160] as Pt,
  abs: [520, 95] as Pt,
  body: [250, 215] as Pt,
};

/** Đường đi của gói tin request: laptop → cáp → cổng OBD → gateway → Engine ECU. */
const REQUEST_PATH: Pt[] = [
  [96, 176],
  [140, 268],
  [280, 292],
  [400, 268],
  [430, 240],
  [430, 190],
  [360, 190],
  [350, 177],
  [379, 160],
  [476, 160],
];

const ECU_W = 88;
const ECU_H = 34;

export interface PacketInfo {
  id: number;
  outcome: UdsOutcome;
}

interface Props {
  packet: PacketInfo | null;
  session: SessionKind;
  unlockedLevel: number | null;
  rebooting: boolean;
}

function EcuBox({ at, label, active }: { at: Pt; label: string; active?: boolean }) {
  return (
    <g>
      <rect
        x={at[0] - ECU_W / 2}
        y={at[1] - ECU_H / 2}
        width={ECU_W}
        height={ECU_H}
        rx={7}
        className={active ? 'fill-surface stroke-accent' : 'fill-surface stroke-border'}
        strokeWidth={active ? 2 : 1.5}
      />
      <text x={at[0]} y={at[1] + 4} textAnchor="middle" className="fill-fg text-[11px] font-semibold">
        {label}
      </text>
    </g>
  );
}

/** Hình minh họa gốc: xe nhìn từ trên xuống với các ECU, CAN bus, cổng OBD-II và laptop tester. */
export function VehicleNetwork({ packet, session, unlockedLevel, rebooting }: Props) {
  const c = vi.car;
  const hasResponse = packet !== null && (packet.outcome === 'positive' || packet.outcome === 'negative');
  const [ex, ey] = NODES.engine;

  return (
    <svg viewBox="0 0 640 320" role="img" aria-label={c.aria} className="h-auto w-full select-none">
      {/* Thân xe */}
      <rect x={150} y={55} width={440} height={210} rx={70} className="fill-surface-2 stroke-border" strokeWidth={2} />
      <rect x={245} y={82} width={185} height={156} rx={22} className="fill-bg/40 stroke-border" strokeWidth={1} />
      <path d="M430 88 L470 72 L470 248 L430 232 Z" className="fill-accent/10 stroke-border" />
      <path d="M245 92 L215 80 L215 240 L245 228 Z" className="fill-accent/10 stroke-border" />
      {/* Bánh xe */}
      {[
        [190, 38],
        [190, 264],
        [495, 38],
        [495, 264],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={64} height={18} rx={6} className="fill-fg/70" />
      ))}
      {/* Đèn pha */}
      <rect x={578} y={80} width={8} height={30} rx={3} className="fill-warn/70" />
      <rect x={578} y={210} width={8} height={30} rx={3} className="fill-warn/70" />

      {/* CAN bus */}
      <g className="stroke-byte-pci/70" strokeWidth={3} fill="none" strokeLinecap="round">
        <path d="M379 160 H476" />
        <path d="M370 143 L440 95 H476" />
        <path d="M310 177 V190 H250 V198" />
        <path d="M430 225 V190 H360 V177" />
      </g>
      <text x={428} y={153} textAnchor="middle" className="fill-byte-pci text-[9px] font-semibold">
        {c.canBus}
      </text>

      {/* Cáp chẩn đoán từ laptop tới cổng OBD */}
      <path d="M96 176 C 120 300, 330 310, 430 240" fill="none" className="stroke-muted" strokeWidth={2} strokeDasharray="5 4" />

      {/* Laptop tester */}
      <g>
        <rect x={28} y={128} width={68} height={44} rx={4} className="fill-surface stroke-accent" strokeWidth={2} />
        <rect x={34} y={134} width={56} height={32} rx={2} className="fill-accent/15" />
        <path d="M20 176 H104 L96 184 H28 Z" className="fill-muted/60" />
        <text x={NODES.tester[0]} y={204} textAnchor="middle" className="fill-fg text-[11px] font-semibold">
          {c.tester}
        </text>
      </g>

      {/* Cổng OBD-II */}
      <rect x={414} y={225} width={32} height={16} rx={3} className="fill-surface stroke-fg/60" strokeWidth={1.5} />
      <text x={430} y={256} textAnchor="middle" className="fill-muted text-[9px] font-semibold">
        {c.obd}
      </text>

      <EcuBox at={NODES.gateway} label={c.gateway} />
      <EcuBox at={NODES.engine} label={c.engine} active />
      <EcuBox at={NODES.abs} label={c.abs} />
      <EcuBox at={NODES.body} label={c.body} />

      {/* Badge trạng thái ECU: session + security */}
      <g>
        <rect x={ex - 44} y={ey + 22} width={88} height={18} rx={9} className="fill-bg stroke-border" />
        <text x={ex - 34} y={ey + 35} className="hex fill-accent text-[10px] font-bold">
          {c.sessionShort[session]}
        </text>
        {unlockedLevel === null ? (
          <Lock x={ex - 4} y={ey + 25} width={12} height={12} className="text-muted" />
        ) : (
          <LockOpen x={ex - 4} y={ey + 25} width={12} height={12} className="text-ok" />
        )}
        <text x={ex + 11} y={ey + 35} className={unlockedLevel === null ? 'fill-muted text-[9px]' : 'fill-ok text-[9px]'}>
          {unlockedLevel === null ? c.locked : c.unlocked(unlockedLevel)}
        </text>
      </g>

      {/* ECU reset: vòng xoay + chữ */}
      {rebooting && (
        <g>
          <motion.circle
            cx={ex}
            cy={ey}
            r={30}
            fill="none"
            className="stroke-warn"
            strokeWidth={3}
            strokeDasharray="30 160"
            animate={{ rotate: 360 }}
            style={{ originX: `${ex}px`, originY: `${ey}px` }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <text x={ex} y={ey - 24} textAnchor="middle" className="fill-warn text-[10px] font-semibold">
            {c.rebooting}
          </text>
        </g>
      )}

      {/* Gói tin request (xanh dương) rồi response (xanh lá = positive, đỏ = negative) */}
      {packet && <PacketAnimation key={packet.id} hasResponse={hasResponse} positive={packet.outcome === 'positive'} />}
    </svg>
  );
}

const LEG_MS = 1100;

/** Chạy hai chặng tuần tự: request đi tới ECU, sau đó response quay về tester (nếu có). */
function PacketAnimation({ hasResponse, positive }: { hasResponse: boolean; positive: boolean }) {
  const [leg, setLeg] = useState<'request' | 'response' | 'done'>('request');
  useEffect(() => {
    const t1 = window.setTimeout(() => setLeg(hasResponse ? 'response' : 'done'), LEG_MS + 50);
    const t2 = window.setTimeout(() => setLeg('done'), 2 * LEG_MS + 100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [hasResponse]);
  if (leg === 'done') return null;
  const xs = REQUEST_PATH.map((p) => p[0]);
  const ys = REQUEST_PATH.map((p) => p[1]);
  const forward = leg === 'request';
  return (
    <motion.circle
      key={leg}
      r={7}
      className={forward ? 'fill-byte-sid' : positive ? 'fill-ok' : 'fill-err'}
      initial={{ cx: forward ? xs[0] : xs.at(-1), cy: forward ? ys[0] : ys.at(-1) }}
      animate={{ cx: forward ? xs : [...xs].reverse(), cy: forward ? ys : [...ys].reverse() }}
      transition={{ duration: LEG_MS / 1000, ease: 'linear' }}
    />
  );
}

export function VehicleNetworkLegend() {
  const c = vi.car;
  const dot = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {dot('bg-byte-sid', c.legendRequest)}
      {dot('bg-ok', c.legendPositive)}
      {dot('bg-err', c.legendNegative)}
    </div>
  );
}

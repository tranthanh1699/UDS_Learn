import type { TraceFrame } from '@/core/trace/exchange';
import { hexBytes } from '@/core/util/hex';
import { vi } from '@/i18n/vi';

const LEFT = 90;
const RIGHT = 510;
const ROW = 40;
const TOP = 46;
const MAX_LABEL_BYTES = 10;

function arrowClass(frame: TraceFrame): string {
  if (frame.role === 'flowControl') return 'stroke-byte-pci fill-byte-pci';
  if (frame.role === 'pending') return 'stroke-warn fill-warn';
  if (frame.role === 'request') return 'stroke-byte-sid fill-byte-sid';
  return frame.annotations.some((a) => a.kind === 'nrc') ? 'stroke-err fill-err' : 'stroke-ok fill-ok';
}

/** Sơ đồ tuần tự Tester ↔ ECU sinh từ danh sách frame thật (gồm cả Flow Control khi nhiều frame). */
export function SequenceDiagram({ frames }: { frames: readonly TraceFrame[] }) {
  const height = TOP + Math.max(frames.length, 1) * ROW + 24;
  const noResponse = !frames.some((f) => f.dir === 'Rx' && f.role !== 'flowControl');
  const total = height + (noResponse ? 20 : 0);
  return (
    <svg viewBox={'0 0 600 ' + total} className="h-auto w-full" role="img" aria-label={vi.learn.sections.sequence}>
      {(
        [
          [LEFT, vi.learn.tester],
          [RIGHT, vi.learn.ecu],
        ] as const
      ).map(([x, label]) => (
        <g key={label}>
          <rect x={x - 45} y={6} width={90} height={26} rx={6} className="fill-surface-2 stroke-border" />
          <text x={x} y={23} textAnchor="middle" className="fill-fg text-[12px] font-semibold">
            {label}
          </text>
          <line x1={x} x2={x} y1={32} y2={height} className="stroke-border" strokeDasharray="4 4" />
        </g>
      ))}
      {frames.map((f, i) => {
        const y = TOP + i * ROW + 14;
        const toRight = f.dir === 'Tx';
        const [x1, x2] = toRight ? [LEFT, RIGHT] : [RIGHT, LEFT];
        const d = toRight ? -9 : 9;
        const head = [x2, y, x2 + d, y - 5, x2 + d, y + 5].join(' ');
        const bytes = f.data.length > MAX_LABEL_BYTES ? hexBytes(f.data.slice(0, MAX_LABEL_BYTES)) + ' …' : hexBytes(f.data);
        const cls = arrowClass(f);
        return (
          <g key={f.id}>
            <line x1={x1} x2={x2} y1={y} y2={y} className={cls} strokeWidth={2} />
            <polygon points={head} className={cls} />
            <text x={(LEFT + RIGHT) / 2} y={y - 6} textAnchor="middle" className="hex fill-fg text-[11px]">
              <tspan className="fill-muted font-semibold">{f.kind} </tspan>
              {bytes}
            </text>
          </g>
        );
      })}
      {noResponse && (
        <text x={RIGHT} y={height + 8} textAnchor="middle" className="fill-muted text-[11px] italic">
          {vi.frame.noResponse}
        </text>
      )}
    </svg>
  );
}

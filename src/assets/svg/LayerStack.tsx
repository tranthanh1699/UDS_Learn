import { vi } from '@/i18n/vi';

type Kind = 'pci' | 'sid' | 'did' | 'pad' | 'meta';

const CELL = 30;
const GAP = 4;
const FILL: Record<Kind, string> = {
  pci: 'fill-byte-pci/20 stroke-byte-pci',
  sid: 'fill-byte-sid/20 stroke-byte-sid',
  did: 'fill-byte-did/20 stroke-byte-did',
  pad: 'fill-transparent stroke-byte-pad',
  meta: 'fill-surface-2 stroke-border',
};
const TEXT: Record<Kind, string> = { pci: 'fill-byte-pci', sid: 'fill-byte-sid', did: 'fill-byte-did', pad: 'fill-byte-pad', meta: 'fill-muted' };

function Bytes({ x, y, cells }: { x: number; y: number; cells: [string, Kind][] }) {
  let cx = x;
  return (
    <g>
      {cells.map(([label, kind], i) => {
        const w = kind === 'meta' ? 56 : CELL;
        const el = (
          <g key={i}>
            <rect x={cx} y={y} width={w} height={26} rx={4} className={FILL[kind]} strokeDasharray={kind === 'pad' ? '3 2' : undefined} />
            <text x={cx + w / 2} y={y + 17} textAnchor="middle" className={`hex text-[11px] font-semibold ${TEXT[kind]}`}>
              {label}
            </text>
          </g>
        );
        cx += w + GAP;
        return el;
      })}
    </g>
  );
}

/** Sơ đồ 3 lớp: PDU UDS được ISO-TP thêm PCI rồi đặt vào CAN frame (có padding). */
export function LayerStack() {
  const l = vi.layers;
  const rows = [
    { y: 8, title: l.uds, desc: l.udsDesc, color: 'stroke-byte-sid', cells: [['22', 'sid'], ['F1', 'did'], ['90', 'did']] as [string, Kind][], x: 228 },
    { y: 82, title: l.isotp, desc: l.isotpDesc, color: 'stroke-byte-pci', cells: [['03', 'pci'], ['22', 'sid'], ['F1', 'did'], ['90', 'did']] as [string, Kind][], x: 194 },
    {
      y: 156,
      title: l.can,
      desc: l.canDesc,
      color: 'stroke-byte-data',
      cells: [['7E0', 'meta'], ['03', 'pci'], ['22', 'sid'], ['F1', 'did'], ['90', 'did'], ['CC', 'pad'], ['CC', 'pad'], ['CC', 'pad'], ['CC', 'pad']] as [string, Kind][],
      x: 194,
    },
  ];
  return (
    <svg viewBox="0 0 560 222" role="img" aria-label={l.aria} className="h-auto w-full">
      {rows.map((r, i) => (
        <g key={r.title}>
          <rect x={2} y={r.y} width={556} height={58} rx={10} className={`fill-surface-2/50 ${r.color}`} strokeWidth={1.5} />
          <text x={14} y={r.y + 24} className="fill-fg text-[12px] font-bold">
            {r.title}
          </text>
          <text x={14} y={r.y + 42} className="fill-muted text-[10px]">
            {r.desc}
          </text>
          <Bytes x={r.x} y={r.y + 16} cells={r.cells} />
          {i < rows.length - 1 && <path d={`M 280 ${r.y + 60} v 12 m -5 -5 l 5 5 l 5 -5`} fill="none" className="stroke-muted" strokeWidth={1.5} />}
        </g>
      ))}
    </svg>
  );
}

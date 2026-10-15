import { motion } from 'framer-motion';
import type { KeyboardEvent } from 'react';
import type { ComponentId } from '@/core/dtc/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

type Pt = [number, number];

/** Vị trí linh kiện trên hình xe nhìn từ trên (đầu xe bên phải, bên trái xe ở phía trên). */
const POS: Record<ComponentId, Pt> = {
  wssFL: [522, 47],
  wssFR: [522, 273],
  wssRL: [222, 47],
  wssRR: [222, 273],
  coolantTemp: [500, 138],
  o2Sensor: [420, 216],
  battery: [556, 96],
  absPump: [462, 100],
  canAbs: [372, 118],
};

/** Vị trí nhãn so với marker. */
const LABEL_DY: Partial<Record<ComponentId, number>> = { wssFL: -18, wssRL: -18, wssFR: 26, wssRR: 26, o2Sensor: 26, battery: -16, absPump: -16, canAbs: -16 };

interface Props {
  faulty: readonly ComponentId[];
  selected: ComponentId | null;
  onSelect: (c: ComponentId) => void;
}

/** Hình minh họa gốc cho trang mô phỏng lỗi: bấm vào linh kiện để chọn và inject lỗi. */
export function FaultView({ faulty, selected, onSelect }: Props) {
  const d = vi.dtc;
  const onKey = (c: ComponentId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(c);
    }
  };
  return (
    <svg viewBox="0 0 640 320" role="group" aria-label={vi.faults.viewAria} className="h-auto w-full select-none">
      {/* Thân xe */}
      <rect x={150} y={55} width={440} height={210} rx={70} className="fill-surface-2 stroke-border" strokeWidth={2} />
      <rect x={245} y={82} width={170} height={156} rx={22} className="fill-bg/40 stroke-border" />
      {[
        [190, 38],
        [190, 264],
        [490, 38],
        [490, 264],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={64} height={18} rx={6} className="fill-fg/60" />
      ))}

      {/* Động cơ và ống xả */}
      <rect x={470} y={118} width={92} height={84} rx={8} className="fill-muted/20 stroke-muted/50" />
      <text x={516} y={192} textAnchor="middle" className="fill-muted text-[10px]">
        {d.engineBlock}
      </text>
      <path d="M470 196 C 430 214, 300 222, 158 226" fill="none" className="stroke-muted/60" strokeWidth={5} strokeLinecap="round" />
      <text x={250} y={244} className="fill-muted text-[9px]">
        {d.exhaust}
      </text>

      {/* ECU và đường CAN tới ABS ECU */}
      <rect x={300} y={146} width={64} height={26} rx={5} className="fill-surface stroke-border" />
      <text x={332} y={163} textAnchor="middle" className="fill-fg text-[9px] font-semibold">
        {d.ecus.gateway}
      </text>
      <rect x={372} y={62} width={56} height={24} rx={5} className="fill-surface stroke-border" />
      <text x={400} y={78} textAnchor="middle" className="fill-fg text-[9px] font-semibold">
        {d.ecus.abs}
      </text>
      <path
        d="M350 146 L372 118 L392 86"
        fill="none"
        strokeWidth={3}
        className={faulty.includes('canAbs') ? 'stroke-err' : 'stroke-byte-pci/70'}
        strokeDasharray={faulty.includes('canAbs') ? '4 4' : undefined}
      />

      {(Object.keys(POS) as ComponentId[]).map((c) => {
        const [x, y] = POS[c];
        const isFaulty = faulty.includes(c);
        const isSelected = selected === c;
        return (
          <g
            key={c}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${d.components[c]}${isFaulty ? ` (${vi.faults.active})` : ''}`}
            onClick={() => onSelect(c)}
            onKeyDown={onKey(c)}
            className="cursor-pointer outline-none [&:focus-visible>circle.ring]:stroke-accent"
          >
            <title>{d.components[c]}</title>
            {isFaulty && (
              <motion.circle
                cx={x}
                cy={y}
                r={12}
                className="fill-err/40"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.2, opacity: 0 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
                transition={{ repeat: Infinity, duration: 1.3, ease: 'easeOut' }}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={10}
              strokeWidth={isSelected ? 3 : 2}
              className={cn('ring', isFaulty ? 'fill-err stroke-err' : 'fill-surface stroke-accent', isSelected && 'stroke-fg')}
            />
            <circle cx={x} cy={y} r={3} className={isFaulty ? 'fill-surface' : 'fill-accent'} />
            <text
              x={x}
              y={y + (LABEL_DY[c] ?? -16)}
              textAnchor="middle"
              className={cn('text-[10px] font-semibold', isFaulty ? 'fill-err' : 'fill-fg')}
            >
              {d.shortNames[c]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { Gear, VehicleConditions } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

const R = 104;
const START = 135;
const SWEEP = 270;

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

interface GaugeProps {
  cx: number;
  cy: number;
  value: number;
  max: number;
  step: number;
  label: (v: number) => string;
  unit: string;
  readout: string;
  redFrom?: number;
}

function Gauge({ cx, cy, value, max, step, label, unit, readout, redFrom }: GaugeProps) {
  const angle = (v: number) => START + (Math.min(Math.max(v, 0), max) / max) * SWEEP;
  const [nx, ny] = polar(cx, cy, R - 18, angle(value));
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 12} className="fill-bg stroke-border" strokeWidth={2} />
      <path d={arcPath(cx, cy, R, START, START + SWEEP)} fill="none" className="stroke-border" strokeWidth={6} strokeLinecap="round" />
      {redFrom !== undefined && (
        <path d={arcPath(cx, cy, R, angle(redFrom), START + SWEEP)} fill="none" className="stroke-err/80" strokeWidth={6} strokeLinecap="round" />
      )}
      <path d={arcPath(cx, cy, R, START, angle(value) + 0.01)} fill="none" className="stroke-accent" strokeWidth={6} strokeLinecap="round" />
      {ticks.map((t) => {
        const [x1, y1] = polar(cx, cy, R - 10, angle(t));
        const [x2, y2] = polar(cx, cy, R - 2, angle(t));
        const [lx, ly] = polar(cx, cy, R - 26, angle(t));
        return (
          <g key={t}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-muted" strokeWidth={2} />
            <text x={lx} y={ly + 4} textAnchor="middle" className="fill-muted text-[11px]">
              {label(t)}
            </text>
          </g>
        );
      })}
      <motion.line
        x1={cx}
        y1={cy}
        initial={false}
        animate={{ x2: nx, y2: ny }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="stroke-err"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={7} className="fill-fg" />
      <text x={cx} y={cy + 42} textAnchor="middle" className="hex fill-fg text-[22px] font-bold">
        {readout}
      </text>
      <text x={cx} y={cy + 60} textAnchor="middle" className="fill-muted text-[11px]">
        {unit}
      </text>
    </g>
  );
}

function Lamp({ x, y, on, tone, title, children }: { x: number; y: number; on: boolean; tone: 'warn' | 'err'; title: string; children: ReactNode }) {
  const d = vi.dashboard;
  return (
    <g transform={`translate(${x} ${y})`} className={cn(on ? (tone === 'warn' ? 'fill-warn stroke-warn' : 'fill-err stroke-err') : 'fill-muted/30 stroke-muted/30')}>
      <title>{`${title}: ${on ? d.lampOn : d.lampOff}`}</title>
      {on && (
        <motion.circle r={20} className={tone === 'warn' ? 'fill-warn/20' : 'fill-err/20'} stroke="none" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }} />
      )}
      {children}
    </g>
  );
}

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

/** Bảng đồng hồ gốc: tốc độ, vòng tua, điện áp, số và đèn cảnh báo (MIL, ắc quy, ABS). */
export function Dashboard({ conditions, milOn, absOn }: { conditions: VehicleConditions; milOn: boolean; absOn: boolean }) {
  const d = vi.dashboard;
  const c = conditions;
  const batteryOn = c.batteryVoltage < 11.5 || c.batteryVoltage > 15.5;
  return (
    <svg viewBox="0 0 680 290" role="img" aria-label={d.aria} className="h-auto w-full select-none">
      <rect x={4} y={4} width={672} height={282} rx={36} className="fill-surface-2 stroke-border" strokeWidth={2} />
      <Gauge cx={150} cy={150} value={c.speedKmh} max={240} step={40} label={String} unit={d.speed} readout={String(Math.round(c.speedKmh))} />
      <Gauge
        cx={530}
        cy={150}
        value={c.rpm / 1000}
        max={8}
        step={1}
        label={String}
        unit={d.rpm}
        readout={(c.rpm / 1000).toFixed(1)}
        redFrom={6}
      />

      {/* Cụm giữa: số, điện áp, đèn cảnh báo */}
      <g>
        <text x={340} y={40} textAnchor="middle" className="fill-muted text-[11px]">
          {d.gear}
        </text>
        {GEARS.map((g, i) => (
          <text
            key={g}
            x={295 + i * 30}
            y={72}
            textAnchor="middle"
            className={cn('hex text-[24px] font-bold', g === c.gear ? 'fill-accent' : 'fill-muted/40')}
          >
            {g}
          </text>
        ))}
        <text x={340} y={118} textAnchor="middle" className="fill-muted text-[11px]">
          {d.voltage}
        </text>
        <text x={340} y={148} textAnchor="middle" className={cn('hex text-[26px] font-bold', batteryOn ? 'fill-err' : 'fill-fg')}>
          {c.batteryVoltage.toFixed(1)} V
        </text>

        <Lamp x={290} y={215} on={milOn} tone="warn" title={d.mil}>
          <path d="M-14 -4 h5 v-5 h12 v5 h4 l4 -4 h3 v16 h-3 l-4 -4 h-3 v6 h-15 l-3 -4 v-6 z" strokeWidth={1} />
        </Lamp>
        <Lamp x={340} y={215} on={batteryOn} tone="err" title={d.battery}>
          <rect x={-14} y={-8} width={28} height={18} rx={2} strokeWidth={1} />
          <rect x={-10} y={-12} width={5} height={4} />
          <rect x={5} y={-12} width={5} height={4} />
          <text x={-7} y={5} textAnchor="middle" className="fill-surface text-[11px] font-bold" stroke="none">
            −
          </text>
          <text x={7} y={5} textAnchor="middle" className="fill-surface text-[11px] font-bold" stroke="none">
            +
          </text>
        </Lamp>
        <Lamp x={390} y={215} on={absOn} tone="warn" title={d.abs}>
          <circle r={12} fill="none" strokeWidth={2.5} />
          <text y={4} textAnchor="middle" className="text-[9px] font-bold" stroke="none">
            ABS
          </text>
        </Lamp>
      </g>
    </svg>
  );
}

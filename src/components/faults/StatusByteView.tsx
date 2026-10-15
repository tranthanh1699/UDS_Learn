import { AnimatePresence, motion } from 'framer-motion';
import { Binary } from 'lucide-react';
import { formatDtc } from '@/core/dtc/catalog';
import { getBit } from '@/core/dtc/faultModel';
import { STATUS_BIT_NAMES } from '@/core/dtc/types';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useFaultsStore } from '@/store/faults';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Tooltip } from '@/components/ui/Tooltip';

const f = vi.faults;
const BITS_DESC = [7, 6, 5, 4, 3, 2, 1, 0];

/** Status byte 8 bit của một DTC; bit vừa đổi nhấp nháy, kèm lý do bằng tiếng Việt. */
export function StatusByteView({ eventId }: { eventId: string | null }) {
  const ev = useFaultsStore((s) => (eventId ? s.dtc.events[eventId] : undefined));
  const entry = useFaultsStore((s) => s.catalog.find((c) => c.id === eventId));
  const change = useFaultsStore((s) => (eventId ? s.lastChange[eventId] : undefined));
  const logId = useFaultsStore((s) => s.log.at(-1)?.id ?? 0);
  if (!ev || !entry) return null;
  const changed = new Set(change?.bitChanges.map((b) => b.bit));

  return (
    <Card>
      <CardHeader
        title={`${f.statusTitle} · ${formatDtc(entry.dtc)}`}
        icon={<Binary className="h-4 w-4" />}
        extra={<span className="hex text-sm font-semibold">0x{hex(ev.status)}</span>}
      />
      <CardBody className="space-y-4">
        <div className="text-xs text-muted">
          {vi.dtc.components[entry.component]} – {vi.dtc.faultTypes[entry.faultType]}
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {BITS_DESC.map((bit) => {
            const on = getBit(ev.status, bit) === 1;
            return (
              <Tooltip key={bit} content={vi.dtc.bits[bit]}>
                <motion.div
                  key={`${bit}-${changed.has(bit) ? logId : 0}`}
                  initial={changed.has(bit) ? { scale: 1.25, opacity: 0.4 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className={cn(
                    'flex cursor-help flex-col items-center rounded-md border p-1.5 text-center',
                    on ? 'border-accent bg-accent/15' : 'border-border bg-surface-2/40',
                    changed.has(bit) && 'ring-2 ring-warn',
                  )}
                >
                  <span className="text-[10px] text-muted">
                    {f.bit} {bit}
                  </span>
                  <span className={cn('hex text-lg font-bold', on ? 'text-accent' : 'text-muted')}>{on ? 1 : 0}</span>
                  <span className="break-all text-[9px] leading-tight text-muted">{STATUS_BIT_NAMES[bit]}</span>
                </motion.div>
              </Tooltip>
            );
          })}
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted">{f.lastChanges}</div>
          <AnimatePresence mode="popLayout">
            {change ? (
              <motion.ul key={logId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5 text-xs">
                {change.bitChanges.map((b) => (
                  <li key={b.bit} className="flex gap-2">
                    <span className="hex shrink-0 rounded bg-warn/15 px-1.5 py-0.5 font-semibold text-warn">
                      bit{b.bit}: {b.from}→{b.to}
                    </span>
                    <span>
                      <span className="font-medium">{STATUS_BIT_NAMES[b.bit]}</span> — {b.reason}
                    </span>
                  </li>
                ))}
                {change.notes.map((n) => (
                  <li key={n} className="text-muted">
                    • {n}
                  </li>
                ))}
              </motion.ul>
            ) : (
              <p className="text-xs text-muted">{f.noChanges}</p>
            )}
          </AnimatePresence>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded bg-surface-2 p-1.5">
            <div className="text-muted">{f.cols.debounce}</div>
            <div className="hex font-semibold">{ev.debounce}</div>
          </div>
          <div className="rounded bg-surface-2 p-1.5">
            <div className="text-muted">{f.cols.cycles}</div>
            <div className="hex font-semibold">{ev.failedCycles}</div>
          </div>
          <div className="rounded bg-surface-2 p-1.5">
            <div className="text-muted">{f.cols.healingAging}</div>
            <div className="hex font-semibold">
              {ev.healingCounter} / {ev.agingCounter}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

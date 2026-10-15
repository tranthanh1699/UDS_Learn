import { Database } from 'lucide-react';
import { useState } from 'react';
import { dtcBytes, formatDtc } from '@/core/dtc/catalog';
import { getBit, isRelevant } from '@/core/dtc/faultModel';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useFaultsStore } from '@/store/faults';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const f = vi.faults;

/** Bảng DTC trong bộ nhớ ECU; bấm một dòng để xem status byte chi tiết. */
export function DtcTable({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const catalog = useFaultsStore((s) => s.catalog);
  const dtc = useFaultsStore((s) => s.dtc);
  const config = useFaultsStore((s) => s.config);
  const [showAll, setShowAll] = useState(false);
  const rows = catalog.filter((c) => showAll || isRelevant(dtc.events[c.id]!, dtc.injected));

  return (
    <Card>
      <CardHeader
        title={f.memoryTitle}
        icon={<Database className="h-4 w-4" />}
        extra={
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            {f.showAll}
          </label>
        }
      />
      <CardBody className="space-y-2">
        <p className="text-xs text-muted">{f.memoryHint}</p>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted">{f.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-2 py-2">{f.cols.dtc}</th>
                  <th className="px-2 py-2">{f.cols.code}</th>
                  <th className="px-2 py-2">{f.cols.component}</th>
                  <th className="px-2 py-2">{f.cols.ecu}</th>
                  <th className="px-2 py-2">{f.cols.status}</th>
                  <th className="px-2 py-2">{f.cols.debounce}</th>
                  <th className="px-2 py-2">{f.cols.cycles}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const ev = dtc.events[c.id]!;
                  const active = dtc.injected.includes(c.id);
                  const span = config.failThreshold - config.passThreshold;
                  const pct = ((ev.debounce - config.passThreshold) / span) * 100;
                  return (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onClick={() => onSelect(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && onSelect(c.id)}
                      className={cn('cursor-pointer border-t border-border hover:bg-surface-2/60', selected === c.id && 'bg-accent/10')}
                    >
                      <td className="hex whitespace-nowrap px-2 py-1.5 text-xs">{dtcBytes(c.dtc)}</td>
                      <td className="hex whitespace-nowrap px-2 py-1.5 font-semibold">{formatDtc(c.dtc)}</td>
                      <td className="px-2 py-1.5 text-xs">
                        {vi.dtc.components[c.component]} – {vi.dtc.faultTypes[c.faultType]}
                        {active && (
                          <Badge tone="err" className="ml-1.5">
                            {f.active}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{vi.dtc.ecus[c.ecu]}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="hex font-semibold">0x{hex(ev.status)}</span>
                          <span className="flex gap-px" aria-hidden="true">
                            {[7, 6, 5, 4, 3, 2, 1, 0].map((b) => (
                              <span key={b} className={cn('h-3 w-1.5 rounded-sm', getBit(ev.status, b) ? 'bg-accent' : 'bg-border')} />
                            ))}
                          </span>
                        </div>
                      </td>
                      <td className="w-28 px-2 py-1.5">
                        <div className="relative h-2 rounded-full bg-border" title={String(ev.debounce)}>
                          <div
                            className={cn('absolute inset-y-0 left-0 rounded-full', ev.debounce > 0 ? 'bg-err' : 'bg-ok')}
                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                          />
                        </div>
                        <span className="hex text-[10px] text-muted">{ev.debounce}</span>
                      </td>
                      <td className="hex px-2 py-1.5 text-center">
                        {ev.failedCycles}/{config.confirmationThreshold}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

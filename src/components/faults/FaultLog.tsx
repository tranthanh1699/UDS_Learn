import { ScrollText } from 'lucide-react';
import { formatDtc } from '@/core/dtc/catalog';
import { getBit } from '@/core/dtc/faultModel';
import { STATUS_BIT_NAMES } from '@/core/dtc/types';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { useFaultsStore } from '@/store/faults';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const f = vi.faults;

/** Nhật ký các bước mô phỏng: chỉ hiển thị chi tiết DTC đang lỗi hoặc từng lỗi, phần còn lại gộp thành một dòng. */
export function FaultLog() {
  const log = useFaultsStore((s) => s.log);
  const catalog = useFaultsStore((s) => s.catalog);
  const injected = useFaultsStore((s) => s.dtc.injected);
  const startTime = log[0]?.t ?? 0;

  return (
    <Card>
      <CardHeader title={f.timeline} icon={<ScrollText className="h-4 w-4" />} />
      <CardBody className="max-h-[32rem] space-y-3 overflow-y-auto">
        {log.length === 0 && <p className="text-sm text-muted">{f.timelineEmpty}</p>}
        {[...log].reverse().map((entry) => {
          const relevant = entry.changes.filter(
            (c) => injected.includes(c.eventId) || getBit(c.statusAfter, 5) || getBit(c.statusBefore, 5) || c.bitChanges.some((b) => [0, 2, 3, 7].includes(b.bit)),
          );
          const others = entry.changes.length - relevant.length;
          return (
            <div key={entry.id} className="border-l-2 border-accent/40 pl-3 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="hex text-muted">{((entry.t - startTime) / 1000).toFixed(1)} s</span>
                <span className="font-semibold">{entry.title}</span>
              </div>
              {entry.notes.map((n) => (
                <div key={n} className="text-muted">
                  {n}
                </div>
              ))}
              {relevant.map((c) => {
                const e = catalog.find((x) => x.id === c.eventId)!;
                return (
                  <div key={c.eventId} className="mt-1.5 rounded bg-surface-2/60 p-2">
                    <div className="hex font-semibold">
                      {formatDtc(e.dtc)} · 0x{hex(c.statusBefore)} → 0x{hex(c.statusAfter)}
                    </div>
                    {c.bitChanges.map((b) => (
                      <div key={b.bit}>
                        <span className="hex text-warn">
                          bit{b.bit} {STATUS_BIT_NAMES[b.bit]} {b.from}→{b.to}
                        </span>
                        : {b.reason}
                      </div>
                    ))}
                    {c.notes.map((n) => (
                      <div key={n} className="text-muted">
                        • {n}
                      </div>
                    ))}
                  </div>
                );
              })}
              {others > 0 && <div className="mt-1 text-muted">{f.otherPassed(others)}</div>}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

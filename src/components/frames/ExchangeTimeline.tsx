import { Info } from 'lucide-react';
import type { Exchange } from '@/core/trace/exchange';
import { hexBytes } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import type { TraceEntry } from '@/store/trace';
import { Badge } from '@/components/ui/Badge';
import { FrameCard } from './FrameCard';

const OUTCOME_TONE = { positive: 'ok', negative: 'err', suppressed: 'neutral', noResponse: 'warn' } as const;

export function ExchangeHeader({ exchange }: { exchange: Exchange }) {
  const r = exchange.result;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="hex font-semibold">{hexBytes(r.request)}</span>
      <span className="text-muted">→</span>
      <Badge tone={OUTCOME_TONE[r.outcome]}>{vi.result.outcome[r.outcome]}</Badge>
      {r.outcome === 'suppressed' && <span className="text-muted">{vi.frame.suppressedTag}</span>}
      {exchange.auto && <Badge>{vi.frame.autoTag}</Badge>}
    </div>
  );
}

/** Danh sách trao đổi mới nhất ở trên cùng; mỗi trao đổi gồm các FrameCard của nó. */
export function ExchangeTimeline({ entries, startTime, limit = 20 }: { entries: readonly TraceEntry[]; startTime: number; limit?: number }) {
  if (entries.length === 0) return <p className="text-sm text-muted">{vi.frame.empty}</p>;
  const shown = entries.slice(-limit).reverse();
  return (
    <div className="space-y-4">
      {shown.map((entry) =>
        entry.type === 'event' ? (
          <div key={`e${entry.event.id}`} className="flex gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-xs">
            <Info className="h-4 w-4 shrink-0 text-warn" />
            <div>
              <div className="font-semibold">{vi.frame.event}</div>
              {entry.event.messages.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          </div>
        ) : (
          <div key={entry.exchange.id} className="space-y-1.5">
            <ExchangeHeader exchange={entry.exchange} />
            {entry.exchange.frames.map((frame, i) => (
              <FrameCard key={frame.id} frame={frame} startTime={startTime} index={i} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}

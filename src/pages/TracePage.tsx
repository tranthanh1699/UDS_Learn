import { Download, Pause, Play, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { formatCanId } from '@/core/can/frame';
import type { Exchange, TraceFrame } from '@/core/trace/exchange';
import { frameInfo, framesToCsv } from '@/core/trace/summary';
import { ALL_NRC_CODES, nrcName } from '@/core/uds/nrc';
import { SERVICE_NAMES } from '@/core/uds/serviceNames';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useTraceStore, type TraceEntry } from '@/store/trace';
import { ByteRow } from '@/components/frames/ByteRow';
import { BYTE_KIND_CLASSES } from '@/components/frames/byteStyles';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

const t = vi.trace;
const inputCls = 'h-9 rounded-md border border-border bg-bg px-2.5 text-sm outline-none focus:border-accent';
const MAX_ROWS = 1000;

type Row = { type: 'frame'; frame: TraceFrame; exchange: Exchange } | { type: 'event'; id: number; t: number; messages: string[] };

function flatten(entries: readonly TraceEntry[]): Row[] {
  const rows: Row[] = [];
  for (const e of entries) {
    if (e.type === 'event') rows.push({ type: 'event', id: e.event.id, t: e.event.t, messages: e.event.messages });
    else for (const frame of e.exchange.frames) rows.push({ type: 'frame', frame, exchange: e.exchange });
  }
  return rows;
}

export function TracePage() {
  const entries = useTraceStore((s) => s.entries);
  const startTime = useTraceStore((s) => s.startTime);
  const clear = useTraceStore((s) => s.clear);
  const [frozen, setFrozen] = useState<readonly TraceEntry[] | null>(null);
  const [idFilter, setIdFilter] = useState('');
  const [sidFilter, setSidFilter] = useState('');
  const [nrcFilter, setNrcFilter] = useState('');
  const [hideAuto, setHideAuto] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const source = frozen ?? entries;
  const allRows = useMemo(() => flatten(source), [source]);
  const rows = useMemo(() => {
    const id = idFilter.trim().replace(/^0x/i, '').toUpperCase();
    return allRows
      .filter((r) => {
        if (r.type === 'event') return !idFilter && !sidFilter && !nrcFilter;
        const { frame, exchange } = r;
        if (hideAuto && exchange.auto) return false;
        if (id && !formatCanId(frame.canId, frame.idType).includes(id)) return false;
        if (sidFilter && exchange.result.sid !== Number(sidFilter)) return false;
        if (nrcFilter === 'neg' && exchange.result.outcome !== 'negative') return false;
        if (nrcFilter && nrcFilter !== 'neg' && exchange.result.nrc !== Number(nrcFilter)) return false;
        return true;
      })
      .slice(-MAX_ROWS);
  }, [allRows, idFilter, sidFilter, nrcFilter, hideAuto]);
  const frameRows = rows.filter((r): r is Extract<Row, { type: 'frame' }> => r.type === 'frame');
  const pendingNew = frozen ? flatten(entries).length - allRows.length : 0;

  const exportCsv = () => {
    const blob = new Blob([framesToCsv(frameRows, startTime)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uds-lab-trace.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title={vi.pages.trace.title} subtitle={vi.pages.trace.subtitle} />
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{t.filterId}</span>
            <input value={idFilter} onChange={(e) => setIdFilter(e.target.value)} placeholder="7E8" className={cn(inputCls, 'hex w-28 uppercase')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{t.filterService}</span>
            <select value={sidFilter} onChange={(e) => setSidFilter(e.target.value)} className={inputCls}>
              <option value="">{t.all}</option>
              {Object.entries(SERVICE_NAMES).map(([sid, name]) => (
                <option key={sid} value={sid}>
                  0x{hex(Number(sid))} {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{t.filterNrc}</span>
            <select value={nrcFilter} onChange={(e) => setNrcFilter(e.target.value)} className={inputCls}>
              <option value="">{t.all}</option>
              <option value="neg">{t.negativeOnly}</option>
              {ALL_NRC_CODES.map((c) => (
                <option key={c} value={c}>
                  0x{hex(c)} {nrcName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={hideAuto} onChange={(e) => setHideAuto(e.target.checked)} />
            {t.hideAuto}
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button onClick={() => setFrozen(frozen ? null : entries)}>
              {frozen ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {frozen ? t.resume : t.pause}
            </Button>
            <Button
              onClick={() => {
                clear();
                setFrozen(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> {t.clear}
            </Button>
            <Button onClick={exportCsv} disabled={frameRows.length === 0}>
              <Download className="h-4 w-4" /> {t.exportCsv}
            </Button>
          </div>
        </CardBody>
      </Card>
      {frozen && <p className="mb-2 text-xs text-warn">{t.pausedNote(pendingNew)}</p>}
      <p className="mb-2 text-xs text-muted">{t.count(frameRows.length, allRows.filter((r) => r.type === 'frame').length)}</p>

      <Card>
        {rows.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">{t.empty}</p>
          </CardBody>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                <tr>
                  <th className="px-2 py-2">{t.cols.time}</th>
                  <th className="px-2 py-2">{t.cols.dir}</th>
                  <th className="px-2 py-2">{t.cols.id}</th>
                  <th className="px-2 py-2">{t.cols.type}</th>
                  <th className="px-2 py-2">{t.cols.dlc}</th>
                  <th className="px-2 py-2">{t.cols.data}</th>
                  <th className="px-2 py-2">{t.cols.info}</th>
                </tr>
              </thead>
              <tbody className="hex">
                {rows.map((r) =>
                  r.type === 'event' ? (
                    <tr key={`e${r.id}`} className="border-t border-border bg-warn/10 font-sans">
                      <td className="hex px-2 py-1.5 text-muted">{((r.t - startTime) / 1000).toFixed(3)}</td>
                      <td colSpan={6} className="px-2 py-1.5">
                        {r.messages.join(' ')}
                      </td>
                    </tr>
                  ) : (
                    <Fragment key={r.frame.id}>
                      <tr
                        tabIndex={0}
                        onClick={() => setExpanded(expanded === r.frame.id ? null : r.frame.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === r.frame.id ? null : r.frame.id)}
                        className={cn('cursor-pointer border-t border-border hover:bg-surface-2/60', expanded === r.frame.id && 'bg-accent/10')}
                      >
                        <td className="px-2 py-1 text-muted">{((r.frame.t - startTime) / 1000).toFixed(3)}</td>
                        <td className={cn('px-2 py-1 font-semibold', r.frame.dir === 'Tx' ? 'text-byte-sid' : 'text-byte-data')}>{r.frame.dir}</td>
                        <td className="px-2 py-1">{formatCanId(r.frame.canId, r.frame.idType)}</td>
                        <td className="px-2 py-1 font-sans">{r.frame.kind}</td>
                        <td className="px-2 py-1">{r.frame.dlc}</td>
                        <td className="px-2 py-1">
                          {r.frame.annotations.map((a) => (
                            <span key={a.index} className={cn('mr-1', BYTE_KIND_CLASSES[a.kind].split(' ').find((c) => c.startsWith('text-')))}>
                              {hex(a.value)}
                            </span>
                          ))}
                        </td>
                        <td className="px-2 py-1 font-sans">{frameInfo(r.frame, r.exchange)}</td>
                      </tr>
                      {expanded === r.frame.id && (
                        <tr className="bg-surface-2/40">
                          <td colSpan={7} className="px-3 py-2 font-sans">
                            <ByteRow annotations={r.frame.annotations} size="sm" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

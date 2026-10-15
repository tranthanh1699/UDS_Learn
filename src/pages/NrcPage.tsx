import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_NRC_CODES, nrcName } from '@/core/uds/nrc';
import { hex } from '@/core/util/hex';
import { SERVICES_META } from '@/data/services-meta';
import { vi, type ServiceSidKey } from '@/i18n/vi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';

const t = vi.nrcPage;

/** Những tình huống trong simulator trả NRC này: lấy từ bảng NRC trong nội dung học của từng service. */
function simulatorTriggers(code: number): { service: string; trigger: string }[] {
  const list = Object.entries(SERVICES_META).flatMap(([sid, content]) =>
    content!.nrcs.filter((n) => n.nrc === code).map((n) => ({ service: `0x${sid} ${vi.services[sid as ServiceSidKey].name}`, trigger: n.trigger })),
  );
  const generic = t.generic[code];
  return generic ? [...list, { service: '—', trigger: generic }] : list;
}

export function NrcPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const openCode = params.get('code') ? parseInt(params.get('code')!, 16) : null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^0x/, '');
    return ALL_NRC_CODES.filter((c) => {
      if (!q) return true;
      const text = `${hex(c)} ${nrcName(c)} ${vi.nrc[c]?.meaning ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [query]);

  const open = (code: number | null) => setParams(code === null ? {} : { code: hex(code) }, { replace: true });
  const info = openCode !== null ? vi.nrc[openCode] : undefined;
  const triggers = openCode !== null ? simulatorTriggers(openCode) : [];

  return (
    <>
      <PageHeader title={vi.pages.nrc.title} subtitle={vi.pages.nrc.subtitle} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">{t.cols.code}</th>
                  <th className="px-3 py-2">{t.cols.name}</th>
                  <th className="px-3 py-2">{t.cols.meaning}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c}
                    tabIndex={0}
                    onClick={() => open(c)}
                    onKeyDown={(e) => e.key === 'Enter' && open(c)}
                    className="cursor-pointer border-t border-border align-top hover:bg-surface-2/60"
                  >
                    <td className="hex whitespace-nowrap px-3 py-2 font-semibold text-byte-nrc">0x{hex(c)}</td>
                    <td className="hex px-3 py-2">{nrcName(c)}</td>
                    <td className="px-3 py-2 text-muted">{vi.nrc[c]?.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={openCode !== null && info !== undefined}
        onOpenChange={(o) => !o && open(null)}
        title={openCode !== null ? `NRC 0x${hex(openCode)} — ${nrcName(openCode)}` : ''}
        footer={<Button onClick={() => open(null)}>{t.close}</Button>}
      >
        {info && (
          <div className="space-y-3 text-fg">
            {(
              [
                [t.meaning, info.meaning],
                [t.cause, info.cause],
                [t.fix, info.fix],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs font-semibold text-muted">{k}</div>
                <p>{v}</p>
              </div>
            ))}
            <div>
              <div className="text-xs font-semibold text-muted">{t.inSimulator}</div>
              {triggers.length === 0 ? (
                <p className="text-muted">{t.notInSimulator}</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {triggers.map((tr) => (
                    <li key={tr.service + tr.trigger}>
                      <span className="hex text-xs text-accent">{tr.service}</span> — {tr.trigger}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted">{t.iso}</p>
          </div>
        )}
      </Dialog>
    </>
  );
}

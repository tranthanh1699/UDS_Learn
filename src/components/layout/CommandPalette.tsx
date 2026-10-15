import * as RD from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_NRC_CODES, nrcName } from '@/core/uds/nrc';
import { hex } from '@/core/util/hex';
import { MVP_SERVICES, NAV_GROUPS } from '@/data/navigation';
import { SCENARIOS } from '@/data/scenarios';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';
import { useUiStore } from '@/store/ui';

const p = vi.palette;

interface Item {
  id: string;
  group: keyof typeof p.groups;
  label: string;
  hint?: string;
  run: () => void;
}

/** Bỏ dấu tiếng Việt để tìm "tra cuu" vẫn ra "Tra cứu". */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Bảng lệnh Ctrl+K: tìm và mở nhanh trang, service, NRC, kịch bản hoặc chạy hành động. */
export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => navigate(to);
    const pages = NAV_GROUPS.flatMap((g) => g.items)
      .filter((it) => !it.sid)
      .map((it): Item => ({ id: `page:${it.to}`, group: 'pages', label: it.label, run: go(it.to) }));
    const services = MVP_SERVICES.map((sid): Item => ({
      id: `svc:${sid}`,
      group: 'services',
      label: `0x${sid} ${vi.services[sid].name}`,
      hint: vi.services[sid].short,
      run: go(`/service/${sid}`),
    }));
    const nrcs = ALL_NRC_CODES.map((c): Item => ({
      id: `nrc:${c}`,
      group: 'nrc',
      label: `NRC 0x${hex(c)} ${nrcName(c)}`,
      hint: vi.nrc[c]?.meaning,
      run: go(`/nrc?code=${hex(c)}`),
    }));
    const scenarios = SCENARIOS.map((s): Item => ({ id: `sc:${s.id}`, group: 'scenarios', label: `(${s.id}) ${s.title}`, run: go(`/scenarios?id=${s.id}`) }));
    const actions: Item[] = [
      { id: 'act:theme', group: 'actions', label: p.toggleTheme, run: () => useUiStore.getState().toggleTheme() },
      {
        id: 'act:tp',
        group: 'actions',
        label: p.toggleAutoTp,
        run: () => {
          const rt = useEcuRuntimeStore.getState();
          rt.setAutoTesterPresent(!rt.autoTesterPresent);
        },
      },
    ];
    return [...pages, ...services, ...scenarios, ...actions, ...nrcs];
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    const words = q.split(/\s+/);
    return items.filter((it) => {
      const text = normalize(`${it.label} ${it.hint ?? ''}`);
      return words.every((w) => text.includes(w));
    });
  }, [items, query]);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    setOpen(false);
    setQuery('');
    it.run();
  };

  let lastGroup = '';
  return (
    <RD.Root open={open} onOpenChange={setOpen}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(filtered[active]);
            }
          }}
        >
          <RD.Title className="sr-only">{p.open}</RD.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={p.placeholder}
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
            />
          </div>
          <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{p.empty}</li>}
            {filtered.map((it, i) => {
              const header = it.group !== lastGroup ? p.groups[it.group] : null;
              lastGroup = it.group;
              return (
                <li key={it.id} role="presentation">
                  {header && <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{header}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(it)}
                    className={cn('flex w-full items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left text-sm', i === active && 'bg-accent/15 text-accent')}
                  >
                    <span className="shrink-0">{it.label}</span>
                    {it.hint && <span className="truncate text-xs text-muted">{it.hint}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted">{p.hint}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

import { Plug, PlugZap, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { COMPONENT_IDS, dtcBytes, formatDtc } from '@/core/dtc/catalog';
import type { ComponentId } from '@/core/dtc/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useFaultsStore } from '@/store/faults';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const f = vi.faults;
const selectCls = 'h-9 w-full rounded-md border border-border bg-bg px-2.5 text-sm outline-none focus:border-accent';

function effectText(c: ComponentId): string {
  if (c === 'battery') return f.effectBattery;
  if (c.startsWith('wss')) return f.effectWss;
  return f.effectNone;
}

/** Chọn linh kiện + loại lỗi, rồi Inject / Gỡ lỗi. */
export function InjectPanel({ component, onComponent }: { component: ComponentId; onComponent: (c: ComponentId) => void }) {
  const catalog = useFaultsStore((s) => s.catalog);
  const injected = useFaultsStore((s) => s.dtc.injected);
  const inject = useFaultsStore((s) => s.inject);
  const remove = useFaultsStore((s) => s.remove);
  const removeAll = useFaultsStore((s) => s.removeAll);
  const entries = catalog.filter((c) => c.component === component);
  const [faultId, setFaultId] = useState(entries[0]?.id ?? '');
  const entry = entries.find((e) => e.id === faultId) ?? entries[0];
  const isActive = entry ? injected.includes(entry.id) : false;

  return (
    <Card>
      <CardHeader title={f.pickComponent} icon={<PlugZap className="h-4 w-4" />} />
      <CardBody className="space-y-3">
        <select
          aria-label={f.pickComponent}
          value={component}
          onChange={(e) => {
            const c = e.target.value as ComponentId;
            onComponent(c);
            setFaultId(catalog.find((x) => x.component === c)?.id ?? '');
          }}
          className={selectCls}
        >
          {COMPONENT_IDS.map((c) => (
            <option key={c} value={c}>
              {vi.dtc.components[c]}
              {catalog.some((x) => x.component === c && injected.includes(x.id)) ? ` — ${f.active}` : ''}
            </option>
          ))}
        </select>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium text-muted">{f.pickFault}</legend>
          {entries.map((e) => (
            <label key={e.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', e.id === entry?.id ? 'border-accent bg-accent/10' : 'border-border')}>
              <input type="radio" name="faultType" checked={e.id === entry?.id} onChange={() => setFaultId(e.id)} />
              <span className="flex-1">{vi.dtc.faultTypes[e.faultType]}</span>
              {injected.includes(e.id) && <Badge tone="err">{f.active}</Badge>}
            </label>
          ))}
        </fieldset>
        {entry && (
          <div className="rounded-md bg-surface-2/60 p-2.5 text-xs">
            <div>
              <span className="text-muted">{f.dtcLabel}: </span>
              <span className="hex font-semibold">{formatDtc(entry.dtc)}</span>
              <span className="hex text-muted"> ({dtcBytes(entry.dtc)})</span> · {vi.dtc.ecus[entry.ecu]}
              <Badge className="ml-2">{f.example}</Badge>
            </div>
            <p className="mt-1 text-muted">{effectText(component)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!entry || isActive} onClick={() => entry && inject(entry.id)}>
            <PlugZap className="h-4 w-4" /> {f.inject}
          </Button>
          <Button disabled={!isActive} onClick={() => entry && remove(entry.id)}>
            <Plug className="h-4 w-4" /> {f.remove}
          </Button>
          <Button variant="ghost" disabled={injected.length === 0} onClick={removeAll}>
            <Trash2 className="h-4 w-4" /> {f.removeAll}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

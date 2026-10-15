import { Network, Timer } from 'lucide-react';
import { PADDING_OPTIONS } from '@/core/can/padding';
import { decodeStMin } from '@/core/isotp/stmin';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { LiveVehicleNetwork } from '@/components/uds/LiveVehicleNetwork';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, HexNumberInput, NumberInput, inputCls } from './fields';

const t = vi.config.can;

const SAMPLE_29 = { requestId: 0x18da10f1, responseId: 0x18daf110, functionalId: 0x18db33f1 };
const SAMPLE_11 = { requestId: 0x7e0, responseId: 0x7e8, functionalId: 0x7df };

export function CanTab() {
  const can = useVehicleConfigStore((s) => s.draft.can);
  const timing = useVehicleConfigStore((s) => s.draft.timing);
  const update = useVehicleConfigStore((s) => s.update);
  const idWidth = can.idType === 'standard' ? 3 : 8;
  const idMax = can.idType === 'standard' ? 0x7ff : 0x1fffffff;
  const st = decodeStMin(can.stMin);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader title={t.title} icon={<Network className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-muted">{t.idType}</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(['standard', 'extended'] as const).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" checked={can.idType === k} onChange={() => update((d) => void (d.can.idType = k))} />
                    {k === 'standard' ? t.standard : t.extended}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['requestId', 'responseId', 'functionalId'] as const).map((k) => (
                <Field key={k} label={t[k]}>
                  {(id) => <HexNumberInput id={id} value={can[k]} width={idWidth} max={idMax} onChange={(v) => update((d) => void (d.can[k] = v))} />}
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => update((d) => Object.assign(d.can, { idType: 'extended' }, SAMPLE_29))}>
                {t.use29Sample}
              </Button>
              <Button size="sm" onClick={() => update((d) => Object.assign(d.can, { idType: 'standard' }, SAMPLE_11))}>
                {t.use11Sample}
              </Button>
            </div>
            <p className="text-xs text-muted">{t.use29SampleHint}</p>

            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-muted">{t.protocol}</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {[false, true].map((fd) => (
                  <label key={String(fd)} className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" checked={can.fd === fd} onChange={() => update((d) => void (d.can.fd = fd))} />
                    {fd ? t.fd : t.classic}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={t.padding}>
              {(id) => (
                <select
                  id={id}
                  value={can.padding === null ? 'none' : String(can.padding)}
                  onChange={(e) => update((d) => void (d.can.padding = e.target.value === 'none' ? null : Number(e.target.value)))}
                  className={inputCls}
                >
                  {PADDING_OPTIONS.map((p) => (
                    <option key={String(p)} value={p === null ? 'none' : String(p)}>
                      {p === null ? t.paddingNone : `0x${hex(p)}`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`${t.isotpTitle} · ${t.timingTitle}`} icon={<Timer className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.bs} hint={t.bsHint}>
                {(id) => <NumberInput id={id} value={can.bs} min={0} max={255} onChange={(v) => update((d) => void (d.can.bs = v))} />}
              </Field>
              <Field label={t.stMin} hint={t.stMinHint(vi.annotate.meanings.stMinValue(st.microseconds, st.reserved))}>
                {(id) => <HexNumberInput id={id} value={can.stMin} max={0xff} onChange={(v) => update((d) => void (d.can.stMin = v))} />}
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['p2Ms', 'p2StarMs', 's3Ms'] as const).map((k) => (
                <Field key={k} label={k === 'p2Ms' ? t.p2 : k === 'p2StarMs' ? t.p2Star : t.s3}>
                  {(id) => <NumberInput id={id} value={timing[k]} min={1} onChange={(v) => update((d) => void (d.timing[k] = v))} />}
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted">{t.timingHint}</p>
          </CardBody>
        </Card>
      </div>
      <LiveVehicleNetwork />
    </div>
  );
}

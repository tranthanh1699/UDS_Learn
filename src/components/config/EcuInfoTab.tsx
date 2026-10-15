import { Cpu } from 'lucide-react';
import { asciiBytes, hex } from '@/core/util/hex';
import { validateVin } from '@/core/vehicle/validate';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, inputCls } from './fields';

const t = vi.config.ecu;

/** Các trường ECU gắn trực tiếp với DID phổ biến; sửa trường = sửa dữ liệu (và độ dài) của DID. */
const LINKED = [
  { did: 0xf190, label: t.vin, maxLength: 17, upper: true },
  { did: 0xf187, label: t.partNumber, maxLength: 32 },
  { did: 0xf195, label: t.swVersion, maxLength: 32 },
  { did: 0xf18c, label: t.serial, maxLength: 32 },
];

export function EcuInfoTab() {
  const draft = useVehicleConfigStore((s) => s.draft);
  const update = useVehicleConfigStore((s) => s.update);

  return (
    <Card>
      <CardHeader title={t.title} icon={<Cpu className="h-4 w-4" />} />
      <CardBody className="max-w-2xl space-y-4">
        <Field label={t.name}>
          {(id) => <input id={id} value={draft.ecuName} maxLength={40} onChange={(e) => update((d) => void (d.ecuName = e.target.value))} className={inputCls} />}
        </Field>
        <div className="flex items-start gap-2 rounded-lg bg-surface-2/60 p-3 text-xs text-muted">
          <Badge tone="accent" className="shrink-0">
            {t.commonDid}
          </Badge>
          <span>{t.commonDidHint}</span>
        </div>
        {LINKED.map(({ did, label, maxLength, upper }) => {
          const def = draft.dids.find((d) => d.did === did);
          const value = def ? String.fromCharCode(...def.data) : '';
          const vinErrors = did === 0xf190 && def ? validateVin(value) : [];
          return (
            <Field key={did} label={label} hint={did === 0xf190 ? t.vinHint : undefined} error={!def ? t.missingDid(hex(did, 4)) : vinErrors[0]}>
              {(id) => (
                <input
                  id={id}
                  value={value}
                  disabled={!def}
                  maxLength={maxLength}
                  aria-invalid={vinErrors.length > 0}
                  onChange={(e) => {
                    const text = upper ? e.target.value.toUpperCase() : e.target.value;
                    update((d) => {
                      const target = d.dids.find((x) => x.did === did);
                      if (!target) return;
                      target.data = asciiBytes(text);
                      target.length = text.length;
                    });
                  }}
                  className={cn(inputCls, 'hex')}
                />
              )}
            </Field>
          );
        })}
      </CardBody>
    </Card>
  );
}

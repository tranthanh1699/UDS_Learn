import { Gauge as GaugeIcon, Power, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dashboard } from '@/assets/svg/Dashboard';
import type { Gear } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useEffectiveConditions, useFaultsStore } from '@/store/faults';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';

const t = vi.config.conditions;
const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

function Row({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="hex font-semibold">{value}</span>
      </div>
      {children}
    </div>
  );
}

/** Bảng đồng hồ gắn với điều kiện xe hiện tại và đèn cảnh báo từ trạng thái lỗi. */
export function LiveDashboard() {
  const c = useEffectiveConditions();
  const milOn = useFaultsStore((s) => s.milOn);
  const absOn = useFaultsStore((s) => s.absLampOn);
  return <Dashboard conditions={c} milOn={milOn} absOn={absOn} />;
}

export function ConditionsTab() {
  const c = useVehicleConfigStore((s) => s.draft.conditions);
  const set = useVehicleConfigStore((s) => s.setConditions);
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader title={t.title} icon={<SlidersHorizontal className="h-4 w-4" />} />
        <CardBody className="space-y-5">
          <Row label={t.speed} value={`${c.speedKmh} ${vi.units.kmh}`}>
            <Slider label={t.speed} value={c.speedKmh} min={0} max={240} onChange={(v) => set({ speedKmh: v })} />
          </Row>
          <Switch checked={c.engineRunning} onCheckedChange={(on) => set({ engineRunning: on })} label={t.engine} hint={t.engineHint} />
          <Row label={t.rpm} value={`${c.rpm} rpm`}>
            <Slider label={t.rpm} value={c.rpm} min={0} max={8000} step={50} onChange={(v) => set({ rpm: v })} />
          </Row>
          <Row label={t.voltage} value={`${formatNumber(c.batteryVoltage, 1)} ${vi.units.volt}`}>
            <Slider label={t.voltage} value={c.batteryVoltage} min={9} max={16} step={0.1} onChange={(v) => set({ batteryVoltage: Math.round(v * 10) / 10 })} />
          </Row>
          <div className="space-y-2">
            <div className="text-sm">{t.gear}</div>
            <div className="flex gap-2" role="radiogroup" aria-label={t.gear}>
              {GEARS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={c.gear === g}
                  onClick={() => set({ gear: g })}
                  className={cn('hex h-10 w-12 rounded-md border text-lg font-bold', c.gear === g ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted')}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted">{t.hint}</p>
        </CardBody>
      </Card>
      <div className="space-y-4 xl:col-span-3">
        <Card>
          <CardHeader title={t.dashboard} icon={<GaugeIcon className="h-4 w-4" />} />
          <CardBody>
            <LiveDashboard />
          </CardBody>
        </Card>
        <EcuResetSettings />
      </div>
    </div>
  );
}

function EcuResetSettings() {
  const r = useVehicleConfigStore((s) => s.draft.ecuReset);
  const update = useVehicleConfigStore((s) => s.update);
  const e = vi.config.ecuReset;
  return (
    <Card>
      <CardHeader title={e.title} icon={<Power className="h-4 w-4" />} />
      <CardBody className="space-y-3">
        <Switch
          checked={r.requireStandstill}
          onCheckedChange={(v) => update((d) => void (d.ecuReset.requireStandstill = v))}
          label={e.requireStandstill}
          hint={e.requireStandstillHint}
        />
        <Switch
          checked={r.requireEngineOff}
          onCheckedChange={(v) => update((d) => void (d.ecuReset.requireEngineOff = v))}
          label={e.requireEngineOff}
          hint={e.requireEngineOffHint}
        />
      </CardBody>
    </Card>
  );
}

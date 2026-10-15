import { Eraser, FlaskConical, KeyRound, Play, Square, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DtcModelConfig } from '@/core/dtc/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useFaultsStore } from '@/store/faults';
import { Field, NumberInput } from '@/components/config/fields';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';

const f = vi.faults;
const PARAMS: (keyof DtcModelConfig)[] = ['failStep', 'passStep', 'failThreshold', 'passThreshold', 'confirmationThreshold', 'healingCycles', 'agingCycles'];

export function SimulationControls() {
  const dtc = useFaultsStore((s) => s.dtc);
  const config = useFaultsStore((s) => s.config);
  const { startCycle, endCycle, runTests, clearAll, setConfig } = useFaultsStore.getState();
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!auto || !dtc.cycleActive) return;
    const id = window.setInterval(() => useFaultsStore.getState().runTests(), 1000);
    return () => window.clearInterval(id);
  }, [auto, dtc.cycleActive]);

  return (
    <Card>
      <CardHeader title={f.simTitle} icon={<FlaskConical className="h-4 w-4" />} />
      <CardBody className="space-y-4">
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm', dtc.cycleActive ? 'bg-ok/10 text-ok' : 'bg-surface-2 text-muted')}>
          <KeyRound className="h-4 w-4" />
          {dtc.cycleActive ? f.cycleOn(dtc.cycleCount + 1) : f.cycleOff}
        </div>
        <div className="flex flex-wrap gap-2">
          {dtc.cycleActive ? (
            <Button onClick={endCycle}>
              <Square className="h-4 w-4" /> {f.endCycle}
            </Button>
          ) : (
            <Button onClick={startCycle}>
              <Play className="h-4 w-4" /> {f.startCycle}
            </Button>
          )}
          <Button variant="primary" disabled={!dtc.cycleActive} onClick={runTests} title={f.runTestHint}>
            <Timer className="h-4 w-4" /> {f.runTest}
          </Button>
          <Button variant="ghost" onClick={clearAll}>
            <Eraser className="h-4 w-4" /> {f.clearAll}
          </Button>
        </div>
        <Switch checked={auto} onCheckedChange={setAuto} label={f.autoTest} hint={f.runTestHint} />
        <details className="rounded-md border border-border p-2.5">
          <summary className="cursor-pointer text-sm font-medium">{f.params}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {PARAMS.map((k) => (
              <Field key={k} label={f[k]}>
                {(id) => (
                  <NumberInput
                    id={id}
                    value={config[k]}
                    min={k === 'passThreshold' ? -100 : 1}
                    max={k === 'passThreshold' ? -1 : 100}
                    onChange={(v) => {
                      const n = Math.round(v);
                      if (k === 'passThreshold' ? n < 0 && n >= -100 : n >= 1 && n <= 100) setConfig({ [k]: n });
                    }}
                  />
                )}
              </Field>
            ))}
          </div>
        </details>
      </CardBody>
    </Card>
  );
}

import { Boxes, Car, Gauge, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { FaultView } from '@/assets/svg/FaultView';
import type { ComponentId } from '@/core/dtc/types';
import { vi } from '@/i18n/vi';
import { loadString, saveString } from '@/lib/storage';
import { useFaultsStore } from '@/store/faults';
import { LiveDashboard } from '@/components/config/ConditionsTab';
import { DtcTable } from '@/components/faults/DtcTable';
import { FaultLog } from '@/components/faults/FaultLog';
import { InjectPanel } from '@/components/faults/InjectPanel';
import { SimulationControls } from '@/components/faults/SimulationControls';
import { StatusByteView } from '@/components/faults/StatusByteView';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';

const f = vi.faults;

export function FaultsPage() {
  const catalog = useFaultsStore((s) => s.catalog);
  const injected = useFaultsStore((s) => s.dtc.injected);
  const [component, setComponent] = useState<ComponentId>('o2Sensor');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(() => loadString('faultsGuideSeen') !== '1');
  const faultyComponents = [...new Set(catalog.filter((c) => injected.includes(c.id)).map((c) => c.component))];
  // Mặc định hiển thị status byte của lỗi đang inject đầu tiên
  const eventToShow = selectedEvent ?? injected[0] ?? null;

  const closeGuide = (open: boolean) => {
    setGuideOpen(open);
    if (!open) saveString('faultsGuideSeen', '1');
  };

  return (
    <>
      <PageHeader
        title={vi.pages.faults.title}
        subtitle={vi.pages.faults.subtitle}
        badge={
          <Button size="sm" variant="ghost" onClick={() => setGuideOpen(true)}>
            <HelpCircle className="h-4 w-4" /> {f.guide.button}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader title={f.viewTitle} icon={<Car className="h-4 w-4" />} />
            <CardBody>
              <p className="mb-2 text-xs text-muted">{f.viewHint}</p>
              <FaultView faulty={faultyComponents} selected={component} onSelect={setComponent} />
            </CardBody>
          </Card>
          <DtcTable selected={eventToShow} onSelect={setSelectedEvent} />
          <StatusByteView eventId={eventToShow} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <InjectPanel key={component} component={component} onComponent={setComponent} />
          <SimulationControls />
          <Card>
            <CardHeader title={vi.config.conditions.dashboard} icon={<Gauge className="h-4 w-4" />} />
            <CardBody>
              <LiveDashboard />
            </CardBody>
          </Card>
          <FaultLog />
          <Card>
            <CardHeader title={f.autosarTitle} icon={<Boxes className="h-4 w-4" />} />
            <CardBody>
              <dl className="space-y-2 text-sm">
                {f.autosar.map((it) => (
                  <div key={it.name}>
                    <dt className="hex font-semibold text-accent">{it.name}</dt>
                    <dd className="text-muted">{it.desc}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={guideOpen}
        onOpenChange={closeGuide}
        title={f.guide.title}
        footer={
          <Button variant="primary" onClick={() => closeGuide(false)}>
            {f.guide.close}
          </Button>
        }
      >
        <ol className="list-decimal space-y-2 pl-5 text-fg">
          {f.guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}

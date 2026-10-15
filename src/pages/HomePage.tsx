import { Layers, PlayCircle, Sparkles } from 'lucide-react';
import { vi } from '@/i18n/vi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { LiveVehicleNetwork } from '@/components/uds/LiveVehicleNetwork';

const layerColors = ['border-l-byte-sid', 'border-l-byte-pci', 'border-l-byte-data'];

export function HomePage() {
  const p = vi.pages.home;
  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={p.whatIsTitle} icon={<Sparkles className="h-4 w-4" />} />
          <CardBody>
            <p className="text-sm leading-relaxed">{p.whatIsBody}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="hex text-sm">
                  <span className="text-byte-sid">22</span> <span className="text-byte-did">F1 90</span>
                </div>
                <div className="mt-1 text-xs text-muted">request</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="hex text-sm">
                  <span className="text-byte-sid">62</span> <span className="text-byte-did">F1 90</span>{' '}
                  <span className="text-byte-data">57 30 4C ...</span>
                </div>
                <div className="mt-1 text-xs text-muted">positive response</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={p.layersTitle} icon={<Layers className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {p.layers.map((layer, i) => (
              <div key={layer.name} className={`rounded-md border border-border border-l-4 ${layerColors[i]} bg-surface-2/50 px-3 py-2`}>
                <div className="text-sm font-semibold">{layer.name}</div>
                <div className="text-xs text-muted">{layer.desc}</div>
              </div>
            ))}
          </CardBody>
        </Card>
        <div className="lg:col-span-5">
          <LiveVehicleNetwork />
        </div>
        <Card className="lg:col-span-3">
          <CardHeader title={p.quickStartTitle} icon={<PlayCircle className="h-4 w-4" />} />
          <CardBody>
            <ol className="space-y-2 text-sm">
              {p.quickStart.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="hex flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={p.roadmapTitle} />
          <CardBody>
            <p className="text-sm text-muted">{p.roadmapBody}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

import { AlertTriangle, BookOpen, Boxes, FlaskConical, GitCompareArrows, ListChecks, Target, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { DEFAULT_SERVICES } from '@/core/uds/services';
import { nrcName } from '@/core/uds/nrc';
import { hex, hexBytes } from '@/core/util/hex';
import type { VehicleConfig } from '@/core/vehicle/types';
import type { ServiceExample, ServiceLearnContent } from '@/data/services-meta';
import { vi } from '@/i18n/vi';
import { runExample } from '@/lib/sandbox';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { FrameCard } from '@/components/frames/FrameCard';
import { ExchangeHeader } from '@/components/frames/ExchangeTimeline';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DecodeLines } from './DecodeLines';
import { InfoTable } from './InfoTable';
import { SequenceDiagram } from './SequenceDiagram';
import { SessionSecurityMatrix } from './SessionSecurityMatrix';

const l = vi.learn;

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function WorkedExample({ example, config }: { example: ServiceExample; config: VehicleConfig }) {
  const exchange = useMemo(() => runExample(config, example), [config, example]);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <div className="font-semibold">{example.title}</div>
        <p className="mt-0.5 text-sm text-muted">{example.description}</p>
      </div>
      {(example.setup || example.setupState) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">{l.setup}:</span>
          {example.setup?.map((r) => (
            <Badge key={hexBytes(r)} className="hex">
              {hexBytes(r)}
            </Badge>
          ))}
          {example.setupState?.unlockedLevel != null && <Badge>{l.setupState(l.unlocked(example.setupState.unlockedLevel))}</Badge>}
        </div>
      )}
      <ExchangeHeader exchange={exchange} />
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-md bg-surface-2/50 p-2">
          <SequenceDiagram frames={exchange.frames} />
        </div>
        <div className="space-y-3">
          {exchange.frames.map((frame, i) => (
            <div key={frame.id} className="space-y-1.5">
              <FrameCard frame={frame} index={i} />
              <DecodeLines annotations={frame.annotations} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tab "Học": nội dung lý thuyết + ví dụ có frame thật sinh từ engine. */
export function LearnTab({ content }: { content: ServiceLearnContent }) {
  const config = useVehicleConfigStore((s) => s.config);
  const def = DEFAULT_SERVICES.find((s) => hex(s.sid) === content.sid);
  const t = l.table;
  const tableRows = (rows: ServiceLearnContent['requestTable']) => rows.map((r) => [r.byte, r.field, r.size, r.value, r.meaning]);
  // Ưu tiên ví dụ nhiều frame để sơ đồ có cả Flow Control
  const { example: sequenceExample, exchange: sequenceExchange } = useMemo(() => {
    const runs = content.examples.map((example) => ({ example, exchange: runExample(config, example) }));
    return runs.find((r) => r.exchange.frames.length > 2) ?? runs[0]!;
  }, [config, content]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={l.sections.purpose} icon={<Target className="h-4 w-4" />}>
          <p className="text-sm leading-relaxed">{content.purpose}</p>
          <p className="mt-2 text-xs text-muted">
            {l.isoRef}: {content.isoRef}
          </p>
        </Section>
        <Section title={l.sections.useCases} icon={<ListChecks className="h-4 w-4" />}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {content.useCases.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title={l.sections.request} icon={<BookOpen className="h-4 w-4" />}>
        <InfoTable headers={[t.byte, t.field, t.size, t.value, t.meaning]} rows={tableRows(content.requestTable)} monoCols={[0, 3]} />
      </Section>
      <Section title={l.sections.response} icon={<BookOpen className="h-4 w-4" />}>
        <InfoTable headers={[t.byte, t.field, t.size, t.value, t.meaning]} rows={tableRows(content.responseTable)} monoCols={[0, 3]} />
      </Section>

      {content.subFunctions && (
        <Section title={l.sections.subFunctions} icon={<Boxes className="h-4 w-4" />}>
          <InfoTable
            headers={[l.subTable.value, l.subTable.name, l.subTable.meaning]}
            rows={content.subFunctions.map((s) => [s.value, s.name, s.meaning])}
            monoCols={[0]}
          />
        </Section>
      )}

      <Section title={l.sections.nrcs} icon={<AlertTriangle className="h-4 w-4" />}>
        <InfoTable
          headers={[l.nrcTable.nrc, l.nrcTable.name, l.nrcTable.trigger]}
          rows={content.nrcs.map((n) => ['0x' + hex(n.nrc), nrcName(n.nrc), n.trigger])}
          monoCols={[0]}
        />
      </Section>

      {def && (
        <Section title={l.sections.matrix} icon={<GitCompareArrows className="h-4 w-4" />}>
          <SessionSecurityMatrix def={def} config={config} />
        </Section>
      )}

      <Section title={l.sections.sequence} icon={<Workflow className="h-4 w-4" />}>
        <p className="mb-2 text-xs text-muted">{l.sequenceFor(sequenceExample.title)}</p>
        <div className="mx-auto max-w-2xl">
          <SequenceDiagram frames={sequenceExchange.frames} />
        </div>
      </Section>

      <Section title={l.sections.examples} icon={<FlaskConical className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-muted">{l.liveNote}</p>
        <div className="space-y-4">
          {content.examples.map((ex) => (
            <WorkedExample key={ex.title} example={ex} config={config} />
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={l.sections.mistakes} icon={<AlertTriangle className="h-4 w-4" />}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {content.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
        <Section title={l.sections.autosar} icon={<Boxes className="h-4 w-4" />}>
          <p className="mb-2 text-sm">{content.autosar.intro}</p>
          <dl className="space-y-2 text-sm">
            {content.autosar.items.map((it) => (
              <div key={it.name}>
                <dt className="hex font-semibold text-accent">{it.name}</dt>
                <dd className="text-muted">{it.desc}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}

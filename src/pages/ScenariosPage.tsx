import { CheckCircle2, Circle, Hourglass, Play, RotateCcw, Send, XCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Exchange } from '@/core/trace/exchange';
import { nrcName } from '@/core/uds/nrc';
import { hex, hexBytes } from '@/core/util/hex';
import { matchesExpectation, SCENARIOS, type Expectation, type ScenarioStep } from '@/data/scenarios';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useCountdown } from '@/hooks/useCountdown';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';
import { useFaultsStore } from '@/store/faults';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { ExchangeHeader } from '@/components/frames/ExchangeTimeline';
import { FrameCard } from '@/components/frames/FrameCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const t = vi.scenarios;
const BATTERY_FAULT = 'battery:outOfRangeLow';

function expectText(e: Expectation): string {
  if (e.outcome === 'negative' && e.nrc !== undefined) return t.outcome.negative(hex(e.nrc), nrcName(e.nrc));
  if (e.outcome === 'negative') return t.outcome.negative('??', '');
  return t.outcome[e.outcome];
}

interface StepResult {
  exchange?: Exchange;
  pass: boolean;
}

/** Một bước "chờ": hoàn thành khi điều kiện đạt (S3 hết hạn) hoặc hết thời gian chờ. */
function WaitIndicator({ deadline, onDone }: { deadline: number; onDone: () => void }) {
  const left = useCountdown(deadline);
  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);
  return (
    <span className="flex items-center gap-1.5 text-sm text-warn">
      <Hourglass className="h-4 w-4 animate-pulse" /> {t.waiting(((left ?? 0) / 1000).toFixed(1))}
    </span>
  );
}

export function ScenariosPage() {
  const [params, setParams] = useSearchParams();
  const scenario = SCENARIOS.find((s) => s.id === params.get('id')) ?? SCENARIOS[0]!;
  const config = useVehicleConfigStore((s) => s.config);
  const lastSeed = useEcuRuntimeStore((s) => s.lastSeed);
  const s3ExpiresAt = useEcuRuntimeStore((s) => s.s3ExpiresAt);
  const session = useEcuRuntimeStore((s) => s.session);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<Record<number, StepResult>>({});
  const [waitUntil, setWaitUntil] = useState<number | null>(null);

  const restart = () => {
    useEcuRuntimeStore.getState().resetEcu();
    useFaultsStore.getState().removeAll();
    setCurrent(0);
    setResults({});
    setWaitUntil(null);
  };

  // Đổi kịch bản thì làm lại từ bước đầu
  useEffect(() => {
    setCurrent(0);
    setResults({});
    setWaitUntil(null);
  }, [scenario.id]);

  const complete = (i: number, r: StepResult) => {
    setResults((cur) => ({ ...cur, [i]: r }));
    setCurrent(i + 1);
    setWaitUntil(null);
  };

  // Bước chờ S3: xong khi ECU đã quay về default session
  const step = scenario.steps[current];
  useEffect(() => {
    if (waitUntil !== null && step?.kind === 'action' && step.action === 'waitS3' && session === 'default') complete(current, { pass: true });
  }, [session, waitUntil, step, current]);

  const run = (i: number, s: ScenarioStep) => {
    const rt = useEcuRuntimeStore.getState();
    if (s.kind === 'request') {
      const req = s.build({ lastSeed: rt.lastSeed, config });
      if (!req) return;
      const exchange = rt.send(req, s.addressing ?? 'physical');
      const r = exchange.result;
      complete(i, { exchange, pass: matchesExpectation(s.expect, r.outcome, r.nrc, r.response) });
      return;
    }
    switch (s.action) {
      case 'autoTpOn':
        rt.setAutoTesterPresent(true);
        return complete(i, { pass: true });
      case 'autoTpOff':
        rt.setAutoTesterPresent(false);
        return complete(i, { pass: true });
      case 'injectBattery':
        useFaultsStore.getState().inject(BATTERY_FAULT);
        return complete(i, { pass: true });
      case 'removeBattery':
        useFaultsStore.getState().remove(BATTERY_FAULT);
        return complete(i, { pass: true });
      case 'waitS3':
        setWaitUntil(s3ExpiresAt ?? Date.now());
        return;
      case 'waitSecurityDelay':
        setWaitUntil(Date.now() + (config.security.levels[0]?.delayMs ?? 10000) + 300);
        return;
    }
  };

  return (
    <>
      <PageHeader title={vi.pages.scenarios.title} subtitle={vi.pages.scenarios.subtitle} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title={t.pick} />
          <CardBody className="space-y-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setParams({ id: s.id })}
                className={cn('w-full rounded-md border px-3 py-2 text-left text-sm', s.id === scenario.id ? 'border-accent bg-accent/10' : 'border-border hover:bg-surface-2')}
              >
                <div className="font-medium">
                  <span className="hex mr-1.5 text-accent">({s.id})</span>
                  {s.title}
                </div>
                <div className="text-xs text-muted">{s.summary}</div>
              </button>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={restart}>
              <RotateCcw className="h-4 w-4" /> {t.start}
            </Button>
            <span className="text-xs text-muted">{t.startHint}</span>
          </div>
          {scenario.steps.map((s, i) => {
            const res = results[i];
            const isCurrent = i === current;
            const preview = s.kind === 'request' ? s.build({ lastSeed, config }) : null;
            return (
              <Card key={i} className={cn(isCurrent && 'border-accent', !isCurrent && !res && 'opacity-70')}>
                <CardBody className="space-y-2">
                  <div className="flex items-start gap-2">
                    {res ? (
                      res.pass ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-err" />
                    ) : (
                      <Circle className={cn('mt-0.5 h-5 w-5 shrink-0', isCurrent ? 'text-accent' : 'text-muted')} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {i + 1}. {s.title}
                      </div>
                      <p className="text-sm text-muted">{s.explain}</p>
                    </div>
                  </div>
                  {s.kind === 'request' && (
                    <div className="flex flex-wrap items-center gap-3 pl-7 text-sm">
                      <span className="hex rounded bg-surface-2 px-2 py-1 font-semibold">{preview ? hexBytes(preview) : t.noSeed}</span>
                      <span className="text-xs text-muted">
                        {t.expected}: {expectText(s.expect)}
                      </span>
                      <Button size="sm" variant={isCurrent ? 'primary' : 'secondary'} disabled={!preview} onClick={() => run(i, s)}>
                        <Send className="h-3.5 w-3.5" /> {t.send}
                      </Button>
                    </div>
                  )}
                  {s.kind === 'action' && (
                    <div className="flex flex-wrap items-center gap-3 pl-7">
                      {isCurrent && waitUntil !== null ? (
                        <WaitIndicator deadline={waitUntil} onDone={() => s.action === 'waitSecurityDelay' && complete(i, { pass: true })} />
                      ) : (
                        <Button size="sm" variant={isCurrent ? 'primary' : 'secondary'} onClick={() => run(i, s)}>
                          {s.action.startsWith('wait') ? <Play className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />} {res ? t.done : t.run}
                        </Button>
                      )}
                    </div>
                  )}
                  {res?.exchange && (
                    <div className="space-y-1.5 pl-7">
                      <ExchangeHeader exchange={res.exchange} />
                      <p className={cn('text-xs', res.pass ? 'text-ok' : 'text-err')}>
                        {res.pass ? t.pass : `${t.fail}. ${t.failHint}`}
                      </p>
                      <p className="text-xs">{res.exchange.result.explanation}</p>
                      {res.exchange.frames.map((f, k) => (
                        <FrameCard key={f.id} frame={f} index={k} />
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
          {current >= scenario.steps.length && (
            <div className="flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm text-ok">
              <CheckCircle2 className="h-4 w-4" /> {t.completed}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

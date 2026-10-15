import { CheckCircle2, Eye, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FieldKind } from '@/core/annotate/types';
import { formatCanId } from '@/core/can/frame';
import type { TraceFrame } from '@/core/trace/exchange';
import { hex, hexBytes } from '@/core/util/hex';
import type { VehicleConfig } from '@/core/vehicle/types';
import type { ServiceLearnContent } from '@/data/services-meta';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { runExample } from '@/lib/sandbox';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { BYTE_KIND_CLASSES, BYTE_KIND_ORDER } from '@/components/frames/byteStyles';
import { DecodeLines } from '@/components/learn/DecodeLines';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

const x = vi.exercise;

interface Task {
  frame: TraceFrame;
  request: number[];
}

function randomTask(content: ServiceLearnContent, config: VehicleConfig): Task {
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!;
  const example = pick(content.exercises);
  const exchange = runExample(config, example, Math.floor(Math.random() * 0xffffffff));
  return { frame: pick(exchange.frames), request: exchange.result.request };
}

/** Tab "Bài tập decode": người học gán loại cho từng byte của một frame thật, app chấm và giải thích. */
export function ExerciseTab({ content }: { content: ServiceLearnContent }) {
  const config = useVehicleConfigStore((s) => s.config);
  const [task, setTask] = useState(() => randomTask(content, config));
  const [answers, setAnswers] = useState<Record<number, FieldKind | ''>>({});
  const [checked, setChecked] = useState(false);

  const next = useCallback(() => {
    setTask(randomTask(content, config));
    setAnswers({});
    setChecked(false);
  }, [content, config]);

  const { frame } = task;
  const correct = frame.annotations.filter((a) => answers[a.index] === a.kind).length;
  const total = frame.annotations.length;

  const reveal = () => {
    setAnswers(Object.fromEntries(frame.annotations.map((a) => [a.index, a.kind])));
    setChecked(true);
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">{x.intro}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{x.frameInfo(frame.dir, vi.isotp.frameKind[frame.kind], formatCanId(frame.canId, frame.idType))}</span>
          <span className="text-xs text-muted">· {x.requestOf(hexBytes(task.request))}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {frame.annotations.map((a) => {
            const answer = answers[a.index] ?? '';
            const ok = answer === a.kind;
            return (
              <div key={a.index} className="flex w-[5.5rem] flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{vi.frame.popover.byteIndex(a.index)}</span>
                <span
                  className={cn(
                    'hex flex h-10 w-full items-center justify-center rounded-md border text-base font-semibold',
                    checked ? BYTE_KIND_CLASSES[a.kind] : 'border-border bg-surface-2',
                  )}
                >
                  {hex(a.value)}
                </span>
                <select
                  aria-label={vi.frame.popover.byteIndex(a.index)}
                  value={answer}
                  onChange={(e) => {
                    setAnswers((cur) => ({ ...cur, [a.index]: e.target.value as FieldKind }));
                    setChecked(false);
                  }}
                  className={cn(
                    'h-8 w-full rounded-md border bg-bg px-1 text-xs',
                    checked ? (ok ? 'border-ok' : 'border-err') : 'border-border',
                  )}
                >
                  <option value="">{x.choose}</option>
                  {BYTE_KIND_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {vi.annotate.kinds[k]}
                    </option>
                  ))}
                </select>
                {checked && (
                  <span className={cn('flex items-center gap-0.5 text-center text-[10px]', ok ? 'text-ok' : 'text-err')}>
                    {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3 shrink-0" />}
                    {ok ? vi.annotate.kinds[a.kind] : x.answer(vi.annotate.kinds[a.kind])}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setChecked(true)}>
            <CheckCircle2 className="h-4 w-4" /> {x.check}
          </Button>
          <Button onClick={reveal}>
            <Eye className="h-4 w-4" /> {x.reveal}
          </Button>
          <Button variant="ghost" onClick={next}>
            <RefreshCw className="h-4 w-4" /> {x.next}
          </Button>
          {checked && (
            <span className={cn('ml-2 text-sm font-semibold', correct === total ? 'text-ok' : 'text-warn')}>
              {correct === total ? x.perfect : x.score(correct, total)}
            </span>
          )}
        </div>

        {checked && (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-semibold">{x.explain}</div>
            <DecodeLines annotations={frame.annotations} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

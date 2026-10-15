import { CheckCircle2, CircleDashed, MinusCircle, Workflow, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PipelineStep, StepStatus } from '@/core/uds/types';
import { hex } from '@/core/util/hex';
import { nrcName } from '@/core/uds/nrc';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const ICONS: Record<StepStatus, JSX.Element> = {
  passed: <CheckCircle2 className="h-4 w-4 text-ok" />,
  failed: <XCircle className="h-4 w-4 text-err" />,
  skipped: <CircleDashed className="h-4 w-4 text-muted/60" />,
  notApplicable: <MinusCircle className="h-4 w-4 text-muted/60" />,
};

/** "Quy trình ECU xử lý request": các bước kiểm tra NRC theo thứ tự với ✅/❌ và lý do. */
export function PipelinePanel({ steps }: { steps: readonly PipelineStep[] | null }) {
  return (
    <Card>
      <CardHeader title={vi.uds.pipelineTitle} icon={<Workflow className="h-4 w-4" />} />
      <CardBody>
        <p className="mb-3 text-xs italic text-muted">{vi.uds.pipelineNote}</p>
        {!steps || steps.length === 0 ? (
          <p className="text-sm text-muted">{vi.pipeline.empty}</p>
        ) : (
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <motion.li
                key={`${s.order}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'flex gap-2.5 rounded-md px-2 py-1.5 text-sm',
                  s.status === 'failed' && 'bg-err/10',
                  (s.status === 'skipped' || s.status === 'notApplicable') && 'opacity-60',
                )}
              >
                <span className="hex mt-0.5 w-4 shrink-0 text-xs text-muted">{s.order}</span>
                <span className="mt-0.5 shrink-0">{ICONS[s.status]}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 font-medium">
                    {s.title}
                    {s.nrc !== undefined && (
                      <span className="hex text-xs text-err">
                        → NRC 0x{hex(s.nrc)} ({nrcName(s.nrc)})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{s.reason}</div>
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

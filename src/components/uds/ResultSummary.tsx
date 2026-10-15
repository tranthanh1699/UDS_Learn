import { MessageSquareText } from 'lucide-react';
import type { UdsResult } from '@/core/uds/types';
import { vi } from '@/i18n/vi';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const TONE = { positive: 'ok', negative: 'err', suppressed: 'neutral', noResponse: 'warn' } as const;

export function ResultSummary({ result }: { result: UdsResult }) {
  return (
    <Card>
      <CardHeader
        title={vi.result.title}
        icon={<MessageSquareText className="h-4 w-4" />}
        extra={<Badge tone={TONE[result.outcome]}>{vi.result.outcome[result.outcome]}</Badge>}
      />
      <CardBody className="space-y-3 text-sm">
        <p className="leading-relaxed">{result.explanation}</p>
        {result.notes.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">{vi.result.notes}</div>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {result.stateChanges.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">{vi.result.stateChanges}</div>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {result.stateChanges.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

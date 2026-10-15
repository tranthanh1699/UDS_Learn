import { Hammer } from 'lucide-react';
import { vi } from '@/i18n/vi';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ComingSoon({ phase }: { phase: number }) {
  return (
    <Card className="border-dashed">
      <CardBody className="flex items-start gap-3 py-8">
        <Hammer className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
        <div>
          <div className="flex items-center gap-2 font-medium">
            {vi.common.comingSoon}
            <Badge tone="accent">{vi.common.phaseLabel(phase)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{vi.common.plannedPhase(phase)}</p>
        </div>
      </CardBody>
    </Card>
  );
}

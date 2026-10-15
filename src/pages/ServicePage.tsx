import { useParams } from 'react-router-dom';
import { MVP_SERVICES } from '@/data/navigation';
import { vi, type ServiceSidKey } from '@/i18n/vi';
import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { NotFoundPage } from './NotFoundPage';

/** Giai đoạn triển khai dự kiến của từng service trong lộ trình. */
const SERVICE_PHASE: Record<ServiceSidKey, number> = { '10': 4, '22': 4, '3E': 4, '11': 6, '27': 6, '2E': 6 };

export function ServicePage() {
  const sid = (useParams().sid ?? '').toUpperCase() as ServiceSidKey;
  if (!MVP_SERVICES.includes(sid)) return <NotFoundPage message={vi.common.serviceUnknown(sid)} />;
  const svc = vi.services[sid];
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="hex text-byte-sid">0x{sid}</span> {svc.name}
          </>
        }
        subtitle={vi.pages.service.subtitle(sid)}
        badge={<Badge tone="accent">{svc.short}</Badge>}
      />
      <ComingSoon phase={SERVICE_PHASE[sid]} />
    </>
  );
}

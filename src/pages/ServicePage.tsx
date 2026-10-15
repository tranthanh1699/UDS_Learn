import { BookOpen, FlaskConical, PenLine } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { MVP_SERVICES } from '@/data/navigation';
import { SERVICES_META } from '@/data/services-meta';
import { vi, type ServiceSidKey } from '@/i18n/vi';
import { ComingSoon } from '@/components/ComingSoon';
import { ExerciseTab } from '@/components/exercise/ExerciseTab';
import { PageHeader } from '@/components/layout/PageHeader';
import { LearnTab } from '@/components/learn/LearnTab';
import { PracticeTab } from '@/components/practice/PracticeTab';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { NotFoundPage } from './NotFoundPage';

/** Giai đoạn triển khai của các service chưa có nội dung. */
const SERVICE_PHASE: Partial<Record<ServiceSidKey, number>> = { '11': 6, '27': 6, '2E': 6 };

export function ServicePage() {
  const sid = (useParams().sid ?? '').toUpperCase() as ServiceSidKey;
  if (!MVP_SERVICES.includes(sid)) return <NotFoundPage message={vi.common.serviceUnknown(sid)} />;
  const svc = vi.services[sid];
  const content = SERVICES_META[sid];
  const t = vi.servicePage.tabs;

  return (
    <div key={sid}>
      <PageHeader
        title={
          <>
            <span className="hex text-byte-sid">0x{sid}</span> {svc.name}
          </>
        }
        subtitle={vi.pages.service.subtitle(sid)}
        badge={<Badge tone="accent">{svc.short}</Badge>}
      />
      {content ? (
        <Tabs defaultValue="learn">
          <TabsList className="mb-4">
            <TabsTrigger value="learn">
              <BookOpen className="mr-1.5 inline h-4 w-4" />
              {t.learn}
            </TabsTrigger>
            <TabsTrigger value="practice">
              <FlaskConical className="mr-1.5 inline h-4 w-4" />
              {t.practice}
            </TabsTrigger>
            <TabsTrigger value="exercise">
              <PenLine className="mr-1.5 inline h-4 w-4" />
              {t.exercise}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="learn">
            <LearnTab content={content} />
          </TabsContent>
          <TabsContent value="practice">
            <PracticeTab content={content} />
          </TabsContent>
          <TabsContent value="exercise">
            <ExerciseTab content={content} />
          </TabsContent>
        </Tabs>
      ) : (
        <ComingSoon phase={SERVICE_PHASE[sid] ?? 6} />
      )}
    </div>
  );
}

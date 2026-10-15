import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/layout/PageHeader';

/** Trang tạm cho các mục chưa triển khai; sẽ được thay bằng trang thật theo lộ trình. */
export function PlaceholderPage({ title, subtitle, phase }: { title: string; subtitle: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <ComingSoon phase={phase} />
    </>
  );
}

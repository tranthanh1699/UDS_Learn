import { Link } from 'react-router-dom';
import { vi } from '@/i18n/vi';
import { PageHeader } from '@/components/layout/PageHeader';

export function NotFoundPage({ message }: { message?: string }) {
  return (
    <>
      <PageHeader title={vi.common.notFoundTitle} subtitle={message ?? vi.common.notFoundBody} />
      <Link to="/" className="text-sm text-accent hover:underline">
        {vi.common.backHome}
      </Link>
    </>
  );
}

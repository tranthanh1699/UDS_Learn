import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, badge }: { title: ReactNode; subtitle?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

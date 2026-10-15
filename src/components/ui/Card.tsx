import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-surface shadow-sm', className)} {...props} />;
}

export function CardHeader({ title, icon, extra }: { title: ReactNode; icon?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      {icon && <span className="text-accent">{icon}</span>}
      <h2 className="text-sm font-semibold">{title}</h2>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

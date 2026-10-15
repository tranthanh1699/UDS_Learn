import * as RT from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = RT.Root;
export const TabsContent = RT.Content;

export function TabsList({ className, ...props }: RT.TabsListProps) {
  return <RT.List className={cn('inline-flex gap-1 rounded-lg border border-border bg-surface p-1', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: RT.TabsTriggerProps) {
  return (
    <RT.Trigger
      className={cn(
        'rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg data-[state=active]:bg-accent/15 data-[state=active]:text-accent',
        className,
      )}
      {...props}
    />
  );
}

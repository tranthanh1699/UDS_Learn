import * as RD from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export function Dialog({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <RD.Content className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-2xl">
          <RD.Title className="text-base font-semibold">{title}</RD.Title>
          <RD.Description asChild>
            <div className="mt-2 text-sm text-muted">{children}</div>
          </RD.Description>
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const DialogClose = RD.Close;

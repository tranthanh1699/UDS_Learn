import * as RS from '@radix-ui/react-switch';
import { useId, type ReactNode } from 'react';

export function Switch({ checked, onCheckedChange, label, hint }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <RS.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-border transition-colors data-[state=checked]:bg-accent"
      >
        <RS.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </RS.Root>
      <label htmlFor={id} className="cursor-pointer text-sm leading-tight">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

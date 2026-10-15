import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { BYTE_KIND_CLASSES, BYTE_KIND_ORDER } from './byteStyles';

export function ByteLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted">{vi.frame.legend}:</span>
      {BYTE_KIND_ORDER.map((k) => (
        <span key={k} className={cn('rounded border px-1.5 py-0.5 font-medium', BYTE_KIND_CLASSES[k])}>
          {vi.annotate.kinds[k]}
        </span>
      ))}
    </div>
  );
}

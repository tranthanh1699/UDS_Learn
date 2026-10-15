import * as Popover from '@radix-ui/react-popover';
import type { ByteAnnotation } from '@/core/annotate/types';
import { hex } from '@/core/util/hex';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { BYTE_KIND_CLASSES } from './byteStyles';

interface ByteCellProps {
  annotation: ByteAnnotation;
  highlighted: boolean;
  onHover: (fieldId: string | null) => void;
  size?: 'sm' | 'md';
}

/** Một ô byte; bấm để mở BytePopover với giải thích tiếng Việt. */
export function ByteCell({ annotation: a, highlighted, onHover, size = 'md' }: ByteCellProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          onMouseEnter={() => onHover(a.fieldId)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(a.fieldId)}
          onBlur={() => onHover(null)}
          aria-label={`${vi.frame.popover.byteIndex(a.index)}: 0x${hex(a.value)}, ${a.field}`}
          className={cn(
            'hex rounded border text-center font-semibold transition-all',
            size === 'sm' ? 'h-6 w-7 text-[11px]' : 'h-8 w-9 text-sm',
            BYTE_KIND_CLASSES[a.kind],
            highlighted && 'ring-2 ring-current ring-offset-1 ring-offset-surface',
          )}
        >
          {hex(a.value)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-80 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-surface p-3 text-sm shadow-xl"
        >
          <BytePopoverBody a={a} />
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BytePopoverBody({ a }: { a: ByteAnnotation }) {
  const p = vi.frame.popover;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={cn('hex rounded border px-1.5 py-0.5 text-xs font-semibold', BYTE_KIND_CLASSES[a.kind])}>
          {vi.annotate.kinds[a.kind]}
        </span>
        <span className="font-semibold">{a.field}</span>
        <span className="ml-auto text-xs text-muted">{p.byteIndex(a.index)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-xs">
        {[
          [p.hex, `0x${hex(a.value)}`],
          [p.dec, String(a.value)],
          [p.bin, a.value.toString(2).padStart(8, '0')],
        ].map(([k, v]) => (
          <div key={k} className="rounded bg-surface-2 px-2 py-1">
            <div className="text-muted">{k}</div>
            <div className="hex font-medium">{v}</div>
          </div>
        ))}
      </div>
      <p className="leading-relaxed">{a.meaning}</p>
      {a.byteNote && <p className="text-xs text-muted">{a.byteNote}</p>}
      {a.bits && a.bits.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold text-muted">{p.bits}</div>
          <table className="w-full text-xs">
            <tbody>
              {a.bits.map((bit) => (
                <tr key={bit.range} className="border-t border-border align-top">
                  <td className="hex whitespace-nowrap py-1 pr-2 text-muted">
                    {p.bitRange} {bit.range}
                  </td>
                  <td className="hex py-1 pr-2 font-semibold">{bit.value}</td>
                  <td className="py-1">
                    <div className="font-medium">{bit.name}</div>
                    <div className="text-muted">{bit.meaning}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a.isoRef && (
        <div className="border-t border-border pt-2 text-xs text-muted">
          {p.iso}: {a.isoRef}
        </div>
      )}
    </div>
  );
}

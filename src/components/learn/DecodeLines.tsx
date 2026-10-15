import type { ByteAnnotation } from '@/core/annotate/types';
import { hexBytes } from '@/core/util/hex';
import { cn } from '@/lib/cn';
import { BYTE_KIND_CLASSES } from '@/components/frames/byteStyles';

/** Gom các byte liên tiếp cùng trường thành một dòng giải mã. */
export function groupByField(annotations: readonly ByteAnnotation[]): ByteAnnotation[][] {
  const groups: ByteAnnotation[][] = [];
  for (const a of annotations) {
    const last = groups.at(-1);
    if (last && last[0]!.fieldId === a.fieldId && last.at(-1)!.index === a.index - 1) last.push(a);
    else groups.push([a]);
  }
  return groups;
}

/** Giải mã từng dòng: nhóm byte | tên trường | ý nghĩa. */
export function DecodeLines({ annotations }: { annotations: readonly ByteAnnotation[] }) {
  return (
    <div className="space-y-1">
      {groupByField(annotations).map((g) => {
        const first = g[0]!;
        return (
          <div key={first.index} className="grid grid-cols-[minmax(5rem,auto)_1fr] gap-x-3 text-xs sm:grid-cols-[minmax(7rem,auto)_10rem_1fr]">
            <span className={cn('hex h-fit rounded border px-1.5 py-0.5 font-semibold', BYTE_KIND_CLASSES[first.kind])}>
              {hexBytes(g.map((a) => a.value))}
            </span>
            <span className="hidden font-medium sm:block">{first.field}</span>
            <span className="text-muted">
              <span className="font-medium text-fg sm:hidden">{first.field}: </span>
              {first.meaning}
            </span>
          </div>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import type { ByteAnnotation } from '@/core/annotate/types';
import { ByteCell } from './ByteCell';

/** Dãy ByteCell; rê chuột vào một byte sẽ highlight cả trường nhiều byte chứa nó. */
export function ByteRow({ annotations, size }: { annotations: readonly ByteAnnotation[]; size?: 'sm' | 'md' }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-1">
      {annotations.map((a) => (
        <ByteCell key={a.index} annotation={a} highlighted={hovered !== null && hovered === a.fieldId} onHover={setHovered} size={size} />
      ))}
    </div>
  );
}

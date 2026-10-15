import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCanId } from '@/core/can/frame';
import type { TraceFrame } from '@/core/trace/exchange';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { ByteRow } from './ByteRow';

export type FrameCardData = Omit<TraceFrame, 'id' | 'exchangeId' | 't'> & { t?: number };

/** Thẻ hiển thị một CAN frame: thời gian, hướng, CAN ID, DLC, loại CAN và từng byte. */
export function FrameCard({ frame, startTime, index = 0 }: { frame: FrameCardData; startTime?: number; index?: number }) {
  const f = vi.frame;
  const isTx = frame.dir === 'Tx';
  return (
    <motion.div
      initial={{ opacity: 0, x: isTx ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      className={cn('rounded-lg border bg-surface p-2.5', isTx ? 'border-l-4 border-border border-l-byte-sid' : 'border-l-4 border-border border-l-byte-data')}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {frame.t !== undefined && startTime !== undefined && (
          <span className="hex text-muted">{f.seconds(((frame.t - startTime) / 1000).toFixed(3))}</span>
        )}
        <Tooltip content={isTx ? f.txHint : f.rxHint}>
          <span className={cn('hex inline-flex items-center gap-0.5 font-semibold', isTx ? 'text-byte-sid' : 'text-byte-data')}>
            {isTx ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
            {frame.dir}
          </span>
        </Tooltip>
        <span className="hex font-semibold">0x{formatCanId(frame.canId, frame.idType)}</span>
        <Badge>{frame.idType === 'standard' ? f.idStandard : f.idExtended}</Badge>
        <Badge>{frame.fd ? f.fd : f.classic}</Badge>
        <span className="hex text-muted">
          {f.dlc} {frame.dlc}
        </span>
        <Badge tone="accent">{vi.isotp.frameKind[frame.kind]}</Badge>
        <span className="text-muted">{f.role[frame.role]}</span>
      </div>
      <ByteRow annotations={frame.annotations} />
    </motion.div>
  );
}

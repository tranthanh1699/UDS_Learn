import { AlertTriangle, Battery, Cog, Gauge, Lock, LockOpen, Timer, Wrench, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useCountdown } from '@/hooks/useCountdown';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';
import { useFaultsStore } from '@/store/faults';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Tooltip } from '@/components/ui/Tooltip';

function Item({ icon, label, children, hint, className }: { icon: ReactNode; label: string; children: ReactNode; hint?: string; className?: string }) {
  const body = (
    <div className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap', className)}>
      <span className="opacity-70">{icon}</span>
      <span className="text-muted">{label}:</span>
      <span className="font-medium">{children}</span>
    </div>
  );
  return hint ? <Tooltip content={hint}>{body}</Tooltip> : body;
}

const Sep = () => <span className="h-3.5 w-px shrink-0 bg-border" />;

/** Status bar luôn hiển thị: session, security, S3, điều kiện xe, số lỗi, đèn MIL. */
export function StatusBar() {
  const session = useEcuRuntimeStore((s) => s.session);
  const unlockedLevel = useEcuRuntimeStore((s) => s.unlockedLevel);
  const s3ExpiresAt = useEcuRuntimeStore((s) => s.s3ExpiresAt);
  const c = useVehicleConfigStore((s) => s.conditions);
  const faultCount = useFaultsStore((s) => s.activeFaultIds.length);
  const milOn = useFaultsStore((s) => s.milOn);
  const s3Left = useCountdown(s3ExpiresAt);
  const sb = vi.statusBar;

  return (
    <footer className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-surface px-3 text-xs sm:px-4">
      <Item icon={<Wrench className="h-3.5 w-3.5" />} label={sb.session}>
        <span className={cn(session !== 'default' && 'text-accent')}>{vi.session[session]}</span>
      </Item>
      <Sep />
      <Item
        icon={unlockedLevel === null ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5 text-ok" />}
        label={sb.security}
      >
        <span className={cn(unlockedLevel !== null && 'text-ok')}>
          {unlockedLevel === null ? sb.locked : sb.unlocked(unlockedLevel)}
        </span>
      </Item>
      <Sep />
      <Item icon={<Timer className="h-3.5 w-3.5" />} label={sb.s3} hint={s3Left === null ? sb.s3InactiveHint : sb.s3Hint}>
        {s3Left === null ? (
          <span className="text-muted">{sb.s3Inactive}</span>
        ) : (
          <span className={cn('hex', s3Left < 1500 && 'text-warn')}>
            {formatNumber(s3Left / 1000, 1)} {vi.units.s}
          </span>
        )}
      </Item>
      <Sep />
      <Item icon={<Gauge className="h-3.5 w-3.5" />} label={sb.speed}>
        <span className="hex">{c.speedKmh}</span> {vi.units.kmh}
      </Item>
      <Item icon={<Zap className="h-3.5 w-3.5" />} label={sb.rpm}>
        <span className="hex">{c.rpm}</span>
      </Item>
      <Item icon={<Battery className="h-3.5 w-3.5" />} label={sb.voltage}>
        <span className={cn('hex', c.batteryVoltage < 11 && 'text-err')}>{formatNumber(c.batteryVoltage, 1)}</span> {vi.units.volt}
      </Item>
      <Item icon={<Cog className="h-3.5 w-3.5" />} label={sb.gear}>
        <span className="hex">{c.gear}</span>
      </Item>
      <span className="shrink-0 whitespace-nowrap text-muted">{c.engineRunning ? sb.engineOn : sb.engineOff}</span>
      <div className="ml-auto flex shrink-0 items-center gap-3 pl-3">
        <Item icon={<AlertTriangle className="h-3.5 w-3.5" />} label={sb.faults}>
          <span className={cn('hex', faultCount > 0 && 'text-err')}>{faultCount}</span>
        </Item>
        <Sep />
        <Tooltip content={sb.milHint}>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              {milOn && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-warn" />}
              <span className={cn('relative h-2.5 w-2.5 rounded-full', milOn ? 'bg-warn' : 'bg-border')} />
            </span>
            <span className="text-muted">{sb.mil}:</span>
            <span className={cn('font-medium', milOn ? 'text-warn' : 'text-muted')}>{milOn ? sb.milOn : sb.milOff}</span>
          </div>
        </Tooltip>
      </div>
    </footer>
  );
}

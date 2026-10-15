import { Calculator, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { computeKey } from '@/core/uds/keyAlgorithm';
import { hex, hexBytes, parseHexBytes } from '@/core/util/hex';
import type { VehicleConfig } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const k = vi.keyCalc;
const inputCls = 'hex h-9 rounded-md border border-border bg-bg px-2.5 text-sm outline-none focus:border-accent';

/** Công cụ tính key từ seed theo thuật toán đã cấu hình, hiển thị từng bước tính. */
export function KeyCalculator({ config, lastSeed }: { config: VehicleConfig; lastSeed: { level: number; seed: number[] } | null }) {
  const levels = config.security.levels;
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const [seedText, setSeedText] = useState('12 34 56 78');
  const cfg = levels.find((l) => l.level === level) ?? levels[0];

  // Khi tester vừa nhận seed mới, tự đưa vào máy tính
  useEffect(() => {
    if (!lastSeed) return;
    setLevel(lastSeed.level);
    setSeedText(hexBytes(lastSeed.seed));
  }, [lastSeed]);

  const result = useMemo(() => {
    if (!cfg) return null;
    const seed = parseHexBytes(seedText);
    if (seed === null) return { error: vi.practice.hexInvalid };
    if (seed.length !== cfg.seedLength) return { error: k.seedLength(cfg.seedLength) };
    const r = computeKey(seed, cfg);
    return r.ok ? { seed, key: r.key, steps: r.steps } : { error: r.error ?? '' };
  }, [cfg, seedText]);

  const formula =
    cfg?.algorithm === 'expression' ? cfg.expression : cfg ? `seed ${cfg.algorithm === 'xor' ? '^' : '+'} 0x${hex(cfg.constant, cfg.seedLength * 2)}` : '';

  return (
    <Card>
      <CardHeader title={k.title} icon={<Calculator className="h-4 w-4" />} />
      <CardBody className="space-y-3">
        {!cfg ? (
          <p className="text-sm text-muted">{k.noLevels}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">{k.level}</span>
                <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className={cn(inputCls, 'font-sans')}>
                  {levels.map((l) => (
                    <option key={l.level} value={l.level}>
                      L{l.level} (0x27 {hex(l.level)}/{hex(l.level + 1)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">{k.seed}</span>
                <input value={seedText} onChange={(e) => setSeedText(e.target.value)} className={cn(inputCls, 'w-48 uppercase')} />
              </label>
              <Button size="sm" className="h-9" disabled={!lastSeed} onClick={() => lastSeed && (setLevel(lastSeed.level), setSeedText(hexBytes(lastSeed.seed)))}>
                <Download className="h-3.5 w-3.5" /> {k.useLastSeed}
              </Button>
            </div>
            <div className="text-sm">
              <span className="text-muted">{k.algorithm}: </span>
              {vi.security.algorithms[cfg.algorithm]}
              <div className="hex mt-1 rounded bg-surface-2 px-2 py-1 text-xs">key = {formula}</div>
            </div>
            {result && 'error' in result ? (
              <p className="text-sm text-err">{result.error}</p>
            ) : result ? (
              <>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted">{k.steps}</div>
                  <ol className="hex space-y-0.5 text-xs">
                    <li>seed = 0x{hex(result.seed.reduce((a, b) => (a * 256 + b) >>> 0, 0), cfg.seedLength * 2)}</li>
                    {result.steps.map((s, i) => (
                      <li key={i}>
                        {i + 1}. {s.expr} = <span className="font-semibold">0x{hex(s.value, 8)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">{k.result}:</span>
                  <span className="hex rounded border border-byte-data/40 bg-byte-data/10 px-2 py-1 text-sm font-semibold text-byte-data">{hexBytes(result.key)}</span>
                </div>
              </>
            ) : null}
            <p className="text-xs text-muted">{k.note}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

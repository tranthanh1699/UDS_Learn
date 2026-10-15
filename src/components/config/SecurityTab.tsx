import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { computeKey } from '@/core/uds/keyAlgorithm';
import { hex, hexBytes } from '@/core/util/hex';
import type { KeyAlgorithm, SecurityLevelConfig } from '@/core/vehicle/types';
import { validateSecurityLevel } from '@/core/vehicle/validate';
import { vi } from '@/i18n/vi';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Field, HexNumberInput, NumberInput, inputCls } from './fields';

const t = vi.config.sec;
const ALGORITHMS: KeyAlgorithm[] = ['xor', 'add', 'expression'];
const SAMPLE_SEED = [0x12, 0x34, 0x56, 0x78];

function LevelCard({ level, index }: { level: SecurityLevelConfig; index: number }) {
  const update = useVehicleConfigStore((s) => s.update);
  const edit = (fn: (l: SecurityLevelConfig) => void) => update((cfg) => fn(cfg.security.levels[index]!));
  const errors = validateSecurityLevel(level);
  const seed = SAMPLE_SEED.slice(0, level.seedLength);
  const preview = errors.length === 0 ? computeKey(seed, level) : null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="hex font-semibold text-accent">L{level.level}</span>
        <span className="hex text-xs text-muted">{t.levelHint(hex(level.level), hex(level.level + 1))}</span>
        <IconButton className="ml-auto" aria-label={t.remove} title={t.remove} onClick={() => update((cfg) => void cfg.security.levels.splice(index, 1))}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <Field label={t.level}>{(id) => <HexNumberInput id={id} value={level.level} max={0x41} onChange={(v) => edit((l) => void (l.level = v))} />}</Field>
        <Field label={t.seedLength}>
          {(id) => (
            <select id={id} value={level.seedLength} onChange={(e) => edit((l) => void (l.seedLength = Number(e.target.value)))} className={inputCls}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.algorithm}>
          {(id) => (
            <select id={id} value={level.algorithm} onChange={(e) => edit((l) => void (l.algorithm = e.target.value as KeyAlgorithm))} className={inputCls}>
              {ALGORITHMS.map((a) => (
                <option key={a} value={a}>
                  {vi.security.algorithms[a]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {level.algorithm === 'expression' ? (
        <Field label={t.expression} hint={vi.security.exprHelp}>
          {(id) => <input id={id} value={level.expression} onChange={(e) => edit((l) => void (l.expression = e.target.value))} className={`${inputCls} hex`} />}
        </Field>
      ) : (
        <Field label={t.constant}>
          {(id) => <HexNumberInput id={id} value={level.constant} width={level.seedLength * 2} onChange={(v) => edit((l) => void (l.constant = v))} className="max-w-xs" />}
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.maxAttempts}>{(id) => <NumberInput id={id} value={level.maxAttempts} min={1} max={20} onChange={(v) => edit((l) => void (l.maxAttempts = v))} />}</Field>
        <Field label={t.delay}>{(id) => <NumberInput id={id} value={level.delayMs} min={0} max={600000} step={1000} onChange={(v) => edit((l) => void (l.delayMs = v))} />}</Field>
      </div>
      {errors.map((e) => (
        <p key={e} className="text-xs text-err">
          {e}
        </p>
      ))}
      {preview?.ok && <p className="hex text-xs text-ok">{t.preview(hexBytes(seed), hexBytes(preview.key))}</p>}
    </div>
  );
}

export function SecurityTab() {
  const levels = useVehicleConfigStore((s) => s.draft.security.levels);
  const update = useVehicleConfigStore((s) => s.update);
  const addLevel = () =>
    update((cfg) => {
      const used = cfg.security.levels.map((l) => l.level);
      let level = 1;
      while (used.includes(level)) level += 2;
      cfg.security.levels.push({ level, seedLength: 4, algorithm: 'xor', constant: 0x11223344, expression: 'seed ^ 0x11223344', maxAttempts: 3, delayMs: 10000 });
    });
  return (
    <Card>
      <CardHeader
        title={t.title}
        icon={<KeyRound className="h-4 w-4" />}
        extra={
          <Button size="sm" onClick={addLevel}>
            <Plus className="h-3.5 w-3.5" /> {t.add}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        <p className="text-xs text-muted">{t.note}</p>
        <div className="grid gap-3 xl:grid-cols-2">
          {levels.map((l, i) => (
            <LevelCard key={i} level={l} index={i} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

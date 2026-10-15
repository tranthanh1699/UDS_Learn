import { Plus, Table2, Trash2 } from 'lucide-react';
import { ALL_SESSIONS } from '@/core/uds/session';
import type { DidDefinition, DidFormat, DidSource, SessionKind, VehicleConfig } from '@/core/vehicle/types';
import { LIVE_SOURCE_LENGTH } from '@/core/vehicle/validate';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { BytesInput, HexNumberInput, NumberInput, inputCls } from './fields';

const t = vi.config.dids;
const SOURCES: DidSource[] = ['static', 'vehicleSpeed', 'engineRpm', 'batteryVoltage', 'activeSession'];
const FORMATS: DidFormat[] = ['ascii', 'hex', 'uint', 'bcd'];
const selectCls = cn(inputCls, 'h-8 text-xs');

function SessionToggles({ value, onChange, label }: { value: SessionKind[]; onChange: (v: SessionKind[]) => void; label: string }) {
  return (
    <div className="flex gap-0.5" role="group" aria-label={label}>
      {ALL_SESSIONS.map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            title={vi.session[s]}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s) : ALL_SESSIONS.filter((x) => x === s || value.includes(x)))}
            className={cn('hex h-7 w-7 rounded border text-xs font-semibold', on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted')}
          >
            {t.sessionShort[s]}
          </button>
        );
      })}
    </div>
  );
}

function SecuritySelect({ value, onChange, levels, label }: { value: number | null; onChange: (v: number | null) => void; levels: number[]; label: string }) {
  return (
    <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={cn(selectCls, 'w-20')}>
      <option value="">{t.none}</option>
      {levels.map((l) => (
        <option key={l} value={l}>
          L{l}
        </option>
      ))}
    </select>
  );
}

const resize = (data: number[], length: number, fill: number) => Array.from({ length }, (_, i) => data[i] ?? fill);

function nextFreeDid(dids: readonly DidDefinition[]): number {
  let did = 0x0300;
  while (dids.some((d) => d.did === did)) did++;
  return did;
}

/** Bảng DID chỉnh sửa trực tiếp; mỗi thay đổi được kiểm tra và áp dụng cho ECU khi hợp lệ. */
export function DidTableTab() {
  const dids = useVehicleConfigStore((s) => s.draft.dids);
  const levels = useVehicleConfigStore((s) => s.draft.security.levels).map((l) => l.level);
  const update = useVehicleConfigStore((s) => s.update);
  const edit = (i: number, fn: (d: DidDefinition, cfg: VehicleConfig) => void) => update((cfg) => fn(cfg.dids[i]!, cfg));

  const addDid = () =>
    update((cfg) =>
      void cfg.dids.push({
        did: nextFreeDid(cfg.dids),
        name: t.newName,
        length: 1,
        format: 'hex',
        source: 'static',
        data: [0x00],
        readSessions: [...ALL_SESSIONS],
        readSecurityLevel: null,
        writable: false,
        writeSessions: [],
        writeSecurityLevel: null,
      }),
    );

  return (
    <Card>
      <CardHeader
        title={t.title}
        icon={<Table2 className="h-4 w-4" />}
        extra={
          <Button size="sm" onClick={addDid}>
            <Plus className="h-3.5 w-3.5" /> {t.add}
          </Button>
        }
      />
      <CardBody className="space-y-2">
        <p className="text-xs text-muted">{t.hint}</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-2 py-2">{t.did}</th>
                <th className="px-2 py-2">{t.name}</th>
                <th className="px-2 py-2">{t.source}</th>
                <th className="px-2 py-2">{t.format}</th>
                <th className="px-2 py-2">{t.length}</th>
                <th className="px-2 py-2">{t.data}</th>
                <th className="px-2 py-2">
                  {t.read}: {t.sessions} / {t.securityLevel}
                </th>
                <th className="px-2 py-2">
                  {t.write}: {t.writable} / {t.sessions} / {t.securityLevel}
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {dids.map((d, i) => {
                const live = d.source !== 'static';
                return (
                  <tr key={i} className="border-t border-border align-middle">
                    <td className="w-28 px-2 py-1.5">
                      <HexNumberInput value={d.did} width={4} max={0xffff} onChange={(v) => edit(i, (x) => void (x.did = v))} className="[&_input]:h-8 [&_input]:text-xs" />
                    </td>
                    <td className="min-w-40 px-2 py-1.5">
                      <input aria-label={t.name} value={d.name} onChange={(e) => edit(i, (x) => void (x.name = e.target.value))} className={selectCls} />
                    </td>
                    <td className="min-w-36 px-2 py-1.5">
                      <select
                        aria-label={t.source}
                        value={d.source}
                        onChange={(e) =>
                          edit(i, (x) => {
                            const src = e.target.value as DidSource;
                            x.source = src;
                            if (src === 'static') {
                              x.data = resize([], x.length, 0);
                            } else {
                              x.length = LIVE_SOURCE_LENGTH[src];
                              x.data = [];
                              x.writable = false;
                              x.writeSessions = [];
                              x.writeSecurityLevel = null;
                            }
                          })
                        }
                        className={selectCls}
                      >
                        {SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {t.sources[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-28 px-2 py-1.5">
                      <select aria-label={t.format} value={d.format} onChange={(e) => edit(i, (x) => void (x.format = e.target.value as DidFormat))} className={selectCls}>
                        {FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {t.formats[f]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="w-20 px-2 py-1.5">
                      {live ? (
                        <span className="hex text-xs text-muted">{d.length}</span>
                      ) : (
                        <div className="[&_input]:h-8 [&_input]:text-xs">
                          <NumberInput
                            value={d.length}
                            min={1}
                            max={255}
                            onChange={(v) =>
                              edit(i, (x) => {
                                x.length = v;
                                x.data = resize(x.data, Math.max(0, Math.min(255, Math.floor(v))), x.format === 'ascii' ? 0x20 : 0);
                              })
                            }
                          />
                        </div>
                      )}
                    </td>
                    <td className="min-w-56 px-2 py-1.5">
                      {live ? (
                        <span className="text-xs italic text-muted">{t.liveValue}</span>
                      ) : (
                        <BytesInput
                          label={t.data}
                          ascii={d.format === 'ascii'}
                          value={d.data}
                          onChange={(bytes) =>
                            edit(i, (x) => {
                              x.data = bytes;
                              x.length = bytes.length;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <SessionToggles label={`${t.read} ${t.sessions}`} value={d.readSessions} onChange={(v) => edit(i, (x) => void (x.readSessions = v))} />
                        <SecuritySelect label={`${t.read} ${t.securityLevel}`} levels={levels} value={d.readSecurityLevel} onChange={(v) => edit(i, (x) => void (x.readSecurityLevel = v))} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={t.writable}
                          checked={d.writable}
                          disabled={live}
                          onChange={(e) =>
                            edit(i, (x) => {
                              x.writable = e.target.checked;
                              if (x.writable && x.writeSessions.length === 0) x.writeSessions = ['extended'];
                            })
                          }
                        />
                        {d.writable && (
                          <>
                            <SessionToggles label={`${t.write} ${t.sessions}`} value={d.writeSessions} onChange={(v) => edit(i, (x) => void (x.writeSessions = v))} />
                            <SecuritySelect label={`${t.write} ${t.securityLevel}`} levels={levels} value={d.writeSecurityLevel} onChange={(v) => edit(i, (x) => void (x.writeSecurityLevel = v))} />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <IconButton aria-label={t.remove} title={t.remove} onClick={() => update((cfg) => void cfg.dids.splice(i, 1))}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

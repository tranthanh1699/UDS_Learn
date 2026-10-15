import { Check, X } from 'lucide-react';
import { ALL_SESSIONS } from '@/core/uds/session';
import { resolveSubFunctions, type ServiceDefinition } from '@/core/uds/types';
import { hex } from '@/core/util/hex';
import type { SessionKind, VehicleConfig } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';

interface Row {
  label: string;
  sessions: readonly SessionKind[];
  security: number | null;
}

/** Ma trận session × security sinh từ metadata service (và bảng DID với 0x22) nên luôn khớp với engine. */
export function SessionSecurityMatrix({ def, config }: { def: ServiceDefinition; config: VehicleConfig }) {
  const l = vi.learn;
  const rows: Row[] = [{ label: l.matrixService(def.name), sessions: def.sessions, security: def.securityLevel }];
  for (const s of resolveSubFunctions(def, config)) rows.push({ label: l.matrixSub(hex(s.id), s.name), sessions: s.sessions, security: s.securityLevel });
  if (def.sid === 0x22) {
    for (const d of config.dids) rows.push({ label: l.matrixDidRead(hex(d.did, 4), d.name), sessions: d.readSessions, security: d.readSecurityLevel });
  }
  if (def.sid === 0x2e) {
    for (const d of config.dids.filter((x) => x.writable)) {
      rows.push({ label: l.matrixDidWrite(hex(d.did, 4), d.name), sessions: d.writeSessions, security: d.writeSecurityLevel });
    }
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">{l.matrixCols.item}</th>
            {ALL_SESSIONS.map((s) => (
              <th key={s} className="px-3 py-2 font-semibold">
                {vi.session[s]}
              </th>
            ))}
            <th className="px-3 py-2 font-semibold">{l.matrixCols.security}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-3 py-1.5">{r.label}</td>
              {ALL_SESSIONS.map((s) => (
                <td key={s} className="px-3 py-1.5 text-center">
                  {r.sessions.includes(s) ? (
                    <Check className="mx-auto h-4 w-4 text-ok" aria-label={l.allowed} />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-err/70" aria-label={l.denied} />
                  )}
                </td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs">{r.security === null ? l.securityNone : l.securityLevel(r.security)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted">{l.matrixNote}</p>
    </div>
  );
}

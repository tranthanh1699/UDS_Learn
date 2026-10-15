import { Plus, Send, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { annotatePdu, annotatePduBytes } from '@/core/annotate';
import { formatCanId } from '@/core/can/frame';
import { maxSingleFramePayload } from '@/core/isotp/config';
import { decodePci } from '@/core/isotp/pci';
import { previewRequestFrames } from '@/core/trace/exchange';
import { hex, parseHexBytes } from '@/core/util/hex';
import type { Addressing, VehicleConfig } from '@/core/vehicle/types';
import type { ServiceFormSpec } from '@/data/services-meta';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { ByteRow } from '@/components/frames/ByteRow';
import { FrameCard } from '@/components/frames/FrameCard';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';

const p = vi.practice;
const inputCls = 'hex h-9 rounded-md border border-border bg-bg px-2.5 text-sm outline-none focus:border-accent';

interface Built {
  pdu: number[] | null;
  error: string | null;
}

function useHexRequest(text: string, withPci: boolean, fd: boolean): Built {
  return useMemo(() => {
    const bytes = parseHexBytes(text);
    if (bytes === null) return { pdu: null, error: p.hexInvalid };
    if (bytes.length === 0) return { pdu: null, error: p.empty };
    if (!withPci) return { pdu: bytes, error: null };
    const pci = decodePci(bytes, fd);
    if (pci.kind === 'error') return { pdu: null, error: p.pciInvalid(vi.isotp.errors[pci.code]) };
    if (pci.kind !== 'SF') return { pdu: null, error: p.pciOnlySf };
    return { pdu: bytes.slice(pci.pciLength, pci.pciLength + pci.length), error: null };
  }, [text, withPci, fd]);
}

export function RequestBuilder({ sid, form, config, onSend }: { sid: number; form: ServiceFormSpec; config: VehicleConfig; onSend: (pdu: number[], addressing: Addressing) => void }) {
  const [mode, setMode] = useState<'form' | 'hex'>('form');
  const [sub, setSub] = useState<number | 'custom'>(form.subFunctions?.[0]?.id ?? 0);
  const [customSub, setCustomSub] = useState('04');
  const [suppress, setSuppress] = useState(false);
  const [dids, setDids] = useState<number[]>(form.defaultDids ?? []);
  const [customDid, setCustomDid] = useState('');
  const [addressing, setAddressing] = useState<Addressing>('physical');
  const [hexText, setHexText] = useState('');
  const [withPci, setWithPci] = useState(false);

  const formBuilt: Built = useMemo(() => {
    if (form.didPicker) {
      if (dids.length === 0) return { pdu: null, error: p.noDid };
      return { pdu: [sid, ...dids.flatMap((d) => [d >> 8, d & 0xff])], error: null };
    }
    if (form.subFunctions) {
      // Giá trị tự nhập được giữ nguyên byte (kể cả bit 7); công tắc suppress chỉ bật thêm bit 7
      let value = sub === 'custom' ? 0 : sub;
      if (sub === 'custom') {
        const bytes = parseHexBytes(customSub);
        if (bytes?.length !== 1) return { pdu: null, error: p.hexInvalid };
        value = bytes[0]!;
      }
      return { pdu: [sid, value | (suppress ? 0x80 : 0)], error: null };
    }
    return { pdu: [sid], error: null };
  }, [form, dids, sid, sub, customSub, suppress]);
  const hexBuilt = useHexRequest(hexText, withPci, config.can.fd);
  const built = mode === 'form' ? formBuilt : hexBuilt;

  const tooLongForFunctional =
    built.pdu !== null && addressing === 'functional' && built.pdu.length > maxSingleFramePayload({ fd: config.can.fd, padding: config.can.padding });
  const error = built.error ?? (tooLongForFunctional ? p.functionalMultiFrame : null);

  const preview = useMemo(() => {
    if (!built.pdu) return null;
    return {
      bytes: annotatePduBytes(built.pdu, annotatePdu(built.pdu, { direction: 'request', config })),
      frames: previewRequestFrames(config, built.pdu, addressing),
    };
  }, [built.pdu, config, addressing]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (built.pdu && !error) onSend(built.pdu, addressing);
  };

  const addCustomDid = () => {
    const bytes = parseHexBytes(customDid);
    if (bytes?.length !== 2) return;
    setDids((d) => [...d, (bytes[0]! << 8) | bytes[1]!]);
    setCustomDid('');
  };

  return (
    <form onSubmit={submit} className="space-y-4" id="request-builder">
      <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
        {(['form', 'hex'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn('rounded px-3 py-1', mode === m ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg')}
          >
            {m === 'form' ? p.formMode : p.hexMode}
          </button>
        ))}
      </div>

      {mode === 'form' ? (
        <div className="space-y-3">
          {form.subFunctions && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">{p.subFunction}</span>
              <div className="flex flex-wrap gap-2">
                <select
                  value={sub}
                  onChange={(e) => setSub(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                  className={cn(inputCls, 'font-sans')}
                >
                  {form.subFunctions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                  <option value="custom">{p.custom}</option>
                </select>
                {sub === 'custom' && (
                  <input aria-label={p.customHex} value={customSub} onChange={(e) => setCustomSub(e.target.value)} maxLength={4} className={cn(inputCls, 'w-20')} />
                )}
              </div>
            </label>
          )}
          {form.allowSuppress && <Switch checked={suppress} onCheckedChange={setSuppress} label={p.suppress} hint={p.suppressHint} />}
          {form.didPicker && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted">{p.didPicker}</div>
              <div className="flex flex-wrap gap-1.5">
                {config.dids.map((d) => (
                  <button
                    key={d.did}
                    type="button"
                    onClick={() => setDids((cur) => [...cur, d.did])}
                    title={d.name}
                    className="rounded-md border border-border px-2 py-1 text-left text-xs hover:border-byte-did/60"
                  >
                    <span className="hex font-semibold text-byte-did">{hex(d.did, 4)}</span> <span className="text-muted">{d.name}</span>
                    {d.common && <span className="ml-1 text-[10px] text-accent">· {p.commonDid}</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customDid}
                  onChange={(e) => setCustomDid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomDid();
                    }
                  }}
                  placeholder={p.customDid}
                  maxLength={6}
                  className={cn(inputCls, 'w-48')}
                />
                <Button size="sm" className="h-9" onClick={addCustomDid}>
                  <Plus className="h-3.5 w-3.5" /> {p.add}
                </Button>
              </div>
              <div className="text-xs font-medium text-muted">{p.selectedDids}</div>
              <div className="flex min-h-8 flex-wrap gap-1.5">
                {dids.map((d, i) => (
                  <span key={`${d}-${i}`} className="hex inline-flex items-center gap-1 rounded border border-byte-did/40 bg-byte-did/10 px-1.5 py-0.5 text-xs text-byte-did">
                    {hex(d, 4)}
                    <button type="button" aria-label={p.remove} onClick={() => setDids((cur) => cur.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{p.hexInput}</span>
            <input autoFocus value={hexText} onChange={(e) => setHexText(e.target.value)} placeholder={p.hexPlaceholder} className={cn(inputCls, 'w-full')} />
          </label>
          <Switch checked={withPci} onCheckedChange={setWithPci} label={p.withPci} hint={p.withPciHint} />
        </div>
      )}

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted">{p.addressing}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(['physical', 'functional'] as const).map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="addressing" checked={addressing === a} onChange={() => setAddressing(a)} className="accent-[hsl(var(--accent))]" />
              {a === 'physical' ? p.physical : p.functional}
              <span className="hex text-xs text-muted">
                0x{formatCanId(a === 'physical' ? config.can.requestId : config.can.functionalId, config.can.idType)}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {addressing === 'physical'
            ? p.physicalHint(formatCanId(config.can.requestId, config.can.idType))
            : p.functionalHint(formatCanId(config.can.functionalId, config.can.idType))}
        </p>
      </fieldset>

      <div className="space-y-2 rounded-lg bg-surface-2/50 p-3">
        <div className="text-xs font-semibold text-muted">{p.preview}</div>
        {preview ? (
          <>
            <div className="text-xs text-muted">{p.pdu}</div>
            <ByteRow annotations={preview.bytes} />
            <div className="pt-1 text-xs text-muted">{p.frames}</div>
            <div className="space-y-1.5">
              {preview.frames.map((f) => (
                <FrameCard key={f.id} frame={f} />
              ))}
            </div>
          </>
        ) : null}
        {error && <p className="text-sm text-err">{error}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={!built.pdu || error !== null}>
          <Send className="h-4 w-4" /> {p.send}
        </Button>
        <span className="text-xs text-muted">{p.sendHint}</span>
      </div>
    </form>
  );
}

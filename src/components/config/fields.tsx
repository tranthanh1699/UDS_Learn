import { useEffect, useId, useState, type ReactNode } from 'react';
import { hex, parseHexBytes } from '@/core/util/hex';
import { cn } from '@/lib/cn';

export const inputCls =
  'h-9 w-full rounded-md border border-border bg-bg px-2.5 text-sm outline-none focus:border-accent aria-[invalid=true]:border-err';

export function Field({ label, hint, children, error }: { label: ReactNode; hint?: ReactNode; children: (id: string) => ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-xs text-err">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Ô nhập giữ nguyên nội dung người dùng đang gõ (kể cả khi tạm thời chưa hợp lệ);
 * khi rời ô (blur) thì đồng bộ lại theo giá trị thật bên ngoài.
 */
function useLocalText(external: string) {
  const [text, setText] = useState(external);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(external);
  }, [external, focused]);
  return { text, setText, bind: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) } };
}

/** Nhập số dạng hex với số chữ số cố định (ví dụ CAN ID). */
export function HexNumberInput({ id, value, onChange, width = 2, max = 0xffffffff, className }: { id?: string; value: number; onChange: (v: number) => void; width?: number; max?: number; className?: string }) {
  const { text, setText, bind } = useLocalText(hex(value, width));
  const parsed = /^(0x)?[0-9a-f]+$/i.test(text.trim()) ? parseInt(text.trim().replace(/^0x/i, ''), 16) : NaN;
  const valid = Number.isFinite(parsed) && parsed <= max;
  return (
    <div className={cn('relative', className)}>
      <span className="hex pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">0x</span>
      <input
        id={id}
        value={text}
        {...bind}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim().replace(/^0x/i, '');
          const v = /^[0-9a-f]{1,8}$/i.test(t) ? parseInt(t, 16) : NaN;
          // Giá trị vượt `max` vẫn được đưa ra ngoài để phần kiểm tra cấu hình báo lỗi rõ ràng
          if (Number.isFinite(v)) onChange(v);
        }}
        className={cn(inputCls, 'hex pl-7 uppercase')}
      />
    </div>
  );
}

export function NumberInput({ id, value, onChange, min, max, step = 1 }: { id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const { text, setText, bind } = useLocalText(String(value));
  const v = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={text}
      {...bind}
      min={min}
      max={max}
      step={step}
      aria-invalid={!valid}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
      className={cn(inputCls, 'hex')}
    />
  );
}

/** Nhập chuỗi byte dạng hex ("01 02 0A") hoặc ASCII. */
export function BytesInput({ value, onChange, ascii, label }: { value: number[]; onChange: (v: number[]) => void; ascii: boolean; label: string }) {
  const toText = (bytes: number[]) => (ascii ? String.fromCharCode(...bytes) : bytes.map((b) => hex(b)).join(' '));
  const { text, setText, bind } = useLocalText(toText(value));
  const parse = (t: string): number[] | null => {
    if (!ascii) return parseHexBytes(t);
    return [...t].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f) ? [...t].map((c) => c.charCodeAt(0)) : null;
  };
  const valid = parse(text) !== null;
  return (
    <input
      aria-label={label}
      value={text}
      {...bind}
      aria-invalid={!valid}
      onChange={(e) => {
        setText(e.target.value);
        const bytes = parse(e.target.value);
        if (bytes) onChange(bytes);
      }}
      className={cn(inputCls, 'hex h-8 text-xs', !ascii && 'uppercase')}
    />
  );
}

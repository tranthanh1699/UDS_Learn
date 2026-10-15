import { vi } from '@/i18n/vi';

/** Logo gốc của UDS Lab: ba thanh tượng trưng ba lớp UDS / ISO-TP / CAN. */
export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="7" className="fill-surface-2" />
        <rect x="6" y="9" width="5" height="14" rx="1.5" className="fill-byte-pci" />
        <rect x="13.5" y="9" width="5" height="14" rx="1.5" className="fill-byte-sid" />
        <rect x="21" y="9" width="5" height="14" rx="1.5" className="fill-byte-data" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-bold">{vi.app.name}</div>
        <div className="text-[10px] text-muted">ISO 14229-1 · ISO 15765-2</div>
      </div>
    </div>
  );
}

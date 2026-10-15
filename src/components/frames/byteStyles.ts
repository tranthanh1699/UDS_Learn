import type { FieldKind } from '@/core/annotate/types';

/** Màu ByteCell theo loại trường: PCI tím, SID xanh dương, sub-function cyan, DID vàng, dữ liệu xanh lá, NRC đỏ, padding xám. */
export const BYTE_KIND_CLASSES: Record<FieldKind, string> = {
  pci: 'bg-byte-pci/15 text-byte-pci border-byte-pci/40',
  sid: 'bg-byte-sid/15 text-byte-sid border-byte-sid/40',
  sub: 'bg-byte-sub/15 text-byte-sub border-byte-sub/40',
  did: 'bg-byte-did/15 text-byte-did border-byte-did/40',
  data: 'bg-byte-data/15 text-byte-data border-byte-data/40',
  nrc: 'bg-byte-nrc/20 text-byte-nrc border-byte-nrc/50',
  pad: 'bg-transparent text-byte-pad/80 border-border border-dashed',
};

export const BYTE_KIND_ORDER: FieldKind[] = ['pci', 'sid', 'sub', 'did', 'data', 'nrc', 'pad'];

/** Loại trường của một byte; quyết định màu ByteCell. */
export type FieldKind = 'pci' | 'sid' | 'sub' | 'did' | 'data' | 'nrc' | 'pad';

export interface BitInfo {
  /** Dải bit, ví dụ "7" hoặc "7–4". */
  range: string;
  name: string;
  /** Giá trị nhị phân của dải bit. */
  value: string;
  meaning: string;
}

/** Một trường của PDU UDS (có thể dài nhiều byte). */
export interface PduField {
  start: number;
  length: number;
  kind: FieldKind;
  /** Khóa nhóm: các byte cùng fieldId được highlight cùng nhau. */
  fieldId: string;
  field: string;
  meaning: string;
  /** Ghi chú riêng cho từng byte trong trường (ví dụ ký tự ASCII). */
  byteNotes?: (string | undefined)[];
  bits?: BitInfo[];
  isoRef?: string;
}

/** Chú thích cho một byte trong dữ liệu CAN frame. */
export interface ByteAnnotation {
  index: number;
  value: number;
  kind: FieldKind;
  fieldId: string;
  field: string;
  meaning: string;
  byteNote?: string;
  bits?: BitInfo[];
  isoRef?: string;
}

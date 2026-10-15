import { vi } from '../../i18n/vi';
import { hex } from '../util/hex';
import type { SecurityLevelConfig } from '../vehicle/types';

/**
 * Tính key từ seed cho SecurityAccess (0x27).
 * Mọi phép tính dùng số nguyên không dấu 32-bit; kết quả cuối được cắt theo độ dài seed.
 * Biểu thức tùy chỉnh được phân tích bằng parser riêng (không dùng eval).
 */

type Node =
  | { t: 'num'; v: number }
  | { t: 'seed' }
  | { t: 'un'; op: '~' | '-'; a: Node }
  | { t: 'bin'; op: BinOp; a: Node; b: Node };

type BinOp = '|' | '^' | '&' | '<<' | '>>' | '+' | '-' | '*';

const e = vi.security.exprErrors;
const MAX_EXPR_LENGTH = 200;

export type ParseResult = { ok: true; ast: Node } | { ok: false; error: string };

/** Ngữ pháp (ưu tiên tăng dần): | , ^ , & , << >> , + - , * , đơn ngôi ~ - , (biểu thức) / số / seed. */
export function parseKeyExpression(text: string): ParseResult {
  if (text.length > MAX_EXPR_LENGTH) return { ok: false, error: e.tooLong(MAX_EXPR_LENGTH) };
  const tokens: string[] = [];
  const re = /\s*(0x[0-9a-fA-F]+|\d+|seed|<<|>>|[|^&+\-*~()])/y;
  let pos = 0;
  while (pos < text.length) {
    if (/^\s*$/.test(text.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) return { ok: false, error: e.unexpectedChar(text.slice(pos).trim()[0] ?? '?', pos + 1) };
    tokens.push(m[1]!);
    pos = re.lastIndex;
  }
  if (tokens.length === 0) return { ok: false, error: e.empty };

  let i = 0;
  const peek = () => tokens[i];
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  const levels: BinOp[][] = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*']];

  const parseLevel = (lv: number): Node => {
    if (lv === levels.length) return parseUnary();
    let left = parseLevel(lv + 1);
    while (levels[lv]!.includes(peek() as BinOp)) {
      const op = tokens[i++] as BinOp;
      left = { t: 'bin', op, a: left, b: parseLevel(lv + 1) };
    }
    return left;
  };
  const parseUnary = (): Node => {
    const tk = peek();
    if (tk === '~' || tk === '-') {
      i++;
      return { t: 'un', op: tk, a: parseUnary() };
    }
    return parsePrimary();
  };
  const parsePrimary = (): Node => {
    const tk = tokens[i++];
    if (tk === undefined) return fail(e.unexpectedEnd);
    if (tk === 'seed') return { t: 'seed' };
    if (tk === '(') {
      const inner = parseLevel(0);
      if (tokens[i++] !== ')') return fail(e.missingParen);
      return inner;
    }
    if (/^(0x[0-9a-fA-F]+|\d+)$/.test(tk)) {
      const v = Number(tk);
      if (v > 0xffffffff) return fail(e.numberTooLarge(tk));
      return { t: 'num', v: v >>> 0 };
    }
    return fail(e.unexpectedToken(tk));
  };

  try {
    const ast = parseLevel(0);
    if (i < tokens.length) return { ok: false, error: e.unexpectedToken(tokens[i]!) };
    return { ok: true, ast };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface KeyStep {
  /** Mô tả phép tính, ví dụ "0x12345678 ^ 0x5A5A5A5A". */
  expr: string;
  value: number;
}

const h32 = (n: number) => `0x${hex(n >>> 0, 8)}`;

function evaluate(node: Node, seed: number, steps: KeyStep[]): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'seed':
      return seed;
    case 'un': {
      const a = evaluate(node.a, seed, steps);
      const v = (node.op === '~' ? ~a : -a) >>> 0;
      steps.push({ expr: `${node.op}${h32(a)}`, value: v });
      return v;
    }
    case 'bin': {
      const a = evaluate(node.a, seed, steps);
      const b = evaluate(node.b, seed, steps);
      let v: number;
      switch (node.op) {
        case '|': v = a | b; break;
        case '^': v = a ^ b; break;
        case '&': v = a & b; break;
        case '<<': v = a << (b & 31); break;
        case '>>': v = a >>> (b & 31); break;
        case '+': v = a + b; break;
        case '-': v = a - b; break;
        case '*': v = Math.imul(a, b); break;
      }
      v = v >>> 0;
      steps.push({ expr: `${h32(a)} ${node.op} ${node.op === '<<' || node.op === '>>' ? String(b & 31) : h32(b)}`, value: v });
      return v;
    }
  }
}

export const bytesToNumber = (bytes: readonly number[]): number => bytes.reduce((acc, b) => (acc * 256 + b) >>> 0, 0);

export function numberToBytes(value: number, length: number): number[] {
  return Array.from({ length }, (_, i) => (value >>> (8 * (length - 1 - i))) & 0xff);
}

const maskFor = (length: number) => (length >= 4 ? 0xffffffff : 2 ** (8 * length) - 1);

export interface KeyResult {
  ok: boolean;
  key: number[];
  steps: KeyStep[];
  error?: string;
}

/** Tính key cho một seed theo cấu hình của security level; trả về cả các bước trung gian. */
export function computeKey(seed: readonly number[], cfg: Pick<SecurityLevelConfig, 'algorithm' | 'constant' | 'expression' | 'seedLength'>): KeyResult {
  const len = cfg.seedLength;
  const s = bytesToNumber(seed);
  const steps: KeyStep[] = [];
  let ast: Node;
  if (cfg.algorithm === 'expression') {
    const parsed = parseKeyExpression(cfg.expression);
    if (!parsed.ok) return { ok: false, key: [], steps: [], error: parsed.error };
    ast = parsed.ast;
  } else {
    ast = { t: 'bin', op: cfg.algorithm === 'xor' ? '^' : '+', a: { t: 'seed' }, b: { t: 'num', v: cfg.constant >>> 0 } };
  }
  const raw = evaluate(ast, s, steps);
  const masked = len >= 4 ? raw : raw & maskFor(len);
  if (masked !== raw) steps.push({ expr: `${h32(raw)} & ${h32(maskFor(len))}`, value: masked });
  return { ok: true, key: numberToBytes(masked, len), steps };
}

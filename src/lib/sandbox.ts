import { buildExchange, type Exchange } from '@/core/trace/exchange';
import { UdsServer } from '@/core/uds/engine';
import { computeKey } from '@/core/uds/keyAlgorithm';
import type { UdsResult } from '@/core/uds/types';
import type { VehicleConfig } from '@/core/vehicle/types';
import type { ServiceExample } from '@/data/services-meta';

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32) để seed trong ví dụ không đổi giữa các lần hiển thị. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tạo request sendKey từ seed trong response requestSeed cuối cùng của bước chuẩn bị. */
function sendKeyRequest(config: VehicleConfig, setupResults: UdsResult[], mode: 'correct' | 'wrong'): number[] {
  const seedRsp = [...setupResults].reverse().find((r) => r.response?.[0] === 0x67)?.response;
  if (!seedRsp) return [0x27, 0x02];
  const level = seedRsp[1]!;
  const cfg = config.security.levels.find((l) => l.level === level);
  const key = cfg ? computeKey(seedRsp.slice(2), cfg).key : seedRsp.slice(2);
  if (mode === 'wrong') key[key.length - 1] = key[key.length - 1]! ^ 0xff;
  return [0x27, level + 1, ...key];
}

/**
 * Chạy một ví dụ trên ECU tạm (không ảnh hưởng ECU chính) và trả về exchange với frame thật.
 * Thời gian bắt đầu từ 0 để timestamp trong ví dụ dễ đọc.
 */
export function runExample(config: VehicleConfig, example: ServiceExample, randomSeed = 0x2026): Exchange {
  const ecu = new UdsServer(structuredClone(config), { random: seededRandom(randomSeed) });
  const conditions = { ...config.conditions, ...example.conditions };
  const setupResults = (example.setup ?? []).map((req) => ecu.handleRequest(req, { addressing: 'physical', now: 0, conditions }));
  if (example.setupState) ecu.patchState(example.setupState);
  const request = example.sendKeyFromSetup ? sendKeyRequest(config, setupResults, example.sendKeyFromSetup) : example.request;
  const result = ecu.handleRequest(request, { addressing: example.addressing ?? 'physical', now: 0, conditions });
  return buildExchange(0, 0, config, result);
}

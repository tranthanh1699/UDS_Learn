import { buildExchange, type Exchange } from '@/core/trace/exchange';
import { UdsServer } from '@/core/uds/engine';
import type { VehicleConfig } from '@/core/vehicle/types';
import type { ServiceExample } from '@/data/services-meta';

/**
 * Chạy một ví dụ trên ECU tạm (không ảnh hưởng ECU chính) và trả về exchange với frame thật.
 * Thời gian bắt đầu từ 0 để timestamp trong ví dụ dễ đọc.
 */
export function runExample(config: VehicleConfig, example: ServiceExample): Exchange {
  const ecu = new UdsServer(structuredClone(config));
  const conditions = { ...config.conditions, ...example.conditions };
  for (const req of example.setup ?? []) ecu.handleRequest(req, { addressing: 'physical', now: 0, conditions });
  if (example.setupState) ecu.patchState(example.setupState);
  const result = ecu.handleRequest(example.request, { addressing: example.addressing ?? 'physical', now: 0, conditions });
  return buildExchange(0, 0, config, result);
}

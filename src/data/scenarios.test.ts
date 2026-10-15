import { describe, expect, it } from 'vitest';
import { UdsServer } from '@/core/uds/engine';
import { DEFAULT_VEHICLE } from './defaultVehicle';
import { matchesExpectation, SCENARIOS, type StepContext } from './scenarios';

/** Chạy toàn bộ kịch bản trên ECU tạm với thời gian giả lập. */
function play(id: string) {
  const config = structuredClone(DEFAULT_VEHICLE);
  const ecu = new UdsServer(config);
  let now = 0;
  let conditions = { ...config.conditions };
  const ctx: StepContext = { lastSeed: null, config };
  const results: boolean[] = [];
  let autoTp = false;
  // Trong lúc chờ, TesterPresent tự động (nếu bật) được gửi mỗi 2 s như trong ứng dụng
  const wait = (ms: number) => {
    const end = now + ms;
    while (autoTp && now + 2000 < end) {
      now += 2000;
      ecu.handleRequest([0x3e, 0x80], { addressing: 'functional', now, conditions });
    }
    now = end;
  };
  for (const step of SCENARIOS.find((s) => s.id === id)!.steps) {
    now += 200;
    if (step.kind === 'action') {
      if (step.action === 'autoTpOn') autoTp = true;
      if (step.action === 'autoTpOff') autoTp = false;
      if (step.action === 'waitS3') wait(config.timing.s3Ms);
      if (step.action === 'waitSecurityDelay') wait(config.security.levels[0]!.delayMs);
      if (step.action === 'injectBattery') conditions = { ...conditions, batteryVoltage: 10.5 };
      if (step.action === 'removeBattery') conditions = { ...config.conditions };
      continue;
    }
    const req = step.build(ctx);
    expect(req).not.toBeNull();
    const r = ecu.handleRequest(req!, { addressing: step.addressing ?? 'physical', now, conditions });
    if (r.response?.[0] === 0x67 && r.response[1]! % 2 === 1) ctx.lastSeed = { level: r.response[1]!, seed: r.response.slice(2) };
    results.push(matchesExpectation(step.expect, r.outcome, r.nrc, r.response));
  }
  return results;
}

describe('kịch bản hướng dẫn chạy đúng như mong đợi', () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: ${s.title}`, () => {
      expect(play(s.id).every(Boolean)).toBe(true);
    });
  }
});

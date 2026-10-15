import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { UdsServer } from '../uds/engine';
import { buildExchange } from './exchange';
import { frameInfo, framesToCsv } from './summary';

function exchange(req: number[], addressing: 'physical' | 'functional' = 'physical') {
  const ecu = new UdsServer(structuredClone(DEFAULT_VEHICLE));
  return buildExchange(1, 1000, DEFAULT_VEHICLE, ecu.handleRequest(req, { addressing, now: 1000, conditions: DEFAULT_VEHICLE.conditions }));
}

describe('frameInfo', () => {
  it('request, FF/FC/CF của response nhiều frame', () => {
    const ex = exchange([0x22, 0xf1, 0x90]);
    expect(ex.frames.map((f) => frameInfo(f, ex))).toEqual([
      'ReadDataByIdentifier request',
      'Positive response ReadDataByIdentifier',
      'Flow Control CTS, BS=0, STmin=0 ms',
      'Consecutive Frame SN=1',
      'Consecutive Frame SN=2',
    ]);
  });

  it('negative response và request bị suppress', () => {
    const neg = exchange([0x22, 0x12, 0x34]);
    expect(frameInfo(neg.frames[1]!, neg)).toBe('Negative response: NRC 0x31 requestOutOfRange');
    const sup = exchange([0x3e, 0x80], 'functional');
    expect(frameInfo(sup.frames[0]!, sup)).toBe('TesterPresent request (functional) (response bị suppress)');
  });
});

describe('framesToCsv', () => {
  it('có BOM, tiêu đề tiếng Việt và dữ liệu được đặt trong ngoặc kép', () => {
    const ex = exchange([0x10, 0x03]);
    const csv = framesToCsv(ex.frames.map((frame) => ({ frame, exchange: ex })), 1000);
    expect(csv.startsWith('﻿"Thời gian (s)"')).toBe(true);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"0.000","Tx","7E0","11-bit","Single Frame","8","02 10 03 CC CC CC CC CC","DiagnosticSessionControl request"');
  });
});

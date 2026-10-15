import { beforeEach, describe, expect, it, vi as vitest } from 'vitest';

/** localStorage giả cho môi trường Node. */
function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  return data;
}

async function loadStore() {
  vitest.resetModules();
  return (await import('./vehicleConfig')).useVehicleConfigStore;
}

beforeEach(() => installStorage());

describe('vehicleConfig store', () => {
  it('thay đổi hợp lệ được áp dụng và lưu; tải lại vẫn còn', async () => {
    const data = installStorage();
    const store = await loadStore();
    store.getState().setConditions({ speedKmh: 50 });
    expect(store.getState().config.conditions.speedKmh).toBe(50);
    expect(data.get('udslab.vehicleConfig')).toContain('"speedKmh":50');
    const reloaded = await loadStore();
    expect(reloaded.getState().config.conditions.speedKmh).toBe(50);
  });

  it('thay đổi lỗi chỉ nằm ở bản nháp, không áp dụng cho ECU', async () => {
    const store = await loadStore();
    store.getState().update((d) => void (d.can.requestId = 0x900));
    const s = store.getState();
    expect(s.errors.length).toBeGreaterThan(0);
    expect(s.draft.can.requestId).toBe(0x900);
    expect(s.config.can.requestId).toBe(0x7e0);
    store.getState().update((d) => void (d.can.requestId = 0x7e1));
    expect(store.getState().errors).toEqual([]);
    expect(store.getState().config.can.requestId).toBe(0x7e1);
  });

  it('tắt động cơ đưa RPM về 0, bật lại về không tải', async () => {
    const store = await loadStore();
    store.getState().setConditions({ engineRunning: true });
    expect(store.getState().config.conditions.rpm).toBe(800);
    store.getState().setConditions({ engineRunning: false });
    expect(store.getState().config.conditions.rpm).toBe(0);
  });

  it('nhập JSON hỏng hoặc sai cấu trúc bị từ chối', async () => {
    const store = await loadStore();
    expect(store.getState().importJson('{not json')).toMatchObject({ ok: false });
    expect(store.getState().importJson('{"schemaVersion":1,"can":{"requestId":2048}}')).toMatchObject({ ok: false });
    expect(store.getState().importJson('{"schemaVersion":1,"ecuName":"ABS ECU"}')).toEqual({ ok: true });
    expect(store.getState().config.ecuName).toBe('ABS ECU');
  });

  it('dữ liệu hỏng trong localStorage → dùng cấu hình mặc định', async () => {
    installStorage({ 'udslab.vehicleConfig': '{"schemaVersion":1,"can":{"requestId":99999}}' });
    const store = await loadStore();
    expect(store.getState().config.can.requestId).toBe(0x7e0);
  });
});

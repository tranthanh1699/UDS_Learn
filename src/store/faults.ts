import { create } from 'zustand';

/** Trạng thái lỗi inject. Giai đoạn 7 sẽ thay bằng mô hình fault/DTC đầy đủ. */
interface FaultsState {
  activeFaultIds: string[];
  /** true khi ít nhất một DTC có bit7 warningIndicatorRequested */
  milOn: boolean;
  /** true khi có DTC của ABS ECU yêu cầu bật đèn cảnh báo */
  absLampOn: boolean;
}

export const useFaultsStore = create<FaultsState>(() => ({
  activeFaultIds: [],
  milOn: false,
  absLampOn: false,
}));

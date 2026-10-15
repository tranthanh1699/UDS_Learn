import { Car } from 'lucide-react';
import { useState } from 'react';
import { VehicleNetwork, VehicleNetworkLegend } from '@/assets/svg/VehicleNetwork';
import { vi } from '@/i18n/vi';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

/** Hình mạng xe gắn với trạng thái ECU thật và exchange gần nhất. */
export function LiveVehicleNetwork() {
  const session = useEcuRuntimeStore((s) => s.session);
  const unlockedLevel = useEcuRuntimeStore((s) => s.unlockedLevel);
  const rebooting = useEcuRuntimeStore((s) => s.rebooting);
  const last = useEcuRuntimeStore((s) => s.lastExchange);
  const ecuName = useVehicleConfigStore((s) => s.config.ecuName);
  // Exchange đã có trước khi hình được hiển thị thì không phát lại hiệu ứng
  const [seenAtMount] = useState(last?.id ?? null);
  const packet = last && last.id !== seenAtMount ? { id: last.id, outcome: last.result.outcome } : null;
  return (
    <Card>
      <CardHeader title={vi.car.title} icon={<Car className="h-4 w-4" />} extra={<VehicleNetworkLegend />} />
      <CardBody>
        <div className="mx-auto max-w-2xl">
          <VehicleNetwork packet={packet} session={session} unlockedLevel={unlockedLevel} rebooting={rebooting} ecuName={ecuName} />
        </div>
      </CardBody>
    </Card>
  );
}

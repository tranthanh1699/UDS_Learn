import { ListTree, Settings2, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Exchange } from '@/core/trace/exchange';
import type { ServiceLearnContent } from '@/data/services-meta';
import { vi } from '@/i18n/vi';
import { useEcuRuntimeStore } from '@/store/ecuRuntime';
import { useTraceStore } from '@/store/trace';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { ByteLegend } from '@/components/frames/ByteLegend';
import { ExchangeTimeline } from '@/components/frames/ExchangeTimeline';
import { LiveVehicleNetwork } from '@/components/uds/LiveVehicleNetwork';
import { PipelinePanel } from '@/components/uds/PipelinePanel';
import { ResultSummary } from '@/components/uds/ResultSummary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { RequestBuilder } from './RequestBuilder';

const p = vi.practice;

/** Phím Enter gửi request (trừ khi đang gõ trong ô nhập liệu ngoài form hoặc đang ở trên một nút). */
function useEnterToSend() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement;
      const form = document.getElementById('request-builder') as HTMLFormElement | null;
      if (!form || el.closest('textarea, button, [role="dialog"]')) return;
      // Ô text trong form đã tự submit khi nhấn Enter; select/radio/checkbox trong form thì do hook này submit
      const isTextInput = el instanceof HTMLInputElement && !['radio', 'checkbox'].includes(el.type);
      if (isTextInput || (!form.contains(el) && el.closest('input, select'))) return;
      e.preventDefault();
      form.requestSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Tab "Thực hành": tạo request, gửi tới ECU mô phỏng, xem pipeline, frame và hình xe. */
export function PracticeTab({ content }: { content: ServiceLearnContent }) {
  const config = useVehicleConfigStore((s) => s.config);
  const send = useEcuRuntimeStore((s) => s.send);
  // Kết quả của request gửi từ chính tab này (không lẫn với request gửi từ trang service khác)
  const [last, setLast] = useState<Exchange | null>(null);
  const pending = useEcuRuntimeStore((s) => s.simulateResponsePending);
  const setPending = useEcuRuntimeStore((s) => s.setSimulateResponsePending);
  const autoTp = useEcuRuntimeStore((s) => s.autoTesterPresent);
  const setAutoTp = useEcuRuntimeStore((s) => s.setAutoTesterPresent);
  const entries = useTraceStore((s) => s.entries);
  const startTime = useTraceStore((s) => s.startTime);
  const clear = useTraceStore((s) => s.clear);
  const [hideAuto, setHideAuto] = useState(true);
  useEnterToSend();

  const shown = useMemo(
    () => (hideAuto ? entries.filter((e) => !(e.type === 'exchange' && e.exchange.auto)) : entries),
    [entries, hideAuto],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={p.builder} icon={<Wrench className="h-4 w-4" />} />
            <CardBody>
              <RequestBuilder sid={parseInt(content.sid, 16)} form={content.form} config={config} onSend={(pdu, a) => setLast(send(pdu, a))} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={p.options} icon={<Settings2 className="h-4 w-4" />} />
            <CardBody className="space-y-3">
              <Switch checked={pending} onCheckedChange={setPending} label={p.responsePending} hint={p.responsePendingHint} />
              <Switch checked={autoTp} onCheckedChange={setAutoTp} label={p.autoTp} hint={p.autoTpHint} />
            </CardBody>
          </Card>
          {last && <ResultSummary result={last.result} />}
        </div>
        <div className="space-y-4">
          <LiveVehicleNetwork />
          <PipelinePanel steps={last?.result.steps ?? null} />
        </div>
      </div>

      <Card>
        <CardHeader
          title={p.timeline}
          icon={<ListTree className="h-4 w-4" />}
          extra={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={hideAuto} onChange={(e) => setHideAuto(e.target.checked)} />
                {p.hideAuto}
              </label>
              <Button size="sm" variant="ghost" onClick={clear}>
                <Trash2 className="h-3.5 w-3.5" /> {p.clear}
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-3">
          <ByteLegend />
          <p className="text-xs text-muted">{vi.frame.clickHint}</p>
          <ExchangeTimeline entries={shown} startTime={startTime} limit={10} />
        </CardBody>
      </Card>
    </div>
  );
}

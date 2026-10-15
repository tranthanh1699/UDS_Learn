import { AlertTriangle, CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { vi } from '@/i18n/vi';
import { useVehicleConfigStore } from '@/store/vehicleConfig';
import { CanTab } from '@/components/config/CanTab';
import { ConditionsTab } from '@/components/config/ConditionsTab';
import { DidTableTab } from '@/components/config/DidTableTab';
import { EcuInfoTab } from '@/components/config/EcuInfoTab';
import { SecurityTab } from '@/components/config/SecurityTab';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

const a = vi.config.actions;
const TABS = ['can', 'ecu', 'dids', 'security', 'conditions'] as const;

type Notice = { tone: 'ok' | 'err'; title: string; details?: string[] } | null;

export function ConfigPage() {
  const config = useVehicleConfigStore((s) => s.config);
  const errors = useVehicleConfigStore((s) => s.errors);
  const reset = useVehicleConfigStore((s) => s.reset);
  const importJson = useVehicleConfigStore((s) => s.importJson);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'uds-lab-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importJson(await file.text());
    setNotice(result.ok ? { tone: 'ok', title: a.imported } : { tone: 'err', title: a.importFailed, details: result.errors });
  };

  return (
    <>
      <PageHeader title={vi.pages.config.title} subtitle={vi.pages.config.subtitle} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setConfirmReset(true)}>
          <RotateCcw className="h-4 w-4" /> {a.reset}
        </Button>
        <Button onClick={exportJson}>
          <Download className="h-4 w-4" /> {a.export}
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {a.import}
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        <span className="text-xs text-muted">{a.saved}</span>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${notice.tone === 'ok' ? 'border-ok/40 bg-ok/10' : 'border-err/40 bg-err/10'}`}
        >
          {notice.tone === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-err" />}
          <div className="flex-1">
            <div className="font-medium">{notice.title}</div>
            {notice.details && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {notice.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setNotice(null)}>
            {a.close}
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="mb-4 rounded-lg border border-err/40 bg-err/10 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-err" /> {vi.config.errorsTitle}
          </div>
          <p className="mt-1 text-xs text-muted">{a.notSaved}</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="can">
        <TabsList className="mb-4 flex-wrap">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {vi.config.tabs[k]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="can">
          <CanTab />
        </TabsContent>
        <TabsContent value="ecu">
          <EcuInfoTab />
        </TabsContent>
        <TabsContent value="dids">
          <DidTableTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="conditions">
          <ConditionsTab />
        </TabsContent>
      </Tabs>

      <Dialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={a.resetTitle}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">{a.cancel}</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                reset();
                setConfirmReset(false);
                setNotice({ tone: 'ok', title: a.resetDone });
              }}
            >
              {a.confirm}
            </Button>
          </>
        }
      >
        {a.resetBody}
      </Dialog>
    </>
  );
}

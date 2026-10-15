import * as RS from '@radix-ui/react-slider';

export function Slider({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string }) {
  return (
    <RS.Root
      value={[value]}
      onValueChange={([v]) => v !== undefined && onChange(v)}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      className="relative flex h-5 w-full touch-none select-none items-center"
    >
      <RS.Track className="relative h-1.5 grow rounded-full bg-border">
        <RS.Range className="absolute h-full rounded-full bg-accent" />
      </RS.Track>
      <RS.Thumb aria-label={label} className="block h-4 w-4 rounded-full border-2 border-accent bg-surface shadow focus-visible:ring-2 focus-visible:ring-accent/60" />
    </RS.Root>
  );
}

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePI } from "@/lib/pi-store";
import { eur } from "@/lib/pi-domain";

function useAnimatedNumber(value: number, duration = 550) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (Math.abs(delta) < 0.0001) {
      setDisplay(value);
      return;
    }
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(origin + delta * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return display;
}

interface TileProps {
  title: string;
  subtitle: string;
  value: number;
  baseline: number;
  format: (n: number) => string;
  goodDirection: "up" | "down";
  target?: string;
}

function Tile({ title, subtitle, value, baseline, format, goodDirection, target }: TileProps) {
  const shown = useAnimatedNumber(value);
  const delta = value - baseline;
  const improving = goodDirection === "up" ? delta > 0 : delta < 0;
  const flat = Math.abs(delta) < 0.005;
  const tone = flat ? "text-muted-foreground" : improving ? "text-good" : "text-bad";

  return (
    <div className="rounded-lg border bg-card p-4 shadow-tile">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={cn(
            "mt-0.5 size-2.5 shrink-0 rounded-full",
            flat ? "bg-muted-foreground/40" : improving ? "bg-good" : "bg-bad",
          )}
          aria-hidden
        />
      </div>
      <p
        key={Math.round(value * 100)}
        className="animate-kpi tabular mt-3 text-3xl leading-none font-semibold"
      >
        {format(shown)}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className={cn("tabular font-medium", tone)}>
          {flat ? "±0" : `${delta > 0 ? "▲ +" : "▼ "}${format(Math.abs(delta))}`}
        </span>
        <span className="text-muted-foreground">
          vs. wave start {format(baseline)}
          {target ? ` · target ${target}` : ""}
        </span>
      </div>
    </div>
  );
}

export function KpiStrip() {
  const { kpis, state } = usePI();
  const pct = (n: number) => `${n.toFixed(1)} %`;

  return (
    <section aria-label="Key performance indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Tile
        title="Inventory Record Accuracy"
        subtitle="Posted count items within ±2 % tolerance"
        value={kpis.ira}
        baseline={state.baseline.ira}
        format={pct}
        goodDirection="up"
        target="95.0 %"
      />
      <Tile
        title="Open Difference Exposure"
        subtitle="Unposted value at risk, plant 1010"
        value={kpis.openVarianceValue}
        baseline={state.baseline.openVarianceValue}
        format={(n) => eur(n)}
        goodDirection="down"
      />
      <Tile
        title="Count Completion"
        subtitle="PI documents posted in wave CC-2026-34"
        value={kpis.completion}
        baseline={state.baseline.completion}
        format={pct}
        goodDirection="up"
        target="100 %"
      />
    </section>
  );
}

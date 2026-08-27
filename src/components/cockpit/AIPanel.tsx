import { cn } from "@/lib/utils";
import type { AIRecommendation } from "@/lib/pi-domain";
import { ACTION_META } from "@/lib/pi-domain";
import { Pill } from "./ui";

export function AIPanel({
  ai,
  onApply,
  applyLabel,
  disabled,
}: {
  ai: AIRecommendation | null;
  onApply: () => void;
  applyLabel: string;
  disabled?: boolean;
}) {
  if (!ai) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No recommendation required</p>
        <p className="mt-1">
          The difference has been posted and the book stock is reconciled. The engine only evaluates
          open physical inventory documents.
        </p>
      </div>
    );
  }

  const tone = ACTION_META[ai.action].tone as "info" | "warn" | "good";

  return (
    <div
      key={`${ai.docId}-${ai.action}-${ai.score}`}
      className="animate-kpi rounded-lg border bg-card p-4 shadow-tile"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          AI Difference Advisor
        </span>
        <Pill tone="neutral">rule-based · grounded in PI data</Pill>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone={tone} className="text-xs">
          Recommended: {ai.label}
        </Pill>
        <span className="tabular text-[11px] text-muted-foreground">
          Confidence {ai.confidence}% · Priority score {ai.score}/100
        </span>
      </div>

      <p className="mt-2 text-sm leading-snug text-foreground/90">{ai.rationale}</p>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t pt-3 sm:grid-cols-2">
        {ai.factors.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="tabular truncate font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      <button
        onClick={onApply}
        disabled={disabled}
        className={cn(
          "mt-4 w-full rounded-md px-3 py-2 text-sm font-semibold transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {applyLabel}
      </button>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "warn" | "good" | "bad";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/25",
  warn: "bg-warn-soft text-warn border-warn/30",
  good: "bg-good-soft text-good border-good/25",
  bad: "bg-bad-soft text-bad border-bad/25",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

export function MessageStrip({
  kind,
  code,
  children,
  onClose,
}: {
  kind: "success" | "error" | "info";
  code?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const map = {
    success: "bg-good-soft border-good/30 text-good",
    error: "bg-bad-soft border-bad/30 text-bad",
    info: "bg-info-soft border-info/30 text-info",
  } as const;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm animate-kpi",
        map[kind],
      )}
    >
      <span className="mt-px font-semibold">
        {kind === "success" ? "✓" : kind === "error" ? "!" : "i"}
      </span>
      <p className="flex-1 leading-snug">
        {code ? <span className="font-mono text-xs opacity-80">[{code}] </span> : null}
        {children}
      </p>
      {onClose ? (
        <button
          onClick={onClose}
          aria-label="Dismiss message"
          className="rounded px-1 leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

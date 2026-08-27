import { cn } from "@/lib/utils";
import type { DocCalc } from "@/lib/pi-domain";
import { PROCESS_FLOW } from "@/lib/pi-domain";

function stageIndex(c: DocCalc) {
  switch (c.doc.status) {
    case "CREATED":
    case "RECOUNT":
      return 0;
    case "COUNTED":
      return c.requiresApproval || c.suspect ? 2 : 1;
    case "PENDING_APPROVAL":
      return 2;
    case "POSTED":
      return 3;
  }
}

export function ProcessFlow({ calc }: { calc: DocCalc }) {
  const current = stageIndex(calc);

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {PROCESS_FLOW.map((s, i) => {
        const done = i < current || calc.doc.status === "POSTED";
        const active = i === current && calc.doc.status !== "POSTED";
        return (
          <li key={s.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                done
                  ? "border-good/30 bg-good-soft text-good"
                  : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              <span className="font-mono text-[10px] opacity-80">{s.tcode}</span>
              <span>{s.label}</span>
              {done ? <span aria-hidden>✓</span> : null}
            </div>
            {i < PROCESS_FLOW.length - 1 ? (
              <span className="text-muted-foreground/50" aria-hidden>
                ›
              </span>
            ) : null}
          </li>
        );
      })}
      {calc.doc.recountCount > 0 ? (
        <li className="rounded-full border border-warn/30 bg-warn-soft px-2.5 py-1 text-[11px] font-medium text-warn">
          Recount cycle {calc.doc.recountCount}
        </li>
      ) : null}
    </ol>
  );
}

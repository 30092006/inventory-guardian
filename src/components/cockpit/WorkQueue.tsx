import { cn } from "@/lib/utils";
import { usePI } from "@/lib/pi-store";
import { ACTION_META, STATUS_META, eur } from "@/lib/pi-domain";
import { Pill } from "./ui";

export function WorkQueue({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { queue, calcs } = usePI();
  const posted = calcs.filter((c) => c.doc.status === "POSTED");

  return (
    <section
      aria-label="Physical inventory work queue"
      className="flex min-h-0 flex-col rounded-lg border bg-card shadow-tile"
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Difference Work Queue</h2>
          <p className="text-[11px] text-muted-foreground">
            Open PI documents · ranked by AI priority score
          </p>
        </div>
        <Pill tone="info">{queue.length} open</Pill>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Work queue is clear</p>
            <p className="mt-1">
              All physical inventory documents in wave CC-2026-34 are posted. Inventory record
              accuracy is final for this period.
            </p>
          </div>
        ) : (
          <ul>
            {queue.map(({ calc, ai }) => {
              const active = calc.doc.id === selectedId;
              const meta = STATUS_META[calc.doc.status];
              return (
                <li key={calc.doc.id}>
                  <button
                    onClick={() => onSelect(calc.doc.id)}
                    aria-current={active}
                    className={cn(
                      "w-full border-b px-4 py-3 text-left transition-colors",
                      active ? "bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        PI {calc.doc.id}
                      </span>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {calc.items[0]!.material.description}
                      {calc.items.length > 1 ? ` +${calc.items.length - 1} item(s)` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>
                        Plant {calc.doc.plant} / SLoc {calc.doc.sloc}
                      </span>
                      <span className="tabular">
                        Diff{" "}
                        <strong
                          className={cn(
                            "font-semibold",
                            !calc.allCounted
                              ? "text-muted-foreground"
                              : calc.absVarianceValue > 5000
                                ? "text-bad"
                                : "text-foreground",
                          )}
                        >
                          {calc.allCounted ? eur(calc.totalVarianceValue) : "—"}
                        </strong>
                      </span>
                      {calc.overdue > 0 ? (
                        <span className="text-warn">{calc.overdue}d overdue</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        AI
                      </span>
                      <Pill tone={ACTION_META[ai.action].tone as "info" | "warn" | "good"}>
                        {ai.label}
                      </Pill>
                      <span className="tabular ml-auto text-[11px] text-muted-foreground">
                        Score {ai.score}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {posted.length > 0 ? (
          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Completed ({posted.length})
            </p>
            <ul className="space-y-1">
              {posted.map((c) => (
                <li key={c.doc.id}>
                  <button
                    onClick={() => onSelect(c.doc.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                      c.doc.id === selectedId ? "bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <span className="font-mono text-muted-foreground">PI {c.doc.id}</span>
                    <span className="tabular truncate text-muted-foreground">
                      MatDoc {c.doc.materialDocNo}
                    </span>
                    <Pill tone="good">Posted</Pill>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

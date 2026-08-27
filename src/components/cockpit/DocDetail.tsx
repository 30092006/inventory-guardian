import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePI } from "@/lib/pi-store";
import {
  STATUS_META,
  TOLERANCE_VALUE_EUR,
  eur,
  num,
  type ValidationResult,
} from "@/lib/pi-domain";
import { Field, MessageStrip, Pill } from "./ui";
import { ProcessFlow } from "./ProcessFlow";
import { AIPanel } from "./AIPanel";

type Msg = { kind: "success" | "error" | "info"; code?: string; text: string } | null;

export function DocDetail({ docId }: { docId: string }) {
  const { calcs, recFor, enterCount, post, recount, approve } = usePI();
  const calc = calcs.find((c) => c.doc.id === docId);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    setDrafts({});
    setMsg(null);
  }, [docId]);

  if (!calc) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-tile">
        Select a physical inventory document from the work queue.
      </div>
    );
  }

  const { doc } = calc;
  const ai = recFor(doc.id);
  const meta = STATUS_META[doc.status];
  const editable = doc.status !== "POSTED";

  const handle = (res: ValidationResult, successText: string) => {
    setMsg(
      res.ok
        ? { kind: "success", text: successText }
        : { kind: "error", code: res.code, text: res.message },
    );
  };

  const submitCount = (itemNo: number) => {
    const raw = drafts[itemNo] ?? "";
    const res = enterCount(doc.id, itemNo, raw);
    if (res.ok) setDrafts((d) => ({ ...d, [itemNo]: "" }));
    handle(res, `Count quantity ${raw} saved for item ${itemNo}. Difference recalculated.`);
  };

  const doPost = () =>
    handle(
      post(doc.id),
      "Difference posted (MI07). Material document created, book stock corrected and KPIs recalculated.",
    );
  const doRecount = () =>
    handle(recount(doc.id), "Recount document created (MI11). Previous count cleared.");
  const doApprove = () =>
    handle(approve(doc.id), "Write-off approved. The difference can now be posted.");

  const applyAI = () => {
    if (!ai) return;
    if (ai.action === "POST") doPost();
    else if (ai.action === "RECOUNT") doRecount();
    else if (ai.action === "APPROVE") doApprove();
    else
      setMsg({
        kind: "info",
        text: "Enter the physical count quantity for each item below, then post the difference.",
      });
  };

  return (
    <section aria-label="Physical inventory document detail" className="flex flex-col gap-3">
      {/* Object header */}
      <div className="rounded-lg border bg-card p-4 shadow-tile">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              Physical Inventory Document {doc.id} / FY {doc.fiscalYear}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">
              {calc.items.length === 1
                ? calc.items[0]!.material.description
                : `${calc.items.length} materials · storage location ${doc.sloc}`}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={meta.tone}>{meta.label}</Pill>
            {doc.approvedBy ? <Pill tone="good">Approved</Pill> : null}
            {calc.overdue > 0 && doc.status !== "POSTED" ? (
              <Pill tone="warn">{calc.overdue} days overdue</Pill>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <ProcessFlow calc={calc} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Plant / SLoc" value={`${doc.plant} / ${doc.sloc}`} />
          <Field label="Planned count date" value={doc.plannedDate} />
          <Field label="Counted by" value={doc.countedBy ?? "—"} />
          <Field
            label="Difference value"
            value={
              <span
                className={cn(
                  "tabular",
                  !calc.allCounted
                    ? "text-muted-foreground"
                    : calc.absVarianceValue > TOLERANCE_VALUE_EUR
                      ? "text-bad"
                      : "text-good",
                )}
              >
                {calc.allCounted ? eur(calc.totalVarianceValue) : "—"}
              </span>
            }
          />
          <Field
            label="Material document"
            value={doc.materialDocNo ? <span className="font-mono">{doc.materialDocNo}</span> : "—"}
          />
        </div>
      </div>

      {msg ? (
        <MessageStrip kind={msg.kind} code={msg.code} onClose={() => setMsg(null)}>
          {msg.text}
        </MessageStrip>
      ) : null}

      {/* Items */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-tile">
        <header className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Count items</h3>
          <p className="text-[11px] text-muted-foreground">
            Book quantity from MARD · difference posted to movement type 701/702
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">Item / Material</th>
                <th className="px-3 py-2 text-right font-medium">Book qty</th>
                <th className="px-3 py-2 text-right font-medium">Count qty</th>
                <th className="px-3 py-2 text-right font-medium">Difference</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {calc.items.map((ic) => (
                <tr key={ic.item.itemNo} className="border-b last:border-0 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium">{ic.material.description}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{ic.material.matnr}</span>
                      <Pill tone={ic.material.abc === "A" ? "bad" : ic.material.abc === "B" ? "warn" : "neutral"}>
                        ABC {ic.material.abc}
                      </Pill>
                      <span className="tabular">MAP {eur(ic.material.price)}</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-3 text-right">
                    {num(ic.item.bookQtySnapshot)} {ic.material.uom}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {ic.counted ? (
                      <span className="tabular font-medium">
                        {num(ic.item.countQty!)} {ic.material.uom}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">not counted</span>
                    )}
                    {editable ? (
                      <div className="mt-1.5 flex items-center justify-end gap-1">
                        <label className="sr-only" htmlFor={`c-${ic.item.itemNo}`}>
                          Count quantity for item {ic.item.itemNo}
                        </label>
                        <input
                          id={`c-${ic.item.itemNo}`}
                          inputMode="decimal"
                          value={drafts[ic.item.itemNo] ?? ""}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [ic.item.itemNo]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitCount(ic.item.itemNo);
                          }}
                          placeholder="Enter count"
                          className="tabular w-24 rounded border border-input bg-background px-2 py-1 text-right text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                        />
                        <button
                          onClick={() => submitCount(ic.item.itemNo)}
                          className="rounded border border-input bg-secondary px-2 py-1 text-xs font-medium hover:bg-accent"
                        >
                          Save
                        </button>
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      "tabular px-3 py-3 text-right font-medium",
                      !ic.counted
                        ? "text-muted-foreground"
                        : ic.varianceQty === 0
                          ? "text-good"
                          : Math.abs(ic.variancePct) >= 25
                            ? "text-bad"
                            : "text-warn",
                    )}
                  >
                    {ic.counted ? (
                      <>
                        {ic.varianceQty > 0 ? "+" : ""}
                        {num(ic.varianceQty)}
                        <span className="block text-[11px] font-normal opacity-80">
                          {ic.variancePct > 0 ? "+" : ""}
                          {ic.variancePct.toFixed(1)} %
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-medium">
                    {ic.counted ? eur(ic.varianceValue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60 text-sm font-semibold">
                <td className="px-4 py-2" colSpan={3}>
                  Total difference
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {calc.allCounted ? `${calc.maxAbsPct.toFixed(1)} % max` : "—"}
                </td>
                <td className="tabular px-4 py-2 text-right">
                  {calc.allCounted ? eur(calc.totalVarianceValue) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI + actions */}
      <div className="grid gap-3 lg:grid-cols-2">
        <AIPanel
          ai={ai}
          onApply={applyAI}
          applyLabel={ai ? `Apply recommendation — ${ai.label}` : "No action"}
          disabled={!ai}
        />

        <div className="rounded-lg border bg-card p-4 shadow-tile">
          <h3 className="text-sm font-semibold">Business actions</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Posting tolerance {eur(TOLERANCE_VALUE_EUR)} per document · recount limit 1
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={doPost}
              disabled={!editable}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Post difference (MI07)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={doRecount}
                disabled={!editable}
                className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trigger recount
              </button>
              <button
                onClick={doApprove}
                disabled={!editable || !!doc.approvedBy}
                className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve write-off
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
            <li>• Count quantity is mandatory and cannot be negative.</li>
            <li>
              • Differences above {eur(TOLERANCE_VALUE_EUR)} require supervisor approval before
              posting.
            </li>
            <li>• Posted documents are locked — no duplicate posting or recount.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PIStoreProvider, usePI } from "@/lib/pi-store";
import { KpiStrip } from "@/components/cockpit/KpiStrip";
import { WorkQueue } from "@/components/cockpit/WorkQueue";
import { DocDetail } from "@/components/cockpit/DocDetail";
import { USER, eur } from "@/lib/pi-domain";
import { Pill } from "@/components/cockpit/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Physical Inventory Difference Cockpit — Plant 1010" },
      {
        name: "description",
        content:
          "SAP MM-IM cycle counting cockpit: prioritise physical inventory differences, apply AI-ranked recommendations, post MI07 corrections and track inventory record accuracy live.",
      },
      { property: "og:title", content: "Physical Inventory Difference Cockpit — Plant 1010" },
      {
        property: "og:description",
        content:
          "Decision cockpit for warehouse inventory accuracy: AI-ranked count differences, tolerance controls and live IRA KPIs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PIStoreProvider>
      <Cockpit />
    </PIStoreProvider>
  ),
});

function Cockpit() {
  const { queue, state, reset } = usePI();
  const [selected, setSelected] = useState<string>(
    () => queue[0]?.calc.doc.id ?? state.docs[0]!.id,
  );
  const activeId = state.docs.some((d) => d.id === selected)
    ? selected
    : (queue[0]?.calc.doc.id ?? state.docs[0]!.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-shell text-shell-foreground">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-shell-foreground/15 text-xs font-bold">
              PI
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold">Physical Inventory — Difference Cockpit</h1>
              <p className="text-[11px] opacity-70">
                MM-IM · Cycle count wave CC-2026-34 · Plant 1010
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            <span className="hidden sm:inline opacity-80">
              {USER.name} · {USER.role}
            </span>
            <button
              onClick={() => {
                reset();
                setSelected("0100000451");
              }}
              className="rounded border border-shell-foreground/25 px-2 py-1 font-medium transition-colors hover:bg-shell-foreground/10"
            >
              Reset demo data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-6">
        <KpiStrip />

        <div className="grid gap-3 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[380px_1fr]">
          <div className="lg:sticky lg:top-[60px] lg:max-h-[calc(100vh-76px)]">
            <WorkQueue selectedId={activeId} onSelect={setSelected} />
          </div>
          <div className="min-w-0 space-y-3">
            <DocDetail docId={activeId} />
            <ActivityLog />
          </div>
        </div>
      </main>
    </div>
  );
}

function ActivityLog() {
  const { state, kpis } = usePI();
  return (
    <section className="rounded-lg border bg-card p-4 shadow-tile">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Document flow / activity</h3>
        <Pill tone="info">Open exposure {eur(kpis.openVarianceValue)}</Pill>
      </div>
      <ul className="mt-3 space-y-2">
        {state.log.map((l) => (
          <li key={l.id} className="flex gap-2 text-xs">
            <span
              className={
                l.kind === "success"
                  ? "text-good"
                  : l.kind === "error"
                    ? "text-bad"
                    : "text-muted-foreground"
              }
              aria-hidden
            >
              ●
            </span>
            <span className="font-mono text-muted-foreground">{l.docId}</span>
            <span className="flex-1 text-foreground/90">{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

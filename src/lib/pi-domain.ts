// SAP MM-IM Physical Inventory (Cycle Counting) — domain model, rules & KPIs.
// Single source of truth for all application data lives in the store (pi-store.tsx);
// this module holds pure types + pure calculation/validation/AI functions.

export type ABCClass = "A" | "B" | "C";

export type PIStatus =
  | "CREATED" // MI01 — PI document created, count not entered
  | "COUNTED" // MI04 — count entered
  | "PENDING_APPROVAL" // difference exceeds tolerance, supervisor approval required
  | "RECOUNT" // MI11 — recount document triggered
  | "POSTED"; // MI07 — difference posted, stock corrected

export interface Material {
  matnr: string;
  description: string;
  plant: string;
  sloc: string;
  uom: string;
  price: number; // moving average price (EUR)
  abc: ABCClass;
  bookQty: number; // MARD book stock — corrected on posting
}

export interface PIItem {
  itemNo: number;
  matnr: string;
  bookQtySnapshot: number; // book qty at time of PI doc creation
  countQty: number | null;
}

export interface PIDoc {
  id: string; // physical inventory document number
  plant: string;
  sloc: string;
  fiscalYear: number;
  plannedDate: string; // ISO
  countedBy: string | null;
  countedOn: string | null;
  status: PIStatus;
  recountOf: string | null;
  recountCount: number;
  approvedBy: string | null;
  materialDocNo: string | null;
  postedOn: string | null;
  items: PIItem[];
}

export interface LogEntry {
  id: string;
  ts: string;
  docId: string;
  text: string;
  kind: "success" | "error" | "info";
}

export interface AppState {
  materials: Record<string, Material>;
  docs: PIDoc[];
  log: LogEntry[];
  baseline: KPIValues;
  seq: number;
}

// ---------------------------------------------------------------- constants
export const TOLERANCE_VALUE_EUR = 5000; // absolute difference value requiring approval
export const TOLERANCE_PCT = 2; // |variance %| within this = "accurate" count
export const SUSPECT_PCT = 25; // above this the count is implausible -> recount
export const MAX_RECOUNTS = 1;
export const USER = { name: "M. Keller", role: "Warehouse Clerk" };
export const SUPERVISOR = "R. Vogel (Inventory Supervisor)";

// ---------------------------------------------------------------- helpers
export const eur = (n: number) =>
  `${n < 0 ? "-" : ""}€${Math.abs(Math.round(n)).toLocaleString("de-DE")}`;

export const num = (n: number, d = 0) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

export function daysOverdue(plannedDate: string, today = new Date()): number {
  const d = Math.floor((today.getTime() - new Date(plannedDate).getTime()) / 86_400_000);
  return d;
}

export interface ItemCalc {
  item: PIItem;
  material: Material;
  varianceQty: number;
  variancePct: number;
  varianceValue: number;
  counted: boolean;
}

export function calcItem(item: PIItem, materials: Record<string, Material>): ItemCalc {
  const material = materials[item.matnr]!;
  const counted = item.countQty !== null;
  const varianceQty = counted ? item.countQty! - item.bookQtySnapshot : 0;
  const variancePct =
    counted && item.bookQtySnapshot !== 0
      ? (varianceQty / item.bookQtySnapshot) * 100
      : counted
        ? 100
        : 0;
  return {
    item,
    material,
    varianceQty,
    variancePct,
    varianceValue: varianceQty * material.price,
    counted,
  };
}

export interface DocCalc {
  doc: PIDoc;
  items: ItemCalc[];
  totalVarianceValue: number; // signed
  absVarianceValue: number;
  maxAbsPct: number;
  allCounted: boolean;
  bookValue: number;
  overdue: number;
  requiresApproval: boolean;
  suspect: boolean;
}

export function calcDoc(doc: PIDoc, materials: Record<string, Material>): DocCalc {
  const items = doc.items.map((i) => calcItem(i, materials));
  const totalVarianceValue = items.reduce((s, i) => s + i.varianceValue, 0);
  const absVarianceValue = items.reduce((s, i) => s + Math.abs(i.varianceValue), 0);
  const maxAbsPct = items.reduce((m, i) => Math.max(m, Math.abs(i.variancePct)), 0);
  const allCounted = items.every((i) => i.counted);
  return {
    doc,
    items,
    totalVarianceValue,
    absVarianceValue,
    maxAbsPct,
    allCounted,
    bookValue: items.reduce((s, i) => s + i.item.bookQtySnapshot * i.material.price, 0),
    overdue: daysOverdue(doc.plannedDate),
    requiresApproval: allCounted && absVarianceValue > TOLERANCE_VALUE_EUR,
    suspect: allCounted && maxAbsPct >= SUSPECT_PCT,
  };
}

export const isOpen = (d: PIDoc) => d.status !== "POSTED";

// ---------------------------------------------------------------- KPIs
export interface KPIValues {
  ira: number; // inventory record accuracy %
  openVarianceValue: number; // EUR at risk in open PI documents
  completion: number; // cycle count completion %
}

export function calcKPIs(state: Pick<AppState, "docs" | "materials">): KPIValues {
  const posted = state.docs.filter((d) => d.status === "POSTED");
  const postedItems = posted.flatMap((d) => d.items.map((i) => calcItem(i, state.materials)));
  const accurate = postedItems.filter((i) => Math.abs(i.variancePct) <= TOLERANCE_PCT).length;
  const ira = postedItems.length ? (accurate / postedItems.length) * 100 : 0;

  const openVarianceValue = state.docs
    .filter(isOpen)
    .reduce((s, d) => s + calcDoc(d, state.materials).absVarianceValue, 0);

  const completion = state.docs.length ? (posted.length / state.docs.length) * 100 : 0;
  return { ira, openVarianceValue, completion };
}

// ---------------------------------------------------------------- validation
export interface ValidationResult {
  ok: boolean;
  code?: string;
  message: string;
}

/** V1 — count entry: mandatory, numeric, non-negative. */
export function validateCount(raw: string): ValidationResult {
  if (raw.trim() === "")
    return { ok: false, code: "PI 021", message: "Count quantity is mandatory — enter a value." };
  const v = Number(raw);
  if (!Number.isFinite(v))
    return { ok: false, code: "PI 022", message: "Count quantity must be numeric." };
  if (v < 0)
    return { ok: false, code: "PI 023", message: "Negative count quantity is not allowed." };
  return { ok: true, message: "Count quantity valid." };
}

/** V2 + V3 — posting: valid status sequence, complete count, tolerance/approval control. */
export function validatePost(c: DocCalc): ValidationResult {
  const { doc } = c;
  if (doc.status === "POSTED")
    return {
      ok: false,
      code: "M7 083",
      message: `Difference already posted with material document ${doc.materialDocNo}. Duplicate posting rejected.`,
    };
  if (doc.status === "CREATED" || doc.status === "RECOUNT" || !c.allCounted)
    return {
      ok: false,
      code: "M7 049",
      message: "Count must be entered for all items before the difference can be posted.",
    };
  if (c.requiresApproval && !doc.approvedBy)
    return {
      ok: false,
      code: "M7 314",
      message: `Difference value ${eur(c.absVarianceValue)} exceeds the ${eur(
        TOLERANCE_VALUE_EUR,
      )} posting tolerance. Supervisor approval is required.`,
    };
  return { ok: true, message: "Posting checks passed." };
}

export function validateRecount(c: DocCalc): ValidationResult {
  if (c.doc.status === "POSTED")
    return {
      ok: false,
      code: "M7 083",
      message: "Difference already posted — a recount can no longer be triggered.",
    };
  if (!c.allCounted)
    return {
      ok: false,
      code: "M7 049",
      message: "Enter the first count before triggering a recount.",
    };
  if (c.doc.recountCount >= MAX_RECOUNTS)
    return {
      ok: false,
      code: "PI 044",
      message: `Recount limit reached (max ${MAX_RECOUNTS}). Escalate for approval and post instead.`,
    };
  return { ok: true, message: "Recount allowed." };
}

export function validateApprove(c: DocCalc): ValidationResult {
  if (c.doc.status === "POSTED")
    return { ok: false, code: "M7 083", message: "Document already posted." };
  if (!c.allCounted)
    return { ok: false, code: "M7 049", message: "Count is incomplete — nothing to approve." };
  if (!c.requiresApproval)
    return {
      ok: false,
      code: "PI 031",
      message: "Difference is within tolerance — approval is not applicable. Post directly.",
    };
  if (c.doc.approvedBy)
    return { ok: false, code: "PI 032", message: "Approval already granted." };
  return { ok: true, message: "Approval can be granted." };
}

// ---------------------------------------------------------------- AI (rules-based, data-grounded)
export type AIAction = "COUNT" | "RECOUNT" | "APPROVE" | "POST";

export interface AIRecommendation {
  docId: string;
  action: AIAction;
  label: string;
  rationale: string;
  factors: { label: string; value: string }[];
  score: number; // 0-100 priority
  confidence: number; // 0-100
}

/**
 * Deterministic, rule-filtered recommendation engine.
 * Only actions that pass business validation can ever be recommended.
 */
export function recommend(c: DocCalc): AIRecommendation {
  const { doc } = c;
  const valueAtRisk = c.absVarianceValue;
  const abc = c.items.some((i) => i.material.abc === "A")
    ? "A"
    : c.items.some((i) => i.material.abc === "B")
      ? "B"
      : "C";

  // ---- priority score (transparent weighting)
  const valueScore = Math.min(50, (valueAtRisk / 12000) * 50);
  const abcScore = abc === "A" ? 20 : abc === "B" ? 12 : 5;
  const overdueScore = Math.min(20, Math.max(0, c.overdue) * 4);
  const pctScore = Math.min(10, (c.maxAbsPct / 40) * 10);
  const score = Math.round(valueScore + abcScore + overdueScore + pctScore);

  const factors = [
    { label: "Difference value", value: c.allCounted ? eur(c.absVarianceValue) : "not counted" },
    { label: "Max deviation", value: c.allCounted ? `${c.maxAbsPct.toFixed(1)} %` : "—" },
    { label: "ABC indicator", value: `${abc} — ${eur(c.bookValue)} book value` },
    { label: "Count due", value: c.overdue > 0 ? `${c.overdue} days overdue` : "on schedule" },
    { label: "Recount cycle", value: `${doc.recountCount} of ${MAX_RECOUNTS}` },
  ];

  // ---- rule-filtered action selection
  if (!c.allCounted) {
    return {
      docId: doc.id,
      action: "COUNT",
      label: "Execute count",
      rationale: `No count entered for ${doc.items.length} item(s) in ${doc.sloc}. ${
        c.overdue > 0 ? `Count is ${c.overdue} days past the planned date, ` : ""
      }blocking ${abc}-class stock from reconciliation.`,
      factors,
      score,
      confidence: 92,
    };
  }

  if (c.suspect && validateRecount(c).ok) {
    return {
      docId: doc.id,
      action: "RECOUNT",
      label: "Trigger recount (MI11)",
      rationale: `Deviation of ${c.maxAbsPct.toFixed(
        1,
      )} % exceeds the ${SUSPECT_PCT} % plausibility threshold — a counting error is more likely than a real stock loss of ${eur(
        c.absVarianceValue,
      )}. Recount before the book stock is corrected.`,
      factors,
      score: Math.min(100, score + 8),
      confidence: 88,
    };
  }

  if (c.requiresApproval && !doc.approvedBy) {
    return {
      docId: doc.id,
      action: "APPROVE",
      label: "Escalate for supervisor approval",
      rationale: `Difference of ${eur(c.absVarianceValue)} is above the ${eur(
        TOLERANCE_VALUE_EUR,
      )} posting tolerance${
        doc.recountCount >= MAX_RECOUNTS ? " and the recount has confirmed the count" : ""
      }. Posting is blocked until ${SUPERVISOR} approves the write-off.`,
      factors,
      score: Math.min(100, score + 5),
      confidence: 90,
    };
  }

  return {
    docId: doc.id,
    action: "POST",
    label: "Post difference (MI07)",
    rationale: doc.approvedBy
      ? `Approval granted by ${doc.approvedBy}. Post the difference to correct book stock and clear ${eur(
          c.absVarianceValue,
        )} from the open exposure.`
      : `Difference of ${eur(c.absVarianceValue)} is within the ${eur(
          TOLERANCE_VALUE_EUR,
        )} tolerance and the ${c.maxAbsPct.toFixed(
          1,
        )} % deviation is plausible. Post to correct book stock immediately.`,
    factors,
    score,
    confidence: Math.abs(c.maxAbsPct) <= TOLERANCE_PCT ? 95 : 84,
  };
}

export const ACTION_META: Record<AIAction, { tone: string; short: string }> = {
  COUNT: { tone: "info", short: "Count" },
  RECOUNT: { tone: "warn", short: "Recount" },
  APPROVE: { tone: "warn", short: "Approve" },
  POST: { tone: "good", short: "Post" },
};

export const STATUS_META: Record<PIStatus, { label: string; tone: "neutral" | "info" | "warn" | "good" | "bad" }> = {
  CREATED: { label: "Count pending", tone: "neutral" },
  COUNTED: { label: "Counted", tone: "info" },
  RECOUNT: { label: "Recount required", tone: "warn" },
  PENDING_APPROVAL: { label: "Approval required", tone: "bad" },
  POSTED: { label: "Difference posted", tone: "good" },
};

export const PROCESS_FLOW: { key: string; label: string; tcode: string }[] = [
  { key: "CREATED", label: "PI document created", tcode: "MI01" },
  { key: "COUNTED", label: "Count entered", tcode: "MI04" },
  { key: "REVIEW", label: "Difference review", tcode: "MI20" },
  { key: "POSTED", label: "Difference posted", tcode: "MI07" },
];

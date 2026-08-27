import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  calcDoc,
  calcKPIs,
  recommend,
  validateApprove,
  validateCount,
  validatePost,
  validateRecount,
  eur,
  SUPERVISOR,
  type AppState,
  type DocCalc,
  type KPIValues,
  type LogEntry,
  type PIDoc,
  type ValidationResult,
  type AIRecommendation,
} from "./pi-domain";
import { createInitialState } from "./pi-seed";

type Action =
  | { type: "ENTER_COUNT"; docId: string; itemNo: number; qty: number }
  | { type: "POST"; docId: string }
  | { type: "RECOUNT"; docId: string }
  | { type: "APPROVE"; docId: string }
  | { type: "RESET" };

const now = () => new Date().toISOString();

function addLog(state: AppState, entry: Omit<LogEntry, "id" | "ts">): LogEntry[] {
  return [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: now(), ...entry }, ...state.log].slice(
    0,
    40,
  );
}

function replaceDoc(docs: PIDoc[], docId: string, fn: (d: PIDoc) => PIDoc): PIDoc[] {
  return docs.map((d) => (d.id === docId ? fn(d) : d));
}

function reducer(state: AppState, action: Action): AppState {
  if (action.type === "RESET") return createInitialState();

  const doc = state.docs.find((d) => d.id === action.docId);
  if (!doc) return state;
  const calc = calcDoc(doc, state.materials);

  switch (action.type) {
    case "ENTER_COUNT": {
      if (doc.status === "POSTED") return state;
      const docs = replaceDoc(state.docs, doc.id, (d) => {
        const items = d.items.map((i) =>
          i.itemNo === action.itemNo ? { ...i, countQty: action.qty } : i,
        );
        const allCounted = items.every((i) => i.countQty !== null);
        return {
          ...d,
          items,
          status: allCounted ? "COUNTED" : d.status === "RECOUNT" ? "RECOUNT" : "CREATED",
          countedBy: allCounted ? "M. Keller" : d.countedBy,
          countedOn: allCounted ? now().slice(0, 10) : d.countedOn,
          approvedBy: null, // a new count invalidates any prior approval
        };
      });
      const updated = state.docs.find((d) => d.id === doc.id)!;
      const item = updated.items.find((i) => i.itemNo === action.itemNo)!;
      return {
        ...state,
        docs,
        log: addLog(state, {
          docId: doc.id,
          kind: "success",
          text: `Count ${action.qty} ${state.materials[item.matnr]!.uom} recorded for item ${action.itemNo} / ${item.matnr}.`,
        }),
      };
    }

    case "APPROVE": {
      if (!validateApprove(calc).ok) return state;
      return {
        ...state,
        docs: replaceDoc(state.docs, doc.id, (d) => ({
          ...d,
          approvedBy: SUPERVISOR,
          status: "COUNTED",
        })),
        log: addLog(state, {
          docId: doc.id,
          kind: "success",
          text: `Write-off of ${eur(calc.absVarianceValue)} approved by ${SUPERVISOR}.`,
        }),
      };
    }

    case "RECOUNT": {
      if (!validateRecount(calc).ok) return state;
      return {
        ...state,
        docs: replaceDoc(state.docs, doc.id, (d) => ({
          ...d,
          items: d.items.map((i) => ({ ...i, countQty: null })),
          status: "RECOUNT",
          recountCount: d.recountCount + 1,
          countedBy: null,
          countedOn: null,
          approvedBy: null,
        })),
        log: addLog(state, {
          docId: doc.id,
          kind: "info",
          text: `Recount triggered (MI11). Previous count of ${eur(calc.absVarianceValue)} difference discarded.`,
        }),
      };
    }

    case "POST": {
      if (!validatePost(calc).ok) return state;
      const materials = { ...state.materials };
      for (const ic of calc.items) {
        materials[ic.item.matnr] = {
          ...materials[ic.item.matnr]!,
          bookQty: ic.item.countQty!,
        };
      }
      const matDoc = String(state.seq);
      return {
        ...state,
        materials,
        seq: state.seq + 1,
        docs: replaceDoc(state.docs, doc.id, (d) => ({
          ...d,
          status: "POSTED",
          materialDocNo: matDoc,
          postedOn: now().slice(0, 10),
        })),
        log: addLog(state, {
          docId: doc.id,
          kind: "success",
          text: `Difference posted (MI07). Material document ${matDoc} created, stock corrected by ${eur(
            calc.totalVarianceValue,
          )}.`,
        }),
      };
    }
  }
}

export interface Toast {
  kind: "success" | "error";
  title: string;
  message: string;
  code?: string;
}

interface Ctx {
  state: AppState;
  kpis: KPIValues;
  calcs: DocCalc[];
  queue: { calc: DocCalc; ai: AIRecommendation }[];
  recFor: (docId: string) => AIRecommendation | null;
  enterCount: (docId: string, itemNo: number, raw: string) => ValidationResult;
  post: (docId: string) => ValidationResult;
  recount: (docId: string) => ValidationResult;
  approve: (docId: string) => ValidationResult;
  reset: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function PIStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const calcs = useMemo(
    () => state.docs.map((d) => calcDoc(d, state.materials)),
    [state.docs, state.materials],
  );
  const kpis = useMemo(() => calcKPIs(state), [state]);

  const queue = useMemo(
    () =>
      calcs
        .filter((c) => c.doc.status !== "POSTED")
        .map((c) => ({ calc: c, ai: recommend(c) }))
        .sort((a, b) => b.ai.score - a.ai.score),
    [calcs],
  );

  const recFor = useCallback(
    (docId: string) => {
      const c = calcs.find((x) => x.doc.id === docId);
      return c && c.doc.status !== "POSTED" ? recommend(c) : null;
    },
    [calcs],
  );

  const guard = useCallback(
    (docId: string, validate: (c: DocCalc) => ValidationResult, act: Action): ValidationResult => {
      const c = calcs.find((x) => x.doc.id === docId);
      if (!c) return { ok: false, message: "Physical inventory document not found." };
      const res = validate(c);
      if (res.ok) dispatch(act);
      return res;
    },
    [calcs],
  );

  const value: Ctx = {
    state,
    kpis,
    calcs,
    queue,
    recFor,
    enterCount: (docId, itemNo, raw) => {
      const res = validateCount(raw);
      const c = calcs.find((x) => x.doc.id === docId);
      if (c?.doc.status === "POSTED")
        return {
          ok: false,
          code: "M7 083",
          message: "Document is posted — the count can no longer be changed.",
        };
      if (res.ok) dispatch({ type: "ENTER_COUNT", docId, itemNo, qty: Number(raw) });
      return res;
    },
    post: (docId) => guard(docId, validatePost, { type: "POST", docId }),
    recount: (docId) => guard(docId, validateRecount, { type: "RECOUNT", docId }),
    approve: (docId) => guard(docId, validateApprove, { type: "APPROVE", docId }),
    reset: () => dispatch({ type: "RESET" }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePI() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("usePI must be used inside PIStoreProvider");
  return ctx;
}

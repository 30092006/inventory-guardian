import type { AppState, Material, PIDoc } from "./pi-domain";
import { calcKPIs } from "./pi-domain";

const PLANT = "1010";

function iso(offsetDays: number) {
  const d = new Date("2026-08-27T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const materialList: Material[] = [
  { matnr: "MAT-100234", description: "Servo Drive Unit SD-40", plant: PLANT, sloc: "0001", uom: "PC", price: 742.5, abc: "A", bookQty: 120 },
  { matnr: "MAT-100781", description: "Hydraulic Pump HP-12", plant: PLANT, sloc: "0001", uom: "PC", price: 1280.0, abc: "A", bookQty: 34 },
  { matnr: "MAT-101455", description: "Control Board CB-77", plant: PLANT, sloc: "0002", uom: "PC", price: 398.0, abc: "A", bookQty: 210 },
  { matnr: "MAT-102900", description: "Bearing Assembly BA-9", plant: PLANT, sloc: "0002", uom: "PC", price: 86.4, abc: "B", bookQty: 640 },
  { matnr: "MAT-103311", description: "Steel Bracket SB-220", plant: PLANT, sloc: "0003", uom: "PC", price: 24.9, abc: "C", bookQty: 1500 },
  { matnr: "MAT-104020", description: "Cable Harness CH-5m", plant: PLANT, sloc: "0003", uom: "PC", price: 47.2, abc: "B", bookQty: 880 },
  { matnr: "MAT-104777", description: "Sealing Ring SR-32", plant: PLANT, sloc: "0003", uom: "PC", price: 3.15, abc: "C", bookQty: 12400 },
  { matnr: "MAT-105120", description: "Gearbox GX-500", plant: PLANT, sloc: "0001", uom: "PC", price: 2150.0, abc: "A", bookQty: 48 },
  { matnr: "MAT-105644", description: "Sensor Module SM-11", plant: PLANT, sloc: "0002", uom: "PC", price: 165.0, abc: "B", bookQty: 305 },
  { matnr: "MAT-106001", description: "Lubricant Grade 40 (20L)", plant: PLANT, sloc: "0004", uom: "CAN", price: 58.0, abc: "C", bookQty: 260 },
  { matnr: "MAT-106510", description: "Filter Cartridge FC-8", plant: PLANT, sloc: "0004", uom: "PC", price: 31.5, abc: "C", bookQty: 1740 },
  { matnr: "MAT-107233", description: "Power Supply PS-24V", plant: PLANT, sloc: "0002", uom: "PC", price: 214.0, abc: "B", bookQty: 156 },
];

const materials: Record<string, Material> = Object.fromEntries(
  materialList.map((m) => [m.matnr, { ...m }]),
);

function doc(
  id: string,
  sloc: string,
  plannedOffset: number,
  status: PIDoc["status"],
  items: { matnr: string; book: number; count: number | null }[],
  extra: Partial<PIDoc> = {},
): PIDoc {
  return {
    id,
    plant: PLANT,
    sloc,
    fiscalYear: 2026,
    plannedDate: iso(plannedOffset),
    countedBy: status === "CREATED" || status === "RECOUNT" ? null : "M. Keller",
    countedOn: status === "CREATED" || status === "RECOUNT" ? null : iso(plannedOffset),
    status,
    recountOf: null,
    recountCount: 0,
    approvedBy: null,
    materialDocNo: null,
    postedOn: null,
    items: items.map((it, idx) => ({
      itemNo: (idx + 1) * 10,
      matnr: it.matnr,
      bookQtySnapshot: it.book,
      countQty: it.count,
    })),
    ...extra,
  };
}

const docs: PIDoc[] = [
  // --- high-value difference above tolerance -> approval required (edge case)
  doc("0100000451", "0001", -6, "COUNTED", [
    { matnr: "MAT-105120", book: 48, count: 43 },
  ]),
  // --- implausible deviation -> AI recommends recount (edge case)
  doc("0100000452", "0002", -4, "COUNTED", [
    { matnr: "MAT-101455", book: 210, count: 138 },
  ]),
  // --- clean, within tolerance -> straight post
  doc("0100000453", "0003", -1, "COUNTED", [
    { matnr: "MAT-103311", book: 1500, count: 1494 },
    { matnr: "MAT-104777", book: 12400, count: 12400 },
  ]),
  // --- overdue, not yet counted, A-class
  doc("0100000454", "0001", -9, "CREATED", [
    { matnr: "MAT-100781", book: 34, count: null },
    { matnr: "MAT-100234", book: 120, count: null },
  ]),
  // --- counted, moderate difference, B-class, within tolerance
  doc("0100000455", "0002", -2, "COUNTED", [
    { matnr: "MAT-105644", book: 305, count: 297 },
  ]),
  // --- already recounted once, still above tolerance -> approval path
  doc("0100000456", "0002", -5, "COUNTED", [
    { matnr: "MAT-107233", book: 156, count: 118 },
  ], { recountCount: 1, recountOf: "0100000440" }),
  // --- not counted, low priority C-class
  doc("0100000457", "0004", 1, "CREATED", [
    { matnr: "MAT-106510", book: 1740, count: null },
  ]),
  // --- not counted, due today
  doc("0100000458", "0004", 0, "CREATED", [{ matnr: "MAT-106001", book: 260, count: null }]),
  // --- counted with surplus difference
  doc("0100000459", "0003", -3, "COUNTED", [{ matnr: "MAT-104020", book: 880, count: 902 }]),
  // --- already posted (history, feeds IRA baseline)
  doc("0100000441", "0002", -20, "POSTED", [{ matnr: "MAT-102900", book: 640, count: 638 }], {
    materialDocNo: "4900001871",
    postedOn: iso(-20),
  }),
  doc("0100000442", "0003", -18, "POSTED", [{ matnr: "MAT-104777", book: 12400, count: 12280 }], {
    materialDocNo: "4900001872",
    postedOn: iso(-18),
  }),
  doc("0100000443", "0001", -15, "POSTED", [{ matnr: "MAT-100234", book: 120, count: 120 }], {
    materialDocNo: "4900001873",
    postedOn: iso(-15),
  }),
  doc(
    "0100000438",
    "0003",
    -24,
    "POSTED",
    [
      { matnr: "MAT-103311", book: 1500, count: 1428 },
      { matnr: "MAT-104020", book: 880, count: 879 },
    ],
    { materialDocNo: "4900001868", postedOn: iso(-24) },
  ),
  doc("0100000439", "0002", -26, "POSTED", [{ matnr: "MAT-105644", book: 305, count: 281 }], {
    materialDocNo: "4900001869",
    postedOn: iso(-26),
  }),
  doc(
    "0100000440",
    "0004",
    -28,
    "POSTED",
    [
      { matnr: "MAT-106510", book: 1740, count: 1737 },
      { matnr: "MAT-106001", book: 260, count: 236 },
    ],
    { materialDocNo: "4900001870", postedOn: iso(-28) },
  ),
];

export function createInitialState(): AppState {
  const base: Omit<AppState, "baseline"> = {
    materials,
    docs,
    seq: 4900001874,
    log: [
      {
        id: "seed",
        ts: iso(0),
        docId: "—",
        text: "Cycle count wave CC-2026-34 released for plant 1010.",
        kind: "info",
      },
    ],
  };
  return { ...base, baseline: calcKPIs(base) };
}

/**
 * Pure, DOM-free derivation from a person's own synthetic records into the shapes the alive
 * trajectory hero and its panels need for the logged-in home screen. No colour/size/speed/
 * direction ever varies with a value here: every node gets the same fixed shapes/sizes as the
 * example dataset, and phases are exam dates, never a life-stage or health-stage word.
 */
import { formatKoreanDate } from "@/lib/format/korean-date";
import { phaseRanges, T_END } from "@/lib/home/alive-trajectory";
import type { ExampleNode, ExampleRing } from "@/lib/home/alive-example-data";

/** The minimal shape this module needs from a FoundationRecord (see lib/foundation/client.ts). */
export type HomeRecordLike = {
  documentId: string;
  label: string;
  value: string;
  unit: string;
  observedOn: string;
};

/** Never a life-stage or health-stage word: exam-date phases plus one trailing open phase. */
export const NEXT_RESULT_PHASE_LABEL = "다음 결과지";

/** At most this many real nodes are drawn per ring; the rest fold into one "+N개" marker node. */
export const MAX_NODES_PER_RING = 4;

/** Cycles if there are more documents than example ring radii to draw from. */
const RING_RADII: ReadonlyArray<{ rx: number; ry: number }> = [
  { rx: 150, ry: 34 },
  { rx: 210, ry: 46 },
  { rx: 120, ry: 30 },
  { rx: 90, ry: 24 },
];

export type HomePhaseData = {
  /** One label per completed document (exam-date order) plus a trailing "다음 결과지". */
  labels: string[];
  /** One ring per completed document, in the same order as `labels` (never includes the trailing one). */
  rings: ExampleRing[];
  /** Ring index -> how many of that document's records were folded into the "+N개" marker. */
  overflowByRing: ReadonlyArray<{ ringIndex: number; count: number }>;
};

/**
 * Groups records by document, orders documents by exam date, and lays out one ring per document
 * along the trajectory (evenly spread through its phase range) plus a trailing open phase with no
 * ring. A document with more than `MAX_NODES_PER_RING` records shows the first four and folds the
 * rest into a single "+N개" marker node (never dropped silently).
 */
export function buildHomePhases(records: ReadonlyArray<HomeRecordLike>): HomePhaseData {
  const byDocument = new Map<string, HomeRecordLike[]>();
  for (const record of records) {
    const bucket = byDocument.get(record.documentId);
    if (bucket) bucket.push(record);
    else byDocument.set(record.documentId, [record]);
  }

  const documents = Array.from(byDocument.entries())
    .map(([documentId, docRecords]) => ({
      documentId,
      observedOn: [...docRecords].sort((a, b) => a.observedOn.localeCompare(b.observedOn))[0].observedOn,
      records: docRecords,
    }))
    .sort((a, b) => a.observedOn.localeCompare(b.observedOn));

  const labels = [...documents.map((doc) => `${formatKoreanDate(doc.observedOn)} 결과지`), NEXT_RESULT_PHASE_LABEL];
  const ranges = phaseRanges(labels, T_END);
  const overflowByRing: Array<{ ringIndex: number; count: number }> = [];

  const rings: ExampleRing[] = documents.map((doc, i) => {
    const t = (ranges[i].t0 + ranges[i].t1) / 2;
    const radii = RING_RADII[i % RING_RADII.length];
    const shown = doc.records.slice(0, MAX_NODES_PER_RING);
    const overflow = doc.records.length - shown.length;
    const total = doc.records.length;
    const nodes: ExampleNode[] = shown.map((record, j) => ({
      item: record.label,
      value: record.value,
      unit: record.unit,
      observedOn: record.observedOn,
      shape: j % 2 === 0 ? "squircle" : "circle",
      size: 22,
      phase: (j / total) * Math.PI * 2,
    }));
    if (overflow > 0) {
      overflowByRing.push({ ringIndex: i, count: overflow });
      nodes.push({
        item: `+${overflow}개`,
        value: "",
        unit: "",
        observedOn: "",
        shape: "circle",
        size: 16,
        phase: (shown.length / total) * Math.PI * 2,
      });
    }
    return { t, rx: radii.rx, ry: radii.ry, nodes };
  });

  return { labels, rings, overflowByRing };
}

/**
 * Derives the pre-login example hero's phases and ring positions from the example rings' own
 * node dates, instead of a hand-picked, fixed label list — so no phase is ever empty by
 * construction and adding/removing example nodes can never desync the labels from the data.
 */
export function buildExamplePhases(rings: ReadonlyArray<ExampleRing>): { labels: string[]; rings: ExampleRing[] } {
  const dated = rings
    .map((ring) => ({
      date: [...ring.nodes].map((node) => node.observedOn).sort()[0],
      ring,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const labels = [...dated.map((d) => `${formatKoreanDate(d.date)} 검진`), "다음 검진"];
  const ranges = phaseRanges(labels, T_END);
  const repositioned = dated.map((d, i) => ({ ...d.ring, t: (ranges[i].t0 + ranges[i].t1) / 2 }));
  return { labels, rings: repositioned };
}

export type HomeIdentityCounts = {
  recordCount: number;
  resultSheetCount: number;
  lastResultDate: string | null;
};

/** Real counts for the identity panel; the identity itself (name/age/gender) has no real data. */
export function homeIdentityCounts(records: ReadonlyArray<HomeRecordLike>): HomeIdentityCounts {
  const documentIds = new Set(records.map((record) => record.documentId));
  const dates = records.map((record) => record.observedOn).sort();
  return {
    recordCount: records.length,
    resultSheetCount: documentIds.size,
    lastResultDate: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

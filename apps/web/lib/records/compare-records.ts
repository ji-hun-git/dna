import type { FoundationRecord } from "@/lib/foundation/client";

/** One dated value exactly as the person confirmed it. */
export type RecordComparisonPoint = {
  observedOn: string;
  value: string;
};

/**
 * Two dated values of the same item, side by side. The pair carries no
 * difference, direction, or judgement: the product states what the server
 * stored on each date and stops there.
 */
export type RecordComparison = {
  label: string;
  unit: string;
  earlier: RecordComparisonPoint;
  later: RecordComparisonPoint;
};

/**
 * Builds one comparison per label that has current values on at least two
 * distinct observation dates, using the earliest and the latest of them.
 *
 * Only `CURRENT` records take part, so a corrected value replaces the value it
 * superseded without any extra bookkeeping here. Nothing is parsed as a number.
 */
export function compareRecords(records: FoundationRecord[]): RecordComparison[] {
  const byLabel = new Map<string, FoundationRecord[]>();
  for (const record of records) {
    if (record.status !== "CURRENT") continue;
    const collected = byLabel.get(record.label);
    if (collected) collected.push(record);
    else byLabel.set(record.label, [record]);
  }

  const comparisons: RecordComparison[] = [];
  for (const [label, collected] of byLabel) {
    if (new Set(collected.map((record) => record.observedOn)).size < 2) continue;
    // Two records of the same label on the same day resolve by confirmation
    // time, so the pair is the same on every render and in every browser.
    const ordered = [...collected].sort((left, right) => left.observedOn === right.observedOn
      ? left.confirmedAt.localeCompare(right.confirmedAt)
      : left.observedOn.localeCompare(right.observedOn));
    const earlier = ordered[0];
    const later = ordered[ordered.length - 1];
    comparisons.push({
      label,
      unit: later.unit,
      earlier: { observedOn: earlier.observedOn, value: earlier.value },
      later: { observedOn: later.observedOn, value: later.value },
    });
  }

  return comparisons.sort((left, right) => left.label.localeCompare(right.label, "ko"));
}

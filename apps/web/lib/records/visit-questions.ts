import type { FoundationRecord } from "@/lib/foundation/client";

export type VisitQuestion = {
  id: string;
  text: string;
  reason: string;
  sourceRecordIds: string[];
  records: FoundationRecord[];
  method: "DETERMINISTIC_TEMPLATE";
};

/** A minimal, source-linked context; no model call, numeric threshold or clinical inference. */
export function buildVisitQuestions(records: FoundationRecord[]): VisitQuestion[] {
  const groups = new Map<string, FoundationRecord[]>();
  for (const record of records) {
    if (record.status !== "CURRENT") continue;
    const key = `${record.label}\u0000${record.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const ordered = [...items].sort((a, b) => a.observedOn.localeCompare(b.observedOn)
      || a.confirmedAt.localeCompare(b.confirmedAt) || a.recordId.localeCompare(b.recordId));
    const latest = ordered.at(-1)!;
    const previous = ordered.findLast((item) => item.observedOn < latest.observedOn);
    const sources = previous ? [previous, latest] : [latest];
    return {
      id, text: previous
        ? `이번 ${latest.label} 결과를 이전 결과와 함께 어떻게 봐야 하나요?`
        : `${latest.label} 결과가 어떤 검사에서 나온 값인지 설명해 주실 수 있나요?`,
      reason: previous ? "직접 확인한 같은 항목의 두 날짜 기록이 있어요." : "직접 확인한 이 항목의 기록이 있어요.",
      sourceRecordIds: sources.map((record) => record.recordId), records: sources,
      method: "DETERMINISTIC_TEMPLATE" as const,
    };
  }).sort((a, b) => b.records.at(-1)!.observedOn.localeCompare(a.records.at(-1)!.observedOn)
    || a.id.localeCompare(b.id)).slice(0, 3);
}

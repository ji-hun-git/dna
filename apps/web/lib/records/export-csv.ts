import type { FoundationRecord } from "@/lib/foundation/client";

// Quoting alone does not prevent formula execution when opened in a spreadsheet.
function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** A portable projection of the authenticated read-model, never extraction candidates. */
export function buildRecordCsv(records: readonly FoundationRecord[]): string {
  const header = ["자료 구분", "검사일", "항목", "결과지 표기", "확인한 값", "단위", "원래 값", "원래 검사일", "확인 방식", "근거 쪽수", "문서 확인값", "기록 버전"];
  const rows = records.filter((record) => record.status === "CURRENT").map((record) => [
    "예시 데이터 · 개인 기록 정리본", record.observedOn, record.label,
    record.originalLabel ?? record.label, record.value, record.unit, record.originalValue,
    record.originalObservedOn, record.reviewDecision === "CORRECTED" ? "사용자가 수정함" : "사용자가 원문과 같다고 확인함",
    record.evidencePage, record.documentSha256, record.recordVersionId,
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadRecordCsv(records: readonly FoundationRecord[]): void {
  const blob = new Blob([buildRecordCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "alm-example-records.csv";
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser consume the download before releasing the temporary URL.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

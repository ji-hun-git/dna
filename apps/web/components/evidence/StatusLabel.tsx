const labels = {
  verified: "검증됨",
  stale: "업데이트 필요",
  unknown: "확인되지 않음",
} as const;

export type EvidenceStatus = keyof typeof labels;

export function StatusLabel({ status }: { status: EvidenceStatus }) {
  return (
    <span className="gc-status-label" data-status={status}>
      <span aria-hidden="true">●</span> {labels[status]}
    </span>
  );
}

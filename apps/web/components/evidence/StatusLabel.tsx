const labels = {
  verified: "직접 확인",
  stale: "최신 정보 확인 필요",
  unknown: "출처 확인 전",
} as const;

export type EvidenceStatus = keyof typeof labels;

export function StatusLabel({ status }: { status: EvidenceStatus }) {
  return (
    <span className="gc-status-label" data-status={status}>
      <span aria-hidden="true">●</span> {labels[status]}
    </span>
  );
}

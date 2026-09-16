"use client";

import type { HealthEvent } from "@/lib/foundation/client";
import { SourcePreview } from "@/components/integrated/SourcePreview";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format/korean-date";
import { shortDigest } from "@/lib/format/short-digest";
import styles from "@/components/my-data/MyData.module.css";

/**
 * Second-level detail for one cell. Every line here is a stored fact or a
 * stored status; the drawer never adds a comparison or a meaning.
 */
export function EvidenceDrawer({ event, onClose }: { event: HealthEvent; onClose: () => void }) {
  const titleId = `evidence-${event.eventId}`;
  return (
    <section className={styles.drawer} aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>{event.concept} 근거</h2>
        <button type="button" onClick={onClose}>근거 닫기</button>
      </header>
      <dl>
        <dt>값</dt><dd>{event.value} {event.unit}</dd>
        <dt>검사일</dt><dd>{formatKoreanDate(event.observedOn)}</dd>
        <dt>확인</dt><dd><span>{event.corrected ? "직접 수정한 값" : "직접 확인한 값"}</span> · {formatKoreanDateTime(event.confirmedAt)}</dd>
        <dt>출처 위치</dt><dd>{event.source.page}쪽</dd>
        <dt>문서</dt><dd>{shortDigest(event.source.documentSha256)}</dd>
        <dt>원문</dt><dd>{shortDigest(event.source.sourceTextSha256)}</dd>
      </dl>
      {event.source.previewAvailable
        ? <SourcePreview documentId={event.source.documentId} page={event.source.page} />
        : <p role="status">출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.</p>}
      <p><a href={`/records#record-${event.recordId}`}>기록 목록에서 이 값 보기</a></p>
    </section>
  );
}

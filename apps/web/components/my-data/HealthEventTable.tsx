import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import styles from "@/components/my-data/MyData.module.css";

type HealthEventTableProps = {
  events: HealthEvent[];
  selectedId?: string;
  matchedIds: Set<string> | null;
  onSelect: (eventId: string, invoker: HTMLElement) => void;
};

/** The same events as the canvas, as a table. This is the accessible equivalent, not a summary. */
export function HealthEventTable({ events, selectedId, matchedIds, onSelect }: HealthEventTableProps) {
  const visible = matchedIds ? events.filter((event) => matchedIds.has(event.eventId)) : events;
  return (
    <table className={styles.table} aria-label="기록 목록">
      <thead>
        <tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">검사일</th><th scope="col">확인</th><th scope="col">근거</th></tr>
      </thead>
      <tbody>
        {visible.map((event) => (
          <tr key={event.eventId} aria-current={event.eventId === selectedId ? "true" : undefined}>
            <th scope="row">{event.concept}</th>
            <td className="num">{event.value} {event.unit}</td>
            <td>{formatKoreanDate(event.observedOn)}</td>
            <td>{event.corrected ? "직접 수정" : "직접 확인"}{event.verification === "uncertain" ? " · 출처 미리보기 없음" : ""}</td>
            <td>
              <button type="button" onClick={(click) => onSelect(event.eventId, click.currentTarget)}
                aria-label={`${event.concept} ${event.value} ${event.unit}, ${formatKoreanDate(event.observedOn)} 근거 보기`}>
                근거 보기
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

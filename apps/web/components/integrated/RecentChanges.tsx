import type { ChangeSummary } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";

type RecentChangesProps = {
  changes: ChangeSummary;
};

function datedValue(point: { observedOn: string; value: string }, unit: string) {
  return `${formatKoreanDate(point.observedOn)} ${point.value} ${unit}`;
}

/**
 * Each line is one string so the rendered text is exactly what the tests and the
 * Playwright assertions expect. Two values side by side; no arrow, no direction.
 */
function changeLine(item: ChangeSummary["items"][number]) {
  const latest = `${item.concept} · 이번 ${datedValue(item.latest, item.unit)}`;
  return item.previous ? `${latest} · 이전 ${datedValue(item.previous, item.unit)}` : `${latest} · 이전 값 없음`;
}

/** The latest 결과지's values beside the previous value of the same item. Hidden when there is nothing to list. */
export function RecentChanges({ changes }: RecentChangesProps) {
  const latest = changes.latestDocument;
  if (!latest || changes.items.length === 0) return null;
  return (
    <section className="gc-health-home__overview" aria-labelledby="recent-changes-title">
      <div className="gc-health-home__section-heading">
        <div><p>{`새 결과지 · ${formatKoreanDate(latest.observedOn)}`}</p><h2 id="recent-changes-title">최근 변화</h2></div>
        <span>{`새 기록 ${latest.eventCount}개`}</span>
      </div>
      <p className="gc-records-comparison__note">새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.</p>
      <ul className="gc-review-saved" aria-label="항목별 이번 값과 이전 값">
        {changes.items.map((item) => (
          <li key={item.latest.eventId} data-testid="change-item">{changeLine(item)}</li>
        ))}
      </ul>
      {changes.newConcepts.length > 0 && <p>{`이전 값이 없는 항목: ${changes.newConcepts.join(", ")}`}</p>}
    </section>
  );
}

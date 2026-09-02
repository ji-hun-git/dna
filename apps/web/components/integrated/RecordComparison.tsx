import { formatKoreanDate } from "@/lib/format/korean-date";
import type { RecordComparison as RecordComparisonEntry } from "@/lib/records/compare-records";

type RecordComparisonProps = {
  comparisons: RecordComparisonEntry[];
};

/**
 * The whole line is composed as one string so the rendered text is exactly what
 * the tests and the Playwright assertions expect, with no JSX whitespace rules
 * in between.
 */
function comparisonLine(comparison: RecordComparisonEntry) {
  const earlier = `${formatKoreanDate(comparison.earlier.observedOn)} ${comparison.earlier.value} ${comparison.unit}`;
  const later = `${formatKoreanDate(comparison.later.observedOn)} ${comparison.later.value} ${comparison.unit}`;
  return `${comparison.label} · ${earlier} → ${later}`;
}

/** Two dated values of the same item, stated side by side and nothing more. */
export function RecordComparison({ comparisons }: RecordComparisonProps) {
  return (
    <section className="gc-records-comparison" aria-labelledby="record-comparison-title">
      <h2 id="record-comparison-title">날짜별로 본 내 기록</h2>
      <p className="gc-records-comparison__note">
        같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.
      </p>
      {comparisons.length === 0 ? (
        <p className="gc-integrated-empty">두 날짜 이상 확인한 항목이 아직 없어요.</p>
      ) : (
        <ul className="gc-records-comparison__list">
          {comparisons.map((comparison) => (
            <li key={comparison.label} data-testid="record-comparison-item">
              {comparisonLine(comparison)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

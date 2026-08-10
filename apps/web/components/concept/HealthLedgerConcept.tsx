import { StatusLabel } from "@/components/evidence/StatusLabel";

export type HealthLedgerObservation = {
  id: string;
  monthIndex: number;
  date: string;
  value: string;
  source: string;
};

export type HealthLedgerConceptProps = {
  profileLabel: string;
  updatedAt: string;
  metric: {
    name: string;
    value: string;
    unit: string;
    observedAt: string;
    delta: string;
    status: "verified";
  };
  observations: readonly HealthLedgerObservation[];
};

const monthCount = 60;
const years = ["2022", "2023", "2024", "2025", "2026"];

export function HealthLedgerConcept({
  profileLabel,
  updatedAt,
  metric,
  observations,
}: HealthLedgerConceptProps) {
  const observationByMonth = new Map(observations.map((observation) => [observation.monthIndex, observation]));
  const latestObservation = observations.reduce((latest, observation) =>
    observation.date > latest.date ? observation : latest,
  );
  const recentFirst = [...observations].sort((left, right) => right.date.localeCompare(left.date));

  return (
    <main className="gc-health-ledger">
      <header className="gc-health-ledger__masthead" aria-label="기록 헤더">
        <div className="gc-health-ledger__identity">
          <span className="gc-health-ledger__wordmark" aria-label="앎">
            앎
          </span>
          <span>{profileLabel}</span>
        </div>
        <p>
          업데이트 <time dateTime={updatedAt}>{updatedAt}</time>
        </p>
      </header>

      <section className="gc-health-ledger__intro" aria-labelledby="ledger-title">
        <p className="gc-health-ledger__eyebrow">VERIFIED HEALTH LEDGER · FIVE YEARS</p>
        <h1 id="ledger-title">시간 위의 증거</h1>
        <p className="gc-health-ledger__lede">
          한 번의 수치보다 중요한 것은 언제, 어디서, 어떤 기록으로 확인되었는가입니다.
        </p>
      </section>

      <section className="gc-health-ledger__metric" aria-labelledby="metric-name">
        <header className="gc-health-ledger__metric-header">
          <div>
            <p className="gc-health-ledger__eyebrow">LATEST VERIFIED MEASUREMENT</p>
            <h2 id="metric-name">{metric.name}</h2>
          </div>
          <StatusLabel status={metric.status} />
        </header>

        <div className="gc-health-ledger__metric-summary">
          <p className="gc-health-ledger__metric-value">
            <span className="gc-health-ledger__metric-number">{metric.value}</span>
            <span className="gc-health-ledger__metric-unit">{metric.unit}</span>
          </p>
          <div className="gc-health-ledger__metric-context">
            <p>{metric.delta}</p>
            <p>
              확인일 <time dateTime={metric.observedAt}>{metric.observedAt}</time>
            </p>
          </div>
        </div>

        <div
          className="gc-health-ledger__field"
          role="img"
          aria-label={`최근 5년 ${monthCount}개월 중 검진 기록이 연결된 달 ${observations.length}개`}
        >
          {Array.from({ length: monthCount }, (_, monthIndex) => {
            const observation = observationByMonth.get(monthIndex);
            return (
              <span
                key={monthIndex}
                className="gc-health-ledger__mark"
                data-testid="ledger-mark"
                data-state={observation ? "observed" : "empty"}
                data-current={observation?.id === latestObservation.id ? "true" : "false"}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <div className="gc-health-ledger__years" aria-hidden="true">
          {years.map((year) => (
            <span key={year}>{year}</span>
          ))}
        </div>
        <p className="gc-health-ledger__legend">한 칸은 한 달 · 밝은 칸은 출처가 연결된 기록</p>
      </section>

      <section className="gc-health-ledger__records" aria-labelledby="record-list-title">
        <div className="gc-health-ledger__section-heading">
          <p className="gc-health-ledger__eyebrow">SOURCE-BOUND OBSERVATIONS</p>
          <h2 id="record-list-title">연결된 기록</h2>
        </div>
        <ol>
          {recentFirst.map((observation, index) => (
            <li key={observation.id}>
              <span className="gc-health-ledger__record-index">{String(index + 1).padStart(2, "0")}</span>
              <time dateTime={observation.date}>{observation.date}</time>
              <strong>{observation.value}</strong>
              <span>{metric.unit}</span>
              <span className="gc-health-ledger__record-source">{observation.source}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="gc-health-ledger__caveat" aria-label="해석 안내">
        <p className="gc-health-ledger__eyebrow">READ WITH CONTEXT</p>
        <p>측정값은 진단이 아닙니다.</p>
        <p>검사 조건과 개인의 상황을 함께 보고, 필요한 해석은 의료진과 확인하세요.</p>
      </aside>

      <footer className="gc-health-ledger__footer">
        <span>SYNTHETIC DESIGN FIXTURE · NOT MEDICAL ADVICE</span>
        <span>모든 표시값은 디자인 검증용 합성 데이터</span>
      </footer>
    </main>
  );
}

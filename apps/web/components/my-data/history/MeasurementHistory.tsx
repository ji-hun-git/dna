"use client";

import { useEffect, useMemo, useState } from "react";
import { createFoundationClient, type MeasurementSeries } from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { HistoryGraph } from "@/components/my-data/history/HistoryGraph";
import styles from "@/components/my-data/history/History.module.css";

const NOT_COMPUTABLE = "계산할 수 없어요";

function needsSignIn(error: unknown) {
  const state = foundationShellState(error);
  return state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED";
}

/** The server's strings with the unit appended. Nothing is recomputed, rounded or coloured here. */
function lastDifferenceText(series: MeasurementSeries) {
  const difference = series.derived.lastDifference;
  if (!difference) return NOT_COMPUTABLE;
  return `${difference.absolute} ${series.unit}${difference.percent == null ? "" : ` (${difference.percent}%)`}`;
}

function withUnit(text: string | undefined, unit: string) {
  return text === undefined ? NOT_COMPUTABLE : `${text} ${unit}`;
}

export function MeasurementHistory() {
  const client = useMemo(() => createFoundationClient(), []);
  const [series, setSeries] = useState<MeasurementSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAction, setErrorAction] = useState<"retry-read" | "sign-in">();
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage("");
    setErrorAction(undefined);
    void (async () => {
      try {
        await client.getSession();
        const loaded = await client.getSeries();
        if (active) setSeries(loaded.series);
      } catch (error) {
        if (active) {
          setSeries([]);
          setErrorMessage(describeFoundationError(error));
          setErrorAction(needsSignIn(error) ? "sign-in" : "retry-read");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client, loadAttempt]);

  // Arriving from an evidence drawer: move to the series that holds that event.
  useEffect(() => {
    if (series.length === 0 || typeof window === "undefined") return;
    const match = /^#event-([0-9a-f-]{36})$/.exec(window.location.hash);
    if (!match) return;
    const index = series.findIndex((item) => item.points.some((point) => point.eventId === match[1]));
    if (index < 0) return;
    const heading = document.getElementById(`history-series-title-${index}`);
    if (heading && typeof heading.scrollIntoView === "function") heading.scrollIntoView({ block: "start" });
    heading?.focus();
  }, [series]);

  return (
    <IntegratedShell current="my-data" status="예시 데이터">
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-labelledby="history-title">
            <p><a href="/my-data">나의 데이터로 돌아가기</a></p>
            <h1 id="history-title">측정 이력</h1>
            <p>같은 항목의 확인한 값을 검사일 순서로 모았어요. 값의 의미나 변화의 방향은 판단하지 않아요.</p>
            <p>뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.</p>
          </section>

          {loading && <p role="status" aria-live="polite">서버에서 측정 이력을 불러오고 있어요.</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}{" "}
            {errorAction === "sign-in" && <a href="/">홈에서 다시 로그인</a>}
            {errorAction === "retry-read" && <button type="button" disabled={loading} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>다시 불러오기</button>}
          </p>}
          {!loading && !errorMessage && series.length === 0 && (
            <p>아직 확인한 기록이 없어요. 결과지를 추가해 값을 확인하면 여기에 항목별로 모여요.</p>
          )}

          {series.map((item, index) => (
            <section key={`${item.conceptCode ?? item.concept}|${item.unit}`} className={styles.series} data-testid="history-series" aria-labelledby={`history-series-title-${index}`}>
              <header className={styles.seriesHeader}>
                <h2 id={`history-series-title-${index}`} tabIndex={-1}>{item.concept}</h2>
                <span className={styles.unit}>{item.unit}</span>
              </header>

              <HistoryGraph series={item} seriesIndex={index} />

              <dl className={styles.derived}>
                <div><dt>마지막 두 값의 차이</dt><dd data-testid="derived-last-difference">{lastDifferenceText(item)}</dd></div>
                <div><dt>30일로 환산한 차이</dt><dd data-testid="derived-per-30-days">{withUnit(item.derived.per30Days, item.unit)}</dd></div>
                <div><dt>최근 3회 평균</dt><dd data-testid="derived-mean-of-last-3">{withUnit(item.derived.meanOfLast3, item.unit)}</dd></div>
              </dl>

              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label={`${item.concept} 측정 이력`}>
                  <thead><tr><th scope="col">검사일</th><th scope="col">값</th><th scope="col">단위</th><th scope="col">출처</th></tr></thead>
                  <tbody>
                    {item.points.map((point) => (
                      <tr key={point.eventId}>
                        <th scope="row">{formatKoreanDate(point.observedOn)}</th>
                        <td className={styles.number}>{point.value}</td>
                        <td>{item.unit}</td>
                        <td><a href={`/my-data#event-${point.eventId}`} aria-label={`${item.concept} ${point.value} ${item.unit}, ${formatKoreanDate(point.observedOn)} 출처 보기`}>출처 보기</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </IntegratedShell>
  );
}

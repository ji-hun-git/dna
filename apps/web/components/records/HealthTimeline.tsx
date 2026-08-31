"use client";

import { useMemo, useState } from "react";
import { StatusLabel } from "@/components/evidence/StatusLabel";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { demoHealthTimeline, type DemoHealthMetric } from "@/lib/records/demo-health-timeline";
import styles from "./HealthTimeline.module.css";

function compactDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}.`;
}

function describeChange(metric: DemoHealthMetric) {
  const latest = metric.records.at(-1)!;
  const previous = metric.records.at(-2)!;
  const difference = latest.value - previous.value;
  if (difference === 0) return "이전 예시 기록과 같아요";
  const deltaUnit = metric.unit === "%" ? "%p" : metric.unit;
  const amount = `${Math.abs(difference).toLocaleString("ko-KR")}${deltaUnit === "%p" ? "" : " "}${deltaUnit}`;
  return `이전 예시 기록보다 ${amount} ${difference > 0 ? "높아요" : "낮아요"}`;
}

function TrendChart({ metric }: { metric: DemoHealthMetric }) {
  const width = 560;
  const height = 220;
  const padding = { left: 38, right: 28, top: 24, bottom: 42 };
  const values = metric.records.map((record) => record.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.08, 1);
  const minimum = rawMin - spread * 0.35;
  const maximum = rawMax + spread * 0.35;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const points = metric.records.map((record, index) => ({
    x: padding.left + (metric.records.length === 1 ? plotWidth / 2 : (index / (metric.records.length - 1)) * plotWidth),
    y: padding.top + ((maximum - record.value) / (maximum - minimum)) * plotHeight,
    record,
  }));
  const summary = `${metric.label} 예시 기록: ${metric.records.map((record) => `${formatKoreanDate(record.observedAt)} ${record.displayValue}${metric.unit}`).join(", ")}`;

  return (
    <div className={styles.chartFrame}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
        {[0, 1, 2, 3].map((line) => {
          const y = padding.top + (line / 3) * plotHeight;
          return <line key={line} className={styles.gridLine} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
        })}
        <polyline className={styles.trendLine} points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
        {points.map((point) => (
          <g key={point.record.id}>
            <circle className={styles.trendDot} cx={point.x} cy={point.y} r="6" />
            <text className={styles.valueLabel} x={point.x} y={point.y - 15} textAnchor="middle">{point.record.displayValue}</text>
            <text className={styles.dateLabel} x={point.x} y={height - 13} textAnchor="middle">{compactDate(point.record.observedAt)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HealthTimeline() {
  const [selectedMetricId, setSelectedMetricId] = useState(demoHealthTimeline.metrics[0].id);
  const metric = demoHealthTimeline.metrics.find((item) => item.id === selectedMetricId) ?? demoHealthTimeline.metrics[0];
  const latest = metric.records.at(-1)!;
  const measurementCount = demoHealthTimeline.metrics.reduce((total, item) => total + item.records.length, 0);
  const sourceCount = useMemo(() => new Set(
    demoHealthTimeline.metrics.flatMap((item) => item.records.map((record) => record.sourceName)),
  ).size, []);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.appbar}>
          <a className={styles.brand} href="/" aria-label="앎 건강 홈"><span aria-hidden="true">앎</span><strong>앎</strong></a>
          <nav aria-label="주요 메뉴">
            <a href="/">홈</a>
            <a href="/records" aria-current="page">기록</a>
            <a href="/data-control">데이터 관리</a>
          </nav>
          <span className={styles.appbarState}>예시 기록 · 실제 기록 0개</span>
        </header>

        <section className={styles.hero} aria-labelledby="timeline-title">
          <div className={styles.heroCopy}>
            <p>확인한 건강 기록</p>
            <h1 id="timeline-title">시간이 지나며<br />무엇이 바뀌었는지 확인하세요</h1>
            <p>날짜와 값만 나열하지 않고, 각 기록의 출처와 직접 확인한 이력을 함께 보여드려요.</p>
          </div>
          <aside className={styles.truthPanel} aria-label="현재 화면의 데이터 상태">
            <header><span>데이터 상태</span><strong>예시 화면</strong></header>
            <p><strong>00</strong><span>실제 건강 기록</span></p>
            <dl>
              <div><dt>예시 측정값</dt><dd>{String(measurementCount).padStart(2, "0")}</dd></div>
              <div><dt>예시 출처</dt><dd>{String(sourceCount).padStart(2, "0")}</dd></div>
              <div><dt>직접 확인 표시</dt><dd>{String(measurementCount).padStart(2, "0")}</dd></div>
            </dl>
            <footer>실제 파일이나 기관 API에서 가져온 기록이 아니에요</footer>
          </aside>
        </section>

        <section className={styles.timeline} aria-labelledby="metric-section-title">
          <header className={styles.sectionHeading}>
            <div><p>값의 변화</p><h2 id="metric-section-title">항목별 기록</h2></div>
            <span>검사 조건과 기관 기준에 따라 값과 참고치가 달라질 수 있어요</span>
          </header>

          <div className={styles.metricTabs} role="group" aria-label="확인할 건강 항목">
            {demoHealthTimeline.metrics.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === metric.id}
                onClick={() => setSelectedMetricId(item.id)}
              >
                <span>{item.label}</span>
                <strong>{item.records.at(-1)!.displayValue}<small>{item.unit}</small></strong>
                <em>{item.records.length}개 기록</em>
              </button>
            ))}
          </div>

          <article className={styles.metricPanel} aria-labelledby="selected-metric-title">
            <div className={styles.metricSummary}>
              <div className={styles.metricTopline}><span>가장 최근 값</span><StatusLabel status="verified" /></div>
              <h3 id="selected-metric-title">{metric.label}</h3>
              <p className={styles.latestValue}><strong>{latest.displayValue}</strong><span>{metric.unit}</span></p>
              <p className={styles.change}>{describeChange(metric)}</p>
              <p className={styles.reference}>{metric.referenceText}</p>
              <dl>
                <div><dt>검사일</dt><dd><time dateTime={latest.observedAt}>{formatKoreanDate(latest.observedAt)}</time></dd></div>
                <div><dt>출처</dt><dd>{latest.sourceName}</dd></div>
              </dl>
            </div>
            <TrendChart metric={metric} />
          </article>
        </section>

        <section className={styles.history} aria-labelledby="history-title">
          <header className={styles.sectionHeading}>
            <div><p>출처와 확인 이력</p><h2 id="history-title">{metric.label} 기록 {metric.records.length}개</h2></div>
            <span>가장 최근 기록부터 보여드려요</span>
          </header>
          <ol>
            {[...metric.records].reverse().map((record, index) => (
              <li key={record.id}>
                <div className={styles.historyDate}>
                  <span>{index === 0 ? "최근" : String(metric.records.length - index).padStart(2, "0")}</span>
                  <time dateTime={record.observedAt}>{formatKoreanDate(record.observedAt)}</time>
                </div>
                <div className={styles.historyValue}><strong>{record.displayValue}</strong><span>{metric.unit}</span></div>
                <div className={styles.historySource}><strong>{record.sourceName}</strong><span>{record.confirmationNote}</span></div>
                <details>
                  <summary>출처와 확인 이력 보기</summary>
                  <dl>
                    <div><dt>원문 위치</dt><dd>{record.sourceLocation}</dd></div>
                    <div><dt>파일 확인값</dt><dd><code>{record.sourceDigest.slice(7, 19)}…{record.sourceDigest.slice(-8)}</code></dd></div>
                    <div><dt>확인 상태</dt><dd>{record.confirmationNote}</dd></div>
                  </dl>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.boundary} aria-labelledby="boundary-title">
          <div><p>기록을 이해하는 데 도움을 드려요</p><h2 id="boundary-title">이 화면은 진단 결과가 아니에요</h2><span>값의 의미나 건강 상태는 검사 결과지와 의료진 설명을 함께 확인하세요.</span></div>
          <a href="/">홈으로 돌아가기</a>
        </section>
      </div>
    </main>
  );
}

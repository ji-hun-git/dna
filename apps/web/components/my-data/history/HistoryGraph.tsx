"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MeasurementSeries } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { HISTORY_LAYOUT_DEFAULTS, layoutHistory } from "@/lib/my-data/history-layout";
import styles from "@/components/my-data/history/History.module.css";

/** The drawing is laid out at the container's real width so anchors keep their size on a phone. */
function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const measured = Math.floor(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

type HistoryGraphProps = {
  series: MeasurementSeries;
  /** Position of the series in the list. It picks the identifying colour and nothing else. */
  seriesIndex: number;
};

/**
 * The person's own values: square anchors at the confirmed values, straight segments between
 * neighbours, y from this series' own minimum to its own maximum. The ribbon (outer band plus a
 * dashed centre line) is the same straight path stroked twice at fixed widths.
 */
export function HistoryGraph({ series, seriesIndex }: HistoryGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(wrapRef);
  const [selectedId, setSelectedId] = useState<string>();
  const layout = useMemo(() => layoutHistory(series.points, { ...HISTORY_LAYOUT_DEFAULTS, width }), [series.points, width]);
  const { height, anchorSize, hitSize } = HISTORY_LAYOUT_DEFAULTS;
  const selected = layout.anchors.find((anchor) => anchor.eventId === selectedId);
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const toggle = (eventId: string) => setSelectedId((current) => (current === eventId ? undefined : eventId));
  const graphLabel = `${series.concept} ${series.unit}, 측정 ${series.points.length}회, ${formatKoreanDate(first.observedOn)}부터 ${formatKoreanDate(last.observedOn)}까지. 같은 값이 아래 표에 있어요.`;

  return (
    <div ref={wrapRef} className={styles.graphWrap} data-series-colour={(seriesIndex % 4) + 1}>
      {layout.drawable ? (
        <>
          {/* role="img" with focusable anchors inside fails jest-axe's nested-interactive rule
              (an SVG image must have no focusable descendants), so this uses role="group" with
              the same accessible name, plus a visually hidden paragraph carrying that summary
              for anyone whose assistive technology does not announce a group's own label. */}
          <svg
            className={styles.graph}
            role="group"
            aria-label={graphLabel}
            viewBox={`0 0 ${width} ${height + 24}`}
            width={width}
            height={height + 24}
          >
            <path data-ribbon="band" className={styles.ribbonBand} d={layout.path} />
            <path data-ribbon="centre" className={styles.ribbonCentre} d={layout.path} />
            <g className={styles.ticks} aria-hidden="true">
              {layout.ticks.map((tick) => (
                <g key={tick.observedOn}>
                  <line x1={tick.x} x2={tick.x} y1={height - 6} y2={height} />
                  {tick.labelled ? (
                    <text x={tick.x} y={height + 16} textAnchor={tick.x < width / 3 ? "start" : tick.x > (width * 2) / 3 ? "end" : "middle"}>
                      {formatKoreanDate(tick.observedOn)}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
            {selected ? <line data-leader="" className={styles.leader} x1={selected.x} x2={selected.x} y1={selected.y} y2={height + 24} /> : null}
            {layout.anchors.map((anchor) => (
              <g
                key={anchor.eventId}
                role="button"
                tabIndex={0}
                aria-label={`${series.concept} ${anchor.value} ${series.unit}, ${formatKoreanDate(anchor.observedOn)}`}
                aria-pressed={anchor.eventId === selectedId}
                className={styles.anchor}
                onClick={() => toggle(anchor.eventId)}
                onKeyDown={(keyboard) => {
                  if (keyboard.key === "Enter" || keyboard.key === " ") {
                    keyboard.preventDefault();
                    toggle(anchor.eventId);
                  }
                }}
              >
                <rect data-hit="" x={anchor.x - hitSize / 2} y={anchor.y - hitSize / 2} width={hitSize} height={hitSize} />
                <rect data-anchor="" x={anchor.x - anchorSize / 2} y={anchor.y - anchorSize / 2} width={anchorSize} height={anchorSize} />
              </g>
            ))}
          </svg>
          <p className={styles.visuallyHidden}>{graphLabel}</p>
          {selected ? (
            <div role="group" aria-label="선택한 측정값" className={styles.card}>
              <strong className={styles.cardNumber}>{selected.value} {series.unit}</strong>
              <span>{formatKoreanDate(selected.observedOn)}</span>
              <a href={`/my-data#event-${selected.eventId}`}>출처 보기</a>
            </div>
          ) : null}
          {seriesIndex === 0 ? (
            <p className={styles.note}>점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.</p>
          ) : null}
          {layout.adjusted ? (
            <p className={styles.note} data-testid="history-adjusted-notice">점이 겹치지 않도록 위치를 조금 옮겼어요. 정확한 검사일은 아래 표에서 확인해 주세요.</p>
          ) : null}
        </>
      ) : (
        <p className={styles.note}>{series.points.length === 1 ? "값이 하나라서 그래프 없이 표로만 보여드려요." : "숫자가 아닌 값이 있어 그래프 없이 표로만 보여드려요."}</p>
      )}
    </div>
  );
}

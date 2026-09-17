"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MeasurementSeries } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { HISTORY_LAYOUT_DEFAULTS, layoutHistory } from "@/lib/my-data/history-layout";
import styles from "@/components/my-data/history/History.module.css";

/**
 * The founder-approved time gradient (wave4-mockup-decision.md): the same four stops for every
 * series, left (earlier) to right (later). This is the only colour rule in the graph — it marks a
 * position in time, never a value, so every series draws it identically.
 */
export const HISTORY_TIME_GRADIENT_STOPS = [
  { offset: "0", color: "#1f5bff" },
  { offset: ".55", color: "#35c6b4" },
  { offset: ".8", color: "#6fe06a" },
  { offset: "1", color: "#c8f02a" },
] as const;

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
  /** Position of the series in the list. Used only to tell series apart in the DOM (heading,
   * gradient id); it never selects a colour — every series draws the same time gradient. */
  seriesIndex: number;
  /** The shared x domain (I2): every series on the page maps the same real exam date to the same
   * x fraction, so the earliest and latest exam date across the whole page — not this series'
   * own — drive both the anchor positions and (because they share the same coordinate space)
   * the gradient. */
  domainStart: string;
  domainEnd: string;
};

/** "2026-07-28" becomes "2026.07.28" — the mockup's own date style for the anchor name and the card's
 * first line; kept separate from the app's `formatKoreanDate` (used everywhere else on the
 * screen), which the mockup does not use for these two spots. */
function dotDate(observedOn: string) {
  return observedOn.replaceAll("-", ".");
}

/**
 * The person's own values: square anchors at the confirmed values, straight segments between
 * neighbours, y from this series' own minimum to its own maximum. The ribbon (outer band plus a
 * solid body, both the same time gradient, plus a dashed ink centre line) is the same straight
 * path stroked three times at fixed widths. Series are told apart by heading and position only —
 * colour here means time, nothing else, and is identical for every series on the page.
 */
export function HistoryGraph({ series, seriesIndex, domainStart, domainEnd }: HistoryGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(wrapRef);
  const [selectedId, setSelectedId] = useState<string>();
  const layout = useMemo(
    () => layoutHistory(series.points, { ...HISTORY_LAYOUT_DEFAULTS, width, domainStart, domainEnd }),
    [series.points, width, domainStart, domainEnd],
  );
  // Unique per series instance on the page, independent of `seriesIndex`. Called unconditionally,
  // alongside every other hook, ahead of the empty-points guard below.
  const reactId = useId();
  const { height, anchorSize, hitSize, paddingX } = HISTORY_LAYOUT_DEFAULTS;
  if (series.points.length === 0) return null; // guard: the schema requires >=1, but never trust it blindly
  const selected = layout.anchors.find((anchor) => anchor.eventId === selectedId);
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const toggle = (eventId: string) => setSelectedId((current) => (current === eventId ? undefined : eventId));
  const graphLabel = `${series.concept} ${series.unit}, 측정 ${series.points.length}회, ${formatKoreanDate(first.observedOn)}부터 ${formatKoreanDate(last.observedOn)}까지. 같은 값이 아래 표에 있어요.`;
  const gradientId = `history-time-${reactId}-${seriesIndex}`;
  const cardId = `history-card-${reactId}-${seriesIndex}`;

  return (
    <div ref={wrapRef} className={styles.graphWrap}>
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
            <defs>
              <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={paddingX} y1="0" x2={width - paddingX} y2="0">
                {HISTORY_TIME_GRADIENT_STOPS.map((stop) => (
                  <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                ))}
              </linearGradient>
            </defs>
            <path data-ribbon="band" className={styles.ribbonBand} stroke={`url(#${gradientId})`} d={layout.path} />
            <path data-ribbon="body" className={styles.ribbonBody} stroke={`url(#${gradientId})`} d={layout.path} />
            <path data-ribbon="centre" className={styles.ribbonCentre} stroke="var(--hist-ink)" d={layout.path} />
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
                // Order "검사일 값 단위" (wave4-mockup-decision.md / wave4-mockup.html), e.g.
                // "2026.07.28 188 mg/dL" — the series itself is already named by the nearest
                // heading, so its concept is not repeated here.
                aria-label={`${dotDate(anchor.observedOn)} ${anchor.value} ${series.unit}`}
                aria-pressed={anchor.eventId === selectedId}
                aria-describedby={anchor.eventId === selectedId ? cardId : undefined}
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
                {/* Black square anchors always — selection is shown by the card, the leader line
                    and aria-pressed, never by recolouring the anchor. */}
                <rect
                  data-anchor=""
                  x={anchor.x - anchorSize / 2}
                  y={anchor.y - anchorSize / 2}
                  width={anchorSize}
                  height={anchorSize}
                  fill="var(--hist-ink)"
                />
              </g>
            ))}
          </svg>
          <p className={styles.visuallyHidden}>{graphLabel}</p>
          {selected ? (
            <div id={cardId} role="group" aria-label="선택한 측정값" aria-live="polite" className={styles.card}>
              <span className={styles.cardLabel}>{dotDate(selected.observedOn)} 확인한 값</span>
              <strong className={styles.cardNumber}>{selected.value} {series.unit}</strong>
              <a href={`/my-data#event-${selected.eventId}`}>출처 보기</a>
            </div>
          ) : null}
          {layout.adjusted ? (
            <p className={styles.note} data-testid="history-adjusted-notice">점이 겹치지 않도록 위치를 조금 옮겼어요. 정확한 검사일은 아래 표에서 확인해 주세요.</p>
          ) : null}
        </>
      ) : (
        <p className={styles.note}>{series.points.length === 1 ? "측정이 한 번이라 그래프 없이 표만 보여드려요." : "숫자가 아닌 값이 있어 그래프 없이 표로만 보여드려요."}</p>
      )}
    </div>
  );
}

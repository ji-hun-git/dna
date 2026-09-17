"use client";

import { useMemo, useState } from "react";
import type { HealthEvent } from "@/lib/foundation/client";
import { layoutCells } from "@/lib/my-data/cell-layout";
import { CellTooltip } from "@/components/my-data/CellTooltip";
import { usePrefersReducedMotion } from "@/lib/my-data/reduced-motion";
import styles from "@/components/my-data/MyData.module.css";

type LivingCellCanvasProps = {
  events: HealthEvent[];
  selectedId?: string;
  matchedIds: Set<string> | null;
  newIds: Set<string>;
  onSelect: (eventId: string, invoker: HTMLElement | SVGElement) => void;
  width?: number;
};

const CELL = 10;
const GAP = 3;
const PADDING = 24;

/**
 * Pure SVG. Every rect is one CURRENT record; there is no decorative rect.
 * State is carried in data attributes and patterns so it survives without colour.
 */
export function LivingCellCanvas({ events, selectedId, matchedIds, newIds, onSelect, width = 720 }: LivingCellCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  // Cells whose one arrival animation already finished in this mount; they never get the class again.
  const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(() => new Set());
  const reducedMotion = usePrefersReducedMotion();
  const { cells, scale, height, adjusted } = useMemo(
    () => layoutCells(events, { width, cellSize: CELL, gap: GAP, padding: PADDING, selectedId, matchedIds, newIds }),
    [events, width, selectedId, matchedIds, newIds],
  );
  const byId = useMemo(() => new Map(events.map((event) => [event.eventId, event])), [events]);
  const targetId = focusedId ?? hoveredId;
  const hovered = targetId ? byId.get(targetId) : undefined;
  const hoveredCell = hovered ? cells.find((cell) => cell.eventId === hovered.eventId) : undefined;
  const dimmed = matchedIds !== null;

  return (
    <figure className={styles.canvasWrap} aria-label="나의 데이터: 한 칸이 하나의 기록">
      <svg
        className={styles.canvas}
        viewBox={`0 0 ${width} ${height + 28}`}
        width="100%"
        role="group"
        aria-label={`${events.length}개의 기록, ${scale.start ? `${scale.start}부터 ${scale.end}까지` : "기간 없음"}`}
      >
        <defs>
          <pattern id="gc-cell-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.2" />
          </pattern>
        </defs>
        <g className={styles.axis} aria-hidden="true">
          <line x1={PADDING} x2={width - PADDING} y1={height + 6} y2={height + 6} />
          {scale.ticks.map((tick) => (
            <text key={tick.label} x={tick.x} y={height + 22} textAnchor="middle">{tick.label}</text>
          ))}
        </g>
        {cells.map((cell) => {
          const dim = dimmed && cell.state === "idle";
          const arrived = cell.state === "new" && !reducedMotion && !settledIds.has(cell.eventId);
          const label = cell.uncertain ? `${cell.ariaLabel} (출처 미리보기 없음)` : cell.ariaLabel;
          return (
            <g
              key={cell.eventId}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={cell.state === "selected"}
              aria-describedby={targetId === cell.eventId ? `cell-tip-${cell.eventId}` : undefined}
              data-state={cell.state}
              data-uncertain={cell.uncertain ? "true" : undefined}
              data-corrected={cell.corrected ? "true" : undefined}
              data-dim={dim ? "true" : undefined}
              data-arrived={arrived ? "true" : undefined}
              className={arrived ? `${styles.cell} ${styles.cellArrived}` : styles.cell}
              onClick={(mouse) => onSelect(cell.eventId, mouse.currentTarget)}
              onKeyDown={(keyboard) => {
                if (keyboard.key === "Enter" || keyboard.key === " ") {
                  keyboard.preventDefault();
                  onSelect(cell.eventId, keyboard.currentTarget);
                }
              }}
              onMouseEnter={() => setHoveredId(cell.eventId)}
              onMouseLeave={() => setHoveredId(undefined)}
              onFocus={() => setFocusedId(cell.eventId)}
              onBlur={() => setFocusedId(undefined)}
              onAnimationEnd={arrived ? () => setSettledIds((current) => new Set(current).add(cell.eventId)) : undefined}
            >
              <rect data-cell="" x={cell.x} y={cell.y} width={cell.size} height={cell.size} rx="1.5" />
              {cell.state === "query-related" ? (
                <rect data-query-ring="" x={cell.x - 2} y={cell.y - 2} width={cell.size + 4} height={cell.size + 4} rx="2.5" />
              ) : null}
              {cell.uncertain ? (
                <rect data-hatch="" x={cell.x} y={cell.y} width={cell.size} height={cell.size} rx="1.5" fill="url(#gc-cell-hatch)" />
              ) : null}
              {cell.corrected ? (
                <circle data-corrected-mark="" cx={cell.x + cell.size} cy={cell.y} r="2" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered && hoveredCell ? (
        <CellTooltip
          event={hovered}
          x={Math.min(88, Math.max(12, ((hoveredCell.x + hoveredCell.size / 2) / width) * 100))}
          y={hoveredCell.y}
        />
      ) : null}
      <figcaption className={styles.caption}>한 칸 = 확인한 기록 하나. 값의 의미나 변화의 방향은 판단하지 않아요.</figcaption>
      {adjusted ? (
        <p className={styles.adjustedNotice} data-testid="cell-adjusted-notice">
          셀이 겹치지 않도록 위치를 조금 옮겼어요. 정확한 날짜는 셀을 선택해 확인해 주세요.
        </p>
      ) : null}
    </figure>
  );
}

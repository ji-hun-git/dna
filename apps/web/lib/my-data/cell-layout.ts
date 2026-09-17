import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";

export type CellState = "idle" | "new" | "query-related" | "selected";

export type TimeScale = {
  start: string;
  end: string;
  x(observedOn: string): number;
  ticks: Array<{ label: string; x: number }>;
};

export type CellLayout = {
  eventId: string;
  x: number;
  y: number;
  size: number;
  state: CellState;
  uncertain: boolean;
  corrected: boolean;
  ariaLabel: string;
};

function dayNumber(isoDate: string) {
  return Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000;
}

function monthLabel(isoDate: string) {
  return `${isoDate.slice(0, 4)}. ${Number(isoDate.slice(5, 7))}.`;
}

/** Linear day scale. Only coordinates: no smoothing, no interpolation of values. */
export function buildTimeScale(dates: string[], width: number, padding: number): TimeScale {
  const sorted = [...new Set(dates)].sort();
  const start = sorted[0] ?? "";
  const end = sorted[sorted.length - 1] ?? start;
  const span = dayNumber(end) - dayNumber(start);
  const inner = width - padding * 2;
  const x = (observedOn: string) => span === 0
    ? width / 2
    : padding + ((dayNumber(observedOn) - dayNumber(start)) / span) * inner;
  const months = [...new Set(sorted.map((date) => date.slice(0, 7)))];
  const ticks = months.map((month) => {
    const first = sorted.find((date) => date.startsWith(month))!;
    return { label: monthLabel(first), x: x(first) };
  });
  return { start, end, x, ticks };
}

type LayoutOptions = {
  width: number;
  cellSize: number;
  gap: number;
  padding: number;
  selectedId?: string;
  matchedIds?: Set<string> | null;
  newIds?: Set<string>;
};

function stateFor(eventId: string, options: LayoutOptions): CellState {
  if (options.selectedId === eventId) return "selected";
  if (options.matchedIds?.has(eventId)) return "query-related";
  if (options.newIds?.has(eventId)) return "new";
  return "idle";
}

/**
 * One rect per event. Same-day events stack upward in concept order so the
 * picture is stable across renders. Nothing here reads the value as a number.
 */
export function layoutCells(events: HealthEvent[], options: LayoutOptions) {
  const scale = buildTimeScale(events.map((event) => event.observedOn), options.width, options.padding);
  const step = options.cellSize + options.gap;
  const byDay = new Map<string, HealthEvent[]>();
  for (const event of events) {
    const stack = byDay.get(event.observedOn);
    if (stack) stack.push(event);
    else byDay.set(event.observedOn, [event]);
  }
  let tallest = 0;
  for (const stack of byDay.values()) {
    stack.sort((left, right) => left.concept.localeCompare(right.concept, "ko") || left.confirmedAt.localeCompare(right.confirmedAt));
    tallest = Math.max(tallest, stack.length);
  }
  const height = options.padding * 2 + tallest * step;
  const baseline = height - options.padding - options.cellSize;
  // Dates close together (e.g. one day apart on a months-wide axis) would otherwise map to
  // x positions closer than one cell width, so their rects overlap and steal pointer/click
  // events from each other. Keep the day order and spread any that are too close, then pull
  // the right edge back inside the padded width without re-introducing overlap.
  const days = [...byDay.keys()];
  const orderedDays = [...days].sort((left, right) => scale.x(left) - scale.x(right));
  const resolvedX = new Map<string, number>();
  let previousX: number | undefined;
  for (const day of orderedDays) {
    let x = scale.x(day);
    if (previousX !== undefined && x - previousX < step) x = previousX + step;
    resolvedX.set(day, x);
    previousX = x;
  }
  const maxX = options.width - options.padding - options.cellSize / 2;
  let nextX: number | undefined;
  for (const day of [...orderedDays].reverse()) {
    let x = resolvedX.get(day)!;
    if (x > maxX) x = maxX;
    if (nextX !== undefined && nextX - x < step) x = nextX - step;
    resolvedX.set(day, x);
    nextX = x;
  }
  const cells: CellLayout[] = [];
  for (const [observedOn, stack] of byDay) {
    stack.forEach((event, index) => {
      cells.push({
        eventId: event.eventId,
        x: resolvedX.get(observedOn)! - options.cellSize / 2,
        y: baseline - index * step,
        size: options.cellSize,
        state: stateFor(event.eventId, options),
        uncertain: event.verification === "uncertain",
        corrected: event.corrected,
        ariaLabel: `${event.concept} ${event.value} ${event.unit}, ${formatKoreanDate(event.observedOn)}`,
      });
    });
  }
  return { cells, scale, height };
}

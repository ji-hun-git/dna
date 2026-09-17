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
 * Dates close together (e.g. one day apart on a months-wide axis) would otherwise map to
 * x positions closer than one cell width, so their rects overlap and steal pointer/click
 * events from each other. Given day-ordered target centres and a minimum centre-to-centre
 * `step`, returns centres that keep that order, respect `[minX, maxX]`, and are spaced by at
 * least `step` whenever the available span (`maxX - minX`) can fit that spacing.
 *
 * When it cannot fit (more dates than the width has room for at minimum spacing), the
 * degrade rule is: spread all of them evenly across the full available span, in date order,
 * inside the canvas — never negative, never clamped into an undefined pile-up. Pure and O(n):
 * two linear passes, no loop that depends on convergence.
 */
export function declumpPositions(targets: number[], step: number, minX: number, maxX: number): number[] {
  const count = targets.length;
  if (count === 0) return [];
  if (count === 1) return [Math.min(Math.max(targets[0], minX), maxX)];

  const availableSpan = maxX - minX;
  const requiredSpan = (count - 1) * step;
  if (requiredSpan > availableSpan) {
    return targets.map((_, index) => minX + (index * availableSpan) / (count - 1));
  }

  // Forward pass: the smallest sequence that is >= each target, >= minX, and spaced by `step`.
  const forward: number[] = [Math.max(targets[0], minX)];
  for (let index = 1; index < count; index++) {
    forward.push(Math.max(targets[index], forward[index - 1] + step));
  }

  // Backward pass: pull the sequence back under maxX without breaking the minimum spacing.
  // Because requiredSpan <= availableSpan was checked above, this always stays >= minX too.
  const resolved = forward.slice();
  resolved[count - 1] = Math.min(resolved[count - 1], maxX);
  for (let index = count - 2; index >= 0; index--) {
    resolved[index] = Math.min(resolved[index], resolved[index + 1] - step);
  }
  return resolved;
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
  const orderedDays = [...byDay.keys()].sort((left, right) => scale.x(left) - scale.x(right));
  const minX = options.padding + options.cellSize / 2;
  const maxX = options.width - options.padding - options.cellSize / 2;
  const declumped = declumpPositions(orderedDays.map((day) => scale.x(day)), step, minX, maxX);
  const resolvedX = new Map<string, number>(orderedDays.map((day, index) => [day, declumped[index]]));
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

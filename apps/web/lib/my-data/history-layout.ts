/**
 * Pure geometry for the 측정 이력 graph. The person's own values only: y spans the series' own
 * minimum and maximum, neighbouring points are joined by straight segments (no curve, no fit, no
 * value is invented between points), x follows the exam date, ticks sit only at real exam dates.
 * Nothing here knows a range, a threshold or a direction.
 */
export type HistoryPointInput = { eventId: string; value: string; observedOn: string };

export type HistoryLayoutOptions = {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  /** Visible square anchor edge. */
  anchorSize: number;
  /** Transparent pointer/keyboard target edge around an anchor. */
  hitSize: number;
  /** Minimum distance between neighbouring anchor centres before a point is nudged. */
  minGap: number;
  /** Minimum distance between two labelled ticks. */
  minLabelGap: number;
};

export const HISTORY_LAYOUT_DEFAULTS: Omit<HistoryLayoutOptions, "width"> = {
  height: 180,
  paddingX: 28,
  paddingY: 24,
  anchorSize: 9,
  hitSize: 24,
  minGap: 26,
  minLabelGap: 72,
};

export type HistoryAnchor = { eventId: string; x: number; y: number; value: string; observedOn: string };
export type HistorySegment = { x1: number; y1: number; x2: number; y2: number };
export type HistoryTick = { x: number; observedOn: string; labelled: boolean };
export type HistoryLayout = {
  drawable: boolean;
  flat: boolean;
  adjusted: boolean;
  min: number | null;
  max: number | null;
  anchors: HistoryAnchor[];
  segments: HistorySegment[];
  ticks: HistoryTick[];
  /** `M x,y L x,y …` — move and line commands only. */
  path: string;
};

const NUMERIC = /^-?\d+(\.\d+)?$/;
const NOTHING: HistoryLayout = { drawable: false, flat: false, adjusted: false, min: null, max: null, anchors: [], segments: [], ticks: [], path: "" };

export function parseHistoryValue(raw: string): number | null {
  const text = raw.replace(/,/g, "").trim();
  return NUMERIC.test(text) ? Number(text) : null;
}

function dayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function layoutHistory(points: readonly HistoryPointInput[], options: HistoryLayoutOptions): HistoryLayout {
  const numeric = points
    .map((point, index) => ({ point, index, number: parseHistoryValue(point.value) }))
    .filter((entry): entry is { point: HistoryPointInput; index: number; number: number } => entry.number !== null)
    // Time order; equal dates keep a stable, input-independent order by event id.
    .sort((a, b) => a.point.observedOn.localeCompare(b.point.observedOn) || a.point.eventId.localeCompare(b.point.eventId));
  if (numeric.length < 2) return NOTHING;

  const { width, height, paddingX, paddingY, minGap, minLabelGap } = options;
  const left = paddingX;
  const right = width - paddingX;
  const innerWidth = Math.max(0, right - left);
  const top = paddingY;
  const innerHeight = Math.max(0, height - 2 * paddingY);
  const count = numeric.length;

  const values = numeric.map((entry) => entry.number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = min === max;

  const days = numeric.map((entry) => dayNumber(entry.point.observedOn));
  const span = days[count - 1] - days[0];
  const even = numeric.map((_, index) => left + (index / (count - 1)) * innerWidth);
  const byDate = span > 0 ? days.map((day) => left + ((day - days[0]) / span) * innerWidth) : even;
  let xs = [...byDate];
  if ((count - 1) * minGap > innerWidth) {
    xs = even; // cannot keep every point apart: even spacing in time order
  } else {
    for (let index = 1; index < count; index += 1) xs[index] = Math.max(xs[index], xs[index - 1] + minGap);
    if (xs[count - 1] > right) {
      xs[count - 1] = right;
      for (let index = count - 2; index >= 0; index -= 1) xs[index] = Math.min(xs[index], xs[index + 1] - minGap);
    }
  }
  const adjusted = span === 0 || xs.some((x, index) => Math.abs(x - byDate[index]) > 0.5);

  const anchors: HistoryAnchor[] = numeric.map((entry, index) => ({
    eventId: entry.point.eventId,
    x: round2(xs[index]),
    y: round2(flat ? height / 2 : top + ((max - entry.number) / (max - min)) * innerHeight),
    value: entry.point.value,
    observedOn: entry.point.observedOn,
  }));
  const segments: HistorySegment[] = anchors.slice(1).map((anchor, index) => ({
    x1: anchors[index].x, y1: anchors[index].y, x2: anchor.x, y2: anchor.y,
  }));
  const path = anchors.map((anchor, index) => `${index === 0 ? "M" : "L"}${anchor.x},${anchor.y}`).join(" ");

  // One tick per real exam date, at the first anchor of that date. Labels are thinned, never invented.
  const firstOfDate = anchors.filter((anchor, index) => index === 0 || anchors[index - 1].observedOn !== anchor.observedOn);
  const lastX = firstOfDate[firstOfDate.length - 1].x;
  let previousLabelX = Number.NEGATIVE_INFINITY;
  const ticks: HistoryTick[] = firstOfDate.map((anchor, index) => {
    const isEdge = index === 0 || index === firstOfDate.length - 1;
    const fits = anchor.x - previousLabelX >= minLabelGap && lastX - anchor.x >= minLabelGap;
    // The first and the last real date are always labelled; one in between only when it clears both neighbours.
    const labelled = isEdge || fits;
    if (labelled) previousLabelX = anchor.x;
    return { x: anchor.x, observedOn: anchor.observedOn, labelled };
  });

  return { drawable: true, flat, adjusted, min, max, anchors, segments, ticks, path };
}

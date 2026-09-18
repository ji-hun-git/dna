/**
 * Example data shared between the "alive trajectory" hero and the identity/records panels beside
 * it. Everything here is fabricated example data, never a real person's record: see the caption
 * and boundary sentences carried by the components that render this. Nothing here encodes a
 * value by colour, size, speed or direction — every node uses identical strokes and identical
 * motion regardless of which item it carries.
 */

export type ExampleNode = {
  item: string;
  value: string;
  unit: string;
  observedOn: string;
  shape: "circle" | "squircle";
  size: number;
  phase: number;
};

export type ExampleRing = { t: number; rx: number; ry: number; nodes: ExampleNode[] };

export const RINGS: ReadonlyArray<ExampleRing> = [
  {
    t: 0.1,
    rx: 150,
    ry: 34,
    nodes: [
      { item: "체질량지수", value: "23.4", unit: "", observedOn: "2025-01-20", shape: "squircle", size: 26, phase: 0.2 },
      { item: "휴식 시 맥박", value: "58", unit: "회/분", observedOn: "2025-01-20", shape: "circle", size: 16, phase: 3.4 },
    ],
  },
  {
    t: 0.34,
    rx: 210,
    ry: 46,
    nodes: [
      { item: "혈압", value: "120/80", unit: "mmHg", observedOn: "2025-07-14", shape: "squircle", size: 30, phase: 1.1 },
      { item: "수면", value: "7시간 12분", unit: "", observedOn: "2025-07-14", shape: "circle", size: 14, phase: 2.6 },
      { item: "걸음", value: "8,900", unit: "", observedOn: "2025-07-15", shape: "squircle", size: 20, phase: 4.7 },
    ],
  },
  {
    t: 0.58,
    rx: 120,
    ry: 30,
    nodes: [
      { item: "총콜레스테롤", value: "194", unit: "mg/dL", observedOn: "2026-01-15", shape: "squircle", size: 34, phase: 0.6 },
    ],
  },
  {
    t: 0.8,
    rx: 90,
    ry: 24,
    nodes: [
      { item: "비타민 D", value: "31.2", unit: "ng/mL", observedOn: "2026-07-28", shape: "circle", size: 18, phase: 2.0 },
      { item: "당화혈색소", value: "5.2", unit: "%", observedOn: "2026-07-28", shape: "squircle", size: 18, phase: 5.1 },
    ],
  },
];

export function nodeLabel(node: ExampleNode) {
  return node.unit ? `${node.item} ${node.value} ${node.unit}` : `${node.item} ${node.value}`;
}

export function nodeValueWithUnit(node: ExampleNode) {
  return node.unit ? `${node.value} ${node.unit}` : node.value;
}

/** Flattened example record rows for the records panel — the same nodes drawn on the hero. */
export function exampleRecordRows(): ExampleNode[] {
  return RINGS.flatMap((ring) => ring.nodes);
}

/** The one example profile shown in the identity panel. Never a real-looking name. */
export const EXAMPLE_IDENTITY = {
  name: "예시 사용자",
  age: 25,
  gender: "여성",
  lastResultDate: "2026-07-28",
  recordCount: exampleRecordRowsCount(),
  resultSheetCount: 3,
} as const;

function exampleRecordRowsCount() {
  return RINGS.reduce((sum, ring) => sum + ring.nodes.length, 0);
}

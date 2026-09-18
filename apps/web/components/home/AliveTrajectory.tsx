"use client";

import { useEffect, useRef } from "react";
import { formatKoreanDate } from "@/lib/format/korean-date";
import {
  BASE_CONTROL_POINTS,
  DRAW,
  DRIFT,
  PICKER,
  Spring,
  addDrumVelocity,
  buildPath,
  createControlPoints,
  createDrum,
  fadeEdge,
  halfEllipsePath,
  pathPoint,
  stepControlPoints,
  stepDrum,
  type ControlPoint,
} from "@/lib/home/alive-trajectory";
import { usePrefersReducedMotion } from "@/lib/my-data/reduced-motion";
import styles from "@/components/home/AliveTrajectory.module.css";

const VIEW_W = 1200;
const VIEW_H = 760;
const T_END = 0.97;

/**
 * Example items only — never a real person's record, and never a status word. Each label is
 * item, value and unit; the date goes through formatKoreanDate. Every node uses identical
 * strokes, size-per-item and identical motion, so nothing here can be read as encoding a value.
 */
type ExampleNode = {
  item: string;
  value: string;
  unit: string;
  observedOn: string;
  shape: "circle" | "squircle";
  size: number;
  phase: number;
};

type ExampleRing = { t: number; rx: number; ry: number; nodes: ExampleNode[] };

const RINGS: ReadonlyArray<ExampleRing> = [
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

function nodeLabel(node: ExampleNode) {
  return node.unit ? `${node.item} ${node.value} ${node.unit}` : `${node.item} ${node.value}`;
}

const NS = "http://www.w3.org/2000/svg";

type NodeRefs = {
  spec: ExampleNode;
  phase: Spring;
  group: SVGGElement;
  shape: SVGCircleElement | SVGRectElement;
  label: SVGTextElement;
  date: SVGTextElement;
  rr: number;
};

type RingRefs = {
  spec: ExampleRing;
  back: SVGPathElement;
  front: SVGPathElement;
  pos: Spring;
  nodes: NodeRefs[];
};

function el<K extends keyof SVGElementTagNameMap>(
  parent: SVGElement,
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

export type AliveTrajectoryProps = {
  className?: string;
};

/**
 * A full-viewport, pitch-black hero: a breathing arrow curving up and to the right, with energy
 * flowing along it, tall elliptical rings straddling the path carrying labelled example-item
 * nodes, and scroll-driven drum motion (momentum, then a detent snap). Everything here is
 * decorative: the SVG is a single `role="img"` with a Korean description, nothing inside it is
 * focusable, and no property of a node (colour, size, speed, direction) varies with the item's
 * value. Under `prefers-reduced-motion: reduce` it renders one still frame and runs no loop.
 */
export function AliveTrajectory({ className }: AliveTrajectoryProps) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowRef = useRef<SVGPathElement | null>(null);
  const haloRef = useRef<SVGPathElement | null>(null);
  const flowRef = useRef<SVGPathElement | null>(null);
  const tipRef = useRef<SVGGElement | null>(null);
  const backLayerRef = useRef<SVGGElement | null>(null);
  const frontLayerRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const arrow = arrowRef.current;
    const halo = haloRef.current;
    const flow = flowRef.current;
    const tip = tipRef.current;
    const backLayer = backLayerRef.current;
    const frontLayer = frontLayerRef.current;
    const root = rootRef.current;
    if (!svg || !arrow || !halo || !flow || !tip || !backLayer || !frontLayer || !root) return undefined;

    const controlPoints: ControlPoint[] = createControlPoints(BASE_CONTROL_POINTS);
    const drum = createDrum();
    const draw = new Spring(reduced ? 1 : 0, DRAW);
    draw.set(1);

    const rings: RingRefs[] = RINGS.map((spec) => {
      const back = el(backLayer, "path", { fill: "none", stroke: "rgba(255,255,255,0.42)", "stroke-width": 1 });
      const front = el(frontLayer, "path", { fill: "none", stroke: "rgba(255,255,255,0.42)", "stroke-width": 1 });
      const nodes: NodeRefs[] = spec.nodes.map((nodeSpec) => {
        const group = el(frontLayer, "g", {});
        const rr = nodeSpec.size / 2;
        const shape =
          nodeSpec.shape === "circle"
            ? el(group, "circle", { r: rr, fill: "#000", stroke: "#fff", "stroke-width": 2 })
            : el(group, "rect", {
                x: -rr,
                y: -rr,
                width: nodeSpec.size,
                height: nodeSpec.size,
                rx: rr * 0.55,
                fill: "#000",
                stroke: "#fff",
                "stroke-width": 2,
              });
        const label = el(group, "text", { fill: "#fff", "font-size": 12, "dominant-baseline": "middle", y: -1 });
        label.textContent = nodeLabel(nodeSpec);
        const date = el(group, "text", {
          fill: "rgba(255,255,255,0.6)",
          "font-size": 10,
          "dominant-baseline": "middle",
          y: 13,
          class: styles.mono,
        });
        date.textContent = formatKoreanDate(nodeSpec.observedOn);
        return { spec: nodeSpec, phase: new Spring(nodeSpec.phase, DRIFT), group, shape, label, date, rr };
      });
      return { spec, back, front, pos: new Spring(spec.t, PICKER), nodes };
    });

    const onWheel = (event: WheelEvent) => {
      addDrumVelocity(drum, event.deltaY);
    };
    if (!reduced) root.addEventListener("wheel", onWheel, { passive: true });

    let intersecting = true;
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          intersecting = entries.some((entry) => entry.isIntersecting);
        },
        { threshold: 0 },
      );
      observer.observe(root);
    }

    let hidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      hidden = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", onVisibility);

    let time = 0;
    let drift = 0;
    let flowOffset = 0;
    let last = 0;
    let frameId = 0;
    let cancelled = false;

    function renderStill() {
      const d = buildPath(controlPoints, 0);
      arrow!.setAttribute("d", d);
      halo!.setAttribute("d", d);
      flow!.setAttribute("d", d);
      arrow!.style.strokeDasharray = "";
      arrow!.style.strokeDashoffset = "0";
      halo!.style.strokeDasharray = "";
      halo!.style.strokeDashoffset = "0";
      halo!.style.opacity = "0.3";
      flow!.style.opacity = "0";
      const head = pathPoint(controlPoints, 1);
      tip!.setAttribute("transform", `translate(${head.x} ${head.y}) rotate(${(head.angle * 180) / Math.PI})`);
      tip!.style.opacity = "1";
      for (const ring of rings) {
        const c = pathPoint(controlPoints, ring.spec.t);
        const rot = c.angle + Math.PI / 2;
        ring.back.setAttribute("d", halfEllipsePath(c.x, c.y, ring.spec.rx, ring.spec.ry, rot, Math.PI, 2 * Math.PI, 48));
        ring.back.style.opacity = "1";
        ring.front.setAttribute("d", halfEllipsePath(c.x, c.y, ring.spec.rx, ring.spec.ry, rot, 0, Math.PI, 48));
        ring.front.style.opacity = "1";
        for (const node of ring.nodes) {
          const theta = node.spec.phase;
          const ex = ring.spec.rx * Math.cos(theta);
          const ey = ring.spec.ry * Math.sin(theta);
          const x = c.x + ex * Math.cos(rot) - ey * Math.sin(rot);
          const y = c.y + ex * Math.sin(rot) + ey * Math.cos(rot);
          const side = Math.cos(theta) >= 0 ? 1 : -1;
          node.group.setAttribute("transform", `translate(${x} ${y})`);
          node.group.style.opacity = "1";
          for (const text of [node.label, node.date]) {
            text.setAttribute("text-anchor", side > 0 ? "start" : "end");
            text.setAttribute("x", String(side * (node.rr + 12)));
          }
        }
      }
    }

    function frame(now: number) {
      if (cancelled) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!hidden && intersecting) {
        time += dt;
        const d = buildPath(controlPoints, time);
        stepControlPoints(controlPoints, dt);
        arrow!.setAttribute("d", d);
        halo!.setAttribute("d", d);
        flow!.setAttribute("d", d);
        const length = 3200; // stable approximate length; only used for the dash draw-in effect.
        const drawn = draw.step(dt);
        arrow!.style.strokeDasharray = String(length);
        arrow!.style.strokeDashoffset = String(length * (1 - drawn));
        halo!.style.strokeDasharray = String(length);
        halo!.style.strokeDashoffset = String(length * (1 - drawn));
        halo!.style.opacity = String(0.25 + 0.15 * Math.sin(time * 1.3));
        flowOffset -= dt * 70;
        flow!.style.strokeDashoffset = String(flowOffset);
        flow!.style.opacity = String(drawn);
        const head = pathPoint(controlPoints, 1);
        tip!.setAttribute("transform", `translate(${head.x} ${head.y}) rotate(${(head.angle * 180) / Math.PI})`);
        tip!.style.opacity = String(drawn);

        drift += dt * 0.012;
        const offset = drift + stepDrum(drum, dt);
        for (const ring of rings) {
          const raw = ring.spec.t + offset;
          const t = ((raw % T_END) + T_END) % T_END;
          ring.pos.set(t);
          if (Math.abs(ring.pos.x - t) > T_END / 2) ring.pos.jump(t);
          const p = ring.pos.step(dt);
          const edge = fadeEdge(p, T_END, 0.06) * drawn;
          const c = pathPoint(controlPoints, p);
          const rot = c.angle + Math.PI / 2 + 0.06 * Math.sin(time * 0.7 + p * 9);
          ring.back.setAttribute("d", halfEllipsePath(c.x, c.y, ring.spec.rx, ring.spec.ry, rot, Math.PI, 2 * Math.PI, 48));
          ring.back.style.opacity = String(edge);
          ring.front.setAttribute("d", halfEllipsePath(c.x, c.y, ring.spec.rx, ring.spec.ry, rot, 0, Math.PI, 48));
          ring.front.style.opacity = String(edge);
          for (const node of ring.nodes) {
            // Kepler-ish: faster on the near side, slower far away, always through a spring.
            node.phase.set(node.phase.t + dt * 0.45 * (1 + 0.5 * Math.sin(node.phase.x)));
            const theta = node.phase.step(dt);
            const ex = ring.spec.rx * Math.cos(theta);
            const ey = ring.spec.ry * Math.sin(theta);
            const x = c.x + ex * Math.cos(rot) - ey * Math.sin(rot);
            const y = c.y + ex * Math.sin(rot) + ey * Math.cos(rot);
            const near = Math.sin(theta) >= 0;
            const layer = (near ? frontLayer : backLayer)!;
            if (node.group.parentNode !== layer) layer.appendChild(node.group);
            const side = Math.cos(theta) >= 0 ? 1 : -1;
            const scale = near ? 1 : 0.82;
            node.group.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
            node.group.style.opacity = String((near ? 1 : 0.5) * edge);
            for (const text of [node.label, node.date]) {
              text.setAttribute("text-anchor", side > 0 ? "start" : "end");
              text.setAttribute("x", String(side * (node.rr + 12)));
            }
          }
        }
      }
      frameId = requestAnimationFrame(frame);
    }

    if (reduced) {
      renderStill();
    } else {
      frameId = requestAnimationFrame(frame);
    }

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (!reduced) root.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      backLayer.replaceChildren();
      frontLayer.replaceChildren();
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} data-reduced-motion={reduced}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="개인 건강 기록이 시간에 따라 위로 흘러가는 모습을 표현한 장식용 예시 애니메이션"
        focusable="false"
      >
        <defs>
          <pattern id="alive-grid-40" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.6} />
          </pattern>
          <pattern id="alive-grid-200" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={0.8} />
          </pattern>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#alive-grid-40)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#alive-grid-200)" />
        <g ref={backLayerRef} />
        <path ref={haloRef} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={10} strokeLinecap="round" />
        <path ref={arrowRef} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        <path ref={flowRef} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 26" />
        <g ref={tipRef}>
          <path d="M -24 -10 L 0 0 L -24 10" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g ref={frontLayerRef} />
      </svg>
      <p className={styles.caption}>예시 데이터 · 실제 사람의 기록이 아니에요</p>
      <p className={styles.boundary}>선의 모양과 움직임은 건강 상태를 뜻하지 않아요.</p>
    </div>
  );
}

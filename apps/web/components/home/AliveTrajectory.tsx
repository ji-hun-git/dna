"use client";

import { useEffect, useRef } from "react";
import { formatKoreanDate } from "@/lib/format/korean-date";
import {
  BASE_CONTROL_POINTS,
  DRAW,
  DRIFT,
  PHASE_LABELS,
  PICKER,
  Spring,
  T_END,
  addDrumVelocity,
  buildPath,
  createControlPoints,
  createDrum,
  fadeEdge,
  halfEllipsePath,
  pathPoint,
  phaseRanges,
  phaseSegmentPath,
  phaseTick,
  stepControlPoints,
  stepDrum,
  type ControlPoint,
  type PhaseRange,
} from "@/lib/home/alive-trajectory";
import { RINGS, nodeLabel, type ExampleNode, type ExampleRing } from "@/lib/home/alive-example-data";
import { usePrefersReducedMotion } from "@/lib/my-data/reduced-motion";
import styles from "@/components/home/AliveTrajectory.module.css";

const VIEW_W = 1200;
const VIEW_H = 760;

/** Shown under the SVG; unrelated to the boundary sentence, which never changes between modes. */
const EXAMPLE_CAPTION = "예시 데이터 · 실제 사람의 기록이 아니에요";

/** All white; the dash pattern only marks a time boundary, never a value. */
const PHASE_DASH_PATTERNS: readonly string[] = ["", "16 8", "3 7", "1 6"];

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

type PhaseSegmentRefs = {
  range: PhaseRange;
  path: SVGPathElement;
  tick?: SVGLineElement;
  label?: SVGTextElement;
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
  /** Time-period phase labels; defaults to the example checkup periods. */
  phaseLabels?: readonly string[];
  /** Rings of labelled nodes, one per completed phase; defaults to the example dataset. */
  rings?: ReadonlyArray<ExampleRing>;
  /** The mono caption under the SVG; the boundary sentence below it never changes. */
  caption?: string;
};

/**
 * A full-viewport, pitch-black hero: a breathing horizontal time axis (left to right, flat at
 * mid-height — it never climbs), with energy flowing along it, tall elliptical rings straddling
 * the path carrying labelled item nodes, and scroll-driven drum motion (momentum, then a detent
 * snap). The axis has no arrowhead or gate at its end; it simply continues to the right edge.
 * Everything here is decorative: the
 * SVG is a single `role="img"` with a Korean description, nothing inside it is focusable, and no
 * property of a node (colour, size, speed, direction) varies with the item's value. Under
 * `prefers-reduced-motion: reduce` it renders one still frame and runs no loop. `phaseLabels` and
 * `rings` default to the pre-login example dataset; the logged-in home screen passes the same
 * shapes built from the person's own records (see `lib/home/alive-home-data.ts`).
 */
export function AliveTrajectory({
  className,
  phaseLabels = PHASE_LABELS,
  rings: ringSpecs = RINGS,
  caption = EXAMPLE_CAPTION,
}: AliveTrajectoryProps) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const phasesLayerRef = useRef<SVGGElement | null>(null);
  const haloRef = useRef<SVGPathElement | null>(null);
  const flowRef = useRef<SVGPathElement | null>(null);
  const backLayerRef = useRef<SVGGElement | null>(null);
  const frontLayerRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const phasesLayer = phasesLayerRef.current;
    const halo = haloRef.current;
    const flow = flowRef.current;
    const backLayer = backLayerRef.current;
    const frontLayer = frontLayerRef.current;
    const root = rootRef.current;
    if (!svg || !phasesLayer || !halo || !flow || !backLayer || !frontLayer || !root) return undefined;

    const controlPoints: ControlPoint[] = createControlPoints(BASE_CONTROL_POINTS);
    const drum = createDrum();
    // The composition is complete at rest: the arrow, phase markers, rings and nodes must all be
    // fully opaque on the very first frame (a screenshot can land before any animation has had a
    // chance to run). `draw` therefore starts AT its target, not at 0. The only entrance flourish
    // lives in `haloFlourish` below, and it touches the halo glow alone — never a ring, node or
    // label.
    const draw = new Spring(1, DRAW);
    draw.set(1);
    const haloFlourish = new Spring(reduced ? 1 : 0, DRAW);
    haloFlourish.set(1);

    const ranges = phaseRanges(phaseLabels, T_END);
    const phaseSegments: PhaseSegmentRefs[] = ranges.map((range, i) => {
      const path = el(phasesLayer, "path", {
        fill: "none",
        stroke: "#fff",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-dasharray": PHASE_DASH_PATTERNS[i % PHASE_DASH_PATTERNS.length],
      });
      // The path's own start (i = 0) needs no dividing tick, but every phase still gets a label.
      const tick =
        i === 0 ? undefined : el(phasesLayer, "line", { stroke: "#fff", "stroke-width": 1.5, opacity: 0.8 });
      // Horizontal, 12px, with a black halo so it reads over the grid; never rotated, always
      // placed above its tick so it can never overprint the path or a ring.
      const label = el(phasesLayer, "text", {
        fill: "#fff",
        "font-size": 12,
        "text-anchor": "middle",
        "dominant-baseline": "auto",
        "paint-order": "stroke",
        stroke: "#000",
        "stroke-width": 3,
        "stroke-linejoin": "round",
        class: styles.mono,
      });
      label.textContent = range.label;
      return { range, path, tick, label };
    });

    const rings: RingRefs[] = ringSpecs.map((spec) => {
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
        const label = el(group, "text", {
          fill: "#fff",
          "font-size": 12,
          "dominant-baseline": "middle",
          y: -1,
          "paint-order": "stroke",
          stroke: "#000",
          "stroke-width": 3,
          "stroke-linejoin": "round",
        });
        label.textContent = nodeLabel(nodeSpec);
        const date = el(group, "text", {
          fill: "rgba(255,255,255,0.7)",
          "font-size": 10,
          "dominant-baseline": "middle",
          y: 13,
          "paint-order": "stroke",
          stroke: "#000",
          "stroke-width": 3,
          "stroke-linejoin": "round",
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

    function layoutPhaseSegment(segment: PhaseSegmentRefs, opacity: number) {
      segment.path.setAttribute("d", phaseSegmentPath(controlPoints, segment.range.t0, segment.range.t1, 24));
      segment.path.style.opacity = String(opacity);
      // The label sits at the start of its own segment (a mid-path label would overlap a ring).
      const marker = phaseTick(controlPoints, segment.range.t0);
      if (segment.tick) {
        segment.tick.setAttribute("x1", String(marker.x1));
        segment.tick.setAttribute("y1", String(marker.y1));
        segment.tick.setAttribute("x2", String(marker.x2));
        segment.tick.setAttribute("y2", String(marker.y2));
        segment.tick.style.opacity = String(opacity);
      }
      if (segment.label) {
        // Always straight up from the tick's own point (never rotated with the tangent, never
        // the tick's normal-offset endpoint, which could point down): the axis is horizontal, so
        // "above" is simply a smaller y, clearing the tallest ring's stroke.
        const pathPointAtTick = pathPoint(controlPoints, segment.range.t0);
        segment.label.setAttribute("x", String(pathPointAtTick.x));
        // Clears the tallest ring (ry up to 46) plus its node's own offset comfortably.
        segment.label.setAttribute("y", String(pathPointAtTick.y - 100));
        segment.label.removeAttribute("transform");
        segment.label.style.opacity = String(opacity);
      }
    }

    function renderStill() {
      const d = buildPath(controlPoints, 0);
      halo!.setAttribute("d", d);
      flow!.setAttribute("d", d);
      halo!.style.strokeDasharray = "";
      halo!.style.strokeDashoffset = "0";
      halo!.style.opacity = "0.3";
      flow!.style.opacity = "0";
      for (const segment of phaseSegments) layoutPhaseSegment(segment, 1);
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
        halo!.setAttribute("d", d);
        flow!.setAttribute("d", d);
        const length = 3200; // stable approximate length; only used for the halo dash flourish.
        const drawn = draw.step(dt); // stays 1: never gates a ring, node, label or phase segment.
        const haloIn = haloFlourish.step(dt); // 0 -> 1 entrance flourish, halo only.
        for (const segment of phaseSegments) layoutPhaseSegment(segment, drawn);
        halo!.style.strokeDasharray = String(length);
        halo!.style.strokeDashoffset = String(length * (1 - haloIn));
        halo!.style.opacity = String((0.25 + 0.15 * Math.sin(time * 1.3)) * haloIn);
        flowOffset -= dt * 70;
        flow!.style.strokeDashoffset = String(flowOffset);
        flow!.style.opacity = String(drawn);

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
      // Run the first frame synchronously, in this effect, before any observer has had a chance
      // to fire: a screenshot or first paint must already show the complete composition, not a
      // blank hero waiting on requestAnimationFrame. `frame` schedules its own next call.
      frame(performance.now());
    }

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (!reduced) root.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      backLayer.replaceChildren();
      frontLayer.replaceChildren();
      phasesLayer.replaceChildren();
    };
  }, [reduced, phaseLabels, ringSpecs]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} data-reduced-motion={reduced}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="날짜별 예시 건강 기록이 가로 시간선을 따라 나열된 모습을 표현한 장식용 애니메이션"
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
        <g ref={phasesLayerRef} />
        <path ref={flowRef} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 26" />
        {/* No tip marker, gate or arrowhead: the horizontal time axis simply continues to the
            right edge, fading via the flow dash's own opacity. */}
        <g ref={frontLayerRef} />
      </svg>
      <p className={styles.caption}>{caption}</p>
      <p className={styles.boundary}>선의 모양과 움직임은 건강 상태를 뜻하지 않아요.</p>
    </div>
  );
}

/**
 * Verlet Cloth - mass-spring fabric
 *
 * A grid of point masses linked by distance constraints, integrated with Verlet
 * and relaxed over a few iterations per frame. Pinned along the top, blown by
 * wind, and grabbable: drag the cursor through it to push it, or stress it until
 * links tear.
 */

import { createSimHarness, clamp, TAU } from "./_shared.js?v=20260615-lab2";

export function mountVerletCloth(refs) {
  function build(api) {
    const w = api.custom;
    const cols = clamp(Math.round(api.state.count / 9), 12, 40);
    const rows = Math.round(cols * 0.7);
    const margin = Math.min(api.w, api.h) * 0.12;
    const spanX = api.w - margin * 2;
    const gap = spanX / (cols - 1);
    const ox = margin;
    const oy = margin * 0.8;
    w.cols = cols; w.rows = rows; w.rest = gap;
    w.points = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const px = ox + x * gap;
        const py = oy + y * gap;
        w.points.push({ x: px, y: py, ox: px, oy: py, pin: y === 0 && x % 2 === 0 });
      }
    w.links = [];
    const idx = (x, y) => y * cols + x;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (x < cols - 1) w.links.push({ a: idx(x, y), b: idx(x + 1, y), len: gap, on: true });
        if (y < rows - 1) w.links.push({ a: idx(x, y), b: idx(x, y + 1), len: gap, on: true });
      }
    w.linkCount = w.links.length;
  }

  function step(api) {
    const w = api.custom;
    const grav = 0.5;
    const wind = Math.sin(api.frame * 0.02) * api.state.turbulence * 1.4 + api.state.turbulence * 0.6;
    const iters = clamp(Math.round(2 + api.state.attraction * 6), 2, 8);
    // verlet integrate
    for (const p of w.points) {
      if (p.pin) { p.x = p.ox; p.y = p.oy; p.px = p.ox; p.py = p.oy; continue; }
      const vx = (p.x - (p.px ?? p.x)) * 0.99 + wind;
      const vy = (p.y - (p.py ?? p.y)) * 0.99 + grav;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy;
    }
    // pointer push
    if (api.pointer) {
      for (const p of w.points) {
        const dx = p.x - api.pointer.x, dy = p.y - api.pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 40 && d > 0.001 && !p.pin) { p.x += (dx / d) * (40 - d) * 0.4; p.y += (dy / d) * (40 - d) * 0.4; }
      }
    }
    // satisfy constraints
    const tear = 2.6;
    for (let it = 0; it < iters; it++) {
      for (const l of w.links) {
        if (!l.on) continue;
        const a = w.points[l.a], b = w.points[l.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d > l.len * tear) { l.on = false; continue; }
        const diff = (d - l.len) / d * 0.5;
        const ox = dx * diff, oy = dy * diff;
        if (!a.pin) { a.x += ox; a.y += oy; }
        if (!b.pin) { b.x -= ox; b.y -= oy; }
      }
    }
    // bounds
    for (const p of w.points) { p.y = Math.min(p.y, api.h - 4); }
    let intact = 0, spd = 0, maxy = 0;
    for (const l of w.links) if (l.on) intact++;
    for (const p of w.points) { spd += Math.abs(p.x - (p.px ?? p.x)) + Math.abs(p.y - (p.py ?? p.y)); maxy = Math.max(maxy, p.y); }
    api.push(clamp(spd / w.points.length / 4, 0, 1), clamp(intact / w.linkCount, 0, 1), clamp(maxy / api.h, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    ctx.strokeStyle = "rgba(125,211,252,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const l of w.links) {
      if (!l.on) continue;
      const a = w.points[l.a], b = w.points[l.b];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(167,139,250,0.9)";
    for (const p of w.points) if (p.pin) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill(); }
    if (api.pointer) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(api.pointer.x, api.pointer.y, 40, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const torn = w.linkCount - w.links.filter((l) => l.on).length;
    ctx.fillText(`${w.cols}x${w.rows} cloth - drag to push, stress to tear (${torn} torn)`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 41,
    firstVariation: "drape",
    usePointer: true,
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: { energy: (v) => v.toFixed(2), order: (v) => `${Math.round(v * 100)}%`, spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      drape: { count: 220, speed: 1.5, turbulence: 0.12, attraction: 0.5, trails: false },
      breeze: { count: 220, speed: 1.6, turbulence: 0.4, attraction: 0.5, trails: false },
      flag: { count: 280, speed: 1.6, turbulence: 0.7, attraction: 0.45, trails: false },
      loose: { count: 180, speed: 1.5, turbulence: 0.2, attraction: 0.2, trails: false }
    },
    reset(api) { build(api); api.log(`${api.custom.cols}x${api.custom.rows} Verlet cloth, ${api.custom.linkCount} links.`); },
    step,
    draw
  });
}

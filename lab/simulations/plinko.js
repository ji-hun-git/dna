/**
 * Plinko / Galton Board - the bell curve, built by bouncing
 *
 * Balls fall through a triangular peg field, deflecting left or right at each row.
 * Catch them in bins at the bottom and a normal distribution emerges from pure
 * physics: the central limit theorem you can watch.
 */

import { createSimHarness, clamp, TAU } from "./_shared.js?v=20260615-lab2";

export function mountPlinko(refs) {
  function build(api) {
    const w = api.custom;
    const rows = clamp(Math.round(api.state.count / 26), 7, 14);
    w.rows = rows;
    w.top = api.h * 0.16;
    w.bottom = api.h * 0.82;
    w.spacing = (api.h * 0.66) / rows;
    w.pegs = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 2;
      const y = w.top + r * w.spacing;
      const width = (count - 1) * w.spacing;
      for (let c = 0; c < count; c++) {
        w.pegs.push({ x: api.w / 2 - width / 2 + c * w.spacing, y });
      }
    }
    w.bins = rows + 2;
    w.binW = api.w / w.bins;
    w.counts = new Array(w.bins).fill(0);
    w.balls = [];
    w.total = 0;
  }

  function spawn(api) {
    const w = api.custom;
    w.balls.push({ x: api.w / 2 + (api.rand() - 0.5) * 8, y: w.top - 20, vx: 0, vy: 0, hue: 200 + api.rand() * 120 });
  }

  function step(api) {
    const w = api.custom;
    const grav = 0.06 + api.state.attraction * 0.12;
    const sub = clamp(Math.round(api.state.speed * 2), 1, 6);
    const rate = 0.2 + api.state.count * 0.001;
    for (let s = 0; s < sub; s++) {
      if (api.rand() < rate && w.balls.length < 220) spawn(api);
      const pr = w.spacing * 0.28;
      for (const b of w.balls) {
        b.vy += grav;
        b.x += b.vx; b.y += b.vy;
        b.vx *= 0.99;
        for (const p of w.pegs) {
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
          if (d < pr + 3 && d > 0.001) {
            const nx = dx / d, ny = dy / d;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 1.5 * dot * nx; b.vy -= 1.5 * dot * ny;
            b.vx *= 0.6; b.vy *= 0.6;
            b.vx += (api.rand() - 0.5) * (0.6 + api.state.turbulence * 1.6);
            b.x = p.x + nx * (pr + 3); b.y = p.y + ny * (pr + 3);
          }
        }
        if (b.x < 4) { b.x = 4; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > api.w - 4) { b.x = api.w - 4; b.vx = -Math.abs(b.vx) * 0.5; }
      }
      // collect at bottom
      w.balls = w.balls.filter((b) => {
        if (b.y > w.bottom) {
          const bin = clamp(Math.floor(b.x / w.binW), 0, w.bins - 1);
          w.counts[bin]++; w.total++;
          return false;
        }
        return true;
      });
    }
    const peak = Math.max(1, ...w.counts);
    // "normality": center bins should dominate
    const mid = w.bins / 2;
    let centerMass = 0;
    for (let i = 0; i < w.bins; i++) centerMass += w.counts[i] * (1 - Math.abs(i - mid) / mid);
    api.push(clamp(w.balls.length / 120, 0, 1), clamp(centerMass / Math.max(1, w.total), 0, 1), clamp(peak / 60, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    // histogram
    const peak = Math.max(1, ...w.counts);
    for (let i = 0; i < w.bins; i++) {
      const h = (w.counts[i] / peak) * (api.h - w.bottom - 6);
      ctx.fillStyle = `hsla(${210 + (i / w.bins) * 90}, 80%, 60%, 0.5)`;
      ctx.fillRect(i * w.binW + 1, api.h - h, w.binW - 2, h);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.moveTo(0, w.bottom); ctx.lineTo(api.w, w.bottom); ctx.stroke();
    // pegs
    ctx.fillStyle = "rgba(147,197,253,0.5)";
    for (const p of w.pegs) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill(); }
    // balls
    for (const b of w.balls) {
      ctx.fillStyle = `hsla(${b.hue},88%,68%,0.95)`;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`${w.rows} rows - ${w.total} balls landed - a normal distribution emerges`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 61,
    firstVariation: "classic",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: { energy: (v) => `${Math.round(v * 100)}%`, order: (v) => `${Math.round(v * 100)}%`, spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      classic: { count: 220, speed: 1.8, turbulence: 0.25, attraction: 0.4, trails: false },
      tall: { count: 320, speed: 1.8, turbulence: 0.25, attraction: 0.4, trails: false },
      chaotic: { count: 240, speed: 2.0, turbulence: 0.8, attraction: 0.4, trails: false },
      gentle: { count: 200, speed: 1.5, turbulence: 0.12, attraction: 0.25, trails: false }
    },
    reset(api) { build(api); api.log(`${api.custom.rows}-row Galton board, ${api.custom.bins} bins.`); },
    step,
    draw
  });
}

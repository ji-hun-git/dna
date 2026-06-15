/**
 * Double Pendulum - deterministic chaos
 *
 * A field of double pendulums with almost-identical starting angles. They track
 * each other for a moment, then sensitive dependence on initial conditions pulls
 * them apart. The chart's "divergence" line is the butterfly effect, measured.
 */

import { createSimHarness, clamp, TAU } from "./_shared.js?v=20260615-lab2";

const G = 0.5;
const L1 = 1;
const L2 = 1;
const M1 = 1;
const M2 = 1;

export function mountDoublePendulum(refs) {
  function deriv(t1, t2, w1, w2) {
    const d = t1 - t2;
    const den = 2 * M1 + M2 - M2 * Math.cos(2 * d);
    const a1 =
      (-G * (2 * M1 + M2) * Math.sin(t1) -
        M2 * G * Math.sin(t1 - 2 * t2) -
        2 * Math.sin(d) * M2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) /
      (L1 * den);
    const a2 =
      (2 * Math.sin(d) *
        (w1 * w1 * L1 * (M1 + M2) + G * (M1 + M2) * Math.cos(t1) + w2 * w2 * L2 * M2 * Math.cos(d))) /
      (L2 * den);
    return [a1, a2];
  }

  function step(api) {
    const w = api.custom;
    const sub = clamp(Math.round(api.state.speed * 3), 1, 8);
    const dt = 0.05;
    const damp = 1 - api.state.attraction * 0.004;
    for (let s = 0; s < sub; s++) {
      for (const p of w.pend) {
        const [a1, a2] = deriv(p.t1, p.t2, p.w1, p.w2);
        p.w1 = (p.w1 + a1 * dt) * damp;
        p.w2 = (p.w2 + a2 * dt) * damp;
        p.t1 += p.w1 * dt;
        p.t2 += p.w2 * dt;
      }
    }
    // metrics: tip spread (divergence), mean speed, energy
    let mx = 0, my = 0, n = w.pend.length;
    const tips = w.pend.map((p) => {
      const x = Math.sin(p.t1) * L1 + Math.sin(p.t2) * L2;
      const y = Math.cos(p.t1) * L1 + Math.cos(p.t2) * L2;
      mx += x; my += y;
      return { x, y };
    });
    mx /= n; my /= n;
    let spread = 0, spd = 0;
    for (let i = 0; i < n; i++) {
      spread += Math.hypot(tips[i].x - mx, tips[i].y - my);
      spd += Math.abs(w.pend[i].w1) + Math.abs(w.pend[i].w2);
    }
    api.push(clamp(spd / n / 8, 0, 1), clamp(spread / n / 1.6, 0, 1), clamp((spread / n) / 2, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) { ctx.fillStyle = "rgba(7,7,13,0.12)"; ctx.fillRect(0, 0, api.w, api.h); }
    else { ctx.fillStyle = "rgba(7,7,13,0.96)"; ctx.fillRect(0, 0, api.w, api.h); }
    const cx = api.w / 2, cy = api.h * 0.4;
    const scale = Math.min(api.w, api.h) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < w.pend.length; i++) {
      const p = w.pend[i];
      const x1 = cx + Math.sin(p.t1) * L1 * scale;
      const y1 = cy + Math.cos(p.t1) * L1 * scale;
      const x2 = x1 + Math.sin(p.t2) * L2 * scale;
      const y2 = y1 + Math.cos(p.t2) * L2 * scale;
      const hue = 200 + (i / w.pend.length) * 130;
      const alpha = w.pend.length > 40 ? 0.5 : 0.9;
      ctx.strokeStyle = `hsla(${hue},85%,68%,${alpha})`;
      ctx.lineWidth = w.pend.length > 40 ? 1 : 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = `hsla(${hue},90%,70%,${alpha})`;
      ctx.beginPath(); ctx.arc(x2, y2, w.pend.length > 40 ? 1.6 : 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`${w.pend.length} double pendulums - deterministic chaos`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 21,
    firstVariation: "fan",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(244,114,182,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: { energy: (v) => v.toFixed(2), order: (v) => v.toFixed(2), spread: (v) => v.toFixed(2) },
    presets: {
      fan: { count: 120, speed: 1.6, turbulence: 0.04, attraction: 0.05, trails: true },
      pair: { count: 64, speed: 1.6, turbulence: 0.02, attraction: 0.02, trails: true },
      storm: { count: 240, speed: 2.2, turbulence: 0.12, attraction: 0.04, trails: true },
      damped: { count: 120, speed: 1.6, turbulence: 0.06, attraction: 0.45, trails: true }
    },
    reset(api) {
      const w = api.custom;
      const n = clamp(Math.round(api.state.count / 1.6), 40, 260);
      const base = Math.PI * (0.6 + api.rand() * 0.5);
      w.pend = Array.from({ length: n }, (_, i) => ({
        t1: base + (i / n) * api.state.turbulence * 0.5 + (api.rand() - 0.5) * 0.001,
        t2: base + (api.rand() - 0.5) * 0.002,
        w1: 0,
        w2: 0
      }));
      api.log(`${n} double pendulums, near-identical start (spread ${api.state.turbulence.toFixed(2)}).`);
    },
    step,
    draw
  });
}

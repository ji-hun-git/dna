/**
 * Lunar Lander - autonomous soft landing
 *
 * A squad of landers fall under gravity toward a pad. Each runs a PD controller
 * on altitude, descent rate, and horizontal offset, firing main and side
 * thrusters on a fuel budget. Touch down slow and upright to score; come in hot
 * and it crashes. Watch the success rate climb as the controller is tuned.
 */

import { createSimHarness, clamp, TAU } from "./_shared.js?v=20260615-lab2";

export function mountLunarLander(refs) {
  function makeLander(api) {
    return {
      x: api.range(api.w * 0.2, api.w * 0.8),
      y: api.h * 0.12 + api.range(-10, 10),
      vx: api.range(-1.2, 1.2),
      vy: 0,
      ang: 0,
      fuel: 100,
      dead: false,
      landed: false,
      flame: 0,
      side: 0
    };
  }

  function build(api) {
    const w = api.custom;
    w.padX = api.w * (0.35 + api.rand() * 0.3);
    w.padW = api.w * 0.12;
    w.groundY = api.h * 0.86;
    const n = clamp(Math.round(api.state.count / 24), 1, 10);
    w.landers = Array.from({ length: n }, () => makeLander(api));
    w.success = 0; w.crash = 0;
  }

  function control(api, L) {
    const w = api.custom;
    const g = 0.012;
    const gain = 0.6 + api.state.attraction * 1.8;
    const targetVy = clamp((w.groundY - L.y) * 0.01, 0.2, 2.2); // slow down near ground
    const wantUp = (L.vy - targetVy) * gain * 0.08; // need upward thrust if descending too fast
    let main = clamp(g + wantUp, 0, 0.05);
    // horizontal: steer toward pad
    const dx = w.padX - L.x;
    L.side = clamp((dx * 0.004 - L.vx * 0.06) * gain, -0.02, 0.02);
    if (api.state.turbulence > 0) { main += (api.rand() - 0.5) * api.state.turbulence * 0.01; L.x += (api.rand() - 0.5) * api.state.turbulence * 0.3; }
    if (L.fuel <= 0) { main = 0; L.side = 0; }
    L.flame = main;
    return { main, side: L.side, g };
  }

  function step(api) {
    const w = api.custom;
    const sub = clamp(Math.round(api.state.speed * 2), 1, 5);
    for (let s = 0; s < sub; s++) {
      for (const L of w.landers) {
        if (L.dead || L.landed) continue;
        const { main, side, g } = control(api, L);
        L.vy += g - main;
        L.vx += side;
        L.fuel -= (main * 200 + Math.abs(side) * 100);
        L.x += L.vx; L.y += L.vy;
        L.ang = clamp(L.vx * 0.25, -0.5, 0.5);
        if (L.x < 8 || L.x > api.w - 8) { L.vx *= -0.5; L.x = clamp(L.x, 8, api.w - 8); }
        if (L.y >= w.groundY - 10) {
          L.y = w.groundY - 10;
          const onPad = Math.abs(L.x - w.padX) < w.padW / 2;
          const soft = L.vy < 1.4 && Math.abs(L.vx) < 1.0;
          if (onPad && soft) { L.landed = true; w.success++; api.log(`Soft landing (vy ${L.vy.toFixed(2)}). Success ${w.success}.`); }
          else { L.dead = true; w.crash++; }
          continue;
        }
      }
      // respawn finished landers after a beat
      for (let i = 0; i < w.landers.length; i++) {
        const L = w.landers[i];
        if (L.dead || L.landed) { L.timer = (L.timer || 0) + 1; if (L.timer > 30) w.landers[i] = makeLander(api); }
      }
    }
    const games = w.success + w.crash || 1;
    let upright = 0, fuel = 0;
    for (const L of w.landers) { upright += L.dead ? 0 : 1 - Math.abs(L.ang); fuel += L.fuel; }
    api.push(clamp(w.success / games, 0, 1), clamp(upright / w.landers.length, 0, 1), clamp(fuel / w.landers.length / 100, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) { ctx.fillStyle = "rgba(7,7,13,0.18)"; ctx.fillRect(0, 0, api.w, api.h); }
    else { ctx.fillStyle = "rgba(7,7,13,0.96)"; ctx.fillRect(0, 0, api.w, api.h); }
    // ground + pad
    ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, w.groundY); ctx.lineTo(api.w, w.groundY); ctx.stroke();
    ctx.fillStyle = "rgba(52,211,153,0.6)";
    ctx.fillRect(w.padX - w.padW / 2, w.groundY - 3, w.padW, 5);
    for (const L of w.landers) {
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.ang);
      const col = L.landed ? "rgba(110,231,183,0.95)" : L.dead ? "rgba(248,113,113,0.9)" : "rgba(147,197,253,0.95)";
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.beginPath();
      ctx.moveTo(-6, 6); ctx.lineTo(-9, 11); ctx.moveTo(6, 6); ctx.lineTo(9, 11); ctx.stroke();
      if (L.flame > 0.005 && !L.dead && !L.landed) {
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        const fl = 4 + L.flame * 200;
        ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(3, 6); ctx.lineTo(0, 6 + fl); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`${w.landers.length} landers - landed ${w.success} - crashed ${w.crash}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 71,
    firstVariation: "squad",
    chartColors: ["rgba(52,211,153,0.95)", "rgba(96,165,250,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: { energy: (v) => `${Math.round(v * 100)}%`, order: (v) => v.toFixed(2), spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      squad: { count: 150, speed: 1.7, turbulence: 0.15, attraction: 0.6, trails: true },
      solo: { count: 60, speed: 1.6, turbulence: 0.1, attraction: 0.6, trails: true },
      windy: { count: 180, speed: 1.7, turbulence: 0.6, attraction: 0.7, trails: true },
      lowgain: { count: 150, speed: 1.7, turbulence: 0.2, attraction: 0.2, trails: true }
    },
    reset(api) { build(api); api.log(`${api.custom.landers.length} autonomous landers, PD descent control.`); },
    step,
    draw
  });
}

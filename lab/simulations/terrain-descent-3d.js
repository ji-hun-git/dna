/**
 * Optimizer Landscape 3D — agents descending a loss surface.
 *
 * A height field z = f(x, y) (a bowl plus gaussian wells) is drawn as a rotating
 * wireframe mesh with a hand-rolled pinhole camera. A population of optimizers
 * does gradient descent / momentum / SGD / annealing on the analytic gradient and
 * rolls toward minima — "agents navigating a value landscape." On-theme with the
 * research, and a genuine 3D scene with no external dependencies.
 */

import { createSimHarness, clamp, project3d } from "./_shared.js?v=20260615-lab2";

const GRID = 24;
const RANGE = 1.3;
const HSCALE = 0.62;

export function mountTerrainDescent3d(refs) {
  function fieldVal(w, x, y) {
    let v = (x * x + y * y) * 0.32; // gentle global bowl
    for (const well of w.wells) {
      const dx = x - well.cx;
      const dy = y - well.cy;
      v -= well.depth * Math.exp(-(dx * dx + dy * dy) / (2 * well.s * well.s));
    }
    return v;
  }

  function grad(w, x, y) {
    let gx = x * 0.64;
    let gy = y * 0.64;
    for (const well of w.wells) {
      const dx = x - well.cx;
      const dy = y - well.cy;
      const e = well.depth * Math.exp(-(dx * dx + dy * dy) / (2 * well.s * well.s));
      gx += (e * dx) / (well.s * well.s);
      gy += (e * dy) / (well.s * well.s);
    }
    return { gx, gy };
  }

  function spawnAgent(api) {
    return {
      x: api.range(-RANGE, RANGE),
      y: api.range(-RANGE, RANGE),
      vx: 0,
      vy: 0,
      still: 0,
      path: [],
      hue: 200 + api.rand() * 110
    };
  }

  function step(api) {
    const w = api.custom;
    const lr = 0.002 + api.state.speed * 0.004;
    const momentum = clamp(api.state.attraction * 0.95, 0, 0.95);
    let noiseScale = api.state.turbulence * 0.05;
    if (w.anneal) noiseScale *= Math.exp(-api.frame / 600);

    let lossSum = 0;
    let converged = 0;
    let mx = 0;
    let my = 0;
    for (const a of w.agents) {
      const g = grad(w, a.x, a.y);
      const gmag = Math.hypot(g.gx, g.gy);
      a.vx = momentum * a.vx - lr * g.gx + (api.rand() - 0.5) * noiseScale;
      a.vy = momentum * a.vy - lr * g.gy + (api.rand() - 0.5) * noiseScale;
      a.x = clamp(a.x + a.vx, -RANGE, RANGE);
      a.y = clamp(a.y + a.vy, -RANGE, RANGE);
      a.path.push({ x: a.x, y: a.y });
      if (a.path.length > 64) a.path.shift();

      const moving = Math.hypot(a.vx, a.vy);
      if (gmag < 0.05 && moving < 0.004) {
        a.still += 1;
        converged += 1;
      } else {
        a.still = Math.max(0, a.still - 1);
      }
      if (a.still > 160) {
        api.log(`Optimizer settled in a minimum (loss ${fieldVal(w, a.x, a.y).toFixed(2)}); re-seeding.`);
        Object.assign(a, spawnAgent(api));
      }
      lossSum += fieldVal(w, a.x, a.y);
      mx += a.x;
      my += a.y;
    }
    const n = w.agents.length;
    mx /= n;
    my /= n;
    let spread = 0;
    for (const a of w.agents) spread += Math.hypot(a.x - mx, a.y - my);
    const meanLoss = lossSum / n;
    // normalize loss to 0..1 then invert so "lower loss = higher signal"
    const norm = clamp((meanLoss - w.minLoss) / (w.maxLoss - w.minLoss || 1), 0, 1);
    api.push(1 - norm, converged / n, clamp(spread / n / RANGE, 0, 1));
  }

  function heightColor(v, w) {
    const t = clamp((v - w.minLoss) / (w.maxLoss - w.minLoss || 1), 0, 1);
    // low (minima) violet/blue → high amber
    const r = Math.round(120 + t * 120);
    const g = Math.round(110 + t * 80);
    const b = Math.round(230 - t * 170);
    return `rgba(${r},${g},${b},0.5)`;
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    const cam = {
      yaw: api.frame * 0.0035,
      pitch: 0.62,
      dist: 3.4,
      fov: Math.min(api.w, api.h) * 0.6
    };

    // Project the height-field grid once.
    const proj = [];
    for (let i = 0; i <= GRID; i++) {
      proj[i] = [];
      const x = -RANGE + (i / GRID) * 2 * RANGE;
      for (let j = 0; j <= GRID; j++) {
        const y = -RANGE + (j / GRID) * 2 * RANGE;
        const v = fieldVal(w, x, y);
        const world = { x, y: -v * HSCALE, z: y };
        proj[i][j] = { ...project3d(world, cam, api.w, api.h), v };
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j <= GRID; j++) {
        const p = proj[i][j];
        if (i < GRID) {
          const q = proj[i + 1][j];
          ctx.strokeStyle = heightColor((p.v + q.v) / 2, w);
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(q.sx, q.sy);
          ctx.stroke();
        }
        if (j < GRID) {
          const q = proj[i][j + 1];
          ctx.strokeStyle = heightColor((p.v + q.v) / 2, w);
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(q.sx, q.sy);
          ctx.stroke();
        }
      }
    }

    // Optimizers + descent paths.
    for (const a of w.agents) {
      if (api.state.trails && a.path.length > 1) {
        ctx.strokeStyle = `hsla(${a.hue}, 85%, 70%, 0.5)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        a.path.forEach((pt, k) => {
          const world = { x: pt.x, y: -fieldVal(w, pt.x, pt.y) * HSCALE, z: pt.y };
          const sp = project3d(world, cam, api.w, api.h);
          if (k === 0) ctx.moveTo(sp.sx, sp.sy);
          else ctx.lineTo(sp.sx, sp.sy);
        });
        ctx.stroke();
      }
      const world = { x: a.x, y: -fieldVal(w, a.x, a.y) * HSCALE, z: a.y };
      const sp = project3d(world, cam, api.w, api.h);
      ctx.fillStyle = `hsla(${a.hue}, 90%, 72%, 0.95)`;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, clamp(sp.scale * 0.02, 2.5, 7), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(sp.sx - 1, sp.sy - 1, clamp(sp.scale * 0.006, 0.8, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${w.agents.length} optimizers · ${api.state.variation} · 3D loss landscape`, 14, 12);
  }

  function buildWells(api) {
    const w = api.custom;
    const k = 3 + Math.floor(api.rand() * 3);
    w.wells = [];
    for (let i = 0; i < k; i++) {
      w.wells.push({
        cx: api.range(-0.9, 0.9),
        cy: api.range(-0.9, 0.9),
        depth: api.range(0.6, 1.4),
        s: api.range(0.22, 0.4)
      });
    }
    // estimate min/max for color + metric normalization
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i <= GRID; i++) {
      const x = -RANGE + (i / GRID) * 2 * RANGE;
      for (let j = 0; j <= GRID; j++) {
        const y = -RANGE + (j / GRID) * 2 * RANGE;
        const v = fieldVal(w, x, y);
        mn = Math.min(mn, v);
        mx = Math.max(mx, v);
      }
    }
    w.minLoss = mn;
    w.maxLoss = mx;
  }

  return createSimHarness(refs, {
    seedDefault: 11,
    firstVariation: "descent",
    chartColors: ["rgba(251,191,36,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => v.toFixed(2),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => v.toFixed(2)
    },
    presets: {
      descent: { count: 150, speed: 1.5, turbulence: 0.05, attraction: 0.2, trails: true },
      momentum: { count: 150, speed: 1.4, turbulence: 0.05, attraction: 0.85, trails: true },
      noisy: { count: 180, speed: 1.5, turbulence: 0.6, attraction: 0.4, trails: true },
      annealing: { count: 180, speed: 1.6, turbulence: 0.9, attraction: 0.5, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.anneal = api.state.variation === "annealing";
      buildWells(api);
      const n = clamp(Math.round(api.state.count / 8), 4, 44);
      w.agents = Array.from({ length: n }, () => spawnAgent(api));
      api.log(`${api.state.variation} · ${n} optimizers on a ${w.wells.length}-well landscape.`);
    },
    step,
    draw
  });
}

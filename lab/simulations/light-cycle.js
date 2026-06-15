/**
 * Light Cycle Arena - autonomous Tron agents.
 *
 * Each cycle chooses straight / left / right by estimating reachable open space
 * (flood fill) ahead, with an optional aggression term that biases toward cutting
 * off the opponent. Last surviving cycle wins the round; the arena resets and a
 * win tally accrues. Maps the "Light Cycle Arena" template - and echoes the
 * endless AI-vs-AI match on the main site's hero.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const COLORS = [
  { trail: "rgba(96,165,250,0.85)", head: "rgba(147,197,253,1)", glow: "rgba(96,165,250,0.35)" },
  { trail: "rgba(244,114,182,0.85)", head: "rgba(249,168,212,1)", glow: "rgba(244,114,182,0.35)" },
  { trail: "rgba(52,211,153,0.85)", head: "rgba(110,231,183,1)", glow: "rgba(52,211,153,0.35)" }
];

const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
];

export function mountLightCycle(refs) {
  function key(x, y) {
    return `${x},${y}`;
  }

  function inBounds(api, x, y) {
    const w = api.custom;
    return x >= 0 && y >= 0 && x < w.G && y < w.G;
  }

  function cellFree(api, x, y) {
    const w = api.custom;
    if (w.torus) {
      x = (x + w.G) % w.G;
      y = (y + w.G) % w.G;
    } else if (!inBounds(api, x, y)) {
      return false;
    }
    return !w.grid.has(key(x, y));
  }

  function norm(api, x, y) {
    const w = api.custom;
    if (w.torus) return { x: (x + w.G) % w.G, y: (y + w.G) % w.G };
    return { x, y };
  }

  function floodArea(api, sx, sy, cap) {
    const w = api.custom;
    const p = norm(api, sx, sy);
    if (!w.torus && !inBounds(api, p.x, p.y)) return 0;
    if (w.grid.has(key(p.x, p.y))) return 0;
    const seen = new Set([key(p.x, p.y)]);
    const stack = [[p.x, p.y]];
    let count = 0;
    while (stack.length && count < cap) {
      const [x, y] = stack.pop();
      count += 1;
      for (const d of DIRS) {
        const np = norm(api, x + d.x, y + d.y);
        if (!w.torus && !inBounds(api, np.x, np.y)) continue;
        const k = key(np.x, np.y);
        if (!seen.has(k) && !w.grid.has(k)) {
          seen.add(k);
          stack.push([np.x, np.y]);
        }
      }
    }
    return count;
  }

  function turnOptions(dir) {
    const i = DIRS.findIndex((d) => d.x === dir.x && d.y === dir.y);
    return [DIRS[(i + 3) % 4], DIRS[i], DIRS[(i + 1) % 4]]; // left, straight, right
  }

  function planCycle(api, cyc, others) {
    const w = api.custom;
    let best = null;
    let bestScore = -Infinity;
    for (const d of turnOptions(cyc.dir)) {
      const nx = cyc.x + d.x;
      const ny = cyc.y + d.y;
      if (!cellFree(api, nx, ny)) continue;
      const np = norm(api, nx, ny);
      const area = floodArea(api, np.x, np.y, w.G * w.G);
      let aggression = 0;
      if (api.state.attraction > 0 && others.length) {
        let nearest = Infinity;
        for (const o of others) nearest = Math.min(nearest, Math.abs(o.x - np.x) + Math.abs(o.y - np.y));
        aggression = -nearest * api.state.attraction * 0.8;
      }
      const score = area * 1.0 + aggression + (api.rand() - 0.5) * api.state.turbulence * 8;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  function endRound(api, winnerId) {
    const w = api.custom;
    if (winnerId >= 0) {
      w.wins[winnerId] = (w.wins[winnerId] || 0) + 1;
      api.log(`Round ${w.round} → cycle ${winnerId + 1} wins (length ${w.roundLen}).`);
    } else {
      api.log(`Round ${w.round} → mutual crash.`);
    }
    w.lastRoundLen = w.roundLen;
    w.pendingReset = 18;
  }

  function tick(api) {
    const w = api.custom;
    const alive = w.cycles.filter((c) => c.alive);
    for (const c of alive) {
      const others = alive.filter((o) => o !== c && o.alive);
      const move = planCycle(api, c, others);
      if (!move) {
        c.alive = false;
        continue;
      }
      c.pendingDir = move;
    }
    for (const c of alive) {
      if (!c.alive) continue;
      c.dir = c.pendingDir;
      const np = norm(api, c.x + c.dir.x, c.y + c.dir.y);
      if (!cellFree(api, np.x, np.y)) {
        c.alive = false;
        continue;
      }
      w.grid.add(key(np.x, np.y));
      c.trail.push({ x: np.x, y: np.y });
      c.x = np.x;
      c.y = np.y;
    }
    w.roundLen += 1;
    w.filled = w.grid.size;

    const survivors = w.cycles.filter((c) => c.alive);
    if (survivors.length <= (w.cycles.length > 1 ? 1 : 0)) {
      endRound(api, survivors.length === 1 ? survivors[0].id : -1);
    }
  }

  function newRound(api) {
    const w = api.custom;
    w.round += 1;
    w.grid = new Set();
    w.roundLen = 0;
    const n = w.cycleCount;
    w.cycles = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.round(w.G / 2 + Math.cos(angle) * w.G * 0.3);
      const y = Math.round(w.G / 2 + Math.sin(angle) * w.G * 0.3);
      const dir = DIRS[(i + 2) % 4];
      w.grid.add(key(x, y));
      w.cycles.push({
        id: i,
        x,
        y,
        dir,
        pendingDir: dir,
        alive: true,
        trail: [{ x, y }],
        color: COLORS[i % COLORS.length]
      });
    }
  }

  function step(api) {
    const w = api.custom;
    if (w.pendingReset > 0) {
      w.pendingReset -= 1;
      if (w.pendingReset === 0) newRound(api);
    } else {
      const framesPerTick = clamp(Math.round(10 / Math.max(0.2, api.state.speed)), 1, 22);
      w.acc = (w.acc || 0) + 1;
      if (w.acc >= framesPerTick) {
        w.acc = 0;
        tick(api);
      }
    }
    const totalWins = Object.values(w.wins).reduce((s, n) => s + n, 0) || 1;
    const maxWin = Math.max(0, ...Object.values(w.wins));
    const energy = clamp(w.roundLen / (w.G * 2.4), 0, 1);
    const order = clamp(1 - (maxWin / totalWins - 1 / w.cycleCount), 0, 1);
    const spread = clamp(w.filled / (w.G * w.G), 0, 1);
    api.push(energy, order, spread);
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(6,6,12,0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.cycles) return;
    const size = Math.min(api.w, api.h) * 0.94;
    const cell = size / w.G;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(ox, oy, size, size);

    for (const c of w.cycles) {
      ctx.strokeStyle = c.color.trail;
      ctx.lineWidth = Math.max(1.5, cell * 0.5);
      ctx.lineJoin = "round";
      ctx.beginPath();
      c.trail.forEach((p, i) => {
        const x = ox + (p.x + 0.5) * cell;
        const y = oy + (p.y + 0.5) * cell;
        // break the polyline on torus wraps
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prev = c.trail[i - 1];
          if (Math.abs(prev.x - p.x) > 1 || Math.abs(prev.y - p.y) > 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      const hx = ox + (c.x + 0.5) * cell;
      const hy = oy + (c.y + 0.5) * cell;
      ctx.fillStyle = c.color.glow;
      ctx.beginPath();
      ctx.arc(hx, hy, cell * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.alive ? c.color.head : "rgba(120,120,130,0.8)";
      ctx.beginPath();
      ctx.arc(hx, hy, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const wins = w.cycles.map((c) => `#${c.id + 1}:${w.wins[c.id] || 0}`).join("  ");
    ctx.fillText(`round ${w.round}   ·   wins ${wins}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 77,
    firstVariation: "duel",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(244,114,182,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.lastRoundLen || api.custom.roundLen || 0),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      duel: { count: 200, speed: 1.9, turbulence: 0.12, attraction: 0.2, trails: true },
      triple: { count: 240, speed: 1.9, turbulence: 0.14, attraction: 0.2, trails: true },
      survival: { count: 220, speed: 2.2, turbulence: 0.08, attraction: 0.55, trails: true },
      torus: { count: 200, speed: 1.9, turbulence: 0.12, attraction: 0.25, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.G = clamp(Math.round(api.state.count / 6), 24, 64);
      w.torus = api.state.variation === "torus";
      w.cycleCount = api.state.variation === "triple" ? 3 : 2;
      w.wins = {};
      w.round = 0;
      w.acc = 0;
      w.filled = 0;
      w.pendingReset = 0;
      w.lastRoundLen = 0;
      newRound(api);
      api.log(`${api.state.variation} · ${w.cycleCount} cycles on a ${w.G}×${w.G} arena${w.torus ? " (wrap)" : ""}.`);
    },
    step,
    draw
  });
}

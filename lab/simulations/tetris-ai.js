/**
 * Tetris AI - a heuristic stacker
 *
 * For every piece the agent tries each rotation and column, drops it, and scores
 * the resulting board by lines cleared, aggregate height, holes, and bumpiness.
 * It plays the best placement, clears lines, and keeps going until it tops out.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const W = 10, H = 20;
const SHAPES = [
  { c: "#5fa0e0", cells: [[-1, 0], [0, 0], [1, 0], [2, 0]] }, // I
  { c: "#f3c44c", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
  { c: "#b99cff", cells: [[-1, 0], [0, 0], [1, 0], [0, 1]] }, // T
  { c: "#7ee7bd", cells: [[0, 0], [1, 0], [-1, 1], [0, 1]] }, // S
  { c: "#f87171", cells: [[-1, 0], [0, 0], [0, 1], [1, 1]] }, // Z
  { c: "#6db3f5", cells: [[-1, 0], [0, 0], [1, 0], [1, 1]] }, // J
  { c: "#f59f3c", cells: [[-1, 0], [0, 0], [1, 0], [-1, 1]] } // L
];

function rotations(cells) {
  const out = [];
  let cur = cells.map(([x, y]) => [x, y]);
  for (let r = 0; r < 4; r++) {
    const minx = Math.min(...cur.map((c) => c[0]));
    const miny = Math.min(...cur.map((c) => c[1]));
    const norm = cur.map(([x, y]) => [x - minx, y - miny]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (!out.some((o) => JSON.stringify(o) === JSON.stringify(norm))) out.push(norm);
    cur = cur.map(([x, y]) => [y, -x]);
  }
  return out;
}

export function mountTetrisAI(refs) {
  function collides(grid, cells, ox, oy) {
    for (const [cx, cy] of cells) {
      const x = ox + cx, y = oy + cy;
      if (x < 0 || x >= W || y >= H) return true;
      if (y >= 0 && grid[y * W + x]) return true;
    }
    return false;
  }

  function dropY(grid, cells, ox) {
    let y = -2;
    while (!collides(grid, cells, ox, y + 1)) y++;
    return y;
  }

  function scoreBoard(grid, attraction) {
    const heights = new Array(W).fill(0);
    let holes = 0;
    for (let x = 0; x < W; x++) {
      let seen = false;
      for (let y = 0; y < H; y++) {
        if (grid[y * W + x]) { if (!seen) { heights[x] = H - y; seen = true; } }
        else if (seen) holes++;
      }
    }
    let lines = 0;
    for (let y = 0; y < H; y++) { let full = true; for (let x = 0; x < W; x++) if (!grid[y * W + x]) { full = false; break; } if (full) lines++; }
    const agg = heights.reduce((s, h) => s + h, 0);
    let bump = 0;
    for (let x = 0; x < W - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);
    return (0.6 + attraction * 1.2) * lines * 6 - 0.51 * agg - 0.36 * holes - 0.18 * bump;
  }

  function bestMove(api) {
    const w = api.custom;
    const rots = w.shape.rots;
    let best = null, bestScore = -Infinity;
    for (let r = 0; r < rots.length; r++) {
      const cells = rots[r];
      const maxx = Math.max(...cells.map((c) => c[0]));
      for (let ox = 0; ox + maxx < W; ox++) {
        if (collides(w.grid, cells, ox, 0) && dropY(w.grid, cells, ox) < 0) continue;
        const oy = dropY(w.grid, cells, ox);
        if (oy < 0) continue;
        const test = w.grid.slice();
        for (const [cx, cy] of cells) { const y = oy + cy; if (y >= 0) test[y * W + (ox + cx)] = 1; }
        let sc = scoreBoard(test, api.state.attraction) + (api.rand() - 0.5) * api.state.turbulence * 4;
        if (sc > bestScore) { bestScore = sc; best = { r, ox, oy }; }
      }
    }
    return best;
  }

  function spawn(api) {
    const w = api.custom;
    const s = SHAPES[Math.floor(api.rand() * SHAPES.length)];
    w.shape = { def: s, rots: rotations(s.cells) };
    w.move = bestMove(api);
    if (!w.move) { w.topout = true; return; }
    w.cur = { r: w.move.r, ox: w.move.ox, y: -2 };
  }

  function tick(api) {
    const w = api.custom;
    if (w.topout) { w.overT--; if (w.overT <= 0) reset2(api); return; }
    const cells = w.shape.rots[w.cur.r];
    // descend toward resting y
    if (w.cur.y < w.move.oy) { w.cur.y++; return; }
    // lock
    for (const [cx, cy] of cells) { const y = w.cur.y + cy, x = w.cur.ox + cx; if (y >= 0) w.grid[y * W + x] = SHAPES.indexOf(w.shape.def) + 1; }
    // clear lines
    let cleared = 0;
    for (let y = H - 1; y >= 0; y--) {
      let full = true; for (let x = 0; x < W; x++) if (!w.grid[y * W + x]) { full = false; break; }
      if (full) { for (let yy = y; yy > 0; yy--) for (let x = 0; x < W; x++) w.grid[yy * W + x] = w.grid[(yy - 1) * W + x]; for (let x = 0; x < W; x++) w.grid[x] = 0; cleared++; y++; }
    }
    w.lines += cleared;
    w.pieces++;
    spawn(api);
  }

  function reset2(api) {
    const w = api.custom;
    w.grid = new Uint8Array(W * H);
    w.lines = 0; w.pieces = 0; w.topout = false; w.overT = clamp(Math.round(api.state.count / 6), 8, 50);
    spawn(api);
  }

  function step(api) {
    const w = api.custom;
    const fpt = clamp(Math.round(8 / Math.max(0.2, api.state.speed)), 1, 20);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= fpt) { w.acc = 0; tick(api); }
    let maxH = 0, filled = 0;
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (w.grid[y * W + x]) { maxH = Math.max(maxH, H - y); }
    for (let i = 0; i < w.grid.length; i++) if (w.grid[i]) filled++;
    api.push(clamp(w.lines / 40, 0, 1), clamp(1 - maxH / H, 0, 1), clamp(filled / (W * H), 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    const cell = Math.min((api.w * 0.5) / W, (api.h * 0.92) / H);
    const bw = cell * W, bh = cell * H;
    const ox = (api.w - bw) / 2, oy = (api.h - bh) / 2 + 4;
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.strokeRect(ox, oy, bw, bh);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = w.grid[y * W + x];
      if (v) { ctx.fillStyle = SHAPES[v - 1].c; rr(ctx, ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 2); ctx.fill(); }
    }
    if (!w.topout && w.cur) {
      const cells = w.shape.rots[w.cur.r];
      // ghost
      if (api.state.trails) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        for (const [cx, cy] of cells) { const y = w.move.oy + cy, x = w.cur.ox + cx; if (y >= 0) { rr(ctx, ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 2); ctx.fill(); } }
      }
      ctx.fillStyle = w.shape.def.c;
      for (const [cx, cy] of cells) { const y = w.cur.y + cy, x = w.cur.ox + cx; if (y >= 0) { rr(ctx, ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 2); ctx.fill(); } }
    }
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`lines ${w.lines} - pieces ${w.pieces}${w.topout ? " - top out" : ""}`, 14, 12);
  }

  function rr(ctx, x, y, ww, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath(); }

  return createSimHarness(refs, {
    seedDefault: 91,
    firstVariation: "classic",
    liveCount: true,
    chartColors: ["rgba(52,211,153,0.95)", "rgba(96,165,250,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: { energy: (_v, api) => String(api.custom.lines || 0), order: (v) => `${Math.round(v * 100)}%`, spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      classic: { count: 160, speed: 1.8, turbulence: 0.0, attraction: 0.5, trails: true },
      fast: { count: 160, speed: 3.0, turbulence: 0.0, attraction: 0.5, trails: true },
      greedy: { count: 160, speed: 2.0, turbulence: 0.0, attraction: 0.9, trails: true },
      noisy: { count: 160, speed: 2.0, turbulence: 0.5, attraction: 0.5, trails: true }
    },
    reset(api) { reset2(api); api.log("Heuristic Tetris agent: height / holes / lines / bumpiness."); },
    step,
    draw
  });
}

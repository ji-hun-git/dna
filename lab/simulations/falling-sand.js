/**
 * Falling Sand - a cellular-automaton playground
 *
 * Each cell is empty, sand, water, wall, wood, or fire. Sand piles and slides,
 * water flows and levels out, fire climbs wood and burns out. Paint with the
 * cursor; the variation picks what falls from the sky.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const EMPTY = 0, SAND = 1, WATER = 2, WALL = 3, WOOD = 4, FIRE = 5;
const COLORS = {
  1: [232, 193, 112], 2: [86, 150, 220], 3: [110, 116, 130], 4: [120, 86, 54], 5: [245, 140, 60]
};

export function mountFallingSand(refs) {
  function idx(w, x, y) { return y * w.W + x; }

  function build(api) {
    const w = api.custom;
    const scale = clamp(Math.round(7 - api.state.count / 80), 3, 8);
    w.W = Math.max(80, Math.floor(api.w / scale));
    w.H = Math.max(60, Math.floor(api.h / scale));
    w.grid = new Uint8Array(w.W * w.H);
    // a couple of walls/ledges to interact with
    for (let x = Math.floor(w.W * 0.2); x < Math.floor(w.W * 0.5); x++) w.grid[idx(w, x, Math.floor(w.H * 0.55))] = WALL;
    for (let x = Math.floor(w.W * 0.55); x < Math.floor(w.W * 0.85); x++) w.grid[idx(w, x, Math.floor(w.H * 0.72))] = WOOD;
    w.buf = document.createElement("canvas"); w.buf.width = w.W; w.buf.height = w.H;
    w.bufCtx = w.buf.getContext("2d");
    w.img = w.bufCtx.createImageData(w.W, w.H);
    w.emit = { sand: SAND, water: WATER, fire: FIRE, mixed: SAND }[api.state.variation] || SAND;
  }

  function swap(g, a, b) { const t = g[a]; g[a] = g[b]; g[b] = t; }

  function tick(api) {
    const w = api.custom, g = w.grid, W = w.W, H = w.H;
    // emit from the top
    const rate = 0.3 + api.state.turbulence;
    const cols = api.state.variation === "mixed" ? 3 : 2;
    for (let c = 0; c < cols; c++) {
      if (api.rand() < rate) {
        const x = 2 + Math.floor(api.rand() * (W - 4));
        const mat = api.state.variation === "mixed" ? (api.rand() < 0.5 ? SAND : WATER) : w.emit;
        if (g[idx(w, x, 1)] === EMPTY) g[idx(w, x, 1)] = mat;
      }
    }
    // pointer paints
    if (api.pointer) {
      const px = Math.floor((api.pointer.x / api.w) * W), py = Math.floor((api.pointer.y / api.h) * H);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = px + dx, y = py + dy;
        if (x > 0 && y > 0 && x < W && y < H && g[idx(w, x, y)] === EMPTY) g[idx(w, x, y)] = w.emit;
      }
    }
    // update bottom-up
    for (let y = H - 2; y >= 0; y--) {
      const dir = api.rand() < 0.5 ? 1 : -1;
      for (let xi = 0; xi < W; xi++) {
        const x = dir === 1 ? xi : W - 1 - xi;
        const i = idx(w, x, y), c = g[i];
        if (c === EMPTY || c === WALL || c === WOOD) continue;
        if (c === FIRE) {
          // spread to adjacent wood, then die
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && g[idx(w, nx, ny)] === WOOD && api.rand() < 0.25) g[idx(w, nx, ny)] = FIRE;
          }
          if (api.rand() < 0.08) g[i] = EMPTY;
          else if (g[idx(w, x, y - 1)] === EMPTY && api.rand() < 0.5) swap(g, i, idx(w, x, y - 1));
          continue;
        }
        const below = idx(w, x, y + 1);
        if (g[below] === EMPTY) { swap(g, i, below); continue; }
        if (c === WATER && g[below] === WATER) { /* try sideways */ }
        const dl = x > 0 ? idx(w, x - 1, y + 1) : -1;
        const dr = x < W - 1 ? idx(w, x + 1, y + 1) : -1;
        const order = api.rand() < 0.5 ? [dl, dr] : [dr, dl];
        let moved = false;
        for (const t of order) { if (t >= 0 && g[t] === EMPTY) { swap(g, i, t); moved = true; break; } }
        if (!moved && c === WATER) {
          const sl = x > 0 ? idx(w, x - 1, y) : -1, sr = x < W - 1 ? idx(w, x + 1, y) : -1;
          const o2 = api.rand() < 0.5 ? [sl, sr] : [sr, sl];
          for (const t of o2) { if (t >= 0 && g[t] === EMPTY) { swap(g, i, t); break; } }
        }
      }
    }
  }

  function step(api) {
    const w = api.custom;
    const sub = clamp(Math.round(api.state.speed * 1.6), 1, 5);
    for (let s = 0; s < sub; s++) tick(api);
    let filled = 0, fire = 0;
    for (let i = 0; i < w.grid.length; i++) { if (w.grid[i]) filled++; if (w.grid[i] === FIRE) fire++; }
    api.push(clamp(filled / w.grid.length * 2, 0, 1), clamp(fire / 200, 0, 1), clamp(filled / w.grid.length, 0, 1));
  }

  function draw(api) {
    const w = api.custom, d = w.img.data, g = w.grid;
    for (let i = 0; i < g.length; i++) {
      const o = i * 4, c = g[i];
      if (c === EMPTY) { d[o] = 10; d[o + 1] = 11; d[o + 2] = 19; }
      else { const col = COLORS[c]; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; }
      d[o + 3] = 255;
    }
    w.bufCtx.putImageData(w.img, 0, 0);
    api.ctx.imageSmoothingEnabled = false;
    api.ctx.clearRect(0, 0, api.w, api.h);
    api.ctx.drawImage(w.buf, 0, 0, w.W, w.H, 0, 0, api.w, api.h);
    api.ctx.fillStyle = "rgba(245,245,247,0.92)";
    api.ctx.font = "600 12px Inter, sans-serif";
    api.ctx.textAlign = "left"; api.ctx.textBaseline = "top";
    api.ctx.fillText(`${api.state.variation} - paint with the cursor`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 51,
    firstVariation: "sand",
    usePointer: true,
    chartColors: ["rgba(232,193,112,0.95)", "rgba(245,140,60,0.95)", "rgba(86,150,220,0.95)"],
    metricFormat: { energy: (v) => `${Math.round(v * 100)}%`, order: (v) => `${Math.round(v * 100)}%`, spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      sand: { count: 200, speed: 2.0, turbulence: 0.4, attraction: 0.3, trails: false },
      water: { count: 200, speed: 2.0, turbulence: 0.5, attraction: 0.3, trails: false },
      fire: { count: 200, speed: 2.0, turbulence: 0.3, attraction: 0.3, trails: false },
      mixed: { count: 220, speed: 2.2, turbulence: 0.5, attraction: 0.3, trails: false }
    },
    reset(api) { build(api); api.log(`${api.custom.W}x${api.custom.H} grid - emitting ${api.state.variation}.`); },
    step,
    draw
  });
}

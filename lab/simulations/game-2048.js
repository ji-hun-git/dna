/**
 * 2048 - Expectimax agent
 *
 * An agent plays 2048 by expectimax search: it maximizes over the four slides and
 * averages over the random tile spawns, scoring boards by empty cells,
 * monotonicity, smoothness, and keeping the max tile in a corner. Watch it build
 * toward 2048 and beyond.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const TILE_COLORS = {
  2: "#3b3f52", 4: "#465079", 8: "#5b76b8", 16: "#5fa0e0",
  32: "#4fb6c9", 64: "#3fc79b", 128: "#6dd66d", 256: "#b6d65a",
  512: "#f3c44c", 1024: "#f59f3c", 2048: "#f4743b", 4096: "#e0518a"
};

export function mountGame2048(refs) {
  function newGrid(N) {
    return new Int32Array(N * N);
  }

  function clone(g) {
    return g.slice();
  }

  function slideLine(line) {
    const N = line.length;
    const out = new Array(N).fill(0);
    let gained = 0;
    const vals = line.filter((v) => v !== 0);
    let i = 0;
    let o = 0;
    while (i < vals.length) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        out[o] = vals[i] * 2;
        gained += vals[i] * 2;
        i += 2;
      } else {
        out[o] = vals[i];
        i += 1;
      }
      o += 1;
    }
    return { out, gained };
  }

  // dir: 0 left, 1 right, 2 up, 3 down
  function move(g, N, dir) {
    const next = newGrid(N);
    let moved = false;
    let gained = 0;
    for (let i = 0; i < N; i++) {
      let line = [];
      for (let j = 0; j < N; j++) {
        let v;
        if (dir === 0) v = g[i * N + j];
        else if (dir === 1) v = g[i * N + (N - 1 - j)];
        else if (dir === 2) v = g[j * N + i];
        else v = g[(N - 1 - j) * N + i];
        line.push(v);
      }
      const { out, gained: gg } = slideLine(line);
      gained += gg;
      for (let j = 0; j < N; j++) {
        const v = out[j];
        if (dir === 0) next[i * N + j] = v;
        else if (dir === 1) next[i * N + (N - 1 - j)] = v;
        else if (dir === 2) next[j * N + i] = v;
        else next[(N - 1 - j) * N + i] = v;
      }
    }
    for (let k = 0; k < g.length; k++) if (g[k] !== next[k]) { moved = true; break; }
    return { grid: next, moved, gained };
  }

  function emptyCells(g) {
    const e = [];
    for (let i = 0; i < g.length; i++) if (g[i] === 0) e.push(i);
    return e;
  }

  function heuristic(g, N) {
    const empty = emptyCells(g).length;
    let mono = 0;
    let smooth = 0;
    let max = 0;
    for (let i = 0; i < g.length; i++) max = Math.max(max, g[i]);
    // monotonicity along rows and cols (prefer ordered)
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N - 1; j++) {
        const a = g[i * N + j];
        const b = g[i * N + j + 1];
        if (a && b) { mono += a >= b ? 0 : -(b - a) * 0.001; smooth -= Math.abs(a - b) * 0.0005; }
        const c = g[j * N + i];
        const d = g[(j + 1) * N + i];
        if (c && d) { smooth -= Math.abs(c - d) * 0.0005; }
      }
    }
    // corner bonus: max tile in a corner
    const corners = [g[0], g[N - 1], g[(N - 1) * N], g[N * N - 1]];
    const cornerBonus = corners.includes(max) ? Math.log2(max || 1) * 1.2 : 0;
    return empty * 2.7 + mono + smooth + cornerBonus;
  }

  function expectimax(api, g, N, depth, isChance) {
    if (depth === 0) return heuristic(g, N);
    if (!isChance) {
      let best = -Infinity;
      let any = false;
      for (let d = 0; d < 4; d++) {
        const m = move(g, N, d);
        if (!m.moved) continue;
        any = true;
        best = Math.max(best, expectimax(api, m.grid, N, depth, true));
      }
      return any ? best : heuristic(g, N);
    }
    // chance node: average over a sample of empty cells × {2:0.9, 4:0.1}
    const empties = emptyCells(g);
    if (!empties.length) return heuristic(g, N);
    const sample = empties.length > 5
      ? empties.filter(() => api.rand() < 5 / empties.length).slice(0, 5)
      : empties;
    const cells = sample.length ? sample : [empties[0]];
    let sum = 0;
    for (const cell of cells) {
      for (const [val, prob] of [[2, 0.9], [4, 0.1]]) {
        const g2 = clone(g);
        g2[cell] = val;
        sum += prob * expectimax(api, g2, N, depth - 1, false);
      }
    }
    return sum / cells.length;
  }

  function bestMove(api, g, N, depth) {
    let best = -Infinity;
    let bestDir = -1;
    for (let d = 0; d < 4; d++) {
      const m = move(g, N, d);
      if (!m.moved) continue;
      const s = expectimax(api, m.grid, N, depth - 1, true) + m.gained * 0.001;
      if (s > best) { best = s; bestDir = d; }
    }
    return bestDir;
  }

  function spawn(api) {
    const w = api.custom;
    const e = emptyCells(w.grid);
    if (!e.length) return false;
    const cell = e[Math.floor(api.rand() * e.length)];
    w.grid[cell] = api.rand() < 0.9 ? 2 : 4;
    return true;
  }

  function depthFor(api) {
    const v = api.state.variation;
    const base = v === "greedy" ? 1 : v === "deep" ? 4 : 3;
    return clamp(base + Math.round(api.state.attraction * 1.5), 1, 5);
  }

  function tick(api) {
    const w = api.custom;
    if (w.over) {
      w.overT -= 1;
      if (w.overT <= 0) startGame(api);
      return;
    }
    let dir;
    if (api.state.turbulence > 0 && api.rand() < api.state.turbulence * 0.08) {
      const valid = [0, 1, 2, 3].filter((d) => move(w.grid, w.N, d).moved);
      dir = valid.length ? valid[Math.floor(api.rand() * valid.length)] : -1;
    } else {
      dir = bestMove(api, w.grid, w.N, depthFor(api));
    }
    if (dir < 0) {
      w.over = true;
      w.overT = clamp(Math.round(api.state.count / 6), 8, 50);
      w.bestScore = Math.max(w.bestScore, w.score);
      w.bestTile = Math.max(w.bestTile, w.maxTile);
      api.log(`Game over · score ${w.score} · max tile ${w.maxTile}.`);
      return;
    }
    const m = move(w.grid, w.N, dir);
    w.grid = m.grid;
    w.score += m.gained;
    spawn(api);
    for (let i = 0; i < w.grid.length; i++) w.maxTile = Math.max(w.maxTile, w.grid[i]);
    w.moves += 1;
  }

  function startGame(api) {
    const w = api.custom;
    w.grid = newGrid(w.N);
    w.score = 0;
    w.maxTile = 0;
    w.moves = 0;
    w.over = false;
    spawn(api);
    spawn(api);
  }

  function step(api) {
    const w = api.custom;
    const fpt = clamp(Math.round(14 / Math.max(0.2, api.state.speed)), 2, 30);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= fpt) {
      w.acc = 0;
      tick(api);
    }
    api.push(clamp(Math.log2((w.maxTile || 1)) / 12, 0, 1), clamp((w.bestTile ? Math.log2(w.bestTile) : 0) / 12, 0, 1), clamp(emptyCells(w.grid).length / (w.N * w.N), 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.grid) return;
    const N = w.N;
    const board = Math.min(api.w * 0.82, api.h * 0.82);
    const pad = board * 0.02;
    const cell = (board - pad * (N + 1)) / N;
    const ox = (api.w - board) / 2;
    const oy = (api.h - board) / 2 + 6;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ox, oy, board, board, 10);
    ctx.fill();
    ctx.stroke();

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + pad + c * (cell + pad);
        const y = oy + pad + r * (cell + pad);
        const v = w.grid[r * N + c];
        ctx.fillStyle = v ? (TILE_COLORS[v] || "#e0518a") : "rgba(255,255,255,0.04)";
        ctx.beginPath();
        ctx.roundRect(x, y, cell, cell, 6);
        ctx.fill();
        if (v && api.state.trails) {
          ctx.fillStyle = v <= 4 ? "rgba(245,245,247,0.92)" : "#0d0f16";
          const fs = Math.round(cell * (v >= 1024 ? 0.3 : v >= 128 ? 0.36 : 0.42));
          ctx.font = `700 ${fs}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${api.state.variation} · score ${w.score} · best tile ${w.bestTile || w.maxTile}${w.over ? " · game over" : ""}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 6,
    firstVariation: "classic",
    liveCount: true,
    chartColors: ["rgba(251,191,36,0.95)", "rgba(244,114,182,0.95)", "rgba(96,165,250,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.maxTile || 0),
      order: (_v, api) => String(api.custom.bestTile || 0),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      classic: { count: 160, speed: 2.0, turbulence: 0.0, attraction: 0.5, trails: true },
      deep: { count: 160, speed: 1.6, turbulence: 0.0, attraction: 0.6, trails: true },
      greedy: { count: 160, speed: 2.4, turbulence: 0.0, attraction: 0.3, trails: true },
      big: { count: 220, speed: 1.8, turbulence: 0.0, attraction: 0.5, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.N = api.state.variation === "big" ? 5 : 4;
      w.bestScore = 0;
      w.bestTile = 0;
      w.acc = 0;
      startGame(api);
      api.log(`${api.state.variation} · ${w.N}×${w.N} · expectimax depth ${depthFor(api)}.`);
    },
    step,
    draw
  });
}

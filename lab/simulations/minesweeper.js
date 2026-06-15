/**
 * Minesweeper - Logic Solver
 *
 * An agent plays Minesweeper by constraint propagation: for every revealed
 * number, if its mines are all flagged the rest are safe; if its unflagged
 * neighbours equal the remaining mines they are all mines. When no deduction is
 * possible it takes the least-risky guess. A counterpart to Wumpus World.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const NUM_COLORS = ["", "#7dd3fc", "#6ee7b3", "#fbbf24", "#f472b6", "#a78bfa", "#5fa0e0", "#f87171", "#cbd5e1"];

export function mountMinesweeper(refs) {
  const idx = (w, x, y) => y * w.W + x;
  function inB(w, x, y) {
    return x >= 0 && y >= 0 && x < w.W && y < w.H;
  }
  function neighbors(w, x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (inB(w, x + dx, y + dy)) out.push([x + dx, y + dy]);
      }
    return out;
  }

  function genBoard(api) {
    const w = api.custom;
    const N = w.W * w.H;
    const safe = new Set();
    // first-click region (center) guaranteed mine-free
    const sx = Math.floor(w.W / 2);
    const sy = Math.floor(w.H / 2);
    safe.add(idx(w, sx, sy));
    for (const [nx, ny] of neighbors(w, sx, sy)) safe.add(idx(w, nx, ny));

    w.mine = new Uint8Array(N);
    let placed = 0;
    let guard = 0;
    while (placed < w.mineCount && guard < N * 20) {
      guard++;
      const c = Math.floor(api.rand() * N);
      if (w.mine[c] || safe.has(c)) continue;
      w.mine[c] = 1;
      placed++;
    }
    w.count = new Int8Array(N);
    for (let y = 0; y < w.H; y++)
      for (let x = 0; x < w.W; x++) {
        if (w.mine[idx(w, x, y)]) continue;
        let n = 0;
        for (const [nx, ny] of neighbors(w, x, y)) if (w.mine[idx(w, nx, ny)]) n++;
        w.count[idx(w, x, y)] = n;
      }
    w.state = new Uint8Array(N); // 0 hidden, 1 revealed, 2 flagged
    w.start = { x: sx, y: sy };
    w.focus = null;
    reveal(api, sx, sy);
  }

  function reveal(api, x, y) {
    const w = api.custom;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const i = idx(w, cx, cy);
      if (w.state[i] !== 0) continue;
      w.state[i] = 1;
      w.revealed += 1;
      if (w.mine[i]) {
        w.dead = true;
        w.deadCell = i;
        return;
      }
      if (w.count[i] === 0) {
        for (const [nx, ny] of neighbors(w, cx, cy)) if (w.state[idx(w, nx, ny)] === 0) stack.push([nx, ny]);
      }
    }
  }

  function deduce(api) {
    const w = api.custom;
    let acted = false;
    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        const i = idx(w, x, y);
        if (w.state[i] !== 1) continue;
        const n = w.count[i];
        const hidden = [];
        let flagged = 0;
        for (const [nx, ny] of neighbors(w, x, y)) {
          const ni = idx(w, nx, ny);
          if (w.state[ni] === 0) hidden.push([nx, ny]);
          else if (w.state[ni] === 2) flagged++;
        }
        if (!hidden.length) continue;
        if (n - flagged === 0) {
          // all hidden are safe
          for (const [hx, hy] of hidden) {
            reveal(api, hx, hy);
            w.focus = { x: hx, y: hy, kind: "safe" };
            acted = true;
            if (w.dead) return true;
          }
        } else if (n - flagged === hidden.length) {
          for (const [hx, hy] of hidden) {
            const hi = idx(w, hx, hy);
            if (w.state[hi] !== 2) {
              w.state[hi] = 2;
              w.flags += 1;
              w.focus = { x: hx, y: hy, kind: "mine" };
              acted = true;
            }
          }
        }
      }
    }
    return acted;
  }

  function guess(api) {
    const w = api.custom;
    // probability estimate per hidden cell from adjacent number constraints
    const N = w.W * w.H;
    const prob = new Float32Array(N).fill(-1);
    for (let y = 0; y < w.H; y++)
      for (let x = 0; x < w.W; x++) {
        const i = idx(w, x, y);
        if (w.state[i] !== 1) continue;
        const hidden = [];
        let flagged = 0;
        for (const [nx, ny] of neighbors(w, x, y)) {
          const ni = idx(w, nx, ny);
          if (w.state[ni] === 0) hidden.push(ni);
          else if (w.state[ni] === 2) flagged++;
        }
        if (!hidden.length) continue;
        const p = (w.count[i] - flagged) / hidden.length;
        for (const hi of hidden) prob[hi] = prob[hi] < 0 ? p : Math.max(prob[hi], p);
      }
    // global density fallback for unconstrained cells
    let remainingMines = w.mineCount - w.flags;
    let hiddenUnconstrained = 0;
    for (let i = 0; i < N; i++) if (w.state[i] === 0 && prob[i] < 0) hiddenUnconstrained++;
    const globalP = hiddenUnconstrained ? clamp(remainingMines / hiddenUnconstrained, 0, 1) : 1;

    let best = -1;
    let bestP = Infinity;
    for (let i = 0; i < N; i++) {
      if (w.state[i] !== 0) continue;
      const p = prob[i] < 0 ? globalP : prob[i];
      if (p < bestP) { bestP = p; best = i; }
    }
    if (best < 0) return;
    const caution = api.state.attraction;
    if (bestP > 0.6 && caution > 0.7) {
      // too risky for a cautious agent - restart
      api.log(`No safe move (min risk ${(bestP * 100) | 0}%) - new board.`);
      w.dead = true;
      w.deadCell = -1;
      return;
    }
    const gx = best % w.W;
    const gy = (best / w.W) | 0;
    w.focus = { x: gx, y: gy, kind: "guess" };
    w.guesses += 1;
    reveal(api, gx, gy);
  }

  function tick(api) {
    const w = api.custom;
    if (w.dead || w.won) {
      w.overT -= 1;
      if (w.overT <= 0) startGame(api);
      return;
    }
    if (!deduce(api)) guess(api);
    if (w.dead) {
      w.losses += 1;
      api.log(`Hit a mine - solved ${w.revealed}/${w.W * w.H - w.mineCount} safe cells.`);
      w.overT = clamp(Math.round(api.state.count / 6), 8, 50);
      return;
    }
    if (w.revealed >= w.W * w.H - w.mineCount) {
      w.won = true;
      w.winsCount += 1;
      api.log(`Cleared the board! Win #${w.winsCount}.`);
      w.overT = clamp(Math.round(api.state.count / 6), 8, 50);
    }
  }

  function step(api) {
    const w = api.custom;
    const fpt = clamp(Math.round(12 / Math.max(0.2, api.state.speed)), 2, 28);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= fpt) {
      w.acc = 0;
      tick(api);
    }
    const safeTotal = w.W * w.H - w.mineCount;
    const games = w.winsCount + w.losses || 1;
    api.push(clamp(w.revealed / safeTotal, 0, 1), clamp(w.winsCount / games, 0, 1), clamp(w.revealed / (w.W * w.H), 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.state) return;
    const cell = Math.min((api.w * 0.92) / w.W, (api.h * 0.82) / w.H);
    const bw = cell * w.W;
    const bh = cell * w.H;
    const ox = (api.w - bw) / 2;
    const oy = (api.h - bh) / 2 + 6;

    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        const i = idx(w, x, y);
        const px = ox + x * cell;
        const py = oy + y * cell;
        const st = w.state[i];
        if (st === 1) {
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, cell, cell);
          const n = w.count[i];
          if (n > 0) {
            ctx.fillStyle = NUM_COLORS[n] || "#cbd5e1";
            ctx.font = `700 ${Math.round(cell * 0.5)}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(n), px + cell / 2, py + cell / 2 + 1);
          }
        } else {
          ctx.fillStyle = "rgba(96,165,250,0.12)";
          ctx.fillRect(px, py, cell, cell);
          if (st === 2) {
            ctx.fillStyle = "rgba(248,113,113,0.9)";
            ctx.font = `${Math.round(cell * 0.46)}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⚑", px + cell / 2, py + cell / 2 + 1);
          } else if ((w.dead || w.won) && w.mine[i]) {
            ctx.fillStyle = "rgba(248,113,113,0.85)";
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.26, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(px + 0.5, py + 0.5, cell, cell);
      }
    }

    if (w.focus && api.state.trails && !w.dead && !w.won) {
      const fx = ox + w.focus.x * cell;
      const fy = oy + w.focus.y * cell;
      ctx.strokeStyle = w.focus.kind === "guess" ? "rgba(251,191,36,0.9)" : w.focus.kind === "mine" ? "rgba(248,113,113,0.9)" : "rgba(52,211,153,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(fx + 1, fy + 1, cell - 2, cell - 2);
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${api.state.variation} · wins ${w.winsCount} · losses ${w.losses} · guesses ${w.guesses}`, 14, 12);
  }

  function startGame(api) {
    const w = api.custom;
    w.revealed = 0;
    w.flags = 0;
    w.guesses = 0;
    w.dead = false;
    w.won = false;
    w.deadCell = -1;
    genBoard(api);
  }

  return createSimHarness(refs, {
    seedDefault: 8,
    firstVariation: "medium",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => `${Math.round(v * 100)}%`,
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      easy: { count: 150, speed: 1.8, turbulence: 0.18, attraction: 0.3, trails: true },
      medium: { count: 200, speed: 1.8, turbulence: 0.28, attraction: 0.3, trails: true },
      hard: { count: 240, speed: 1.8, turbulence: 0.38, attraction: 0.35, trails: true },
      expert: { count: 300, speed: 2.0, turbulence: 0.5, attraction: 0.4, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.W = clamp(Math.round(api.state.count / 14), 9, 24);
      w.H = clamp(Math.round((w.W * api.h) / Math.max(1, api.w)), 7, 18);
      const density = clamp(0.1 + api.state.turbulence * 0.16, 0.1, 0.28);
      w.mineCount = Math.max(1, Math.round(w.W * w.H * density));
      w.winsCount = 0;
      w.losses = 0;
      w.acc = 0;
      startGame(api);
      api.log(`${api.state.variation} · ${w.W}×${w.H}, ${w.mineCount} mines · constraint solver.`);
    },
    step,
    draw
  });
}

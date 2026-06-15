/**
 * Q-Learning Gridworld
 *
 * A tabular TD agent that actually learns on screen: ε-greedy action selection,
 * Q(s,a) ← Q(s,a) + α[r + γ·maxQ(s') − Q(s,a)]. The value heatmap and greedy
 * arrows reshape as the policy improves, and the chart is a live learning curve.
 * Layouts include Cliff Walking and Four Rooms (from the benchmark catalog).
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const DX = [0, 0, -1, 1]; // up, down, left, right (col deltas)
const DY = [-1, 1, 0, 0];
const ARROWS = ["↑", "↓", "←", "→"];
const GAMMA = 0.95;

export function mountQLearning(refs) {
  function id(w, r, c) {
    return r * w.N + c;
  }

  function buildLayout(api) {
    const w = api.custom;
    const N = w.N;
    const wall = Array.from({ length: N }, () => new Array(N).fill(false));
    const cliff = Array.from({ length: N }, () => new Array(N).fill(false));
    w.start = { r: N - 1, c: 0 };
    w.goal = { r: N - 1, c: N - 1 };

    if (api.state.variation === "cliff") {
      for (let c = 1; c < N - 1; c++) cliff[N - 1][c] = true;
    } else if (api.state.variation === "fourrooms") {
      const m = Math.floor(N / 2);
      for (let i = 0; i < N; i++) {
        wall[m][i] = true;
        wall[i][m] = true;
      }
      const d1 = Math.floor(m / 2);
      const d2 = Math.min(N - 1, m + d1);
      wall[m][d1] = false;
      wall[m][d2] = false;
      wall[d1][m] = false;
      wall[d2][m] = false;
      w.start = { r: 0, c: 0 };
      w.goal = { r: N - 1, c: N - 1 };
    } else if (api.state.variation === "maze") {
      // carve from full walls
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) wall[r][c] = true;
      const stack = [[0, 0]];
      wall[0][0] = false;
      while (stack.length) {
        const [cr, cc] = stack[stack.length - 1];
        const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(() => api.rand() - 0.5);
        let moved = false;
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nc >= 0 && nr < N && nc < N && wall[nr][nc]) {
            wall[nr][nc] = false;
            wall[cr + dr / 2][cc + dc / 2] = false;
            stack.push([nr, nc]);
            moved = true;
            break;
          }
        }
        if (!moved) stack.pop();
      }
      w.start = { r: 0, c: 0 };
      w.goal = { r: N - 1, c: N - 1 };
    }
    wall[w.start.r][w.start.c] = false;
    wall[w.goal.r][w.goal.c] = false;
    w.wall = wall;
    w.cliff = cliff;
  }

  function stepEnv(api, s, a) {
    const w = api.custom;
    const N = w.N;
    let nr = s.r + DY[a];
    let nc = s.c + DX[a];
    if (nr < 0 || nc < 0 || nr >= N || nc >= N || w.wall[nr][nc]) {
      nr = s.r;
      nc = s.c;
    }
    if (w.cliff[nr][nc]) {
      return { next: { ...w.start }, reward: -100, done: false };
    }
    if (nr === w.goal.r && nc === w.goal.c) {
      return { next: { r: nr, c: nc }, reward: 10, done: true };
    }
    return { next: { r: nr, c: nc }, reward: -1, done: false };
  }

  function greedyAction(w, s) {
    const base = id(w, s.r, s.c) * 4;
    let best = 0;
    let bv = -Infinity;
    for (let a = 0; a < 4; a++) {
      if (w.Q[base + a] > bv) {
        bv = w.Q[base + a];
        best = a;
      }
    }
    return best;
  }

  function tick(api) {
    const w = api.custom;
    const alpha = clamp(0.1 + api.state.attraction * 0.5, 0.05, 0.6);
    const epsFloor = clamp(api.state.turbulence * 0.25, 0.02, 0.35);
    const eps = Math.max(epsFloor, 1 - w.episodes * 0.012);
    w.eps = eps;

    const s = w.agent;
    let a;
    if (api.rand() < eps) a = Math.floor(api.rand() * 4);
    else a = greedyAction(w, s);

    const { next, reward, done } = stepEnv(api, s, a);
    const sIdx = id(w, s.r, s.c) * 4 + a;
    const nbase = id(w, next.r, next.c) * 4;
    let maxNext = -Infinity;
    for (let i = 0; i < 4; i++) maxNext = Math.max(maxNext, w.Q[nbase + i]);
    const target = done ? reward : reward + GAMMA * maxNext;
    w.Q[sIdx] += alpha * (target - w.Q[sIdx]);

    w.visits.add(id(w, s.r, s.c));
    w.epReturn += reward;
    w.epSteps += 1;
    w.agent = next;

    if (done || w.epSteps > w.N * w.N * 4) {
      w.results.push({ success: done, ret: w.epReturn });
      while (w.results.length > 30) w.results.shift();
      w.episodes += 1;
      w.agent = { ...w.start };
      w.epReturn = 0;
      w.epSteps = 0;
      if (w.episodes % 25 === 0) {
        const sr = w.results.filter((r) => r.success).length / w.results.length;
        api.log(`Episode ${w.episodes} · success ${Math.round(sr * 100)}% · ε ${eps.toFixed(2)}`);
      }
    }
  }

  function step(api) {
    const w = api.custom;
    const perFrame = clamp(Math.round(api.state.speed * 4), 1, 24);
    for (let i = 0; i < perFrame; i++) tick(api);

    const sr = w.results.length ? w.results.filter((r) => r.success).length / w.results.length : 0;
    const avgRet = w.results.length ? w.results.reduce((s, r) => s + r.ret, 0) / w.results.length : 0;
    const safe = w.N * w.N;
    api.push(sr, clamp((avgRet + 100) / 110, 0, 1), clamp(w.visits.size / safe, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.Q) return;
    const N = w.N;
    const size = Math.min(api.w, api.h) * 0.88;
    const cell = size / N;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2 + 4;

    // value range
    let vmin = Infinity;
    let vmax = -Infinity;
    const val = new Array(N * N);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const base = id(w, r, c) * 4;
        let mx = -Infinity;
        for (let a = 0; a < 4; a++) mx = Math.max(mx, w.Q[base + a]);
        val[id(w, r, c)] = mx;
        if (!w.wall[r][c]) {
          vmin = Math.min(vmin, mx);
          vmax = Math.max(vmax, mx);
        }
      }
    }
    const span = vmax - vmin || 1;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        if (w.wall[r][c]) {
          ctx.fillStyle = "rgba(96,165,250,0.08)";
        } else if (w.cliff[r][c]) {
          ctx.fillStyle = "rgba(248,113,113,0.32)";
        } else if (api.state.trails) {
          const t = clamp((val[id(w, r, c)] - vmin) / span, 0, 1);
          ctx.fillStyle = `rgba(${Math.round(40 + t * 30)},${Math.round(70 + t * 160)},${Math.round(210 - t * 120)},${0.14 + t * 0.5})`;
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
        }
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);

        if (!w.wall[r][c] && !w.cliff[r][c] && !(r === w.goal.r && c === w.goal.c)) {
          ctx.fillStyle = "rgba(245,245,247,0.5)";
          ctx.font = `${Math.round(cell * 0.34)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ARROWS[greedyAction(w, { r, c })], x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    // start + goal
    const gx = ox + w.goal.c * cell;
    const gy = oy + w.goal.r * cell;
    ctx.fillStyle = "rgba(52,211,153,0.3)";
    ctx.fillRect(gx, gy, cell, cell);
    ctx.fillStyle = "rgba(110,231,183,0.95)";
    ctx.font = `${Math.round(cell * 0.42)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", gx + cell / 2, gy + cell / 2 + 1);

    const ax = ox + (w.agent.c + 0.5) * cell;
    const ay = oy + (w.agent.r + 0.5) * cell;
    ctx.fillStyle = "rgba(96,165,250,0.2)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(147,197,253,0.98)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const sr = w.results.length ? Math.round((w.results.filter((r) => r.success).length / w.results.length) * 100) : 0;
    ctx.fillText(`${api.state.variation} · episodes ${w.episodes} · success ${sr}% · ε ${(w.eps || 0).toFixed(2)}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 5,
    firstVariation: "cliff",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => `${Math.round(v * 100)}%`,
      order: (v) => v.toFixed(2),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      cliff: { count: 200, speed: 2.0, turbulence: 0.4, attraction: 0.6, trails: true },
      fourrooms: { count: 240, speed: 2.0, turbulence: 0.5, attraction: 0.6, trails: true },
      maze: { count: 280, speed: 2.2, turbulence: 0.6, attraction: 0.6, trails: true },
      open: { count: 200, speed: 2.0, turbulence: 0.4, attraction: 0.6, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.N = clamp(Math.round(api.state.count / 28), 6, 13);
      if (api.state.variation === "maze" && w.N % 2 === 0) w.N += 1;
      w.Q = new Float32Array(w.N * w.N * 4);
      w.visits = new Set();
      w.episodes = 0;
      w.epReturn = 0;
      w.epSteps = 0;
      w.eps = 1;
      w.results = [];
      buildLayout(api);
      w.agent = { ...w.start };
      api.log(`${api.state.variation} · ${w.N}×${w.N} · learning from scratch (γ ${GAMMA}).`);
    },
    step,
    draw
  });
}

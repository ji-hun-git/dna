/**
 * FrozenLake - value iteration, policy field, and a slipping agent.
 *
 * The classic stochastic gridworld: reach the goal without falling into a hole,
 * on ice where moves slip sideways. The renderer solves the MDP live with value
 * iteration, paints the value function as a heatmap, draws the greedy policy as
 * arrows, and lets an agent act under the slippery transition model. Maps the
 * "FrozenLake" CS/RL template.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

// actions: 0 left, 1 down, 2 right, 3 up
const DX = [-1, 1, 0, 0];
const DY = [0, 0, -1, 1]; // note: index aligns col/row below
const ARROWS = ["←", "↓", "→", "↑"];

export function mountFrozenLake(refs) {
  function idx(api, r, c) {
    return r * api.custom.N + c;
  }

  function move(api, r, c, a) {
    // a: 0 left(c-1) 1 down(r+1) 2 right(c+1) 3 up(r-1)
    let nr = r;
    let nc = c;
    if (a === 0) nc = c - 1;
    else if (a === 1) nr = r + 1;
    else if (a === 2) nc = c + 1;
    else nr = r - 1;
    const N = api.custom.N;
    if (nr < 0 || nc < 0 || nr >= N || nc >= N) return { r, c }; // wall bounce
    return { r: nr, c: nc };
  }

  function perpendicular(a) {
    return a === 0 || a === 2 ? [1, 3] : [0, 2];
  }

  function genLake(api) {
    const w = api.custom;
    const N = w.N;
    for (let attempt = 0; attempt < 30; attempt++) {
      const grid = Array.from({ length: N }, () => new Array(N).fill("F"));
      const density = api.state.variation === "deterministic" ? 0.16 : 0.22;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (api.rand() < density) grid[r][c] = "H";
        }
      }
      grid[0][0] = "S";
      grid[N - 1][N - 1] = "G";
      // ensure a hole-free path exists (BFS over F/S/G).
      const seen = new Set(["0,0"]);
      const q = [[0, 0]];
      let head = 0;
      let reached = false;
      while (head < q.length) {
        const [r, c] = q[head++];
        if (r === N - 1 && c === N - 1) {
          reached = true;
          break;
        }
        for (let a = 0; a < 4; a++) {
          const nx = move(api, r, c, a);
          if (grid[nx.r][nx.c] === "H") continue;
          const k = `${nx.r},${nx.c}`;
          if (!seen.has(k)) {
            seen.add(k);
            q.push([nx.r, nx.c]);
          }
        }
      }
      if (reached) {
        w.grid = grid;
        return;
      }
    }
    // fallback: empty lake
    const grid = Array.from({ length: N }, () => new Array(N).fill("F"));
    grid[0][0] = "S";
    grid[N - 1][N - 1] = "G";
    w.grid = grid;
  }

  function solve(api) {
    const w = api.custom;
    const N = w.N;
    const slip = clamp(api.state.turbulence * 0.5, 0, 0.66);
    const gamma = clamp(0.8 + api.state.attraction * 0.19, 0.8, 0.995);
    w.slip = slip;
    w.gamma = gamma;
    const V = new Array(N * N).fill(0);
    const isTerminal = (r, c) => w.grid[r][c] === "H" || w.grid[r][c] === "G";

    const transitions = (r, c, a) => {
      const main = 1 - slip;
      const side = slip / 2;
      const perp = perpendicular(a);
      return [
        { p: main, a },
        { p: side, a: perp[0] },
        { p: side, a: perp[1] }
      ];
    };
    const rewardOf = (r, c) => (w.grid[r][c] === "G" ? 1 : 0);

    for (let sweep = 0; sweep < 80; sweep++) {
      let delta = 0;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (isTerminal(r, c)) {
            V[idx(api, r, c)] = 0;
            continue;
          }
          let bestQ = -Infinity;
          for (let a = 0; a < 4; a++) {
            let q = 0;
            for (const t of transitions(r, c, a)) {
              const nx = move(api, r, c, t.a);
              const rew = rewardOf(nx.r, nx.c);
              const vn = isTerminal(nx.r, nx.c) ? 0 : V[idx(api, nx.r, nx.c)];
              q += t.p * (rew + gamma * vn);
            }
            if (q > bestQ) bestQ = q;
          }
          const old = V[idx(api, r, c)];
          V[idx(api, r, c)] = bestQ;
          delta = Math.max(delta, Math.abs(bestQ - old));
        }
      }
      if (delta < 1e-5) break;
    }

    const policy = new Array(N * N).fill(0);
    let vmax = 0.0001;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        vmax = Math.max(vmax, V[idx(api, r, c)]);
        if (isTerminal(r, c)) continue;
        let bestQ = -Infinity;
        let bestA = 0;
        for (let a = 0; a < 4; a++) {
          let q = 0;
          for (const t of transitions(r, c, a)) {
            const nx = move(api, r, c, t.a);
            const rew = rewardOf(nx.r, nx.c);
            const vn = isTerminal(nx.r, nx.c) ? 0 : V[idx(api, nx.r, nx.c)];
            q += t.p * (rew + gamma * vn);
          }
          if (q > bestQ) {
            bestQ = q;
            bestA = a;
          }
        }
        policy[idx(api, r, c)] = bestA;
      }
    }
    w.V = V;
    w.policy = policy;
    w.vmax = vmax;
    api.log(`Value iteration solved · slip ${slip.toFixed(2)} · γ ${gamma.toFixed(2)} · V(start) ${V[0].toFixed(3)}`);
  }

  function stepAgent(api) {
    const w = api.custom;
    const N = w.N;
    const a = w.policy[idx(api, w.agent.r, w.agent.c)];
    const roll = api.rand();
    const slip = w.slip;
    let act = a;
    if (roll < slip) {
      const perp = perpendicular(a);
      act = roll < slip / 2 ? perp[0] : perp[1];
    }
    const nx = move(api, w.agent.r, w.agent.c, act);
    w.agent = nx;
    w.visited.add(`${nx.r},${nx.c}`);
    const type = w.grid[nx.r][nx.c];
    if (type === "G") {
      w.success += 1;
      w.episodes += 1;
      api.log(`Reached goal. Success ${w.success}/${w.episodes}.`);
      w.agent = { r: 0, c: 0 };
    } else if (type === "H") {
      w.fail += 1;
      w.episodes += 1;
      w.agent = { r: 0, c: 0 };
    }
  }

  function step(api) {
    const w = api.custom;
    // Re-solve if slip or discount changed via sliders.
    const slipNow = clamp(api.state.turbulence * 0.5, 0, 0.66);
    const gammaNow = clamp(0.8 + api.state.attraction * 0.19, 0.8, 0.995);
    if (Math.abs(slipNow - w.slip) > 1e-3 || Math.abs(gammaNow - w.gamma) > 1e-3) solve(api);

    const framesPerTick = clamp(Math.round(14 / Math.max(0.2, api.state.speed)), 2, 32);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= framesPerTick) {
      w.acc = 0;
      stepAgent(api);
    }
    const sr = w.episodes ? w.success / w.episodes : 0;
    const ret = clamp(w.V ? w.V[0] : 0, 0, 1);
    const safe = w.grid.flat().filter((t) => t !== "H").length;
    const cover = clamp(w.visited.size / Math.max(1, safe), 0, 1);
    api.push(sr, ret, cover);
  }

  function valueColor(v, vmax) {
    const t = clamp(v / (vmax || 1), 0, 1);
    // blue (low) → teal → green (high)
    const r = Math.round(40 + t * 30);
    const g = Math.round(80 + t * 150);
    const b = Math.round(200 - t * 110);
    return `rgba(${r},${g},${b},${0.16 + t * 0.5})`;
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.grid) return;
    const N = w.N;
    const size = Math.min(api.w, api.h) * 0.86;
    const cell = size / N;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2 + 4;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const type = w.grid[r][c];
        if (type === "H") {
          ctx.fillStyle = "rgba(10,14,30,0.95)";
        } else if (type === "G") {
          ctx.fillStyle = "rgba(52,211,153,0.3)";
        } else if (api.state.trails) {
          ctx.fillStyle = valueColor(w.V[idx(api, r, c)], w.vmax);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
        }
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);

        if (type === "H") {
          ctx.fillStyle = "rgba(148,163,184,0.55)";
          ctx.font = `${Math.round(cell * 0.4)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✕", x + cell / 2, y + cell / 2 + 1);
        } else if (type === "G") {
          ctx.fillStyle = "rgba(110,231,183,0.95)";
          ctx.font = `${Math.round(cell * 0.42)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("★", x + cell / 2, y + cell / 2 + 1);
        } else {
          // policy arrow
          ctx.fillStyle = "rgba(245,245,247,0.5)";
          ctx.font = `${Math.round(cell * 0.36)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ARROWS[w.policy[idx(api, r, c)]], x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    // agent
    const ax = ox + (w.agent.c + 0.5) * cell;
    const ay = oy + (w.agent.r + 0.5) * cell;
    ctx.fillStyle = "rgba(96,165,250,0.18)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(147,197,253,0.98)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const sr = w.episodes ? Math.round((w.success / w.episodes) * 100) : 0;
    ctx.fillText(`${N}×${N}  ·  slip ${w.slip.toFixed(2)}  ·  γ ${w.gamma.toFixed(2)}  ·  success ${sr}%  ·  V(start) ${(w.V ? w.V[0] : 0).toFixed(2)}`, 14, api.h - 22);
  }

  return createSimHarness(refs, {
    seedDefault: 19,
    firstVariation: "fourbyfour",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => `${Math.round(v * 100)}%`,
      order: (_v, api) => (api.custom.V ? api.custom.V[0].toFixed(2) : "0.00"),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      fourbyfour: { count: 140, speed: 1.6, turbulence: 0.4, attraction: 0.85, trails: true },
      eightbyeight: { count: 300, speed: 2.0, turbulence: 0.4, attraction: 0.95, trails: true },
      slippery: { count: 200, speed: 1.6, turbulence: 1.0, attraction: 0.9, trails: true },
      deterministic: { count: 200, speed: 1.8, turbulence: 0.0, attraction: 0.8, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.N = clamp(Math.round(api.state.count / 34), 4, 10);
      w.slip = -1;
      w.gamma = -1;
      w.visited = new Set();
      w.success = 0;
      w.fail = 0;
      w.episodes = 0;
      w.acc = 0;
      w.agent = { r: 0, c: 0 };
      genLake(api);
      solve(api);
    },
    step,
    draw
  });
}

/**
 * Pathfinding Search
 *
 * Watch A*, Dijkstra, Greedy-best-first, and BFS expand their frontier across an
 * obstacle field, then reconstruct the path. The contrast is the lesson: A*'s
 * heuristic focuses the search, Dijkstra/BFS flood outward, greedy charges at the
 * goal and can detour. Ties to the catalog's Search topic.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

export function mountPathfinding(refs) {
  function id(w, x, y) {
    return y * w.W + x;
  }

  function heuristic(w, x, y) {
    return Math.abs(x - w.goal.x) + Math.abs(y - w.goal.y);
  }

  function genGrid(api) {
    const w = api.custom;
    w.W = clamp(Math.round(api.state.count / 12), 16, 46);
    w.H = clamp(Math.round((w.W * api.h) / Math.max(1, api.w)), 12, 34);
    const density = clamp(0.12 + api.state.turbulence * 0.22, 0.08, 0.42);
    w.blocked = new Uint8Array(w.W * w.H);
    for (let i = 0; i < w.blocked.length; i++) w.blocked[i] = api.rand() < density ? 1 : 0;
    w.start = { x: 1, y: Math.floor(w.H / 2) };
    w.goal = { x: w.W - 2, y: Math.floor(w.H / 2) };
    w.blocked[id(w, w.start.x, w.start.y)] = 0;
    w.blocked[id(w, w.goal.x, w.goal.y)] = 0;
    initSearch(api);
  }

  function initSearch(api) {
    const w = api.custom;
    const n = w.W * w.H;
    w.g = new Float32Array(n).fill(Infinity);
    w.came = new Int32Array(n).fill(-1);
    w.state = new Uint8Array(n); // 0 unseen, 1 open, 2 closed
    const s = id(w, w.start.x, w.start.y);
    w.g[s] = 0;
    w.open = [s];
    w.found = false;
    w.path = null;
    w.expanded = 0;
    w.done = false;
    w.holdT = 0;
  }

  function popBest(api) {
    const w = api.custom;
    const variation = api.state.variation;
    if (variation === "bfs") {
      return w.open.shift(); // FIFO
    }
    const hw = 1 + api.state.attraction * 3;
    let bestI = 0;
    let bestKey = Infinity;
    for (let i = 0; i < w.open.length; i++) {
      const cell = w.open[i];
      const x = cell % w.W;
      const y = (cell / w.W) | 0;
      let key;
      if (variation === "dijkstra") key = w.g[cell];
      else if (variation === "greedy") key = heuristic(w, x, y);
      else key = w.g[cell] + hw * heuristic(w, x, y); // astar (weighted)
      if (key < bestKey) {
        bestKey = key;
        bestI = i;
      }
    }
    const cell = w.open[bestI];
    w.open.splice(bestI, 1);
    return cell;
  }

  function reconstruct(api, cell) {
    const w = api.custom;
    const path = [];
    let cur = cell;
    while (cur !== -1) {
      path.push(cur);
      cur = w.came[cur];
    }
    w.path = path;
    w.found = true;
    api.log(`${api.state.variation.toUpperCase()} reached goal · expanded ${w.expanded} · path ${path.length}`);
  }

  function searchStep(api) {
    const w = api.custom;
    if (w.open.length === 0) {
      w.done = true;
      if (!w.found) api.log(`${api.state.variation.toUpperCase()} found no path · expanded ${w.expanded}`);
      w.holdT = 40;
      return;
    }
    const cell = popBest(api);
    if (w.state[cell] === 2) return;
    w.state[cell] = 2;
    w.expanded += 1;
    const x = cell % w.W;
    const y = (cell / w.W) | 0;
    if (x === w.goal.x && y === w.goal.y) {
      reconstruct(api, cell);
      w.done = true;
      w.holdT = 60;
      return;
    }
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) continue;
      const ni = id(w, nx, ny);
      if (w.blocked[ni] || w.state[ni] === 2) continue;
      const ng = w.g[cell] + 1;
      if (ng < w.g[ni]) {
        w.g[ni] = ng;
        w.came[ni] = cell;
        if (w.state[ni] === 0) {
          w.state[ni] = 1;
          w.open.push(ni);
        }
      }
    }
  }

  function step(api) {
    const w = api.custom;
    if (w.done) {
      w.holdT -= 1;
      if (w.holdT <= 0) {
        if (api.rand() < 0.5) genGrid(api);
        else initSearch(api);
      }
    } else {
      const perFrame = clamp(Math.round(api.state.speed * 4), 1, 30);
      for (let i = 0; i < perFrame && !w.done; i++) searchStep(api);
    }
    const total = w.W * w.H;
    const blockedN = w.blocked.reduce((s, b) => s + b, 0);
    const open = total - blockedN;
    api.push(
      w.found ? clamp(1 - (w.path ? w.path.length : 0) / total, 0, 1) : 0,
      w.found && w.expanded ? clamp((w.path ? w.path.length : 0) / w.expanded, 0, 1) : 0,
      clamp(w.expanded / Math.max(1, open), 0, 1)
    );
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.blocked) return;
    const cw = api.w / w.W;
    const ch = api.h / w.H;

    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        const i = id(w, x, y);
        let fill = null;
        if (w.blocked[i]) fill = "rgba(96,165,250,0.1)";
        else if (api.state.trails && w.state[i] === 2) fill = "rgba(244,114,182,0.16)";
        else if (api.state.trails && w.state[i] === 1) fill = "rgba(52,211,153,0.2)";
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fillRect(x * cw, y * ch, cw + 0.6, ch + 0.6);
        }
      }
    }

    if (w.path) {
      ctx.strokeStyle = "rgba(251,191,36,0.95)";
      ctx.lineWidth = Math.max(2, Math.min(cw, ch) * 0.4);
      ctx.lineJoin = "round";
      ctx.beginPath();
      w.path.forEach((cell, k) => {
        const x = (cell % w.W + 0.5) * cw;
        const y = (((cell / w.W) | 0) + 0.5) * ch;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const dot = (cell, color, rf) => {
      const x = (cell.x + 0.5) * cw;
      const y = (cell.y + 0.5) * ch;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(cw, ch) * rf, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(w.start, "rgba(125,211,252,0.98)", 0.36);
    dot(w.goal, "rgba(110,231,183,0.98)", 0.36);

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const status = w.found ? `path ${w.path.length}` : w.done ? "no path" : "searching…";
    ctx.fillText(`${api.state.variation.toUpperCase()} · expanded ${w.expanded} · ${status}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 13,
    firstVariation: "astar",
    chartColors: ["rgba(251,191,36,0.95)", "rgba(52,211,153,0.95)", "rgba(244,114,182,0.95)"],
    metricFormat: {
      energy: (v) => v.toFixed(2),
      order: (v) => v.toFixed(2),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      astar: { count: 280, speed: 1.6, turbulence: 0.45, attraction: 0.0, trails: true },
      dijkstra: { count: 280, speed: 1.6, turbulence: 0.45, attraction: 0.0, trails: true },
      greedy: { count: 280, speed: 1.6, turbulence: 0.45, attraction: 0.3, trails: true },
      bfs: { count: 280, speed: 1.6, turbulence: 0.45, attraction: 0.0, trails: true }
    },
    reset(api) {
      genGrid(api);
      api.log(`${api.state.variation.toUpperCase()} on a ${api.custom.W}×${api.custom.H} field.`);
    },
    step,
    draw
  });
}

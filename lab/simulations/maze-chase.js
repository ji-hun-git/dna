/**
 * Maze Chase — a self-playing pursuit/evasion game in a generated maze.
 *
 * A prey agent runs a BFS toward pellets while keeping distance from hunters;
 * hunters descend a BFS distance field rooted at the prey. Maps the "Maze Chase"
 * classic-inspired template from the BehaviorPrompt catalog.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

export function mountMazeChase(refs) {
  function key(x, y) {
    return `${x},${y}`;
  }

  function buildMaze(api) {
    const w = api.custom;
    const cols = clamp(Math.round(api.state.count / 26), 5, 12);
    const rows = clamp(Math.round((cols * api.h) / Math.max(1, api.w)), 4, 11);
    const W = cols * 2 + 1;
    const H = rows * 2 + 1;
    const pass = Array.from({ length: H }, () => new Array(W).fill(false));
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));

    const stack = [[0, 0]];
    visited[0][0] = true;
    pass[1][1] = true;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ].sort(() => api.rand() - 0.5);
      let advanced = false;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || visited[ny][nx]) continue;
        visited[ny][nx] = true;
        pass[ny * 2 + 1][nx * 2 + 1] = true;
        pass[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = true;
        stack.push([nx, ny]);
        advanced = true;
        break;
      }
      if (!advanced) stack.pop();
    }

    // "open" variation adds loops by knocking out interior walls.
    if (w.openness > 0) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!pass[y][x] && api.rand() < w.openness) pass[y][x] = true;
        }
      }
    }

    w.W = W;
    w.H = H;
    w.pass = pass;
    w.cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pass[y][x]) w.cells.push({ x, y });
  }

  function neighbors(w, x, y) {
    const out = [];
    if (w.pass[y]?.[x - 1]) out.push([x - 1, y]);
    if (w.pass[y]?.[x + 1]) out.push([x + 1, y]);
    if (w.pass[y - 1]?.[x]) out.push([x, y - 1]);
    if (w.pass[y + 1]?.[x]) out.push([x, y + 1]);
    return out;
  }

  function bfs(w, sx, sy) {
    const dist = new Map();
    dist.set(key(sx, sy), 0);
    const q = [[sx, sy]];
    let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++];
      const d = dist.get(key(x, y));
      for (const [nx, ny] of neighbors(w, x, y)) {
        const k = key(nx, ny);
        if (!dist.has(k)) {
          dist.set(k, d + 1);
          q.push([nx, ny]);
        }
      }
    }
    return dist;
  }

  function farCell(api, fromList, minDist = 4) {
    const w = api.custom;
    for (let i = 0; i < 80; i++) {
      const c = w.cells[Math.floor(api.rand() * w.cells.length)];
      let ok = true;
      for (const f of fromList) {
        if (Math.abs(c.x - f.x) + Math.abs(c.y - f.y) < minDist) ok = false;
      }
      if (ok) return { ...c };
    }
    return { ...w.cells[Math.floor(api.rand() * w.cells.length)] };
  }

  function spawnPellets(api, n) {
    const w = api.custom;
    w.pellets = [];
    for (let i = 0; i < n; i++) w.pellets.push(farCell(api, [w.prey], 2));
  }

  function tick(api) {
    const w = api.custom;
    w.elapsed += 1;
    const distFromPrey = bfs(w, w.prey.x, w.prey.y);

    // Hunters descend the prey distance field.
    for (const h of w.hunters) {
      const opts = neighbors(w, h.x, h.y).map(([x, y]) => ({ x, y, d: distFromPrey.get(key(x, y)) ?? 999 }));
      if (!opts.length) continue;
      opts.sort((a, b) => a.d - b.d);
      let choice = opts[0];
      if (api.rand() < api.state.turbulence * 0.4 || api.rand() > api.state.attraction) {
        choice = opts[Math.floor(api.rand() * opts.length)];
      }
      h.x = choice.x;
      h.y = choice.y;
    }

    // Prey heads to nearest pellet while avoiding hunters.
    let target = w.pellets[0];
    let best = Infinity;
    for (const p of w.pellets) {
      const d = distFromPrey.get(key(p.x, p.y)) ?? 999;
      if (d < best) {
        best = d;
        target = p;
      }
    }
    const distToTarget = target ? bfs(w, target.x, target.y) : null;
    const preyOpts = neighbors(w, w.prey.x, w.prey.y);
    if (preyOpts.length) {
      let bestScore = -Infinity;
      let pick = preyOpts[0];
      for (const [x, y] of preyOpts) {
        const food = distToTarget ? distToTarget.get(key(x, y)) ?? 999 : 0;
        let hunterDist = Infinity;
        for (const h of w.hunters) hunterDist = Math.min(hunterDist, Math.abs(h.x - x) + Math.abs(h.y - y));
        const score = -food * 1.0 + Math.min(hunterDist, 6) * 1.4 + (api.rand() - 0.5) * api.state.turbulence * 3;
        if (score > bestScore) {
          bestScore = score;
          pick = [x, y];
        }
      }
      w.prey.x = pick[0];
      w.prey.y = pick[1];
    }
    w.visited.add(key(w.prey.x, w.prey.y));

    // Pellet pickup.
    w.ateThisTick = 0;
    for (const p of w.pellets) {
      if (p.x === w.prey.x && p.y === w.prey.y) {
        w.score += 1;
        w.ateThisTick = 1;
        Object.assign(p, farCell(api, [w.prey, ...w.hunters], 3));
      }
    }

    // Capture check.
    for (const h of w.hunters) {
      if (h.x === w.prey.x && h.y === w.prey.y) {
        w.captures += 1;
        api.log(`Prey caught after ${w.survival} ticks. Capture #${w.captures}.`);
        w.survival = 0;
        w.prey = farCell(api, w.hunters, 6);
        return;
      }
    }
    w.survival += 1;
  }

  function step(api) {
    const w = api.custom;
    const framesPerTick = clamp(Math.round(12 / Math.max(0.2, api.state.speed)), 2, 30);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= framesPerTick) {
      w.acc = 0;
      tick(api);
    }
    w.foodRate = (w.foodRate || 0) * 0.94 + (w.ateThisTick || 0) * 0.06;
    const energy = clamp(w.foodRate * 8, 0, 1);
    const order = clamp(w.survival / 240, 0, 1);
    const spread = clamp(w.visited.size / Math.max(1, w.cells.length), 0, 1);
    api.push(energy, order, spread);
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.pass) return;
    const cw = api.w / w.W;
    const ch = api.h / w.H;

    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        if (!w.pass[y][x]) {
          ctx.fillStyle = "rgba(96,165,250,0.06)";
          ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
        } else if (api.state.trails && w.visited.has(`${x},${y}`)) {
          ctx.fillStyle = "rgba(52,211,153,0.07)";
          ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
        }
      }
    }

    for (const p of w.pellets) {
      ctx.fillStyle = "rgba(251,191,36,0.92)";
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * cw, (p.y + 0.5) * ch, Math.min(cw, ch) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    const cell = Math.min(cw, ch);
    // Prey.
    ctx.fillStyle = "rgba(96,165,250,0.16)";
    ctx.beginPath();
    ctx.arc((w.prey.x + 0.5) * cw, (w.prey.y + 0.5) * ch, cell * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(125,211,252,0.98)";
    ctx.beginPath();
    ctx.arc((w.prey.x + 0.5) * cw, (w.prey.y + 0.5) * ch, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();

    for (const h of w.hunters) {
      ctx.fillStyle = "rgba(244,114,182,0.95)";
      ctx.beginPath();
      ctx.arc((h.x + 0.5) * cw, (h.y + 0.5) * ch, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`pellets ${w.score}   ·   survival ${w.survival}   ·   captures ${w.captures}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 53,
    firstVariation: "classic",
    chartColors: ["rgba(251,191,36,0.95)", "rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.score || 0),
      order: (_v, api) => String(api.custom.survival || 0),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      classic: { count: 200, speed: 1.8, turbulence: 0.2, attraction: 0.75, trails: true },
      aggressive: { count: 200, speed: 2.2, turbulence: 0.12, attraction: 0.95, trails: true },
      scatter: { count: 220, speed: 1.6, turbulence: 0.5, attraction: 0.4, trails: true },
      open: { count: 260, speed: 2.0, turbulence: 0.22, attraction: 0.8, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.openness = api.state.variation === "open" ? 0.08 : 0;
      buildMaze(api);
      w.visited = new Set();
      w.score = 0;
      w.captures = 0;
      w.survival = 0;
      w.elapsed = 0;
      w.acc = 0;
      w.foodRate = 0;
      const hunterCount = api.state.variation === "aggressive" ? 4 : api.state.variation === "scatter" ? 2 : 3;
      w.prey = { ...w.cells[0] };
      w.hunters = Array.from({ length: hunterCount }, () => farCell(api, [w.prey], 6));
      spawnPellets(api, 4);
      api.log(`${api.state.variation} maze · ${hunterCount} hunters on a ${w.W}×${w.H} lattice.`);
    },
    step,
    draw
  });
}

/**
 * Snake Growth — self-playing snake AI(s).
 *
 * Each snake picks a move with a greedy-toward-food term plus a flood-fill safety
 * term that estimates reachable free space, so it avoids trapping itself. Maps the
 * "Snake-like Growth" classic-inspired template.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const COLORS = [
  { body: "rgba(52,211,153,0.92)", head: "rgba(110,231,183,1)" },
  { body: "rgba(96,165,250,0.92)", head: "rgba(147,197,253,1)" },
  { body: "rgba(244,114,182,0.92)", head: "rgba(249,168,212,1)" },
  { body: "rgba(251,191,36,0.92)", head: "rgba(253,224,71,1)" }
];

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function mountSnakeSwarm(refs) {
  function key(x, y) {
    return `${x},${y}`;
  }

  function wrap(api, x, y) {
    const w = api.custom;
    if (w.torus) return { x: (x + w.G) % w.G, y: (y + w.G) % w.G };
    return { x, y };
  }

  function occupied(api) {
    const set = new Set();
    for (const s of api.custom.snakes) for (const c of s.body) set.add(key(c.x, c.y));
    return set;
  }

  function freeSpace(api, sx, sy, blocked, cap) {
    const w = api.custom;
    if (sx < 0 || sy < 0 || sx >= w.G || sy >= w.G) return 0;
    if (blocked.has(key(sx, sy))) return 0;
    const seen = new Set([key(sx, sy)]);
    const stack = [[sx, sy]];
    let count = 0;
    while (stack.length && count < cap) {
      const [x, y] = stack.pop();
      count += 1;
      for (const d of DIRS) {
        let nx = x + d.x;
        let ny = y + d.y;
        if (w.torus) {
          nx = (nx + w.G) % w.G;
          ny = (ny + w.G) % w.G;
        } else if (nx < 0 || ny < 0 || nx >= w.G || ny >= w.G) {
          continue;
        }
        const k = key(nx, ny);
        if (!seen.has(k) && !blocked.has(k)) {
          seen.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    return count;
  }

  function nearestFood(api, head) {
    const w = api.custom;
    let best = null;
    let bd = Infinity;
    for (const f of w.food) {
      const d = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  function planSnake(api, snake, blocked) {
    const w = api.custom;
    const head = snake.body[0];
    const food = nearestFood(api, head);
    let best = null;
    let bestScore = -Infinity;
    for (const d of DIRS) {
      if (d.x === -snake.dir.x && d.y === -snake.dir.y && snake.body.length > 1) continue;
      const np = wrap(api, head.x + d.x, head.y + d.y);
      if (!w.torus && (np.x < 0 || np.y < 0 || np.x >= w.G || np.y >= w.G)) continue;
      if (blocked.has(key(np.x, np.y))) continue;
      const space = freeSpace(api, np.x, np.y, blocked, snake.body.length + 60);
      const foodTerm = food ? -(Math.abs(food.x - np.x) + Math.abs(food.y - np.y)) : 0;
      const score =
        space * 1.0 +
        foodTerm * (0.6 + api.state.attraction * 2.4) +
        (api.rand() - 0.5) * api.state.turbulence * 6;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  function placeFood(api) {
    const w = api.custom;
    const occ = occupied(api);
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(api.rand() * w.G);
      const y = Math.floor(api.rand() * w.G);
      if (!occ.has(key(x, y))) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  function spawnSnake(api, idx) {
    const w = api.custom;
    const occ = occupied(api);
    let hx = 0;
    let hy = 0;
    for (let i = 0; i < 80; i++) {
      hx = 2 + Math.floor(api.rand() * (w.G - 4));
      hy = 2 + Math.floor(api.rand() * (w.G - 4));
      if (!occ.has(key(hx, hy))) break;
    }
    return {
      id: idx,
      dir: DIRS[Math.floor(api.rand() * 4)],
      grow: 0,
      alive: true,
      deaths: 0,
      body: [
        { x: hx, y: hy },
        { x: hx, y: hy },
        { x: hx, y: hy }
      ],
      color: COLORS[idx % COLORS.length]
    };
  }

  function tick(api) {
    const w = api.custom;
    // Tails vacate this tick, so they are not blockers for the next head.
    const blocked = new Set();
    for (const s of w.snakes) {
      for (let i = 0; i < s.body.length - (s.grow > 0 ? 0 : 1); i++) {
        blocked.add(key(s.body[i].x, s.body[i].y));
      }
    }
    for (const s of w.snakes) {
      const move = planSnake(api, s, blocked);
      if (!move) {
        s.deaths += 1;
        w.totalDeaths += 1;
        api.log(`Snake ${s.id + 1} trapped at length ${s.body.length}.`);
        const fresh = spawnSnake(api, s.id);
        Object.assign(s, fresh);
        continue;
      }
      s.dir = move;
      const head = s.body[0];
      const np = wrap(api, head.x + move.x, head.y + move.y);
      s.body.unshift(np);
      let ate = false;
      for (let i = 0; i < w.food.length; i++) {
        if (w.food[i].x === np.x && w.food[i].y === np.y) {
          ate = true;
          w.eaten += 1;
          w.ateThisTick = 1;
          s.grow += 1;
          w.food[i] = placeFood(api);
        }
      }
      if (s.grow > 0) s.grow -= 1;
      else s.body.pop();
      void ate;
    }
    w.moves += 1;
  }

  function step(api) {
    const w = api.custom;
    const framesPerTick = clamp(Math.round(11 / Math.max(0.2, api.state.speed)), 2, 26);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= framesPerTick) {
      w.acc = 0;
      tick(api);
    }
    w.foodRate = (w.foodRate || 0) * 0.95 + (w.ateThisTick || 0) * 0.05;
    w.ateThisTick = 0;
    const totalLen = w.snakes.reduce((s, sn) => s + sn.body.length, 0);
    const occCount = totalLen;
    const energy = clamp(totalLen / (w.G * 2.2), 0, 1);
    const order = clamp(w.foodRate * 7, 0, 1);
    const spread = clamp(occCount / (w.G * w.G), 0, 1);
    api.push(energy, order, spread);
    w.maxLen = Math.max(w.maxLen, ...w.snakes.map((s) => s.body.length));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) {
      ctx.fillStyle = "rgba(7,7,13,0.32)";
      ctx.fillRect(0, 0, api.w, api.h);
    } else {
      ctx.fillStyle = "rgba(7,7,13,0.96)";
      ctx.fillRect(0, 0, api.w, api.h);
    }
    if (!w.snakes) return;
    const size = Math.min(api.w, api.h) * 0.94;
    const cell = size / w.G;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, size, size);

    for (const f of w.food) {
      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.beginPath();
      ctx.arc(ox + (f.x + 0.5) * cell, oy + (f.y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of w.snakes) {
      for (let i = s.body.length - 1; i >= 0; i--) {
        const c = s.body[i];
        const x = ox + c.x * cell;
        const y = oy + c.y * cell;
        ctx.fillStyle = i === 0 ? s.color.head : s.color.body;
        const pad = i === 0 ? cell * 0.08 : cell * 0.16;
        const r = Math.max(1, cell * 0.22);
        roundRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, r);
        ctx.fill();
      }
    }

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`food ${w.eaten}   ·   longest ${w.maxLen}   ·   resets ${w.totalDeaths}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 88,
    firstVariation: "solo",
    chartColors: ["rgba(52,211,153,0.95)", "rgba(251,191,36,0.95)", "rgba(96,165,250,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.maxLen || 0),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      solo: { count: 170, speed: 1.9, turbulence: 0.1, attraction: 0.45, trails: false },
      duel: { count: 200, speed: 2.0, turbulence: 0.12, attraction: 0.5, trails: false },
      swarm: { count: 240, speed: 2.1, turbulence: 0.16, attraction: 0.5, trails: false },
      torus: { count: 200, speed: 2.0, turbulence: 0.12, attraction: 0.5, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.G = clamp(Math.round(api.state.count / 9), 16, 40);
      w.torus = api.state.variation === "torus";
      const counts = { solo: 1, duel: 2, swarm: 4, torus: 2 };
      const n = counts[api.state.variation] || 1;
      w.snakes = [];
      w.eaten = 0;
      w.moves = 0;
      w.totalDeaths = 0;
      w.maxLen = 3;
      w.acc = 0;
      w.foodRate = 0;
      for (let i = 0; i < n; i++) w.snakes.push(spawnSnake(api, i));
      w.food = [];
      for (let i = 0; i < Math.max(2, n); i++) w.food.push(placeFood(api));
      api.log(`${api.state.variation} · ${n} snake${n > 1 ? "s" : ""} on a ${w.G}×${w.G} board${w.torus ? " (wrap)" : ""}.`);
    },
    step,
    draw
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

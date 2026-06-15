/**
 * Wumpus World (POMDP)
 *
 * A partially observable cave: pits give a breeze in adjacent cells, the wumpus a
 * stench, the gold a glitter. The agent only sees percepts where it stands, and
 * reasons: a visited cell with no breeze and no stench proves all its neighbors
 * safe. It explores the safe frontier, and when forced, takes the least-risky
 * guess. Maps the catalog's POMDP environments.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

export function mountWumpus(refs) {
  const key = (x, y) => `${x},${y}`;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function inB(w, x, y) {
    return x >= 0 && y >= 0 && x < w.N && y < w.N;
  }

  function neighbors(w, x, y) {
    return NB.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inB(w, nx, ny));
  }

  function genWorld(api) {
    const w = api.custom;
    const N = w.N;
    const start = { x: 0, y: N - 1 };
    w.start = start;
    const density = clamp(0.1 + api.state.turbulence * 0.22, 0.06, 0.34);
    const safeStart = new Set([key(start.x, start.y), ...neighbors(w, start.x, start.y).map(([x, y]) => key(x, y))]);

    w.pit = new Set();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (safeStart.has(key(x, y))) continue;
        if (api.rand() < density) w.pit.add(key(x, y));
      }
    }
    // wumpus
    let wx, wy;
    do {
      wx = Math.floor(api.rand() * N);
      wy = Math.floor(api.rand() * N);
    } while (safeStart.has(key(wx, wy)) || w.pit.has(key(wx, wy)));
    w.wumpus = key(wx, wy);
    // gold (avoid pits/start)
    let gx, gy;
    let tries = 0;
    do {
      gx = Math.floor(api.rand() * N);
      gy = Math.floor(api.rand() * N);
      tries++;
    } while ((w.pit.has(key(gx, gy)) || key(gx, gy) === key(start.x, start.y)) && tries < 200);
    w.gold = key(gx, gy);

    w.visited = new Set();
    w.safe = new Set([key(start.x, start.y)]);
    w.breeze = new Set();
    w.stench = new Set();
    w.agent = { ...start };
    w.plan = [];
    w.steps = 0;
    w.alive = true;
    w.grabbed = false;
    api.log(`New cave · ${N}×${N} · ${w.pit.size} pits, 1 wumpus. Find the gold.`);
  }

  function breezeAt(w, x, y) {
    return neighbors(w, x, y).some(([nx, ny]) => w.pit.has(key(nx, ny)));
  }
  function stenchAt(w, x, y) {
    return neighbors(w, x, y).some(([nx, ny]) => key(nx, ny) === w.wumpus);
  }

  function perceive(api) {
    const w = api.custom;
    const { x, y } = w.agent;
    w.visited.add(key(x, y));
    w.safe.add(key(x, y));
    const b = breezeAt(w, x, y);
    const s = stenchAt(w, x, y);
    if (b) w.breeze.add(key(x, y));
    if (s) w.stench.add(key(x, y));
    if (!b && !s) {
      for (const [nx, ny] of neighbors(w, x, y)) w.safe.add(key(nx, ny));
    }
  }

  function bfsPath(w, from, passable, isTarget) {
    const seen = new Set([key(from.x, from.y)]);
    const queue = [{ x: from.x, y: from.y, path: [] }];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (isTarget(cur.x, cur.y) && (cur.x !== from.x || cur.y !== from.y)) return cur.path.concat([[cur.x, cur.y]]);
      for (const [nx, ny] of neighbors(w, cur.x, cur.y)) {
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (!passable(nx, ny) && !(isTarget(nx, ny))) continue;
        seen.add(k);
        queue.push({ x: nx, y: ny, path: cur.path.concat([[cur.x, cur.y]]) });
      }
    }
    return null;
  }

  function dangerScore(w, x, y) {
    // higher = more suspected; -1 if known safe
    if (w.safe.has(key(x, y))) return -1;
    let score = 0;
    for (const [nx, ny] of neighbors(w, x, y)) {
      const k = key(nx, ny);
      if (!w.visited.has(k)) continue;
      if (w.breeze.has(k)) score += 1;
      if (w.stench.has(k)) score += 1;
    }
    return score;
  }

  function planMove(api) {
    const w = api.custom;
    const a = w.agent;

    // 1) Head to gold if its cell is known safe & reachable, else explore.
    // Safe frontier: safe, unvisited cells reachable through safe cells.
    const safePass = (x, y) => w.safe.has(key(x, y));
    const safeFrontier = bfsPath(w, a, safePass, (x, y) => safePass(x, y) && !w.visited.has(key(x, y)));
    if (safeFrontier && safeFrontier.length) {
      w.plan = safeFrontier;
      return;
    }

    // 2) No safe frontier - take the least-risky frontier guess.
    const frontier = [];
    const seen = new Set();
    for (const v of w.visited) {
      const [vx, vy] = v.split(",").map(Number);
      for (const [nx, ny] of neighbors(w, vx, vy)) {
        const k = key(nx, ny);
        if (w.visited.has(k) || seen.has(k)) continue;
        seen.add(k);
        frontier.push({ x: nx, y: ny, score: dangerScore(w, nx, ny) });
      }
    }
    if (!frontier.length) {
      w.plan = [];
      return;
    }
    frontier.sort((p, q) => p.score - q.score);
    const caution = api.state.attraction; // higher = less willing to gamble
    const best = frontier[0];
    if (best.score > 0 && best.score >= 1 + Math.round(caution * 2)) {
      // too risky for the agent's caution → abandon this cave
      w.plan = null;
      return;
    }
    // navigate over visited cells to a cell adjacent to target, then step in
    const adjVisited = neighbors(w, best.x, best.y).some(([nx, ny]) => nx === a.x && ny === a.y);
    if (adjVisited) {
      w.plan = [[best.x, best.y]];
      return;
    }
    const path = bfsPath(
      w,
      a,
      (x, y) => w.visited.has(key(x, y)),
      (x, y) => neighbors(w, x, y).some(([nx, ny]) => nx === best.x && ny === best.y) && w.visited.has(key(x, y))
    );
    if (path && path.length) {
      path.push([best.x, best.y]);
      w.plan = path;
    } else {
      w.plan = [[best.x, best.y]];
    }
  }

  function tick(api) {
    const w = api.custom;
    if (!w.alive) {
      genWorld(api);
      perceive(api);
      return;
    }
    if (w.grabbed) {
      w.successHold = (w.successHold || 0) - 1;
      if (w.successHold <= 0) {
        genWorld(api);
        perceive(api);
      }
      return;
    }

    // glitter?
    if (key(w.agent.x, w.agent.y) === w.gold) {
      w.gold = null;
      w.grabbed = true;
      w.collected = (w.collected || 0) + 1;
      w.successHold = 26;
      api.log(`Glitter! Grabbed the gold (#${w.collected}).`);
      return;
    }

    if (!w.plan || !w.plan.length) planMove(api);
    if (w.plan === null) {
      api.log("Too risky - leaving this cave.");
      w.alive = false;
      return;
    }
    if (!w.plan.length) {
      w.alive = false;
      return;
    }

    const [nx, ny] = w.plan.shift();
    w.agent = { x: nx, y: ny };
    w.steps += 1;
    w.survive = (w.survive || 0) + 1;

    // death?
    if (w.pit.has(key(nx, ny))) {
      w.deaths = (w.deaths || 0) + 1;
      w.deathCell = key(nx, ny);
      w.deathKind = "pit";
      w.alive = false;
      w.survive = 0;
      api.log(`Fell into a pit at ${key(nx, ny)}.`);
      return;
    }
    if (key(nx, ny) === w.wumpus) {
      w.deaths = (w.deaths || 0) + 1;
      w.deathCell = key(nx, ny);
      w.deathKind = "wumpus";
      w.alive = false;
      w.survive = 0;
      api.log(`Eaten by the wumpus at ${key(nx, ny)}.`);
      return;
    }
    perceive(api);
    if (w.steps > w.N * w.N * 3) {
      w.alive = false;
      api.log("Explored out - resetting cave.");
    }
  }

  function step(api) {
    const w = api.custom;
    const fpt = clamp(Math.round(16 / Math.max(0.2, api.state.speed)), 2, 36);
    w.acc = (w.acc || 0) + 1;
    if (w.acc >= fpt) {
      w.acc = 0;
      tick(api);
    }
    const explored = w.visited ? w.visited.size : 0;
    api.push(
      clamp((w.collected || 0) / 6, 0, 1),
      clamp((w.survive || 0) / (w.N * w.N), 0, 1),
      clamp(explored / (w.N * w.N), 0, 1)
    );
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.agent) return;
    const N = w.N;
    const size = Math.min(api.w, api.h) * 0.86;
    const cell = size / N;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2 + 4;
    const cx = (x) => ox + x * cell;
    const cy = (y) => oy + y * cell;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = key(x, y);
        let fill = "rgba(255,255,255,0.02)";
        if (api.state.trails) {
          if (w.visited.has(k)) fill = "rgba(96,165,250,0.14)";
          else if (w.safe.has(k)) fill = "rgba(52,211,153,0.14)";
          else if (dangerScore(w, x, y) > 0) fill = "rgba(248,113,113,0.12)";
        } else if (w.visited.has(k)) {
          fill = "rgba(96,165,250,0.1)";
        }
        ctx.fillStyle = fill;
        ctx.fillRect(cx(x), cy(y), cell, cell);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(cx(x) + 0.5, cy(y) + 0.5, cell, cell);

        // percept marks on visited cells
        if (w.visited.has(k)) {
          let m = "";
          if (w.breeze.has(k)) m += "≈";
          if (w.stench.has(k)) m += "~";
          if (m) {
            ctx.fillStyle = "rgba(244,114,182,0.7)";
            ctx.font = `${Math.round(cell * 0.3)}px Inter, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(m, cx(x) + 3, cy(y) + 2);
          }
        }
      }
    }

    // gold (only show when discovered/visible cell is known safe & adjacent? show faint always when known)
    if (w.gold) {
      const [gx, gy] = w.gold.split(",").map(Number);
      const visibleGold = w.visited.has(w.gold) || w.safe.has(w.gold);
      if (visibleGold) {
        ctx.fillStyle = "rgba(251,191,36,0.95)";
        ctx.font = `${Math.round(cell * 0.5)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("◆", cx(gx) + cell / 2, cy(gy) + cell / 2);
      }
    }

    // reveal cause of death briefly
    if (!w.alive && w.deathCell) {
      const [dx, dy] = w.deathCell.split(",").map(Number);
      ctx.fillStyle = w.deathKind === "pit" ? "rgba(10,14,30,0.9)" : "rgba(167,139,250,0.6)";
      ctx.fillRect(cx(dx), cy(dy), cell, cell);
      ctx.fillStyle = "rgba(248,113,113,0.95)";
      ctx.font = `${Math.round(cell * 0.5)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(w.deathKind === "pit" ? "○" : "W", cx(dx) + cell / 2, cy(dy) + cell / 2);
    }

    // agent
    const ax = cx(w.agent.x) + cell / 2;
    const ay = cy(w.agent.y) + cell / 2;
    ctx.fillStyle = w.grabbed ? "rgba(251,191,36,0.25)" : "rgba(125,211,252,0.2)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.grabbed ? "rgba(253,224,71,0.98)" : "rgba(125,211,252,0.98)";
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`gold ${w.collected || 0} · deaths ${w.deaths || 0} · explored ${w.visited.size}/${N * N}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 29,
    firstVariation: "classic",
    chartColors: ["rgba(251,191,36,0.95)", "rgba(52,211,153,0.95)", "rgba(96,165,250,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.collected || 0),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      classic: { count: 200, speed: 1.6, turbulence: 0.35, attraction: 0.3, trails: true },
      small: { count: 130, speed: 1.6, turbulence: 0.3, attraction: 0.3, trails: true },
      large: { count: 300, speed: 1.8, turbulence: 0.32, attraction: 0.3, trails: true },
      dense: { count: 220, speed: 1.6, turbulence: 0.7, attraction: 0.45, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.N = clamp(Math.round(api.state.count / 34), 4, 9);
      w.collected = 0;
      w.deaths = 0;
      w.survive = 0;
      w.acc = 0;
      genWorld(api);
      perceive(api);
    },
    step,
    draw
  });
}

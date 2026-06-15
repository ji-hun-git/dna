/**
 * Behavior-Prompt Gridworld
 *
 * A live reconstruction of the BehaviorPrompt Games thesis: can an agent infer a
 * latent prerequisite rule (procedural / causal / social) from a prompt condition?
 *
 * Three 7x7 environments — DoorKey, SwitchBridge, Ownership — each have a hidden
 * rule. The agent executes a deterministic plan whose shape depends on the prompt
 * condition (none / text / behavior / hybrid). The "none" plan greedily reaches
 * the goal but violates the latent rule; text/behavior/hybrid satisfy the
 * prerequisite first. The dashboard tracks goal-reach rate vs rule-compliance
 * rate — exactly the sufficiency-vs-compliance distinction the paper sharpens.
 */

import { createSimHarness, clamp, lerp, TAU } from "./_shared.js?v=20260615-lab2";

const N = 7;

const ENVIRONMENTS = [
  {
    id: "doorkey",
    name: "DoorKey",
    family: "procedural",
    rule: "Collect the key before opening the locked door.",
    start: { r: 0, c: 0 },
    key: { r: 0, c: 4 },
    door: { r: 3, c: 4 },
    goal: { r: 6, c: 6 }
  },
  {
    id: "switchbridge",
    name: "SwitchBridge",
    family: "causal",
    rule: "Activate the lever before crossing the bridge over the hazard.",
    start: { r: 6, c: 0 },
    lever: { r: 3, c: 0 },
    hazard: { r: 3, c: 2 },
    bridge: { r: 3, c: 3 },
    goal: { r: 0, c: 6 }
  },
  {
    id: "ownership",
    name: "Ownership",
    family: "social",
    rule: "Ask the owner for permission before opening the owned chest.",
    start: { r: 0, c: 0 },
    owner: { r: 0, c: 6 },
    chest: { r: 3, c: 3 },
    goal: { r: 6, c: 6 }
  }
];

const CONDITION_LABEL = {
  none: "No prompt · Direct Greedy",
  text: "Text rule",
  behavior: "Behavior demo",
  hybrid: "Text + behavior"
};

function eq(a, b) {
  return a.r === b.r && a.c === b.c;
}

function clampCell(r, c) {
  return { r: clamp(r, 0, N - 1), c: clamp(c, 0, N - 1) };
}

function routeMoves(from, to) {
  const moves = [];
  let r = from.r;
  let c = from.c;
  while (r !== to.r) {
    const dir = to.r > r ? "south" : "north";
    r += to.r > r ? 1 : -1;
    moves.push({ type: "move", dir });
  }
  while (c !== to.c) {
    const dir = to.c > c ? "east" : "west";
    c += to.c > c ? 1 : -1;
    moves.push({ type: "move", dir });
  }
  return moves;
}

function routeThrough(points, includeInteractions) {
  const actions = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    actions.push(...routeMoves(points[i], points[i + 1]));
    if (includeInteractions && i < points.length - 2) actions.push({ type: "interact" });
  }
  return actions;
}

function directPlan(env) {
  if (env.id === "doorkey") return routeThrough([env.start, env.door, env.goal], true);
  if (env.id === "switchbridge") return routeThrough([env.start, env.hazard, env.goal], false);
  return routeThrough([env.start, env.chest, env.goal], true);
}

function rulePlan(env) {
  if (env.id === "doorkey") return routeThrough([env.start, env.key, env.door, env.goal], true);
  if (env.id === "switchbridge") return routeThrough([env.start, env.lever, env.bridge, env.goal], true);
  return routeThrough([env.start, env.owner, env.chest, env.goal], true);
}

function planFor(env, condition) {
  if (condition === "none") return directPlan(env);
  const base = rulePlan(env);
  if (condition === "behavior") {
    const at = Math.min(2, base.length);
    return [...base.slice(0, at), { type: "wait" }, ...base.slice(at)];
  }
  return base;
}

function moveCell(pos, dir) {
  if (dir === "north") return clampCell(pos.r - 1, pos.c);
  if (dir === "south") return clampCell(pos.r + 1, pos.c);
  if (dir === "west") return clampCell(pos.r, pos.c - 1);
  if (dir === "east") return clampCell(pos.r, pos.c + 1);
  return { ...pos };
}

export function mountGridworldPrompt(refs) {
  const DIRS = ["north", "south", "east", "west"];

  function newEpisode(api, envIndex) {
    const w = api.custom;
    const env = ENVIRONMENTS[envIndex % ENVIRONMENTS.length];
    w.env = env;
    w.envIndex = envIndex;
    w.plan = planFor(env, api.state.variation);
    w.ptr = 0;
    w.pos = { ...env.start };
    w.prev = { ...env.start };
    w.t = 1;
    w.hasKey = false;
    w.leverOn = false;
    w.permission = false;
    w.violations = 0;
    w.steps = 0;
    w.reachedGoal = false;
    w.phase = "run";
    w.pauseT = 0;
    w.heat = w.heat || {};
    w.pulse = 0;
    api.log(`${env.name} · ${CONDITION_LABEL[api.state.variation]} — rule: ${env.rule}`);
  }

  function finishEpisode(api) {
    const w = api.custom;
    w.reachedGoal = eq(w.pos, w.env.goal);
    const reward = (w.reachedGoal ? 10 : 0) - 5 * w.violations - 0.1 * w.steps;
    w.lastReward = reward;
    w.results.push({ reached: w.reachedGoal, compliant: w.violations === 0 });
    const win = clamp(Math.round(api.state.count / 24), 4, 16);
    while (w.results.length > win) w.results.shift();
    const reach = w.results.reduce((s, r) => s + (r.reached ? 1 : 0), 0) / w.results.length;
    const comp = w.results.reduce((s, r) => s + (r.compliant ? 1 : 0), 0) / w.results.length;
    w.reachRate = reach;
    w.compRate = comp;
    const verdict = w.reachedGoal
      ? w.violations === 0
        ? "solved (rule kept)"
        : `reached goal but broke rule (${w.violations} violation${w.violations > 1 ? "s" : ""})`
      : "failed to reach goal";
    api.log(`${w.env.name}: ${verdict} · reward ${reward.toFixed(1)}`);
    w.phase = "pause";
    w.pauseT = 22;
  }

  function applyAction(api, action) {
    const w = api.custom;
    const env = w.env;
    w.prev = { ...w.pos };
    if (action.type === "move") {
      let dir = action.dir;
      const slip = api.state.turbulence * 0.36;
      if (api.rand() < slip) dir = DIRS[Math.floor(api.rand() * 4)];
      const next = moveCell(w.pos, dir);
      w.pos = next;
      w.steps += 1;
      w.heat[`${next.r}:${next.c}`] = (w.heat[`${next.r}:${next.c}`] || 0) + 1;
      // Causal rule: stepping onto the hazard without the lever is a violation.
      if (env.id === "switchbridge" && env.hazard && eq(next, env.hazard) && !w.leverOn) {
        w.violations += 1;
        w.pulse = 1;
        api.log("Stepped into the hazard without the lever.");
      }
    } else if (action.type === "interact") {
      w.pulse = 1;
      if (env.key && eq(w.pos, env.key) && !w.hasKey) {
        w.hasKey = true;
        api.log("Picked up the key.");
      } else if (env.lever && eq(w.pos, env.lever) && !w.leverOn) {
        w.leverOn = true;
        api.log("Activated the lever — bridge is safe.");
      } else if (env.owner && eq(w.pos, env.owner) && !w.permission) {
        w.permission = true;
        api.log("Asked the owner — permission granted.");
      } else if (env.door && eq(w.pos, env.door)) {
        if (!w.hasKey) {
          w.violations += 1;
          api.log("Tried to open the locked door without a key.");
        }
      } else if (env.chest && eq(w.pos, env.chest)) {
        if (!w.permission) {
          w.violations += 1;
          api.log("Opened the owned chest without asking.");
        }
      }
    }
    // wait: no effect
  }

  function step(api) {
    const w = api.custom;
    if (w.phase === "pause") {
      w.pauseT -= 1;
      if (w.pauseT <= 0) newEpisode(api, w.envIndex + 1);
    } else {
      const framesPerAction = clamp(Math.round(14 / Math.max(0.2, api.state.speed)), 3, 44);
      w.t += 1 / framesPerAction;
      if (w.t >= 1) {
        w.t = 0;
        if (w.ptr >= w.plan.length) {
          finishEpisode(api);
        } else {
          applyAction(api, w.plan[w.ptr]);
          w.ptr += 1;
        }
      }
    }
    w.pulse *= 0.9;

    const reward01 = clamp(((w.lastReward || 0) + 5) / 15, 0, 1);
    api.push(reward01, w.reachRate || 0, w.compRate || 0);
  }

  function boardGeom(api) {
    const size = Math.min(api.w, api.h) * 0.84;
    const cell = size / N;
    const ox = (api.w - size) / 2;
    const oy = (api.h - size) / 2 + 6;
    return { size, cell, ox, oy };
  }

  function cellCenter(g, r, c) {
    return { x: g.ox + (c + 0.5) * g.cell, y: g.oy + (r + 0.5) * g.cell };
  }

  function roleTile(api, g, cell, color, glyph, opts = {}) {
    const { x, y } = cellCenter(g, cell.r, cell.c);
    const s = g.cell * 0.74;
    api.ctx.fillStyle = color.replace("ALPHA", opts.dim ? "0.10" : "0.18");
    api.ctx.strokeStyle = color.replace("ALPHA", "0.6");
    api.ctx.lineWidth = 1.4;
    roundRect(api.ctx, x - s / 2, y - s / 2, s, s, 7);
    api.ctx.fill();
    api.ctx.stroke();
    api.ctx.fillStyle = color.replace("ALPHA", "0.92");
    api.ctx.font = `700 ${Math.round(g.cell * 0.34)}px Inter, sans-serif`;
    api.ctx.textAlign = "center";
    api.ctx.textBaseline = "middle";
    api.ctx.fillText(glyph, x, y + 1);
  }

  function draw(api) {
    const { ctx } = api;
    ctx.fillStyle = "rgba(7, 7, 13, 0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    const w = api.custom;
    if (!w.env) return;
    const g = boardGeom(api);
    const env = w.env;

    // Grid + optional visited heatmap.
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = g.ox + c * g.cell;
        const y = g.oy + r * g.cell;
        if (api.state.trails) {
          const h = w.heat[`${r}:${c}`] || 0;
          if (h > 0) {
            ctx.fillStyle = `rgba(96, 165, 250, ${clamp(h / 8, 0, 0.32)})`;
            ctx.fillRect(x, y, g.cell, g.cell);
          }
        }
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, g.cell, g.cell);
      }
    }

    // Planned-path preview (ghost), opacity from "attraction".
    const ghostA = api.state.attraction;
    if (ghostA > 0.02) {
      ctx.save();
      ctx.strokeStyle = `rgba(196, 181, 253, ${clamp(ghostA, 0, 0.7) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      let p = { ...env.start };
      ctx.beginPath();
      let cc = cellCenter(g, p.r, p.c);
      ctx.moveTo(cc.x, cc.y);
      for (const a of w.plan) {
        if (a.type === "move") {
          p = moveCell(p, a.dir);
          cc = cellCenter(g, p.r, p.c);
          ctx.lineTo(cc.x, cc.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Special tiles.
    if (env.hazard) {
      const { x, y } = cellCenter(g, env.hazard.r, env.hazard.c);
      ctx.fillStyle = w.leverOn ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.18)";
      ctx.fillRect(x - g.cell / 2, y - g.cell / 2, g.cell, g.cell);
      ctx.strokeStyle = w.leverOn ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.55)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x - g.cell / 2 + 1, y - g.cell / 2 + 1, g.cell - 2, g.cell - 2);
    }
    if (env.bridge) roleTile(api, g, env.bridge, "rgba(148,163,184,ALPHA)", "≋");
    if (env.key) roleTile(api, g, env.key, "rgba(251,191,36,ALPHA)", "K", { dim: w.hasKey });
    if (env.door) roleTile(api, g, env.door, "rgba(167,139,250,ALPHA)", "D");
    if (env.lever) roleTile(api, g, env.lever, "rgba(96,165,250,ALPHA)", "L", { dim: w.leverOn });
    if (env.owner) roleTile(api, g, env.owner, "rgba(244,114,182,ALPHA)", "O", { dim: w.permission });
    if (env.chest) roleTile(api, g, env.chest, "rgba(251,191,36,ALPHA)", "C");

    // Goal pulses.
    const goalC = cellCenter(g, env.goal.r, env.goal.c);
    const gp = 1 + Math.sin(api.frame * 0.06) * 0.16;
    ctx.strokeStyle = "rgba(52, 211, 153, 0.7)";
    ctx.fillStyle = "rgba(52, 211, 153, 0.14)";
    ctx.lineWidth = 2;
    roundRect(ctx, goalC.x - g.cell * 0.36 * gp, goalC.y - g.cell * 0.36 * gp, g.cell * 0.72 * gp, g.cell * 0.72 * gp, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(52,211,153,0.95)";
    ctx.font = `700 ${Math.round(g.cell * 0.34)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", goalC.x, goalC.y + 1);

    // Agent (interpolated between cells).
    const ease = w.t * w.t * (3 - 2 * w.t);
    const ar = lerp(w.prev.r, w.pos.r, ease);
    const ac = lerp(w.prev.c, w.pos.c, ease);
    const ax = g.ox + (ac + 0.5) * g.cell;
    const ay = g.oy + (ar + 0.5) * g.cell;
    const violColor = w.violations > 0;
    ctx.beginPath();
    ctx.fillStyle = "rgba(245,245,247,0.10)";
    ctx.arc(ax, ay, g.cell * (0.42 + w.pulse * 0.18), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = violColor ? "rgba(248,113,113,0.96)" : "rgba(245,245,247,0.96)";
    ctx.arc(ax, ay, g.cell * 0.22, 0, TAU);
    ctx.fill();

    // HUD.
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.fillText(`${env.name} · ${env.family}`, 14, 12);
    ctx.fillStyle = "rgba(186,186,196,0.9)";
    ctx.font = "500 11px ui-monospace, monospace";
    ctx.fillText(CONDITION_LABEL[api.state.variation], 14, 30);
    const chips = [];
    if (env.key) chips.push(`key ${w.hasKey ? "✓" : "·"}`);
    if (env.lever) chips.push(`lever ${w.leverOn ? "✓" : "·"}`);
    if (env.owner) chips.push(`perm ${w.permission ? "✓" : "·"}`);
    chips.push(`viol ${w.violations}`);
    ctx.fillStyle = w.violations > 0 ? "rgba(248,113,113,0.95)" : "rgba(52,211,153,0.9)";
    ctx.fillText(chips.join("   "), 14, api.h - 22);
  }

  return createSimHarness(refs, {
    seedDefault: 7,
    firstVariation: "none",
    liveCount: true,
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(244,114,182,0.95)"],
    metricFormat: {
      energy: (_v, api) => (api.custom.lastReward || 0).toFixed(1),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      none: { count: 180, speed: 1.9, turbulence: 0.1, attraction: 0.0, trails: true },
      text: { count: 180, speed: 1.7, turbulence: 0.1, attraction: 0.35, trails: true },
      behavior: { count: 180, speed: 1.5, turbulence: 0.14, attraction: 0.5, trails: true },
      hybrid: { count: 180, speed: 1.8, turbulence: 0.1, attraction: 0.45, trails: true }
    },
    reset(api) {
      api.custom.results = [];
      api.custom.heat = {};
      api.custom.lastReward = 0;
      api.custom.reachRate = 0;
      api.custom.compRate = 0;
      const startEnv = Math.floor(api.rand() * ENVIRONMENTS.length);
      newEpisode(api, startEnv);
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

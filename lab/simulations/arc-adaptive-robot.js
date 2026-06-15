/**
 * ARC Adaptive Unit — damage-tolerant drones and mechs
 *
 * Inspired by ARC Raiders' flying drones and walking mechs. A unit patrols toward
 * waypoints; you can shoot out its rotors/legs (hover the cursor over a part) or
 * they fail on their own, and the controller re-solves on the fly:
 *
 *   - Flyers re-compute a thrust-allocation pseudo-inverse over the rotors that
 *     are still intact, so the craft keeps tracking its target (degrading
 *     gracefully as redundancy runs out).
 *   - Walkers re-phase the gait over the legs that remain and keep the centre of
 *     mass inside the support polygon, switching gait as legs are lost.
 *
 * The math panel highlights the live control step; when a part breaks, the
 * adaptation equation flashes.
 */

import { createSimHarness, clamp, TAU } from "./_shared.js?v=20260615-lab2";

function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) return null;
  const id = 1 / det;
  return [
    A * id, (c * h - b * i) * id, (b * f - c * e) * id,
    B * id, (a * i - c * g) * id, (c * d - a * f) * id,
    C * id, (b * g - a * h) * id, (a * e - b * d) * id
  ];
}

function mul3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

function comInSupport(feet, com) {
  if (feet.length < 3) return false;
  const cx = feet.reduce((s, p) => s + p.x, 0) / feet.length;
  const cy = feet.reduce((s, p) => s + p.y, 0) / feet.length;
  const ordered = [...feet].sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  let sign = 0;
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    const cross = (b.x - a.x) * (com.y - a.y) - (b.y - a.y) * (com.x - a.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function mountArcRobot(refs) {
  function isFlyer(api) {
    return api.state.variation === "quadrotor" || api.state.variation === "hexrotor";
  }

  function partCount(api) {
    return api.state.variation === "hexrotor" || api.state.variation === "hexapod" ? 6 : 4;
  }

  function newTarget(api) {
    const w = api.custom;
    w.target = { x: api.range(api.w * 0.18, api.w * 0.82), y: api.range(api.h * 0.18, api.h * 0.82) };
  }

  function damage(api, idx, on) {
    const w = api.custom;
    const p = w.parts[idx];
    if (!p) return;
    if (on === false) {
      p.alive = true;
      api.log(`${w.partName} ${idx + 1} repaired — re-optimizing.`);
    } else {
      if (!p.alive) return;
      p.alive = false;
      api.log(`${w.partName} ${idx + 1} destroyed — adapting control.`);
    }
    w.adaptFlash = 42;
    if (!isFlyer(api)) regait(api);
  }

  function regait(api) {
    const w = api.custom;
    const ok = w.parts.filter((p) => p.alive);
    const k = ok.length;
    // duty rises so at least ~3 legs are planted; offsets re-spread over the
    // legs that remain (so a tripod-style support set keeps cycling).
    w.duty = clamp(3.4 / w.parts.length + (w.parts.length - k) * 0.05, 0.5, 0.92);
    ok.forEach((p, i) => { p.offset = k > 0 ? (i % 2) * 0.5 + Math.floor(i / 2) / Math.max(1, k) : 0; });
  }

  // ── Flyer dynamics: thrust allocation over intact rotors ──
  function stepFlyer(api, dt) {
    const w = api.custom;
    const b = w.body;
    const gain = 0.6 + api.state.attraction * 2.2;
    const fmax = 60 + api.state.count * 0.6;

    // desired world wrench
    const ex = w.target.x - b.x;
    const ey = w.target.y - b.y;
    let fx = gain * ex * 0.12 - b.vx * 14;
    let fy = gain * ey * 0.12 - b.vy * 14;
    // only ask for the force the intact rotors can deliver — fewer rotors → less
    // agility (graceful degradation), but the allocation stays exact (no spin).
    const aliveN = w.parts.filter((p) => p.alive).length;
    const maxW = 0.5 * Math.max(1, aliveN) * (60 + api.state.count * 0.6);
    const wm = Math.hypot(fx, fy);
    if (wm > maxW) { fx *= maxW / wm; fy *= maxW / wm; }
    const mz = 0; // hold attitude; intact symmetric rotors net zero torque
    const wDes = [fx, fy, mz];

    const alive = w.parts.filter((p) => p.alive);
    let wAch = [0, 0, 0];
    // build A = M Mᵀ over intact rotors (world offsets)
    let sumPx = 0, sumPy = 0, sumP2 = 0;
    const off = alive.map((p) => {
      const ox = Math.cos(b.th + p.angle) * w.R;
      const oy = Math.sin(b.th + p.angle) * w.R;
      sumPx += ox; sumPy += oy; sumP2 += ox * ox + oy * oy;
      return { p, ox, oy };
    });
    const k = alive.length;
    if (k >= 1) {
      const A = [k, 0, -sumPy, 0, k, sumPx, -sumPy, sumPx, sumP2];
      const Ai = inv3(A);
      if (Ai) {
        const z = mul3(Ai, wDes);
        for (const o of off) {
          let fX = z[0] - o.oy * z[2];
          let fY = z[1] + o.ox * z[2];
          const mag = Math.hypot(fX, fY);
          if (mag > fmax) { fX *= fmax / mag; fY *= fmax / mag; }
          o.p.cmd = mag;
          wAch[0] += fX; wAch[1] += fY; wAch[2] += o.ox * fY - o.oy * fX;
        }
      } else {
        // not enough rotors to control all DOF — push along net thrust, accept spin
        for (const o of off) { o.p.cmd = fmax * 0.6; wAch[0] += o.ox === 0 ? 0 : 0; }
        wAch = [fx * 0.4, fy * 0.4, (api.rand() - 0.5) * 240];
      }
    }
    for (const p of w.parts) if (!p.alive) p.cmd = 0;

    const m = 1.2, I = 0.6;
    b.vx += (wAch[0] / m) * dt; b.vx *= (1 - 0.5 * dt);
    b.vy += (wAch[1] / m) * dt; b.vy *= (1 - 0.5 * dt);
    b.om += (wAch[2] / I) * dt; b.om *= (1 - 0.6 * dt); b.om = clamp(b.om, -6, 6);
    const sv = Math.hypot(b.vx, b.vy);
    if (sv > 90) { b.vx *= 90 / sv; b.vy *= 90 / sv; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // gentle visual facing toward travel direction
    const vmag = Math.hypot(b.vx, b.vy);
    if (vmag > 4) {
      const tt = Math.atan2(b.vy, b.vx);
      const e = Math.atan2(Math.sin(tt - b.th), Math.cos(tt - b.th));
      b.th += clamp(e, -1.6 * dt, 1.6 * dt);
    } else {
      b.th += b.om * dt;
    }
    b.x = clamp(b.x, 20, api.w - 20); b.y = clamp(b.y, 20, api.h - 20);

    const err = Math.hypot(ex, ey);
    const dwNorm = Math.hypot(wDes[0], wDes[1]) || 1;
    w.tracking = clamp(1 - err / (Math.min(api.w, api.h) * 0.6), 0, 1);
    w.stability = clamp(Math.hypot(wAch[0], wAch[1]) / dwNorm, 0, 1) * clamp(1 - Math.abs(b.om) / 6, 0, 1);
    if (err < 36) newTarget(api);
  }

  // ── Walker dynamics: gait re-phasing + support polygon ──
  function stepWalker(api, dt) {
    const w = api.custom;
    const b = w.body;
    const ex = w.target.x - b.x;
    const ey = w.target.y - b.y;
    const desiredHeading = Math.atan2(ey, ex);
    const dth = Math.atan2(Math.sin(desiredHeading - b.th), Math.cos(desiredHeading - b.th));
    b.th += clamp(dth, -2 * dt, 2 * dt) * (0.6 + api.state.attraction);

    const alive = w.parts.filter((p) => p.alive);
    const k = alive.length;
    w.phaseClock = (w.phaseClock + dt * (0.6 + api.state.speed * 0.5)) % 1;

    const stride = w.R * 1.4;
    const fwd = { x: Math.cos(b.th), y: Math.sin(b.th) };
    let stanceFeet = [];
    for (const p of w.parts) {
      const hx = b.x + Math.cos(b.th + p.angle) * w.R;
      const hy = b.y + Math.sin(b.th + p.angle) * w.R;
      p.hip = { x: hx, y: hy };
      if (!p.alive) {
        // limp: foot collapses toward the hip
        p.foot = { x: hx - fwd.x * 4, y: hy - fwd.y * 4 };
        p.stance = false;
        continue;
      }
      const phase = (w.phaseClock + p.offset) % 1;
      const inStance = phase < w.duty;
      if (inStance) {
        if (!p.stance) {
          // touchdown: plant just ahead of the hip so the support set stays
          // centred under the body (CoM inside the polygon)
          p.foot = { x: hx + fwd.x * stride * 0.15, y: hy + fwd.y * stride * 0.15 };
        }
        p.stance = true;
        stanceFeet.push(p.foot);
      } else {
        p.stance = false;
        const t = (phase - w.duty) / (1 - w.duty);
        p.foot = {
          x: hx + fwd.x * stride * (0.15 - (1 - t) * 0.4),
          y: hy + fwd.y * stride * (0.15 - (1 - t) * 0.4)
        };
      }
    }

    // statically stable when at least three feet are planted (and ideally the
    // CoM sits inside their convex hull)
    const enough = stanceFeet.length >= 3;
    const supported = enough && comInSupport(stanceFeet, { x: b.x, y: b.y });
    const traction = stanceFeet.length / Math.max(1, w.parts.length);
    const speed = (0.6 + api.state.count * 0.006) * 30 * traction * (enough ? 1 : 0.5);
    b.x += fwd.x * speed * dt; b.y += fwd.y * speed * dt;
    if (!enough) b.th += (api.rand() - 0.5) * 0.7 * dt; // wobble when under-supported
    b.x = clamp(b.x, 24, api.w - 24); b.y = clamp(b.y, 24, api.h - 24);

    w.supported = supported;
    w.stanceCount = stanceFeet.length;
    w.tracking = clamp(1 - Math.hypot(ex, ey) / (Math.min(api.w, api.h) * 0.6), 0, 1);
    w.stability = enough ? clamp((supported ? 0.8 : 0.62) + traction * 0.2, 0, 1) : stanceFeet.length === 2 ? 0.45 : 0.2;
    w.stanceFeet = stanceFeet;
    void k;
    if (Math.hypot(ex, ey) < 30) newTarget(api);
  }

  function autoDamage(api) {
    const w = api.custom;
    const alive = w.parts.filter((p) => p.alive);
    const minParts = isFlyer(api) ? 2 : 2;
    w.dmgTimer -= 1;
    if (w.dmgTimer <= 0) {
      w.dmgTimer = Math.round(clamp(420 - api.state.turbulence * 360, 90, 600));
      if (alive.length > minParts && api.rand() < 0.85) {
        damage(api, w.parts.indexOf(alive[Math.floor(api.rand() * alive.length)]), true);
      }
    }
    w.repairTimer -= 1;
    if (w.repairTimer <= 0) {
      w.repairTimer = 520;
      const dead = w.parts.filter((p) => !p.alive);
      if (dead.length) damage(api, w.parts.indexOf(dead[Math.floor(api.rand() * dead.length)]), false);
    }
    // pointer "shoots" a part it hovers over
    if (api.pointer && (w.killCd = (w.killCd || 0) - 1) <= 0) {
      let best = -1, bd = 18 * 18;
      w.parts.forEach((p, i) => {
        if (!p.alive || !p.viz) return;
        const d = (p.viz.x - api.pointer.x) ** 2 + (p.viz.y - api.pointer.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) { damage(api, best, true); w.killCd = 18; }
    }
  }

  function step(api) {
    const w = api.custom;
    const dt = clamp(0.4 + api.state.speed * 0.4, 0.2, 1.2) * 0.5;
    autoDamage(api);
    if (isFlyer(api)) stepFlyer(api, dt);
    else stepWalker(api, dt);
    if (w.adaptFlash > 0) w.adaptFlash -= 1;

    // sequence highlight: command(0) → allocate(1)/gait(2) → stability(4); adapt(3) flashes
    if (w.adaptFlash > 0) api.stage = 3;
    else {
      const seq = isFlyer(api) ? [0, 1, 4] : [0, 2, 4];
      api.stage = seq[Math.floor(api.frame / 26) % 3];
    }

    const aliveFrac = w.parts.filter((p) => p.alive).length / w.parts.length;
    api.push(clamp(w.tracking, 0, 1), aliveFrac, clamp(w.stability, 0, 1));
  }

  function drawFlyer(api) {
    const { ctx, custom: w } = api;
    const b = w.body;
    // arms + rotors
    for (let i = 0; i < w.parts.length; i++) {
      const p = w.parts[i];
      const x = b.x + Math.cos(b.th + p.angle) * w.R;
      const y = b.y + Math.sin(b.th + p.angle) * w.R;
      p.viz = { x, y };
      ctx.strokeStyle = p.alive ? "rgba(125,211,252,0.5)" : "rgba(248,113,113,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      const r = 13;
      if (p.alive) {
        const glow = clamp((p.cmd || 0) / 60, 0, 1);
        ctx.fillStyle = `rgba(96,165,250,${0.12 + glow * 0.3})`;
        ctx.beginPath(); ctx.arc(x, y, r + 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(147,197,253,0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        // spinning blade
        const sp = api.frame * (0.3 + glow);
        ctx.strokeStyle = "rgba(207,232,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(sp) * r, y + Math.sin(sp) * r);
        ctx.lineTo(x - Math.cos(sp) * r, y - Math.sin(sp) * r);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(40,18,24,0.9)";
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(248,113,113,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        // sparks
        for (let s = 0; s < 3; s++) {
          const a = api.rand() * TAU;
          ctx.strokeStyle = "rgba(251,191,36,0.7)";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * (r + api.rand() * 8), y + Math.sin(a) * (r + api.rand() * 8));
          ctx.stroke();
        }
      }
    }
    // body
    ctx.fillStyle = "rgba(20,24,34,0.95)";
    ctx.strokeStyle = "rgba(147,197,253,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(110,231,183,0.95)";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.th) * 22, b.y + Math.sin(b.th) * 22); ctx.stroke();
  }

  function drawWalker(api) {
    const { ctx, custom: w } = api;
    const b = w.body;
    // support polygon
    if (w.stanceFeet && w.stanceFeet.length >= 3) {
      const cx = w.stanceFeet.reduce((s, p) => s + p.x, 0) / w.stanceFeet.length;
      const cy = w.stanceFeet.reduce((s, p) => s + p.y, 0) / w.stanceFeet.length;
      const ord = [...w.stanceFeet].sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
      ctx.fillStyle = w.supported ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)";
      ctx.strokeStyle = w.supported ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ord.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // legs
    for (let i = 0; i < w.parts.length; i++) {
      const p = w.parts[i];
      if (!p.hip || !p.foot) continue;
      p.viz = { x: (p.hip.x + p.foot.x) / 2, y: (p.hip.y + p.foot.y) / 2 };
      ctx.strokeStyle = !p.alive ? "rgba(120,120,130,0.6)" : p.stance ? "rgba(110,231,183,0.95)" : "rgba(125,211,252,0.8)";
      ctx.lineWidth = !p.alive ? 2 : p.stance ? 4 : 2.5;
      ctx.beginPath(); ctx.moveTo(p.hip.x, p.hip.y); ctx.lineTo(p.foot.x, p.foot.y); ctx.stroke();
      ctx.fillStyle = !p.alive ? "rgba(120,120,130,0.7)" : p.stance ? "rgba(110,231,183,0.95)" : "rgba(125,211,252,0.5)";
      ctx.beginPath(); ctx.arc(p.foot.x, p.foot.y, p.stance ? 5 : 3.5, 0, TAU); ctx.fill();
    }
    // body + CoM
    ctx.fillStyle = "rgba(20,24,34,0.95)";
    ctx.strokeStyle = "rgba(147,197,253,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, 15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = w.supported ? "rgba(110,231,183,0.95)" : "rgba(248,113,113,0.95)";
    ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(110,231,183,0.8)";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.th) * 24, b.y + Math.sin(b.th) * 24); ctx.stroke();
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) {
      ctx.fillStyle = "rgba(7,7,13,0.16)";
      ctx.fillRect(0, 0, api.w, api.h);
    } else {
      ctx.fillStyle = "rgba(7,7,13,0.96)";
      ctx.fillRect(0, 0, api.w, api.h);
    }
    if (!w.parts) return;

    // target
    if (w.target) {
      const t = w.target;
      ctx.strokeStyle = "rgba(251,191,36,0.7)";
      ctx.lineWidth = 1.5;
      const pulse = 8 + Math.sin(api.frame * 0.1) * 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, pulse, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(t.x - 12, t.y); ctx.lineTo(t.x + 12, t.y);
      ctx.moveTo(t.x, t.y - 12); ctx.lineTo(t.x, t.y + 12); ctx.stroke();
    }

    if (isFlyer(api)) drawFlyer(api);
    else drawWalker(api);

    const alive = w.parts.filter((p) => p.alive).length;
    const down = w.parts.length - alive;
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const kind = isFlyer(api) ? "thrust re-allocation" : "gait re-phasing";
    ctx.fillText(`${api.state.variation} · ${alive}/${w.parts.length} ${w.partName}s · ${down ? kind : "nominal"}`, 14, 12);
    ctx.fillStyle = w.adaptFlash > 0 ? "rgba(251,191,36,0.95)" : "rgba(186,186,196,0.85)";
    ctx.font = "500 11px ui-monospace, monospace";
    ctx.fillText(`track ${(w.tracking * 100 | 0)}%   ·   stability ${(w.stability * 100 | 0)}%${w.adaptFlash > 0 ? "   ·   ADAPTING" : ""}`, 14, api.h - 22);
    ctx.fillStyle = "rgba(139,139,149,0.8)";
    ctx.fillText("hover a rotor/leg to disable it", 14, 30);
  }

  return createSimHarness(refs, {
    seedDefault: 2,
    firstVariation: "quadrotor",
    liveCount: true,
    usePointer: true,
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: {
      energy: (v) => `${Math.round(v * 100)}%`,
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      quadrotor: { count: 160, speed: 1.6, turbulence: 0.3, attraction: 0.5, trails: true },
      hexrotor: { count: 160, speed: 1.6, turbulence: 0.35, attraction: 0.5, trails: true },
      quadruped: { count: 150, speed: 1.5, turbulence: 0.3, attraction: 0.5, trails: true },
      hexapod: { count: 160, speed: 1.6, turbulence: 0.35, attraction: 0.5, trails: true }
    },
    reset(api) {
      const w = api.custom;
      const n = partCount(api);
      w.partName = isFlyer(api) ? "rotor" : "leg";
      w.R = Math.min(api.w, api.h) * 0.16;
      w.body = { x: api.w * 0.5, y: api.h * 0.5, vx: 0, vy: 0, th: 0, om: 0 };
      w.parts = Array.from({ length: n }, (_, i) => ({
        angle: (i / n) * TAU,
        alive: true,
        cmd: 0,
        offset: i / n,
        phase: i / n,
        stance: false,
        foot: null,
        hip: null
      }));
      w.phaseClock = 0;
      w.duty = 0.6;
      w.adaptFlash = 0;
      w.dmgTimer = 260;
      w.repairTimer = 520;
      w.tracking = 0;
      w.stability = 1;
      w.supported = true;
      newTarget(api);
      if (!isFlyer(api)) regait(api);
      api.log(`${api.state.variation} online · ${n} ${w.partName}s · patrolling.`);
    },
    step,
    draw
  });
}

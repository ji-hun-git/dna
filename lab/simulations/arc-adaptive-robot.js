/**
 * ARC Adaptive Unit (3D)
 *
 * An ARC-Raiders-style unit, rendered in 3D with an orbiting camera. Flying
 * drones and walking mechs patrol toward waypoints; shoot out a rotor or leg
 * (hover the cursor over it) or let parts fail, and the controller re-solves:
 *
 *   Flyers re-allocate rotor thrust (a lift/torque pseudo-inverse over the
 *   intact rotors), so the craft keeps hovering and tracking. Lose too many and
 *   it can no longer hold altitude and settles to the ground until repaired.
 *
 *   Walkers re-phase the gait over the legs that remain and keep the centre of
 *   mass above the support polygon, crouching and slowing as legs are lost.
 *
 * The math panel highlights the live control step and flashes the adaptation
 * term when a part breaks.
 */

import { createSimHarness, clamp, TAU, project3d } from "./_shared.js?v=20260615-lab2";

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

function rotY(x, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - z * s, z: x * s + z * c };
}

function hull2d(pts) {
  if (pts.length < 3) return pts.slice();
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  return [...pts].sort((p, q) => Math.atan2(p.z - cz, p.x - cx) - Math.atan2(q.z - cz, q.x - cx));
}

function pointInPoly(poly, x, z) {
  if (poly.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function mountArcRobot(refs) {
  const isFlyer = (api) => api.state.variation === "quadrotor" || api.state.variation === "hexrotor";
  const partCount = (api) => (api.state.variation === "hexrotor" || api.state.variation === "hexapod" ? 6 : 4);

  function camera(api) {
    return { yaw: api.frame * 0.004, pitch: 0.5, dist: 4.6, fov: Math.min(api.w, api.h) * 0.62 };
  }

  function newTarget(api) {
    const w = api.custom;
    if (isFlyer(api)) {
      w.target = { x: api.range(-1.2, 1.2), y: api.range(0.6, 1.5), z: api.range(-1.2, 1.2) };
    } else {
      w.target = { x: api.range(-1.3, 1.3), y: 0, z: api.range(-1.3, 1.3) };
    }
  }

  function regait(api) {
    const w = api.custom;
    const ok = w.parts.filter((p) => p.alive);
    const k = ok.length;
    w.duty = clamp(3.4 / w.parts.length + (w.parts.length - k) * 0.05, 0.5, 0.92);
    ok.forEach((p, i) => { p.offset = k > 0 ? (i % 2) * 0.5 + Math.floor(i / 2) / Math.max(1, k) : 0; });
  }

  function damage(api, idx, kill) {
    const w = api.custom;
    const p = w.parts[idx];
    if (!p) return;
    if (kill === false) {
      if (p.alive) return;
      p.alive = true;
      api.log(`${w.partName} ${idx + 1} repaired, re-optimizing.`);
    } else {
      if (!p.alive) return;
      p.alive = false;
      api.log(`${w.partName} ${idx + 1} destroyed, adapting control.`);
    }
    w.adaptFlash = 44;
    if (!isFlyer(api)) regait(api);
  }

  function autoDamage(api) {
    const w = api.custom;
    const alive = w.parts.filter((p) => p.alive);
    w.dmgTimer -= 1;
    if (w.dmgTimer <= 0) {
      w.dmgTimer = Math.round(clamp(440 - api.state.turbulence * 360, 100, 620));
      if (alive.length > 2 && api.rand() < 0.85) {
        damage(api, w.parts.indexOf(alive[Math.floor(api.rand() * alive.length)]), true);
      }
    }
    w.repairTimer -= 1;
    if (w.repairTimer <= 0) {
      w.repairTimer = 560;
      const dead = w.parts.filter((p) => !p.alive);
      if (dead.length) damage(api, w.parts.indexOf(dead[Math.floor(api.rand() * dead.length)]), false);
    }
    if (api.pointer && (w.killCd = (w.killCd || 0) - 1) <= 0) {
      let best = -1, bd = 22 * 22;
      w.parts.forEach((p, i) => {
        if (!p.alive || !p.screen) return;
        const d = (p.screen.x - api.pointer.x) ** 2 + (p.screen.y - api.pointer.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) { damage(api, best, true); w.killCd = 16; }
    }
  }

  // ── Flyer: 3D thrust allocation over intact rotors (per-frame) ──
  function stepFlyer(api) {
    const w = api.custom;
    const b = w.body;
    const spd = clamp(0.4 + api.state.speed * 0.5, 0.3, 1.4);
    const g = 0.004;
    const kp = 0.011 * (0.6 + api.state.attraction);
    const kd = 0.2;
    const fmax = 0.0075;

    // gravity-compensated PD command, then thrust direction
    const ax = kp * (w.target.x - b.x) - kd * b.vx;
    const ay = kp * (w.target.y - b.y) - kd * b.vy + g;
    const az = kp * (w.target.z - b.z) - kd * b.vz;
    const Treq = Math.hypot(ax, ay, az) || 1e-9;
    const nDir = { x: ax / Treq, y: ay / Treq, z: az / Treq };

    // allocate the required thrust over intact rotors with zero roll/pitch torque
    const alive = w.parts.filter((p) => p.alive);
    const k = alive.length;
    let Tach = 0;
    let yawTorque = 0;
    if (k >= 1) {
      let sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0;
      for (const p of alive) { sx += p.rx; sz += p.rz; sxx += p.rx * p.rx; szz += p.rz * p.rz; sxz += p.rx * p.rz; }
      const A = [k, sz, -sx, sz, szz, -sxz, -sx, -sxz, sxx];
      const Ai = inv3(A);
      let z0 = Treq / k, z1 = 0, z2 = 0;
      if (Ai) { z0 = Ai[0] * Treq; z1 = Ai[3] * Treq; z2 = Ai[6] * Treq; }
      for (const p of alive) {
        const u = clamp(z0 + z1 * p.rz - z2 * p.rx, 0, fmax);
        p.cmd = u;
        Tach += u;
        yawTorque += p.spin * u;
      }
    }
    for (const p of w.parts) if (!p.alive) p.cmd = 0;

    // integrate: achieved thrust along nDir, minus gravity
    b.vx += Tach * nDir.x * spd;
    b.vy += (Tach * nDir.y - g) * spd;
    b.vz += Tach * nDir.z * spd;
    b.vx *= 0.995; b.vy *= 0.995; b.vz *= 0.995;
    b.x += b.vx; b.y += b.vy; b.z += b.vz;
    if (b.y < 0.12) { b.y = 0.12; if (b.vy < 0) b.vy = 0; }
    b.x = clamp(b.x, -1.8, 1.8); b.z = clamp(b.z, -1.8, 1.8); b.y = clamp(b.y, 0.12, 2);

    // attitude: yaw drifts when rotor drag is unbalanced; tilt eases toward thrust dir
    b.yawRate = b.yawRate * 0.7 + yawTorque * 1.0; // low-pass: imbalance -> gentle yaw drift
    b.yawRate = clamp(b.yawRate, -0.05, 0.05);
    b.yaw += b.yawRate;
    b.roll = b.roll * 0.85 + Math.atan2(nDir.x, nDir.y) * 0.15;
    b.pitch = b.pitch * 0.85 + Math.atan2(nDir.z, nDir.y) * 0.15;

    const err = Math.hypot(w.target.x - b.x, w.target.y - b.y, w.target.z - b.z);
    w.tracking = clamp(1 - err / 2.6, 0, 1);
    w.stability = clamp(Tach / (Treq + 1e-6), 0, 1) * clamp(1 - Math.abs(b.yawRate) / 0.05, 0, 1);
    if (err < 0.32) newTarget(api);
  }

  // ── Walker: 3D gait re-phasing + ground support polygon (per-frame) ──
  function stepWalker(api) {
    const w = api.custom;
    const b = w.body;
    const spd = clamp(0.4 + api.state.speed * 0.5, 0.3, 1.4);
    const dx = w.target.x - b.x, dz = w.target.z - b.z;
    const want = Math.atan2(dx, dz);
    const dyaw = Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw));
    b.yaw += clamp(dyaw, -0.05, 0.05) * spd * (0.6 + api.state.attraction);

    const alive = w.parts.filter((p) => p.alive);
    const k = alive.length;
    w.phaseClock = (w.phaseClock + 0.013 * spd) % 1;
    const fwd = { x: Math.sin(b.yaw), z: Math.cos(b.yaw) };
    const stride = 0.5;
    const stance = [];
    for (const p of w.parts) {
      const off = rotY(p.bx, p.bz, b.yaw);
      p.hip = { x: b.x + off.x, y: b.h, z: b.z + off.z };
      if (!p.alive) { p.foot = { x: p.hip.x - fwd.x * 0.1, y: 0, z: p.hip.z - fwd.z * 0.1 }; p.stance = false; continue; }
      const phase = (w.phaseClock + p.offset) % 1;
      if (phase < w.duty) {
        if (!p.stance) p.foot = { x: p.hip.x + fwd.x * stride * 0.25, y: 0, z: p.hip.z + fwd.z * stride * 0.25 };
        p.stance = true;
        stance.push(p.foot);
      } else {
        p.stance = false;
        const t = (phase - w.duty) / (1 - w.duty);
        const lift = Math.sin(t * Math.PI) * 0.18;
        p.foot = { x: p.hip.x + fwd.x * stride * (0.25 - (1 - t) * 0.5), y: lift, z: p.hip.z + fwd.z * stride * (0.25 - (1 - t) * 0.5) };
      }
    }

    const enough = stance.length >= 3;
    const supported = enough && pointInPoly(hull2d(stance), b.x, b.z);
    const traction = stance.length / Math.max(1, w.parts.length);
    const speed = 0.02 * spd * (0.6 + api.state.count * 0.004) * traction * (enough ? 1 : 0.5);
    b.x += fwd.x * speed; b.z += fwd.z * speed;
    b.x = clamp(b.x, -1.6, 1.6); b.z = clamp(b.z, -1.6, 1.6);
    b.h = b.h * 0.9 + (0.34 + (k / w.parts.length) * 0.22) * 0.1; // crouch when legs are lost
    if (!enough) b.yaw += (api.rand() - 0.5) * 0.04 * spd;

    w.stanceFeet = stance;
    w.supported = supported;
    w.tracking = clamp(1 - Math.hypot(dx, dz) / 2.6, 0, 1);
    w.stability = enough ? clamp((supported ? 0.8 : 0.62) + traction * 0.2, 0, 1) : stance.length === 2 ? 0.45 : 0.2;
    if (Math.hypot(dx, dz) < 0.3) newTarget(api);
  }

  function step(api) {
    const w = api.custom;
    autoDamage(api);
    if (isFlyer(api)) stepFlyer(api);
    else stepWalker(api);
    if (w.adaptFlash > 0) w.adaptFlash -= 1;

    if (w.adaptFlash > 0) api.stage = 3;
    else {
      const seq = isFlyer(api) ? [0, 1, 4] : [0, 2, 4];
      api.stage = seq[Math.floor(api.frame / 26) % 3];
    }

    const aliveFrac = w.parts.filter((p) => p.alive).length / w.parts.length;
    api.push(clamp(w.tracking, 0, 1), aliveFrac, clamp(w.stability, 0, 1));
  }

  // ── rendering ──
  function drawGround(api, cam) {
    const { ctx } = api;
    ctx.strokeStyle = "rgba(96,165,250,0.12)";
    ctx.lineWidth = 1;
    const N = 8, S = 2;
    for (let i = -N; i <= N; i++) {
      const t = (i / N) * S;
      const a1 = project3d({ x: -S, y: 0, z: t }, cam, api.w, api.h);
      const a2 = project3d({ x: S, y: 0, z: t }, cam, api.w, api.h);
      const b1 = project3d({ x: t, y: 0, z: -S }, cam, api.w, api.h);
      const b2 = project3d({ x: t, y: 0, z: S }, cam, api.w, api.h);
      ctx.beginPath(); ctx.moveTo(a1.sx, a1.sy); ctx.lineTo(a2.sx, a2.sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b1.sx, b1.sy); ctx.lineTo(b2.sx, b2.sy); ctx.stroke();
    }
  }

  function drawTarget(api, cam) {
    const w = api.custom;
    if (!w.target) return;
    const p = project3d(w.target, cam, api.w, api.h);
    const g = project3d({ x: w.target.x, y: 0, z: w.target.z }, cam, api.w, api.h);
    api.ctx.strokeStyle = "rgba(251,191,36,0.55)";
    api.ctx.setLineDash([3, 5]);
    api.ctx.beginPath(); api.ctx.moveTo(p.sx, p.sy); api.ctx.lineTo(g.sx, g.sy); api.ctx.stroke();
    api.ctx.setLineDash([]);
    api.ctx.strokeStyle = "rgba(251,191,36,0.85)";
    api.ctx.lineWidth = 1.5;
    api.ctx.beginPath(); api.ctx.arc(p.sx, p.sy, 7 + Math.sin(api.frame * 0.1) * 2, 0, TAU); api.ctx.stroke();
  }

  function drawFlyer(api, cam) {
    const { ctx, custom: w } = api;
    const b = w.body;
    const bp = project3d(b, cam, api.w, api.h);
    // shadow
    const sh = project3d({ x: b.x, y: 0, z: b.z }, cam, api.w, api.h);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(sh.sx, sh.sy, 16 * bp.scale * 0.02 + 4, 5 * bp.scale * 0.02 + 2, 0, 0, TAU); ctx.fill();

    const items = [];
    for (let i = 0; i < w.parts.length; i++) {
      const p = w.parts[i];
      // rotor offset in body plane, yaw + slight tilt
      let o = rotY(p.rx, p.rz, b.yaw);
      const wy = b.y + o.x * Math.sin(b.pitch) + o.z * Math.sin(b.roll);
      const world = { x: b.x + o.x, y: wy, z: b.z + o.z };
      const sp = project3d(world, cam, api.w, api.h);
      p.screen = { x: sp.sx, y: sp.sy };
      items.push({ p, sp, world });
    }
    items.sort((a, c) => c.sp.depth - a.sp.depth);

    for (const { p, sp } of items) {
      // arm
      ctx.strokeStyle = p.alive ? "rgba(125,211,252,0.5)" : "rgba(248,113,113,0.4)";
      ctx.lineWidth = Math.max(1.5, sp.scale * 0.012);
      ctx.beginPath(); ctx.moveTo(bp.sx, bp.sy); ctx.lineTo(sp.sx, sp.sy); ctx.stroke();
      const r = clamp(sp.scale * 0.02, 5, 16);
      if (p.alive) {
        const glow = clamp((p.cmd || 0) / 0.0015, 0, 1);
        ctx.fillStyle = `rgba(96,165,250,${0.1 + glow * 0.3})`;
        ctx.beginPath(); ctx.ellipse(sp.sx, sp.sy, r * 1.3, r * 0.55, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(147,197,253,0.95)";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(sp.sx, sp.sy, r, r * 0.42, 0, 0, TAU); ctx.stroke();
        const a = api.frame * (0.3 + glow);
        ctx.strokeStyle = "rgba(207,232,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(sp.sx + Math.cos(a) * r, sp.sy + Math.sin(a) * r * 0.42);
        ctx.lineTo(sp.sx - Math.cos(a) * r, sp.sy - Math.sin(a) * r * 0.42);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(40,18,24,0.92)";
        ctx.beginPath(); ctx.ellipse(sp.sx, sp.sy, r, r * 0.42, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(248,113,113,0.8)";
        ctx.beginPath(); ctx.ellipse(sp.sx, sp.sy, r, r * 0.42, 0, 0, TAU); ctx.stroke();
        for (let s = 0; s < 3; s++) {
          const ang = api.rand() * TAU;
          ctx.strokeStyle = "rgba(251,191,36,0.7)";
          ctx.beginPath(); ctx.moveTo(sp.sx, sp.sy);
          ctx.lineTo(sp.sx + Math.cos(ang) * (r + api.rand() * 8), sp.sy + Math.sin(ang) * (r + api.rand() * 8));
          ctx.stroke();
        }
      }
    }
    // hub
    ctx.fillStyle = "rgba(20,24,34,0.96)";
    ctx.strokeStyle = "rgba(147,197,253,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bp.sx, bp.sy, clamp(bp.scale * 0.018, 6, 16), 0, TAU); ctx.fill(); ctx.stroke();
  }

  function drawWalker(api, cam) {
    const { ctx, custom: w } = api;
    const b = w.body;
    // support polygon on the ground
    if (w.stanceFeet && w.stanceFeet.length >= 3) {
      const poly = hull2d(w.stanceFeet).map((p) => project3d({ x: p.x, y: 0, z: p.z }, cam, api.w, api.h));
      ctx.fillStyle = w.supported ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";
      ctx.strokeStyle = w.supported ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const bp = project3d({ x: b.x, y: b.h, z: b.z }, cam, api.w, api.h);
    // legs (depth sorted by foot)
    const legs = w.parts.map((p) => ({ p, fp: project3d(p.foot, cam, api.w, api.h), hp: project3d(p.hip, cam, api.w, api.h) }))
      .sort((a, c) => c.fp.depth - a.fp.depth);
    for (const { p, fp, hp } of legs) {
      p.screen = { x: (fp.sx + hp.sx) / 2, y: (fp.sy + hp.sy) / 2 };
      ctx.strokeStyle = !p.alive ? "rgba(120,120,130,0.6)" : p.stance ? "rgba(110,231,183,0.95)" : "rgba(125,211,252,0.85)";
      ctx.lineWidth = !p.alive ? 2 : p.stance ? clamp(fp.scale * 0.016, 3, 6) : 2.4;
      ctx.beginPath(); ctx.moveTo(hp.sx, hp.sy); ctx.lineTo(fp.sx, fp.sy); ctx.stroke();
      ctx.fillStyle = !p.alive ? "rgba(120,120,130,0.7)" : p.stance ? "rgba(110,231,183,0.95)" : "rgba(125,211,252,0.6)";
      ctx.beginPath(); ctx.arc(fp.sx, fp.sy, clamp(fp.scale * 0.01, 3, 6), 0, TAU); ctx.fill();
    }
    // body
    ctx.fillStyle = "rgba(20,24,34,0.96)";
    ctx.strokeStyle = "rgba(147,197,253,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bp.sx, bp.sy, clamp(bp.scale * 0.02, 8, 18), 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = w.supported ? "rgba(110,231,183,0.95)" : "rgba(248,113,113,0.95)";
    ctx.beginPath(); ctx.arc(bp.sx, bp.sy, 4, 0, TAU); ctx.fill();
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) { ctx.fillStyle = "rgba(7,7,13,0.2)"; ctx.fillRect(0, 0, api.w, api.h); }
    else { ctx.fillStyle = "rgba(7,7,13,0.96)"; ctx.fillRect(0, 0, api.w, api.h); }
    if (!w.parts) return;
    const cam = camera(api);
    drawGround(api, cam);
    drawTarget(api, cam);
    if (isFlyer(api)) drawFlyer(api, cam);
    else drawWalker(api, cam);

    const alive = w.parts.filter((p) => p.alive).length;
    const down = w.parts.length - alive;
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const mode = isFlyer(api) ? "thrust re-allocation" : "gait re-phasing";
    ctx.fillText(`${api.state.variation} (3D) · ${alive}/${w.parts.length} ${w.partName}s · ${down ? mode : "nominal"}`, 14, 12);
    ctx.fillStyle = "rgba(139,139,149,0.85)";
    ctx.font = "500 11px ui-monospace, monospace";
    ctx.fillText("hover a rotor/leg to disable it", 14, 30);
    ctx.fillStyle = w.adaptFlash > 0 ? "rgba(251,191,36,0.95)" : "rgba(186,186,196,0.85)";
    ctx.fillText(`track ${(w.tracking * 100) | 0}%   stability ${(w.stability * 100) | 0}%${w.adaptFlash > 0 ? "   ADAPTING" : ""}`, 14, api.h - 22);
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
      quadruped: { count: 150, speed: 1.5, turbulence: 0.3, attraction: 0.5, trails: false },
      hexapod: { count: 160, speed: 1.6, turbulence: 0.35, attraction: 0.5, trails: false }
    },
    reset(api) {
      const w = api.custom;
      const n = partCount(api);
      const flyer = isFlyer(api);
      w.partName = flyer ? "rotor" : "leg";
      const R = 0.5;
      w.body = flyer
        ? { x: 0, y: 0.9, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, yawRate: 0, roll: 0, pitch: 0 }
        : { x: 0, z: 0, h: 0.5, yaw: 0 };
      w.parts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU;
        return {
          alive: true,
          cmd: 0,
          spin: i % 2 === 0 ? 1 : -1,
          rx: Math.cos(a) * R,
          rz: Math.sin(a) * R,
          bx: Math.cos(a) * R,
          bz: Math.sin(a) * R,
          offset: i / n,
          stance: false,
          foot: null,
          hip: null,
          screen: null
        };
      });
      w.phaseClock = 0;
      w.duty = 0.6;
      w.adaptFlash = 0;
      w.dmgTimer = 280;
      w.repairTimer = 560;
      w.tracking = 0;
      w.stability = 1;
      w.supported = true;
      w.stanceFeet = [];
      newTarget(api);
      if (!flyer) regait(api);
      api.log(`${api.state.variation} online (3D), ${n} ${w.partName}s, patrolling.`);
    },
    step,
    draw
  });
}

/**
 * Boids 3D - flocking in a bounded cube with an orbiting camera.
 *
 * Reynolds' three rules (separation, alignment, cohesion) in full 3D, projected
 * to the canvas with a hand-rolled pinhole camera (no external 3D library, so it
 * stays a single static file). Depth cues - size, alpha, draw order - sell the
 * volume. A "predator" variation adds a chaser the flock evades.
 */

import { createSimHarness, clamp, project3d } from "./_shared.js?v=20260615-lab2";

function clampMag(v, max) {
  const m = Math.hypot(v.x, v.y, v.z);
  if (m > max && m > 0) {
    const s = max / m;
    v.x *= s;
    v.y *= s;
    v.z *= s;
  }
  return v;
}

export function mountBoids3d(refs) {
  const BOUND = 1.0;

  function spawn(api) {
    return {
      x: api.range(-BOUND, BOUND),
      y: api.range(-BOUND, BOUND),
      z: api.range(-BOUND, BOUND),
      vx: api.range(-0.01, 0.01),
      vy: api.range(-0.01, 0.01),
      vz: api.range(-0.01, 0.01),
      hue: 190 + api.rand() * 120
    };
  }

  function step(api) {
    const w = api.custom;
    const maxSpeed = 0.006 + api.state.speed * 0.006;
    const maxForce = 0.0007;
    const percep = 0.55;
    const percepSq = percep * percep;
    const cohW = 0.6 + api.state.attraction * 2.0;
    const jitter = api.state.turbulence * 0.0016;
    const boids = w.boids;

    for (const b of boids) {
      let sx = 0, sy = 0, sz = 0;
      let ax = 0, ay = 0, az = 0;
      let cx = 0, cy = 0, cz = 0;
      let n = 0;
      for (const o of boids) {
        if (o === b) continue;
        const dx = b.x - o.x;
        const dy = b.y - o.y;
        const dz = b.z - o.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > percepSq || d2 === 0) continue;
        sx += dx / d2;
        sy += dy / d2;
        sz += dz / d2;
        ax += o.vx;
        ay += o.vy;
        az += o.vz;
        cx += o.x;
        cy += o.y;
        cz += o.z;
        n += 1;
      }
      let fx = 0, fy = 0, fz = 0;
      const steer = (dx, dy, dz, weight) => {
        const m = Math.hypot(dx, dy, dz);
        if (m === 0) return;
        let ddx = (dx / m) * maxSpeed - b.vx;
        let ddy = (dy / m) * maxSpeed - b.vy;
        let ddz = (dz / m) * maxSpeed - b.vz;
        const s = clampMag({ x: ddx, y: ddy, z: ddz }, maxForce);
        fx += s.x * weight;
        fy += s.y * weight;
        fz += s.z * weight;
      };
      if (n > 0) {
        steer(sx, sy, sz, 1.6);
        steer(ax / n, ay / n, az / n, 1.0);
        steer((cx / n) - b.x, (cy / n) - b.y, (cz / n) - b.z, cohW);
      }
      // predator avoidance / vortex
      if (w.predator) {
        const dx = b.x - w.predator.x;
        const dy = b.y - w.predator.y;
        const dz = b.z - w.predator.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.5) steer(dx, dy, dz, 3.2);
      }
      if (w.vortex) {
        fx += -b.z * 0.0008;
        fz += b.x * 0.0008;
      }
      // boundary containment
      if (b.x > BOUND) fx -= (b.x - BOUND) * 0.02;
      if (b.x < -BOUND) fx -= (b.x + BOUND) * 0.02;
      if (b.y > BOUND) fy -= (b.y - BOUND) * 0.02;
      if (b.y < -BOUND) fy -= (b.y + BOUND) * 0.02;
      if (b.z > BOUND) fz -= (b.z - BOUND) * 0.02;
      if (b.z < -BOUND) fz -= (b.z + BOUND) * 0.02;

      b.vx += fx + (api.rand() - 0.5) * jitter;
      b.vy += fy + (api.rand() - 0.5) * jitter;
      b.vz += fz + (api.rand() - 0.5) * jitter;
      const v = clampMag({ x: b.vx, y: b.vy, z: b.vz }, maxSpeed);
      b.vx = v.x;
      b.vy = v.y;
      b.vz = v.z;
      b.x += b.vx;
      b.y += b.vy;
      b.z += b.vz;
    }

    if (w.predator) {
      // chase flock centroid
      let mx = 0, my = 0, mz = 0;
      for (const b of boids) {
        mx += b.x;
        my += b.y;
        mz += b.z;
      }
      mx /= boids.length;
      my /= boids.length;
      mz /= boids.length;
      const p = w.predator;
      p.vx += (mx - p.x) * 0.002;
      p.vy += (my - p.y) * 0.002;
      p.vz += (mz - p.z) * 0.002;
      const v = clampMag({ x: p.vx, y: p.vy, z: p.vz }, maxSpeed * 1.05);
      p.vx = v.x;
      p.vy = v.y;
      p.vz = v.z;
      p.x = clamp(p.x + p.vx, -BOUND, BOUND);
      p.y = clamp(p.y + p.vy, -BOUND, BOUND);
      p.z = clamp(p.z + p.vz, -BOUND, BOUND);
    }

    // metrics
    let speedSum = 0;
    let vx = 0, vy = 0, vz = 0;
    let spreadSum = 0;
    for (const b of boids) {
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      speedSum += sp;
      if (sp > 0) {
        vx += b.vx / sp;
        vy += b.vy / sp;
        vz += b.vz / sp;
      }
      spreadSum += Math.hypot(b.x, b.y, b.z);
    }
    const n = boids.length;
    api.push(
      clamp((speedSum / n) / (maxSpeed * 1.2), 0, 1),
      clamp(Math.hypot(vx, vy, vz) / n, 0, 1),
      clamp(spreadSum / n / 1.4, 0, 1)
    );
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) {
      ctx.fillStyle = "rgba(7,7,13,0.22)";
      ctx.fillRect(0, 0, api.w, api.h);
    } else {
      ctx.fillStyle = "rgba(7,7,13,0.96)";
      ctx.fillRect(0, 0, api.w, api.h);
    }
    const cam = {
      yaw: api.frame * 0.004,
      pitch: 0.5,
      dist: 3.1,
      fov: Math.min(api.w, api.h) * 0.62
    };

    // cube edges
    const S = BOUND;
    const corners = [
      [-S, -S, -S], [S, -S, -S], [S, S, -S], [-S, S, -S],
      [-S, -S, S], [S, -S, S], [S, S, S], [-S, S, S]
    ].map((c) => project3d({ x: c[0], y: c[1], z: c[2] }, cam, api.w, api.h));
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(corners[a].sx, corners[a].sy);
      ctx.lineTo(corners[b].sx, corners[b].sy);
      ctx.stroke();
    }

    const drawList = w.boids
      .map((b) => ({ b, p: project3d(b, cam, api.w, api.h) }))
      .sort((a, b) => b.p.depth - a.p.depth);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const { b, p } of drawList) {
      const depthT = clamp((p.depth - (cam.dist - 1.4)) / 2.8, 0, 1);
      const r = clamp(p.scale * 0.016, 1, 6) * (1.2 - depthT * 0.5);
      const alpha = 0.85 - depthT * 0.5;
      // short velocity tail
      const tail = project3d(
        { x: b.x - b.vx * 12, y: b.y - b.vy * 12, z: b.z - b.vz * 12 },
        cam,
        api.w,
        api.h
      );
      ctx.strokeStyle = `hsla(${b.hue}, 85%, 68%, ${alpha * 0.6})`;
      ctx.lineWidth = r * 0.7;
      ctx.beginPath();
      ctx.moveTo(tail.sx, tail.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.stroke();
      ctx.fillStyle = `hsla(${b.hue}, 88%, 70%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (w.predator) {
      const p = project3d(w.predator, cam, api.w, api.h);
      ctx.fillStyle = "rgba(248,113,113,0.95)";
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, clamp(p.scale * 0.03, 4, 12), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${w.boids.length} boids · 3D · ${api.state.variation}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 24,
    firstVariation: "flock",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => v.toFixed(2),
      order: (v) => v.toFixed(2),
      spread: (v) => v.toFixed(2)
    },
    presets: {
      flock: { count: 180, speed: 1.7, turbulence: 0.18, attraction: 0.5, trails: true },
      scatter: { count: 200, speed: 2.1, turbulence: 0.5, attraction: 0.12, trails: true },
      predator: { count: 220, speed: 1.9, turbulence: 0.2, attraction: 0.6, trails: true },
      vortex: { count: 200, speed: 1.6, turbulence: 0.14, attraction: 0.45, trails: true }
    },
    reset(api) {
      const w = api.custom;
      const n = clamp(Math.round(api.state.count / 1.6), 50, 260);
      w.boids = Array.from({ length: n }, () => spawn(api));
      w.vortex = api.state.variation === "vortex";
      w.predator = api.state.variation === "predator" ? { ...spawn(api), x: 0, y: 0, z: 0 } : null;
      api.log(`${api.state.variation} · ${n} boids in a 3D cube.`);
    },
    step,
    draw
  });
}

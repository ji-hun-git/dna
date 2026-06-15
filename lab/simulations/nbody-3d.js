/**
 * N-Body Gravity 3D
 *
 * Softened Newtonian gravity integrated for a population of bodies, rendered with
 * the hand-rolled pinhole camera (no external 3D library). Orbits, clusters,
 * binaries, and colliding clouds - depth-sorted with motion trails.
 */

import { createSimHarness, clamp, project3d } from "./_shared.js?v=20260615-lab2";

const SOFT = 0.06; // softening length squared-ish, prevents singularities

export function mountNBody3d(refs) {
  function body(x, y, z, vx, vy, vz, m, hue) {
    return { x, y, z, vx, vy, vz, m, hue, trail: [] };
  }

  function build(api) {
    const w = api.custom;
    const variation = api.state.variation;
    const n = clamp(Math.round(api.state.count / 4), 24, 120);
    const spread = api.state.turbulence;
    w.G = 0.0006 + api.state.attraction * 0.0026;
    const bodies = [];

    const orbit = (M, count, rmin, rmax, hueBase) => {
      bodies.push(body(0, 0, 0, 0, 0, 0, M, 45));
      for (let i = 0; i < count; i++) {
        const r = rmin + api.rand() * (rmax - rmin);
        const a = api.rand() * Math.PI * 2;
        const incl = (api.rand() - 0.5) * 0.5;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = Math.sin(incl) * r * 0.3;
        const v = Math.sqrt((w.G * M) / r) * (0.85 + api.rand() * 0.3);
        // tangential velocity in xz-plane
        const vx = -Math.sin(a) * v;
        const vz = Math.cos(a) * v;
        bodies.push(body(x, y, z, vx + (api.rand() - 0.5) * spread * v * 0.3, (api.rand() - 0.5) * spread * 0.01, vz, 0.4 + api.rand(), hueBase + api.rand() * 60));
      }
    };

    if (variation === "orbits") {
      orbit(220, n - 1, 0.4, 1.3, 190);
    } else if (variation === "binary") {
      const M = 120;
      const sep = 0.5;
      const vorb = Math.sqrt((w.G * M) / (2 * sep)) * 1.0;
      bodies.push(body(-sep, 0, 0, 0, 0, vorb, M, 30));
      bodies.push(body(sep, 0, 0, 0, 0, -vorb, M, 280));
      for (let i = 0; i < n - 2; i++) {
        const r = 0.9 + api.rand() * 0.8;
        const a = api.rand() * Math.PI * 2;
        const v = Math.sqrt((w.G * 2 * M) / r) * (0.8 + api.rand() * 0.3);
        bodies.push(body(Math.cos(a) * r, (api.rand() - 0.5) * 0.3, Math.sin(a) * r, -Math.sin(a) * v, 0, Math.cos(a) * v, 0.4 + api.rand(), 190 + api.rand() * 60));
      }
    } else if (variation === "collision") {
      const make = (cx, vx, hue) => {
        for (let i = 0; i < (n / 2) | 0; i++) {
          const r = api.rand() * 0.45;
          const a = api.rand() * Math.PI * 2;
          const b = api.rand() * Math.PI;
          bodies.push(body(cx + r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a), vx, 0, 0, 0.6 + api.rand(), hue + api.rand() * 50));
        }
      };
      make(-1.1, 0.018, 200);
      make(1.1, -0.018, 30);
    } else {
      // cluster
      for (let i = 0; i < n; i++) {
        const r = api.rand() * 1.0;
        const a = api.rand() * Math.PI * 2;
        const b = api.rand() * Math.PI;
        const v = spread * 0.02;
        bodies.push(
          body(
            r * Math.sin(b) * Math.cos(a),
            r * Math.cos(b),
            r * Math.sin(b) * Math.sin(a),
            (api.rand() - 0.5) * v,
            (api.rand() - 0.5) * v,
            (api.rand() - 0.5) * v,
            0.5 + api.rand() * 1.2,
            200 + api.rand() * 90
          )
        );
      }
    }
    w.bodies = bodies;
  }

  function step(api) {
    const w = api.custom;
    const bodies = w.bodies;
    const dt = 0.4 + api.state.speed * 0.5;
    const G = w.G;
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      const bi = bodies[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const bj = bodies[j];
        const dx = bj.x - bi.x;
        const dy = bj.y - bi.y;
        const dz = bj.z - bi.z;
        const d2 = dx * dx + dy * dy + dz * dz + SOFT;
        const inv = 1 / (d2 * Math.sqrt(d2));
        const f = G * bj.m * inv;
        ax += dx * f;
        ay += dy * f;
        az += dz * f;
      }
      bi.ax = ax;
      bi.ay = ay;
      bi.az = az;
    }

    let ke = 0;
    let lz = 0;
    let rad = 0;
    for (const b of bodies) {
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      b.vz += b.az * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.trail.push({ x: b.x, y: b.y, z: b.z });
      if (b.trail.length > 22) b.trail.shift();
      const v2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
      ke += 0.5 * b.m * v2;
      lz += b.m * (b.x * b.vz - b.z * b.vx);
      rad += Math.hypot(b.x, b.y, b.z);
    }
    api.push(
      clamp(Math.sqrt(ke / n) * 0.25, 0, 1),
      clamp(Math.abs(lz) / (n * 0.6), 0, 1),
      clamp(rad / n / 2.2, 0, 1)
    );
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    if (api.state.trails) {
      ctx.fillStyle = "rgba(7,7,13,0.2)";
      ctx.fillRect(0, 0, api.w, api.h);
    } else {
      ctx.fillStyle = "rgba(7,7,13,0.96)";
      ctx.fillRect(0, 0, api.w, api.h);
    }
    const cam = { yaw: api.frame * 0.003, pitch: 0.45, dist: 4.2, fov: Math.min(api.w, api.h) * 0.62 };

    const drawList = w.bodies
      .map((b) => ({ b, p: project3d(b, cam, api.w, api.h) }))
      .sort((a, b) => b.p.depth - a.p.depth);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const { b, p } of drawList) {
      if (p.depth <= 0.1) continue;
      const depthT = clamp((p.depth - (cam.dist - 2)) / 4, 0, 1);
      const alpha = 0.85 - depthT * 0.5;
      if (api.state.trails && b.trail.length > 1) {
        ctx.strokeStyle = `hsla(${b.hue}, 80%, 66%, ${alpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        b.trail.forEach((t, k) => {
          const tp = project3d(t, cam, api.w, api.h);
          if (k === 0) ctx.moveTo(tp.sx, tp.sy);
          else ctx.lineTo(tp.sx, tp.sy);
        });
        ctx.stroke();
      }
      const r = clamp(p.scale * 0.01 * Math.cbrt(b.m), 1, 9);
      ctx.fillStyle = `hsla(${b.hue}, 85%, ${b.m > 50 ? 72 : 66}%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(245,245,247,0.9)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${w.bodies.length} bodies · 3D gravity · ${api.state.variation}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 17,
    firstVariation: "orbits",
    chartColors: ["rgba(251,191,36,0.95)", "rgba(96,165,250,0.95)", "rgba(167,139,250,0.95)"],
    metricFormat: {
      energy: (v) => v.toFixed(2),
      order: (v) => v.toFixed(2),
      spread: (v) => v.toFixed(2)
    },
    presets: {
      orbits: { count: 200, speed: 1.4, turbulence: 0.25, attraction: 0.5, trails: true },
      cluster: { count: 240, speed: 1.2, turbulence: 0.4, attraction: 0.55, trails: true },
      binary: { count: 200, speed: 1.3, turbulence: 0.3, attraction: 0.5, trails: true },
      collision: { count: 260, speed: 1.3, turbulence: 0.3, attraction: 0.5, trails: true }
    },
    reset(api) {
      build(api);
      api.log(`${api.state.variation} · ${api.custom.bodies.length} bodies · G ${api.custom.G.toFixed(4)}.`);
    },
    step,
    draw
  });
}

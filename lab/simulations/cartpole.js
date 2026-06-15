/**
 * CartPole Control — an ensemble of inverted-pendulum controllers.
 *
 * Each lane runs the classic cartpole dynamics under a PD (and, for swing-up, an
 * energy-pumping) controller. The slider set scales controller gain, disturbance
 * noise, simulation speed, and ensemble size, so you can watch a population of
 * controllers stabilize — or fail — together. Maps the "CartPole Balance" template.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const GRAV = 9.8;
const MC = 1.0; // cart mass
const DT = 0.02;

export function mountCartpole(refs) {
  function makeCart(api, i) {
    const swing = api.state.variation === "swingup";
    return {
      id: i,
      x: api.range(-0.4, 0.4),
      xdot: 0,
      theta: swing ? Math.PI + api.range(-0.2, 0.2) : api.range(-0.05, 0.05),
      thetadot: 0,
      fell: 0,
      uptime: 0
    };
  }

  function control(api, cart) {
    const w = api.custom;
    const gain = 0.4 + api.state.attraction * 2.2;
    // wrap theta into (-pi, pi], measured from upright (0 = up)
    let th = cart.theta;
    while (th > Math.PI) th -= 2 * Math.PI;
    while (th < -Math.PI) th += 2 * Math.PI;

    if (w.swing && Math.abs(th) > 0.45) {
      // energy-pumping swing-up
      const E = 0.5 * w.mp * w.l * w.l * cart.thetadot * cart.thetadot + w.mp * GRAV * w.l * Math.cos(th);
      const Edes = w.mp * GRAV * w.l;
      const u = clamp((E - Edes) * cart.thetadot * Math.cos(th) * -6, -w.fmax, w.fmax);
      return u;
    }
    // PD stabilization near upright
    let u = -(gain * (18 * th + 4 * cart.thetadot) + gain * (1.4 * cart.x + 1.8 * cart.xdot));
    return clamp(u, -w.fmax, w.fmax);
  }

  function integrate(api, cart) {
    const w = api.custom;
    let force = control(api, cart);
    force += (api.rand() - 0.5) * api.state.turbulence * w.wind;
    const ct = Math.cos(cart.theta);
    const st = Math.sin(cart.theta);
    const total = MC + w.mp;
    const temp = (force + w.mp * w.l * cart.thetadot * cart.thetadot * st) / total;
    const thetaacc = (GRAV * st - ct * temp) / (w.l * (4 / 3 - (w.mp * ct * ct) / total));
    const xacc = temp - (w.mp * w.l * thetaacc * ct) / total;
    cart.x += DT * cart.xdot;
    cart.xdot += DT * xacc;
    cart.theta += DT * cart.thetadot;
    cart.thetadot += DT * thetaacc;

    if (cart.x < -2.4 || cart.x > 2.4) {
      cart.fell += 1;
      w.falls += 1;
      const fresh = makeCart(api, cart.id);
      Object.assign(cart, fresh, { fell: cart.fell });
    }
    let th = cart.theta;
    while (th > Math.PI) th -= 2 * Math.PI;
    while (th < -Math.PI) th += 2 * Math.PI;
    if (Math.abs(th) < 0.21) cart.uptime += 1;
    else cart.uptime = Math.max(0, cart.uptime - 1);
  }

  function step(api) {
    const w = api.custom;
    const substeps = Math.max(1, Math.round(api.state.speed * 1.4));
    for (let s = 0; s < substeps; s++) {
      for (const c of w.carts) integrate(api, c);
    }
    let upright = 0;
    let balance = 0;
    let mean = 0;
    for (const c of w.carts) {
      let th = c.theta;
      while (th > Math.PI) th -= 2 * Math.PI;
      while (th < -Math.PI) th += 2 * Math.PI;
      if (Math.abs(th) < 0.21) upright += 1;
      balance += (Math.cos(c.theta) + 1) / 2;
      mean += c.x;
    }
    const n = w.carts.length;
    mean /= n;
    let varx = 0;
    for (const c of w.carts) varx += (c.x - mean) ** 2;
    const spread = clamp(Math.sqrt(varx / n) / 2.4, 0, 1);
    api.push(upright / n, balance / n, spread);
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = api.state.trails ? "rgba(7,7,13,0.34)" : "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.carts) return;
    const n = w.carts.length;
    const laneH = api.h / n;
    const cartW = clamp(laneH * 0.36, 16, 54);
    const poleLen = clamp(laneH * 0.42, 22, 90) * (w.l / 0.5);
    const pad = 26;
    const worldToX = (x) => pad + ((x + 2.4) / 4.8) * (api.w - pad * 2);

    for (let i = 0; i < n; i++) {
      const c = w.carts[i];
      const cy = laneH * (i + 0.5);
      const trackY = cy + laneH * 0.28;
      // track
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, trackY);
      ctx.lineTo(api.w - pad, trackY);
      ctx.stroke();
      // center target
      ctx.strokeStyle = "rgba(96,165,250,0.18)";
      ctx.beginPath();
      ctx.moveTo(worldToX(0), trackY - laneH * 0.4);
      ctx.lineTo(worldToX(0), trackY);
      ctx.stroke();

      let th = c.theta;
      while (th > Math.PI) th -= 2 * Math.PI;
      while (th < -Math.PI) th += 2 * Math.PI;
      const up = Math.abs(th) < 0.21;
      const cx = worldToX(c.x);
      // cart
      ctx.fillStyle = up ? "rgba(52,211,153,0.85)" : "rgba(96,165,250,0.7)";
      roundRect(ctx, cx - cartW / 2, trackY - laneH * 0.12, cartW, laneH * 0.16, 4);
      ctx.fill();
      // pole
      const px = cx + Math.sin(c.theta) * poleLen;
      const py = trackY - laneH * 0.12 - Math.cos(c.theta) * poleLen;
      ctx.strokeStyle = up ? "rgba(110,231,183,0.95)" : "rgba(244,114,182,0.9)";
      ctx.lineWidth = clamp(laneH * 0.05, 2, 5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, trackY - laneH * 0.12);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(px, py, clamp(laneH * 0.05, 2.5, 6), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${n} controllers  ·  falls ${w.falls}  ·  ${w.swing ? "swing-up" : "balance"}`, 14, 10);
  }

  return createSimHarness(refs, {
    seedDefault: 31,
    firstVariation: "balance",
    chartColors: ["rgba(52,211,153,0.95)", "rgba(96,165,250,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: {
      energy: (v) => `${Math.round(v * 100)}%`,
      order: (v) => v.toFixed(2),
      spread: (v) => v.toFixed(2)
    },
    presets: {
      balance: { count: 150, speed: 1.6, turbulence: 0.15, attraction: 0.55, trails: false },
      swingup: { count: 120, speed: 1.8, turbulence: 0.1, attraction: 0.6, trails: false },
      windy: { count: 180, speed: 1.6, turbulence: 0.7, attraction: 0.6, trails: false },
      heavy: { count: 150, speed: 1.5, turbulence: 0.2, attraction: 0.7, trails: false }
    },
    reset(api) {
      const w = api.custom;
      w.swing = api.state.variation === "swingup";
      w.mp = api.state.variation === "heavy" ? 0.3 : 0.1;
      w.l = api.state.variation === "heavy" ? 0.75 : 0.5;
      w.fmax = 14 + api.state.attraction * 12;
      w.wind = api.state.variation === "windy" ? 22 : 10;
      w.falls = 0;
      const n = clamp(Math.round(api.state.count / 24), 1, 12);
      w.carts = Array.from({ length: n }, (_, i) => makeCart(api, i));
      api.log(`${api.state.variation} · ${n} cartpole controllers (pole ${w.l.toFixed(2)} m).`);
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

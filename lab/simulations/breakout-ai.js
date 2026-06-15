/**
 * Breakout AI - a paddle agent that reads the bounce
 *
 * The paddle predicts where the ball will cross its line (reflecting off walls)
 * and slides to intercept, with a reaction lag and a little noise. It clears the
 * brick field, the ball speeds up, and the board resets when cleared or missed.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

export function mountBreakoutAI(refs) {
  function build(api) {
    const w = api.custom;
    const cols = clamp(Math.round(api.state.count / 18), 7, 16);
    const rows = clamp(Math.round(cols * 0.55), 4, 9);
    w.cols = cols; w.rows = rows;
    w.top = api.h * 0.1;
    w.brickW = api.w / cols;
    w.brickH = (api.h * 0.32) / rows;
    w.bricks = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) w.bricks.push({ c, r, alive: true });
    w.paddleW = api.w * 0.13;
    w.paddleX = api.w / 2;
    w.padY = api.h - 24;
    w.r = Math.max(4, api.h * 0.012);
    serve(api);
    w.cleared = 0; w.misses = 0; w.balls = 0;
  }

  function serve(api) {
    const w = api.custom;
    w.ball = { x: api.w / 2, y: api.h * 0.6, vx: (api.rand() < 0.5 ? -1 : 1) * (2 + api.state.speed), vy: 2 + api.state.speed };
    w.balls++;
  }

  function predict(api) {
    // simulate the ball forward (reflecting off side walls) to the paddle line
    const w = api.custom;
    let x = w.ball.x, y = w.ball.y, vx = w.ball.vx, vy = w.ball.vy;
    if (vy <= 0) return w.paddleX; // ball going up, hold
    let guard = 0;
    while (y < w.padY && guard++ < 2000) {
      x += vx; y += vy;
      if (x < w.r) { x = w.r; vx = -vx; }
      if (x > api.w - w.r) { x = api.w - w.r; vx = -vx; }
    }
    return x;
  }

  function step(api) {
    const w = api.custom;
    const sub = clamp(Math.round(api.state.speed * 1.5), 1, 4);
    for (let s = 0; s < sub; s++) {
      const b = w.ball;
      // AI paddle
      const aim = predict(api) + (api.rand() - 0.5) * (1 - api.state.attraction) * api.state.brickW * 0.0;
      const target = clamp(aim + (api.rand() - 0.5) * api.state.turbulence * 60, w.paddleW / 2, api.w - w.paddleW / 2);
      const react = 0.08 + api.state.attraction * 0.22;
      w.paddleX += (target - w.paddleX) * react;
      // ball
      b.x += b.vx; b.y += b.vy;
      if (b.x < w.r) { b.x = w.r; b.vx = -b.vx; }
      if (b.x > api.w - w.r) { b.x = api.w - w.r; b.vx = -b.vx; }
      if (b.y < w.top - w.brickH) { b.y = w.top - w.brickH; b.vy = -b.vy; }
      // bricks
      const cc = Math.floor(b.x / w.brickW);
      const rr = Math.floor((b.y - w.top) / w.brickH);
      const hit = w.bricks.find((k) => k.alive && k.c === cc && k.r === rr);
      if (hit) { hit.alive = false; w.cleared++; b.vy = -b.vy; }
      // paddle
      if (b.y > w.padY - w.r && b.y < w.padY + 6 && Math.abs(b.x - w.paddleX) < w.paddleW / 2 && b.vy > 0) {
        b.vy = -Math.abs(b.vy);
        b.vx += (b.x - w.paddleX) / (w.paddleW / 2) * 1.6;
      }
      if (b.y > api.h + 10) { w.misses++; serve(api); }
      if (!w.bricks.some((k) => k.alive)) { api.log(`Board cleared (${w.cleared} bricks).`); build(api); return; }
    }
    const total = w.cols * w.rows;
    const aliveB = w.bricks.filter((k) => k.alive).length;
    api.push(clamp(w.cleared / 80, 0, 1), clamp(w.balls / (w.misses + 1) / 6, 0, 1), clamp(1 - aliveB / total, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.96)";
    ctx.fillRect(0, 0, api.w, api.h);
    for (const k of w.bricks) {
      if (!k.alive) continue;
      ctx.fillStyle = `hsla(${200 + (k.r / w.rows) * 120}, 75%, 60%, 0.85)`;
      ctx.fillRect(k.c * w.brickW + 1, w.top + k.r * w.brickH + 1, w.brickW - 2, w.brickH - 2);
    }
    ctx.fillStyle = "rgba(245,245,247,0.95)";
    ctx.fillRect(w.paddleX - w.paddleW / 2, w.padY, w.paddleW, 7);
    ctx.fillStyle = "rgba(125,211,252,0.98)";
    ctx.beginPath(); ctx.arc(w.ball.x, w.ball.y, w.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`bricks ${w.cleared} - balls ${w.balls} - misses ${w.misses}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 81,
    firstVariation: "classic",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: { energy: (_v, api) => String(api.custom.cleared || 0), order: (v) => v.toFixed(2), spread: (v) => `${Math.round(v * 100)}%` },
    presets: {
      classic: { count: 200, speed: 1.6, turbulence: 0.15, attraction: 0.7, trails: false },
      wide: { count: 280, speed: 1.6, turbulence: 0.15, attraction: 0.7, trails: false },
      fast: { count: 200, speed: 2.6, turbulence: 0.2, attraction: 0.8, trails: false },
      shaky: { count: 200, speed: 1.8, turbulence: 0.6, attraction: 0.4, trails: false }
    },
    reset(api) { build(api); api.log(`${api.custom.cols}x${api.custom.rows} bricks - predictive paddle agent.`); },
    step,
    draw
  });
}

/**
 * Neuroevolution Flappy
 *
 * A population of birds, each driven by a tiny neural network, learns to play a
 * Flappy-style game by genetic algorithm. Every generation plays the same pipe
 * sequence; the fittest are selected, crossed over, and mutated into the next
 * generation. Watch the swarm get better — the chart is the learning curve.
 */

import { createSimHarness, clamp, mulberry32 } from "./_shared.js?v=20260615-lab2";

const IN = 4;
const H = 6;
const GENOME = IN * H + H + H + 1; // W1 + b1 + W2 + b2

function randomGenome(rand) {
  const g = new Float32Array(GENOME);
  for (let i = 0; i < GENOME; i++) g[i] = (rand() - 0.5) * 2;
  return g;
}

function think(genome, x, hbuf) {
  let p = 0;
  for (let h = 0; h < H; h++) {
    let sum = genome[IN * H + h]; // b1
    for (let i = 0; i < IN; i++) sum += genome[p++] * x[i];
    hbuf[h] = Math.tanh(sum);
  }
  let out = genome[IN * H + H + H]; // b2
  const w2 = IN * H + H;
  for (let h = 0; h < H; h++) out += genome[w2 + h] * hbuf[h];
  return 1 / (1 + Math.exp(-out));
}

export function mountNeuroFlappy(refs) {
  function crossover(a, b, rand) {
    const c = new Float32Array(GENOME);
    for (let i = 0; i < GENOME; i++) c[i] = rand() < 0.5 ? a[i] : b[i];
    return c;
  }
  function mutate(g, rate, rand) {
    for (let i = 0; i < GENOME; i++) {
      if (rand() < rate) g[i] += (rand() - 0.5) * 1.0;
    }
    return g;
  }

  function difficulty(api) {
    switch (api.state.variation) {
      case "easy": return { gap: 0.34, spacing: 0.62, speed: 2.1 };
      case "hard": return { gap: 0.22, spacing: 0.46, speed: 2.9 };
      case "insane": return { gap: 0.18, spacing: 0.4, speed: 3.4 };
      default: return { gap: 0.28, spacing: 0.54, speed: 2.5 };
    }
  }

  function resetGame(api) {
    const w = api.custom;
    w.pipeRand = mulberry32(1000 + w.gen);
    w.pipes = [];
    w.dist = 0;
    for (const b of w.birds) {
      b.y = api.h * 0.5;
      b.vy = 0;
      b.alive = true;
      b.score = 0;
      b.frames = 0;
    }
    w.aliveCount = w.birds.length;
  }

  function spawnPipe(api) {
    const w = api.custom;
    const d = w.diff;
    const margin = api.h * (d.gap / 2 + 0.08);
    const gapY = margin + w.pipeRand() * (api.h - margin * 2);
    w.pipes.push({ x: api.w + 40, gapY, passed: false });
  }

  function evolve(api) {
    const w = api.custom;
    w.birds.sort((a, b) => b.fitness - a.fitness);
    const best = w.birds[0].fitness;
    const meanFit = w.birds.reduce((s, b) => s + b.fitness, 0) / w.birds.length;
    w.bestEver = Math.max(w.bestEver, w.birds[0].score);
    w.history = w.history || [];
    w.history.push(best);

    const elite = Math.max(1, Math.round(w.birds.length * clamp(api.state.attraction, 0.05, 0.5)));
    const pool = w.birds.slice(0, Math.max(elite, Math.round(w.birds.length / 2)));
    const rate = clamp(api.state.turbulence * 0.6, 0.02, 0.7);
    const next = [];
    for (let i = 0; i < elite; i++) next.push({ genome: w.birds[i].genome.slice() });
    while (next.length < w.birds.length) {
      const pa = pool[Math.floor(api.rand() * pool.length)].genome;
      const pb = pool[Math.floor(api.rand() * pool.length)].genome;
      next.push({ genome: mutate(crossover(pa, pb, api.rand), rate, api.rand) });
    }
    w.birds = next.map((n) => ({ genome: n.genome, hbuf: new Float32Array(H), y: 0, vy: 0, alive: true, score: 0, frames: 0, fitness: 0 }));
    w.gen += 1;
    api.log(`Generation ${w.gen} · best score ${w.birds && w.bestEver} · last best fitness ${Math.round(best)}`);
    resetGame(api);
  }

  function tickGame(api) {
    const w = api.custom;
    const d = w.diff;
    const speed = d.speed * (0.6 + api.state.speed * 0.5);
    w.dist += speed;
    const spacingPx = api.w * d.spacing;
    if (!w.pipes.length || w.pipes[w.pipes.length - 1].x < api.w - spacingPx) spawnPipe(api);

    for (const p of w.pipes) p.x -= speed;
    while (w.pipes.length && w.pipes[0].x < -60) w.pipes.shift();

    const birdX = api.w * 0.26;
    const gapH = api.h * d.gap;
    // find next pipe ahead of the bird
    let next = null;
    for (const p of w.pipes) {
      if (p.x + 30 >= birdX) { next = p; break; }
    }
    const r = Math.max(5, api.h * 0.014);

    for (const b of w.birds) {
      if (!b.alive) continue;
      b.frames += 1;
      const gy = next ? next.gapY : api.h / 2;
      const nx = next ? next.x : api.w;
      const x = [b.y / api.h, clamp(b.vy / 10, -1, 1), clamp((nx - birdX) / api.w, 0, 1), (gy - b.y) / api.h];
      if (think(b.genome, x, b.hbuf) > 0.5) b.vy = -api.h * 0.0095;
      b.vy += api.h * 0.0006; // gravity
      b.y += b.vy;

      // collisions
      let dead = false;
      if (b.y < r || b.y > api.h - r) dead = true;
      if (next && b.x + r > next.x && birdX - r < next.x + 30) {
        if (b.y - r < next.gapY - gapH / 2 || b.y + r > next.gapY + gapH / 2) dead = true;
      }
      b.x = birdX;
      if (next && !next.passed && next.x + 30 < birdX) {
        // counted once globally below
      }
      if (dead) {
        b.alive = false;
        b.fitness = b.score * 1000 + b.frames;
        w.aliveCount -= 1;
      }
    }
    // scoring: when a pipe passes the bird line, award living birds
    for (const p of w.pipes) {
      if (!p.passed && p.x + 30 < birdX) {
        p.passed = true;
        for (const b of w.birds) if (b.alive) b.score += 1;
      }
    }

    if (w.aliveCount <= 0) evolve(api);
  }

  function step(api) {
    const w = api.custom;
    const sub = clamp(Math.round(1 + api.state.speed * 2), 1, 7);
    for (let i = 0; i < sub; i++) {
      if (w.aliveCount > 0) tickGame(api);
      else evolve(api);
    }
    const best = w.birds.reduce((m, b) => Math.max(m, b.score), 0);
    const mean = w.birds.reduce((s, b) => s + b.score, 0) / w.birds.length;
    api.push(clamp(mean / 12, 0, 1), clamp(best / 18, 0, 1), clamp(w.aliveCount / w.birds.length, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.birds) return;
    const d = w.diff;
    const gapH = api.h * d.gap;
    const birdX = api.w * 0.26;
    const r = Math.max(5, api.h * 0.014);

    for (const p of w.pipes) {
      ctx.fillStyle = "rgba(52,211,153,0.16)";
      ctx.strokeStyle = "rgba(52,211,153,0.45)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.x, 0, 30, p.gapY - gapH / 2);
      ctx.strokeRect(p.x, 0, 30, p.gapY - gapH / 2);
      ctx.fillRect(p.x, p.gapY + gapH / 2, 30, api.h - (p.gapY + gapH / 2));
      ctx.strokeRect(p.x, p.gapY + gapH / 2, 30, api.h - (p.gapY + gapH / 2));
    }

    let bestBird = null;
    for (const b of w.birds) if (b.alive && (!bestBird || b.score > bestBird.score)) bestBird = b;
    for (const b of w.birds) {
      if (!b.alive) continue;
      const isBest = b === bestBird;
      ctx.fillStyle = isBest ? "rgba(251,191,36,0.95)" : "rgba(147,197,253,0.35)";
      ctx.beginPath();
      ctx.arc(birdX, b.y, isBest ? r * 1.2 : r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`gen ${w.gen} · alive ${w.aliveCount}/${w.birds.length} · best ever ${w.bestEver}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 3,
    firstVariation: "normal",
    chartColors: ["rgba(96,165,250,0.95)", "rgba(251,191,36,0.95)", "rgba(52,211,153,0.95)"],
    metricFormat: {
      energy: (v) => (v * 12).toFixed(1),
      order: (_v, api) => String(api.custom.bestEver || 0),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      easy: { count: 160, speed: 1.8, turbulence: 0.2, attraction: 0.15, trails: true },
      normal: { count: 180, speed: 2.0, turbulence: 0.25, attraction: 0.15, trails: true },
      hard: { count: 220, speed: 2.2, turbulence: 0.3, attraction: 0.12, trails: true },
      insane: { count: 260, speed: 2.4, turbulence: 0.35, attraction: 0.1, trails: true }
    },
    reset(api) {
      const w = api.custom;
      w.diff = difficulty(api);
      w.gen = 1;
      w.bestEver = 0;
      w.history = [];
      const n = clamp(Math.round(api.state.count), 60, 320);
      w.birds = Array.from({ length: n }, () => ({
        genome: randomGenome(api.rand),
        hbuf: new Float32Array(H),
        y: 0, vy: 0, alive: true, score: 0, frames: 0, fitness: 0
      }));
      resetGame(api);
      api.log(`${api.state.variation} · ${n} birds, random brains · evolving.`);
    },
    step,
    draw
  });
}

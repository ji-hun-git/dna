const TAU = Math.PI * 2;

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function metricLine(ctx, values, color, height, width) {
  if (values.length < 2) return;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - clamp(value, 0, 1) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function mountAgentArena({ canvas, chartCanvas, controls, metrics, log }) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const chartCtx = chartCanvas.getContext("2d", { alpha: true });
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let frame = 0;
  let running = !prefersReduced;
  let random = mulberry32(91);
  let resizeObserver = null;
  let agents = [];
  let goals = [];
  let obstacles = [];
  let visited = new Set();
  let captures = 0;
  let rewards = 0;

  const state = {
    count: Number(controls.count.value),
    speed: Number(controls.speed.value),
    turbulence: Number(controls.turbulence.value),
    attraction: Number(controls.attraction.value),
    trails: controls.trails.checked,
    seed: Number(controls.seed.value) || 91,
    variation: controls.variationButtons[0]?.dataset.variation || "pursuit"
  };

  const presets = {
    pursuit: { count: 164, speed: 1.8, turbulence: 0.22, attraction: 0.34, trails: true },
    evasion: { count: 192, speed: 2.15, turbulence: 0.4, attraction: 0.58, trails: true },
    patrol: { count: 132, speed: 1.45, turbulence: 0.18, attraction: 0.24, trails: true },
    pressure: { count: 220, speed: 1.95, turbulence: 0.28, attraction: 0.46, trails: true }
  };

  const history = {
    energy: [],
    order: [],
    spread: []
  };

  function writeLog(message) {
    const line = document.createElement("li");
    line.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - ${message}`;
    log.prepend(line);
    while (log.children.length > 5) log.lastElementChild.remove();
  }

  function syncLabels() {
    controls.countValue.textContent = String(state.count);
    controls.speedValue.textContent = state.speed.toFixed(2);
    controls.turbulenceValue.textContent = state.turbulence.toFixed(2);
    controls.attractionValue.textContent = state.attraction.toFixed(2);
    controls.seedValue.textContent = String(state.seed);
    controls.pause.textContent = running ? "Pause" : "Run";
    controls.pause.setAttribute("aria-pressed", running ? "false" : "true");
    controls.variationButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.variation === state.variation);
    });
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(260, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const chartRect = chartCanvas.parentElement.getBoundingClientRect();
    const chartWidth = Math.max(260, chartRect.width);
    const chartHeight = 220;
    chartCanvas.width = Math.floor(chartWidth * dpr);
    chartCanvas.height = Math.floor(chartHeight * dpr);
    chartCanvas.style.width = `${chartWidth}px`;
    chartCanvas.style.height = `${chartHeight}px`;
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomPoint(margin = 26) {
    return {
      x: margin + random() * Math.max(1, width - margin * 2),
      y: margin + random() * Math.max(1, height - margin * 2)
    };
  }

  function resetWorld() {
    random = mulberry32(state.seed);
    frame = 0;
    captures = 0;
    rewards = 0;
    visited = new Set();
    history.energy.length = 0;
    history.order.length = 0;
    history.spread.length = 0;

    const runnerCount = clamp(Math.round(state.count / 16), 5, 22);
    const seekerCount = clamp(Math.round(state.count / 48), 2, 8);
    const obstacleCount = state.variation === "evasion" ? 7 : state.variation === "pressure" ? 3 : 5;

    goals = Array.from({ length: 4 }, () => ({ ...randomPoint(42), pulse: random() * TAU }));
    obstacles = Array.from({ length: obstacleCount }, () => ({
      ...randomPoint(64),
      r: 20 + random() * 26
    }));

    agents = [
      ...Array.from({ length: runnerCount }, (_, index) => ({
        kind: "runner",
        ...randomPoint(),
        vx: 0,
        vy: 0,
        phase: random() * TAU,
        trail: [],
        id: index
      })),
      ...Array.from({ length: seekerCount }, (_, index) => ({
        kind: "seeker",
        ...randomPoint(),
        vx: 0,
        vy: 0,
        phase: random() * TAU,
        anchor: {
          x: width * (0.18 + (index % 4) * 0.22),
          y: height * (index % 2 ? 0.78 : 0.22)
        },
        trail: [],
        id: index
      }))
    ];

    ctx.clearRect(0, 0, width, height);
    writeLog(`${state.variation} policy loaded with ${runnerCount} runners and ${seekerCount} seekers.`);
  }

  function avoidObstacles(agent, force) {
    for (const obstacle of obstacles) {
      const dx = agent.x - obstacle.x;
      const dy = agent.y - obstacle.y;
      const d = Math.hypot(dx, dy);
      if (d < obstacle.r + 34) {
        const n = normalize(dx, dy);
        force.x += n.x * (1 - d / (obstacle.r + 34)) * 1.7;
        force.y += n.y * (1 - d / (obstacle.r + 34)) * 1.7;
      }
    }
  }

  function steer(agent, force, maxSpeed) {
    const n = normalize(force.x, force.y);
    const noise = (random() - 0.5) * state.turbulence;
    const angle = Math.atan2(n.y, n.x) + noise;
    const targetVX = Math.cos(angle) * maxSpeed;
    const targetVY = Math.sin(angle) * maxSpeed;
    agent.vx = agent.vx * 0.82 + targetVX * 0.18;
    agent.vy = agent.vy * 0.82 + targetVY * 0.18;
    agent.x += agent.vx;
    agent.y += agent.vy;

    if (agent.x < 12 || agent.x > width - 12) agent.vx *= -0.8;
    if (agent.y < 12 || agent.y > height - 12) agent.vy *= -0.8;
    agent.x = clamp(agent.x, 12, width - 12);
    agent.y = clamp(agent.y, 12, height - 12);

    agent.trail.push({ x: agent.x, y: agent.y });
    if (agent.trail.length > 38) agent.trail.shift();
  }

  function nearest(agent, candidates) {
    let best = candidates[0];
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const d = Math.hypot(candidate.x - agent.x, candidate.y - agent.y);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    return { target: best, distance: bestDistance };
  }

  function update() {
    frame += 1;
    const runners = agents.filter((agent) => agent.kind === "runner");
    const seekers = agents.filter((agent) => agent.kind === "seeker");
    const center = {
      x: runners.reduce((sum, agent) => sum + agent.x, 0) / Math.max(1, runners.length),
      y: runners.reduce((sum, agent) => sum + agent.y, 0) / Math.max(1, runners.length)
    };

    for (const runner of runners) {
      const nearestSeeker = nearest(runner, seekers);
      const nearestGoal = nearest(runner, goals);
      const flee = normalize(runner.x - nearestSeeker.target.x, runner.y - nearestSeeker.target.y);
      const goal = normalize(nearestGoal.target.x - runner.x, nearestGoal.target.y - runner.y);
      const safetyWeight = state.variation === "evasion" ? 2.2 : state.variation === "pressure" ? 1.4 : 1.7;
      const goalWeight = 0.35 + state.attraction * 1.6;
      const force = {
        x: flee.x * safetyWeight + goal.x * goalWeight,
        y: flee.y * safetyWeight + goal.y * goalWeight
      };
      avoidObstacles(runner, force);
      steer(runner, force, state.speed * 1.08);

      if (nearestGoal.distance < 18) {
        rewards += 1;
        Object.assign(nearestGoal.target, randomPoint(42), { pulse: random() * TAU });
      }
    }

    for (const seeker of seekers) {
      const nearestRunner = nearest(seeker, runners);
      let force = normalize(nearestRunner.target.x - seeker.x, nearestRunner.target.y - seeker.y);
      if (state.variation === "patrol" && nearestRunner.distance > 130) {
        force = normalize(seeker.anchor.x - seeker.x, seeker.anchor.y - seeker.y);
      }
      if (state.variation === "pressure") {
        const centerBias = normalize(center.x - seeker.x, center.y - seeker.y);
        force.x = force.x * 0.72 + centerBias.x * 0.58;
        force.y = force.y * 0.72 + centerBias.y * 0.58;
      }
      avoidObstacles(seeker, force);
      steer(seeker, force, state.speed * (state.variation === "pursuit" ? 1.12 : 0.96));

      if (nearestRunner.distance < 13) {
        captures += 1;
        rewards -= 0.35;
        Object.assign(nearestRunner.target, randomPoint(), { vx: 0, vy: 0, trail: [] });
        if (captures % 5 === 0) writeLog(`Capture ${captures}: seeker policy is applying pressure.`);
      }
    }

    for (const agent of agents) {
      const gx = Math.floor((agent.x / width) * 24);
      const gy = Math.floor((agent.y / height) * 18);
      visited.add(`${gx}:${gy}`);
    }

    const rewardSignal = clamp((rewards + 8) / 24, 0, 1);
    const captureSignal = clamp(captures / 42, 0, 1);
    const coverageSignal = clamp(visited.size / (24 * 18), 0, 1);
    history.energy.push(rewardSignal);
    history.order.push(captureSignal);
    history.spread.push(coverageSignal);
    for (const key of Object.keys(history)) {
      if (history[key].length > 96) history[key].shift();
    }
  }

  function draw() {
    ctx.fillStyle = state.trails ? "rgba(5, 8, 13, 0.2)" : "rgba(5, 8, 13, 0.96)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    const step = 36;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 147, 199, 0.09)";
    ctx.strokeStyle = "rgba(255, 147, 199, 0.22)";
    for (const obstacle of obstacles) {
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    for (const goal of goals) {
      const pulse = 1 + Math.sin(frame * 0.05 + goal.pulse) * 0.18;
      ctx.strokeStyle = "rgba(126, 231, 189, 0.55)";
      ctx.fillStyle = "rgba(126, 231, 189, 0.12)";
      ctx.beginPath();
      ctx.arc(goal.x, goal.y, 13 * pulse, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    if (state.trails) {
      for (const agent of agents) {
        ctx.beginPath();
        agent.trail.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = agent.kind === "runner" ? "rgba(120, 210, 255, 0.22)" : "rgba(246, 211, 107, 0.2)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    for (const agent of agents) {
      const isRunner = agent.kind === "runner";
      ctx.fillStyle = isRunner ? "rgba(120, 210, 255, 0.92)" : "rgba(246, 211, 107, 0.94)";
      ctx.strokeStyle = isRunner ? "rgba(120, 210, 255, 0.28)" : "rgba(246, 211, 107, 0.28)";
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, isRunner ? 4.2 : 5.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, isRunner ? 10 : 13, 0, TAU);
      ctx.stroke();
    }
  }

  function drawChart() {
    const rect = chartCanvas.getBoundingClientRect();
    const chartW = rect.width;
    const chartH = rect.height;
    chartCtx.clearRect(0, 0, chartW, chartH);
    chartCtx.fillStyle = "rgba(8, 11, 18, 0.72)";
    chartCtx.fillRect(0, 0, chartW, chartH);
    chartCtx.strokeStyle = "rgba(255,255,255,0.07)";
    for (let i = 1; i < 4; i++) {
      const y = (chartH / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(chartW, y);
      chartCtx.stroke();
    }
    metricLine(chartCtx, history.energy, "rgba(126, 231, 189, 0.95)", chartH, chartW);
    metricLine(chartCtx, history.order, "rgba(246, 211, 107, 0.95)", chartH, chartW);
    metricLine(chartCtx, history.spread, "rgba(120, 210, 255, 0.95)", chartH, chartW);
  }

  function updateMetrics() {
    const last = (key) => history[key][history[key].length - 1] || 0;
    metrics.energy.textContent = Math.round(last("energy") * 100);
    metrics.order.textContent = Math.round(last("order") * 100) + "%";
    metrics.spread.textContent = Math.round(last("spread") * 100) + "%";
    metrics.fps.textContent = running ? "60" : "0";
  }

  function loop() {
    if (running && !document.hidden) {
      update();
      draw();
      if (frame % 2 === 0) drawChart();
      if (frame % 8 === 0) updateMetrics();
    }
    raf = requestAnimationFrame(loop);
  }

  function applyControl(event) {
    const target = event.currentTarget;
    if (target === controls.trails) {
      state.trails = controls.trails.checked;
      syncLabels();
      return;
    }
    if (target === controls.seed) {
      state.seed = Number(controls.seed.value) || 91;
      syncLabels();
      return;
    }
    state[target.name] = Number(target.value);
    syncLabels();
    if (target.name === "count") resetWorld();
  }

  function randomizeSeed() {
    state.seed = Math.floor(Math.random() * 90000) + 10000;
    controls.seed.value = String(state.seed);
    syncLabels();
    resetWorld();
  }

  function setVariation(name) {
    state.variation = name;
    Object.assign(state, presets[name] || presets.pursuit);
    controls.count.value = state.count;
    controls.speed.value = state.speed;
    controls.turbulence.value = state.turbulence;
    controls.attraction.value = state.attraction;
    controls.trails.checked = state.trails;
    syncLabels();
    resetWorld();
  }

  controls.count.addEventListener("input", applyControl);
  controls.speed.addEventListener("input", applyControl);
  controls.turbulence.addEventListener("input", applyControl);
  controls.attraction.addEventListener("input", applyControl);
  controls.seed.addEventListener("change", applyControl);
  controls.trails.addEventListener("change", applyControl);
  controls.randomize.addEventListener("click", randomizeSeed);
  controls.reset.addEventListener("click", resetWorld);
  controls.pause.addEventListener("click", () => {
    running = !running;
    syncLabels();
    writeLog(running ? "Arena resumed." : "Arena paused.");
  });
  const variationClick = (event) => setVariation(event.currentTarget.dataset.variation);
  controls.variationButtons.forEach((button) => button.addEventListener("click", variationClick));

  resizeObserver = new ResizeObserver(() => {
    resize();
    resetWorld();
  });
  resizeObserver.observe(canvas.parentElement);
  resizeObserver.observe(chartCanvas.parentElement);
  syncLabels();
  resize();
  resetWorld();
  draw();
  drawChart();
  updateMetrics();
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      controls.count.removeEventListener("input", applyControl);
      controls.speed.removeEventListener("input", applyControl);
      controls.turbulence.removeEventListener("input", applyControl);
      controls.attraction.removeEventListener("input", applyControl);
      controls.seed.removeEventListener("change", applyControl);
      controls.trails.removeEventListener("change", applyControl);
      controls.randomize.removeEventListener("click", randomizeSeed);
      controls.reset.removeEventListener("click", resetWorld);
      controls.variationButtons.forEach((button) => button.removeEventListener("click", variationClick));
    }
  };
}

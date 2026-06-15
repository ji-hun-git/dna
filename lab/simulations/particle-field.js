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

function metricLine(ctx, values, color, yScale, height, width) {
  if (values.length < 2) return;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - yScale(value) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function mountParticleField({ canvas, chartCanvas, controls, metrics, log }) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const chartCtx = chartCanvas.getContext("2d", { alpha: true });
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let frame = 0;
  let running = !prefersReduced;
  let pointer = null;
  let resizeObserver = null;
  let random = mulberry32(42);
  let particles = [];
  const history = {
    energy: [],
    order: [],
    spread: []
  };

  const state = {
    count: Number(controls.count.value),
    speed: Number(controls.speed.value),
    turbulence: Number(controls.turbulence.value),
    attraction: Number(controls.attraction.value),
    trails: controls.trails.checked,
    seed: Number(controls.seed.value) || 42,
    variation: controls.variationButtons[0]?.dataset.variation || "calm"
  };

  const presets = {
    calm: { count: 140, speed: 1.3, turbulence: 0.18, attraction: 0.18, trails: true },
    swarm: { count: 260, speed: 2.2, turbulence: 0.55, attraction: 0.38, trails: true },
    trace: { count: 190, speed: 1.75, turbulence: 0.32, attraction: 0.08, trails: true },
    vortex: { count: 220, speed: 1.55, turbulence: 0.2, attraction: 0.28, trails: true },
    comet: { count: 180, speed: 2.65, turbulence: 0.14, attraction: 0.18, trails: true },
    lattice: { count: 156, speed: 1.45, turbulence: 0.08, attraction: 0.12, trails: false }
  };

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

  function resetParticles() {
    random = mulberry32(state.seed);
    particles = Array.from({ length: state.count }, (_, index) => {
      const x = random() * width;
      const y = random() * height;
      const angle = random() * TAU;
      return {
        id: index,
        x,
        y,
        vx: Math.cos(angle) * state.speed,
        vy: Math.sin(angle) * state.speed,
        phase: random() * TAU,
        mass: 0.75 + random() * 0.8,
        hue: state.variation === "comet"
          ? 24 + random() * 46
          : state.variation === "lattice"
            ? 160 + (index % 6) * 20
            : 185 + random() * 145
      };
    });
    history.energy.length = 0;
    history.order.length = 0;
    history.spread.length = 0;
    frame = 0;
    ctx.clearRect(0, 0, width, height);
    writeLog(`${state.variation} variation loaded: seed ${state.seed}, ${state.count} agents.`);
  }

  function writeLog(message) {
    const line = document.createElement("li");
    line.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - ${message}`;
    log.prepend(line);
    while (log.children.length > 5) log.lastElementChild.remove();
  }

  function fieldAt(x, y, t, phase) {
    const nx = x / width - 0.5;
    const ny = y / height - 0.5;
    const swirl = Math.atan2(ny, nx) + Math.PI / 2;
    const wave =
      Math.sin(nx * 7.2 + t * 0.018 + phase) +
      Math.cos(ny * 6.4 - t * 0.014) +
      Math.sin((nx + ny) * 4.4 + t * 0.012);
    if (state.variation === "vortex") {
      const ring = Math.sin(Math.hypot(nx, ny) * 18 - t * 0.025 + phase);
      return swirl + ring * 0.42;
    }
    if (state.variation === "comet") {
      return -0.08 + Math.sin(ny * 8 + t * 0.02 + phase) * 0.22 + nx * 0.35;
    }
    if (state.variation === "lattice") {
      const quantized = Math.round((swirl + wave * 0.25) / (Math.PI / 4)) * (Math.PI / 4);
      return quantized;
    }
    if (state.variation === "trace") {
      return swirl * 0.36 + wave * 0.9;
    }
    if (state.variation === "swarm") {
      return swirl * 0.72 + wave * 0.88 + Math.sin(t * 0.01 + phase) * 0.18;
    }
    return swirl * 0.58 + wave * 0.72;
  }

  function update() {
    const t = frame++;
    const cx = width / 2;
    const cy = height / 2;
    const centerPull = state.variation === "comet" ? 0.0004 : state.variation === "vortex" ? 0.0024 : 0.0015;
    let energy = 0;
    let orderX = 0;
    let orderY = 0;
    let spread = 0;

    for (const p of particles) {
      let angle = fieldAt(p.x, p.y, t, p.phase);
      angle += (random() - 0.5) * state.turbulence;

      if (pointer && state.attraction > 0) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const pointerAngle = Math.atan2(dy, dx);
        angle = angle * (1 - state.attraction) + pointerAngle * state.attraction;
      }

      const targetVX = Math.cos(angle) * state.speed * p.mass;
      const targetVY = Math.sin(angle) * state.speed * p.mass;
      const inertia = state.variation === "lattice" ? 0.78 : state.variation === "comet" ? 0.92 : 0.88;
      const response = 1 - inertia;
      p.vx = p.vx * inertia + targetVX * response + (cx - p.x) * centerPull;
      p.vy = p.vy * inertia + targetVY * response + (cy - p.y) * centerPull;
      if (state.variation === "comet") p.vx += 0.018 * state.speed;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x += width;
      if (p.x > width) p.x -= width;
      if (p.y < 0) p.y += height;
      if (p.y > height) p.y -= height;

      const v = Math.hypot(p.vx, p.vy);
      energy += v;
      orderX += p.vx / Math.max(0.001, v);
      orderY += p.vy / Math.max(0.001, v);
      spread += Math.hypot(p.x - cx, p.y - cy);
    }

    const n = Math.max(1, particles.length);
    history.energy.push(clamp(energy / n / 4, 0, 1.6));
    history.order.push(clamp(Math.hypot(orderX, orderY) / n, 0, 1));
    history.spread.push(clamp(spread / n / Math.hypot(cx, cy), 0, 1));
    for (const key of Object.keys(history)) {
      if (history[key].length > 96) history[key].shift();
    }
  }

  function drawField() {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    const step = width < 520 ? 56 : 72;
    for (let x = step / 2; x < width; x += step) {
      for (let y = step / 2; y < height; y += step) {
        const angle = fieldAt(x, y, frame, 0);
        const len = 13;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(angle) * len * 0.5, y - Math.sin(angle) * len * 0.5);
        ctx.lineTo(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw() {
    if (state.trails) {
      const fade = state.variation === "trace" ? 0.07 : state.variation === "comet" ? 0.11 : 0.15;
      ctx.fillStyle = `rgba(6, 8, 13, ${fade})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(6, 8, 13, 0.94)";
      ctx.fillRect(0, 0, width, height);
    }

    drawField();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const speed = Math.hypot(p.vx, p.vy);
      const radius = (state.variation === "lattice" ? 1.35 : 1.6) + speed * 0.34;
      const alpha = state.variation === "trace" ? 0.22 + clamp(speed / 9, 0, 0.38) : 0.32 + clamp(speed / 8, 0, 0.45);
      ctx.fillStyle = `hsla(${p.hue}, 88%, 66%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (pointer) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 22 + state.attraction * 38, 0, TAU);
      ctx.stroke();
      ctx.restore();
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
    chartCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (chartH / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(chartW, y);
      chartCtx.stroke();
    }

    metricLine(chartCtx, history.energy, "rgba(120, 210, 255, 0.95)", (v) => clamp(v / 1.4, 0, 1), chartH, chartW);
    metricLine(chartCtx, history.order, "rgba(250, 215, 120, 0.95)", (v) => clamp(v, 0, 1), chartH, chartW);
    metricLine(chartCtx, history.spread, "rgba(185, 150, 255, 0.95)", (v) => clamp(v, 0, 1), chartH, chartW);
  }

  function updateMetrics() {
    const last = (key) => history[key][history[key].length - 1] || 0;
    metrics.energy.textContent = last("energy").toFixed(2);
    metrics.order.textContent = last("order").toFixed(2);
    metrics.spread.textContent = last("spread").toFixed(2);
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
      state.seed = Number(controls.seed.value) || 42;
      syncLabels();
      return;
    }
    state[target.name] = Number(target.value);
    syncLabels();
    if (target.name === "count") resetParticles();
  }

  function randomizeSeed() {
    state.seed = Math.floor(Math.random() * 90000) + 10000;
    controls.seed.value = String(state.seed);
    syncLabels();
    resetParticles();
  }

  function setVariation(name) {
    state.variation = name;
    Object.assign(state, presets[name] || presets.calm);
    controls.count.value = state.count;
    controls.speed.value = state.speed;
    controls.turbulence.value = state.turbulence;
    controls.attraction.value = state.attraction;
    controls.trails.checked = state.trails;
    syncLabels();
    resetParticles();
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function pointerLeave() {
    pointer = null;
  }

  controls.count.addEventListener("input", applyControl);
  controls.speed.addEventListener("input", applyControl);
  controls.turbulence.addEventListener("input", applyControl);
  controls.attraction.addEventListener("input", applyControl);
  controls.seed.addEventListener("change", applyControl);
  controls.trails.addEventListener("change", applyControl);
  controls.randomize.addEventListener("click", randomizeSeed);
  controls.reset.addEventListener("click", resetParticles);
  controls.pause.addEventListener("click", () => {
    running = !running;
    syncLabels();
    writeLog(running ? "Simulation resumed." : "Simulation paused.");
  });
  const variationClick = (event) => setVariation(event.currentTarget.dataset.variation);
  controls.variationButtons.forEach((button) => button.addEventListener("click", variationClick));
  canvas.addEventListener("pointermove", pointerMove, { passive: true });
  canvas.addEventListener("pointerleave", pointerLeave);

  resizeObserver = new ResizeObserver(() => {
    resize();
    resetParticles();
  });
  resizeObserver.observe(canvas.parentElement);
  resizeObserver.observe(chartCanvas.parentElement);
  syncLabels();
  resize();
  resetParticles();
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
      controls.variationButtons.forEach((button) => button.removeEventListener("click", variationClick));
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
    }
  };
}

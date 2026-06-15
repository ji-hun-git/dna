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

export function mountLudicGeometry({ canvas, chartCanvas, controls, metrics, log }) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const chartCtx = chartCanvas.getContext("2d", { alpha: true });
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let frame = 0;
  let running = !prefersReduced;
  let random = mulberry32(314);
  let resizeObserver = null;
  let phases = [];

  const state = {
    count: Number(controls.count.value),
    speed: Number(controls.speed.value),
    turbulence: Number(controls.turbulence.value),
    attraction: Number(controls.attraction.value),
    trails: controls.trails.checked,
    seed: Number(controls.seed.value) || 314,
    variation: controls.variationButtons[0]?.dataset.variation || "orbit"
  };

  const presets = {
    orbit: { count: 180, speed: 1.2, turbulence: 0.14, attraction: 0.26, trails: true },
    rose: { count: 220, speed: 1.65, turbulence: 0.08, attraction: 0.42, trails: true },
    interference: { count: 280, speed: 1.05, turbulence: 0.25, attraction: 0.34, trails: false },
    boundary: { count: 156, speed: 0.9, turbulence: 0.18, attraction: 0.58, trails: false },
    chaos: { count: 240, speed: 2.4, turbulence: 0.55, attraction: 0.22, trails: true }
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

  function resetSystem() {
    random = mulberry32(state.seed);
    phases = Array.from({ length: state.count }, () => random() * TAU);
    history.energy.length = 0;
    history.order.length = 0;
    history.spread.length = 0;
    frame = 0;
    ctx.clearRect(0, 0, width, height);
    writeLog(`${state.variation} notebook variation loaded with ${state.count} samples.`);
  }

  function samplePoint(index, t) {
    const n = Math.max(1, state.count - 1);
    const u = index / n;
    const phase = phases[index] || 0;
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.36;

    if (state.variation === "rose") {
      const theta = u * TAU * (2.5 + state.attraction * 3.5);
      const k = 3 + Math.round(state.attraction * 5);
      const r = scale * (0.22 + 0.76 * Math.abs(Math.cos(k * theta + t + phase * 0.08)));
      return {
        x: cx + Math.cos(theta) * r + Math.sin(t * 1.7 + phase) * state.turbulence * 18,
        y: cy + Math.sin(theta) * r + Math.cos(t * 1.3 + phase) * state.turbulence * 18
      };
    }

    if (state.variation === "interference") {
      const cols = Math.ceil(Math.sqrt(state.count));
      const gx = (index % cols) / Math.max(1, cols - 1);
      const gy = Math.floor(index / cols) / Math.max(1, cols - 1);
      const x = width * (0.12 + gx * 0.76);
      const yBase = height * (0.14 + gy * 0.72);
      const wave =
        Math.sin(gx * TAU * 3 + t * 1.8) +
        Math.cos(gy * TAU * 4 - t * 1.4 + phase) +
        Math.sin((gx + gy) * TAU * 2 + t);
      return { x, y: yBase + wave * (10 + state.turbulence * 34) };
    }

    if (state.variation === "boundary") {
      const classA = index % 2 === 0;
      const theta = u * TAU * 5 + phase * 0.1;
      const radius = scale * (0.18 + (index % 19) / 22);
      const drift = Math.sin(t + phase) * state.turbulence * 38;
      return {
        x: cx + (classA ? -scale * 0.46 : scale * 0.46) + Math.cos(theta) * radius * 0.34 + drift,
        y: cy + Math.sin(theta) * radius * 0.46 + Math.cos(t * 0.7 + phase) * state.attraction * 40,
        classA
      };
    }

    if (state.variation === "chaos") {
      let x = Math.sin(phase + t * 0.6);
      let y = Math.cos(phase * 1.7 - t * 0.4);
      const a = 1.4 + state.attraction;
      const b = -2.3 + state.turbulence;
      const c = 2.4 - state.attraction * 0.7;
      const d = -2.1 + state.turbulence * 0.5;
      for (let j = 0; j < 12 + (index % 7); j++) {
        const nx = Math.sin(a * y) + c * Math.cos(a * x);
        const ny = Math.sin(b * x) + d * Math.cos(b * y);
        x = nx;
        y = ny;
      }
      return { x: cx + x * scale * 0.32, y: cy + y * scale * 0.32 };
    }

    const ring = 0.28 + (index % 9) * 0.052;
    const theta = u * TAU * 3 + t * (0.6 + state.attraction) + phase * 0.18;
    const wobble = Math.sin(theta * 2.3 + t + phase) * state.turbulence * scale * 0.18;
    return {
      x: cx + Math.cos(theta) * scale * ring + Math.cos(theta * 2 + t) * wobble,
      y: cy + Math.sin(theta * 1.37) * scale * ring + Math.sin(theta * 3 - t) * wobble
    };
  }

  function drawBoundary() {
    if (state.variation !== "boundary") return;
    const t = frame * 0.01 * state.speed;
    ctx.save();
    ctx.strokeStyle = "rgba(246, 211, 107, 0.42)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    for (let x = width * 0.12; x <= width * 0.88; x += 12) {
      const nx = (x / width - 0.5) * 2;
      const y = height / 2 + Math.sin(nx * 4 + t) * 50 * state.attraction;
      if (x === width * 0.12) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const fade = state.trails ? (state.variation === "chaos" ? 0.08 : 0.14) : 0.96;
    ctx.fillStyle = `rgba(5, 8, 13, ${fade})`;
    ctx.fillRect(0, 0, width, height);

    const t = frame * 0.01 * state.speed;
    drawBoundary();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    let last = null;
    let curvature = 0;
    let symmetryX = 0;
    let coverage = 0;
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < state.count; i++) {
      const p = samplePoint(i, t);
      const hue = state.variation === "boundary"
        ? (p.classA ? 198 : 42)
        : state.variation === "chaos"
          ? 285 + (i % 32)
          : 170 + (i % 72);
      const alpha = state.variation === "interference" ? 0.46 : 0.62;
      ctx.fillStyle = `hsla(${hue}, 88%, 66%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, state.variation === "interference" ? 1.6 : 2.2, 0, TAU);
      ctx.fill();

      if (last && state.variation !== "interference") {
        ctx.strokeStyle = `hsla(${hue}, 84%, 65%, 0.18)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        curvature += Math.abs(Math.atan2(p.y - last.y, p.x - last.x));
      }
      last = p;
      symmetryX += 1 - clamp(Math.abs(p.x - (width - p.x)) / width, 0, 1);
      coverage += clamp(Math.hypot(p.x - cx, p.y - cy) / Math.hypot(cx, cy), 0, 1);
    }
    ctx.restore();

    const n = Math.max(1, state.count);
    history.energy.push(clamp((curvature / n) % 1.2, 0, 1));
    history.order.push(clamp(symmetryX / n, 0, 1));
    history.spread.push(clamp(coverage / n, 0, 1));
    for (const key of Object.keys(history)) {
      if (history[key].length > 96) history[key].shift();
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
    metricLine(chartCtx, history.energy, "rgba(255, 147, 199, 0.95)", chartH, chartW);
    metricLine(chartCtx, history.order, "rgba(126, 231, 189, 0.95)", chartH, chartW);
    metricLine(chartCtx, history.spread, "rgba(120, 210, 255, 0.95)", chartH, chartW);
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
      frame += 1;
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
      state.seed = Number(controls.seed.value) || 314;
      syncLabels();
      return;
    }
    state[target.name] = Number(target.value);
    syncLabels();
    if (target.name === "count") resetSystem();
  }

  function randomizeSeed() {
    state.seed = Math.floor(Math.random() * 90000) + 10000;
    controls.seed.value = String(state.seed);
    syncLabels();
    resetSystem();
  }

  function setVariation(name) {
    state.variation = name;
    Object.assign(state, presets[name] || presets.orbit);
    controls.count.value = state.count;
    controls.speed.value = state.speed;
    controls.turbulence.value = state.turbulence;
    controls.attraction.value = state.attraction;
    controls.trails.checked = state.trails;
    syncLabels();
    resetSystem();
  }

  controls.count.addEventListener("input", applyControl);
  controls.speed.addEventListener("input", applyControl);
  controls.turbulence.addEventListener("input", applyControl);
  controls.attraction.addEventListener("input", applyControl);
  controls.seed.addEventListener("change", applyControl);
  controls.trails.addEventListener("change", applyControl);
  controls.randomize.addEventListener("click", randomizeSeed);
  controls.reset.addEventListener("click", resetSystem);
  controls.pause.addEventListener("click", () => {
    running = !running;
    syncLabels();
    writeLog(running ? "Notebook resumed." : "Notebook paused.");
  });
  const variationClick = (event) => setVariation(event.currentTarget.dataset.variation);
  controls.variationButtons.forEach((button) => button.addEventListener("click", variationClick));

  resizeObserver = new ResizeObserver(() => {
    resize();
    resetSystem();
  });
  resizeObserver.observe(canvas.parentElement);
  resizeObserver.observe(chartCanvas.parentElement);
  syncLabels();
  resize();
  resetSystem();
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
      controls.reset.removeEventListener("click", resetSystem);
      controls.variationButtons.forEach((button) => button.removeEventListener("click", variationClick));
    }
  };
}

/**
 * Shared toolkit for Laboratory simulations.
 *
 * `createSimHarness` owns everything the standardized project page expects:
 * control wiring, label sync, preset/variation switching, the requestAnimationFrame
 * loop, FPS metering, chart + metric cadence, and a clean dispose boundary.
 *
 * A simulation only has to provide pure logic: reset / step / draw callbacks that
 * read `api.state` (the generic control set) and push three normalized signals
 * (energy / order / spread) per tick. The same boundary can later move into a
 * React component, a Web Worker, or a WebGL engine without touching project
 * metadata.
 */

export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Draw a single normalized (0..1) series as a polyline filling the chart box. */
export function metricLine(ctx, values, color, height, width, scale) {
  if (!values || values.length < 2) return;
  const f = scale || ((v) => clamp(v, 0, 1));
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - f(value) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Pinhole 3D → 2D projection with yaw + pitch camera orbit.
 * cam: { yaw, pitch, dist, fov }. Returns screen point, depth, and scale.
 */
export function project3d(p, cam, w, h) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  let x = p.x * cy - p.z * sy;
  let z = p.x * sy + p.z * cy;
  let y = p.y;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = y * cp - z * sp;
  const z2 = y * sp + z * cp;
  y = y2;
  z = z2 + cam.dist;
  const f = (cam.fov || h * 0.9) / Math.max(0.0001, z);
  return { sx: w / 2 + x * f, sy: h / 2 - y * f, depth: z, scale: f };
}

function writeLog(logEl, message) {
  if (!logEl) return;
  const line = document.createElement("li");
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  line.textContent = `${time} · ${message}`;
  logEl.prepend(line);
  while (logEl.children.length > 6) logEl.lastElementChild.remove();
}

/**
 * @param {Object} refs   { canvas, chartCanvas, controls, metrics, log }
 * @param {Object} config simulation hooks + presets, see comments in callers
 */
export function createSimHarness(refs, config) {
  const { canvas, chartCanvas, controls, metrics, log } = refs;
  const ctx = canvas.getContext("2d", { alpha: true });
  const chartCtx = chartCanvas ? chartCanvas.getContext("2d", { alpha: true }) : null;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seedDefault = config.seedDefault || 1;

  let gen = mulberry32(seedDefault);
  let running = !prefersReduced;
  let raf = 0;
  let resizeObserver = null;
  let pointer = null;
  let fps = 60;
  let lastT = 0;
  let fpsAcc = 0;
  let fpsN = 0;

  const api = {
    ctx,
    chartCtx,
    w: 0,
    h: 0,
    dpr: 1,
    chartW: 0,
    chartH: 220,
    frame: 0,
    pointer: null,
    state: {
      count: Number(controls.count.value),
      speed: Number(controls.speed.value),
      turbulence: Number(controls.turbulence.value),
      attraction: Number(controls.attraction.value),
      trails: controls.trails.checked,
      seed: Number(controls.seed.value) || seedDefault,
      variation: controls.variationButtons[0]?.dataset.variation || config.firstVariation || ""
    },
    series: { energy: [], order: [], spread: [] },
    custom: {},
    reseed(s) {
      gen = mulberry32((s || 0) >>> 0);
    },
    rand() {
      return gen();
    },
    range(min, max) {
      return min + gen() * (max - min);
    },
    log(message) {
      writeLog(log, message);
    },
    push(e, o, s) {
      api.series.energy.push(clamp(e, 0, 1));
      api.series.order.push(clamp(o, 0, 1));
      api.series.spread.push(clamp(s, 0, 1));
      for (const key of ["energy", "order", "spread"]) {
        if (api.series[key].length > 120) api.series[key].shift();
      }
    },
    get running() {
      return running;
    }
  };

  function syncLabels() {
    controls.countValue.textContent = String(api.state.count);
    controls.speedValue.textContent = api.state.speed.toFixed(2);
    controls.turbulenceValue.textContent = api.state.turbulence.toFixed(2);
    controls.attractionValue.textContent = api.state.attraction.toFixed(2);
    controls.seedValue.textContent = String(api.state.seed);
    controls.pause.textContent = running ? "Pause" : "Run";
    controls.pause.setAttribute("aria-pressed", running ? "false" : "true");
    controls.variationButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.variation === api.state.variation);
    });
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    api.w = Math.max(320, rect.width);
    api.h = Math.max(260, rect.height);
    api.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(api.w * api.dpr);
    canvas.height = Math.floor(api.h * api.dpr);
    canvas.style.width = `${api.w}px`;
    canvas.style.height = `${api.h}px`;
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);

    if (chartCanvas && chartCtx) {
      const chartRect = chartCanvas.parentElement.getBoundingClientRect();
      api.chartW = Math.max(240, chartRect.width);
      api.chartH = 220;
      chartCanvas.width = Math.floor(api.chartW * api.dpr);
      chartCanvas.height = Math.floor(api.chartH * api.dpr);
      chartCanvas.style.width = `${api.chartW}px`;
      chartCanvas.style.height = `${api.chartH}px`;
      chartCtx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    }
  }

  function reset() {
    api.reseed(api.state.seed);
    api.frame = 0;
    api.series.energy.length = 0;
    api.series.order.length = 0;
    api.series.spread.length = 0;
    ctx.clearRect(0, 0, api.w, api.h);
    config.reset(api);
  }

  function drawChart() {
    if (!chartCtx) return;
    const W = api.chartW;
    const H = api.chartH;
    chartCtx.clearRect(0, 0, W, H);
    chartCtx.fillStyle = "rgba(10, 11, 19, 0.55)";
    chartCtx.fillRect(0, 0, W, H);
    chartCtx.strokeStyle = "rgba(255,255,255,0.06)";
    chartCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (H / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(W, y);
      chartCtx.stroke();
    }
    const colors = config.chartColors || [
      "rgba(96, 165, 250, 0.95)",
      "rgba(52, 211, 153, 0.95)",
      "rgba(244, 114, 182, 0.95)"
    ];
    metricLine(chartCtx, api.series.energy, colors[0], H, W);
    metricLine(chartCtx, api.series.order, colors[1], H, W);
    metricLine(chartCtx, api.series.spread, colors[2], H, W);
  }

  function updateMetrics() {
    const last = (key) => api.series[key][api.series[key].length - 1] || 0;
    const fmt = config.metricFormat || {};
    metrics.energy.textContent = fmt.energy ? fmt.energy(last("energy"), api) : last("energy").toFixed(2);
    metrics.order.textContent = fmt.order ? fmt.order(last("order"), api) : last("order").toFixed(2);
    metrics.spread.textContent = fmt.spread ? fmt.spread(last("spread"), api) : last("spread").toFixed(2);
    metrics.fps.textContent = running ? String(Math.max(1, Math.round(fps))) : "0";
  }

  function loop(t) {
    if (running && !document.hidden) {
      if (lastT) {
        const dt = t - lastT;
        if (dt > 0) {
          fpsAcc += 1000 / dt;
          fpsN += 1;
          if (fpsN >= 24) {
            fps = fpsAcc / fpsN;
            fpsAcc = 0;
            fpsN = 0;
          }
        }
      }
      lastT = t;
      api.frame += 1;
      config.step(api);
      config.draw(api);
      if (api.frame % 2 === 0) drawChart();
      if (api.frame % 8 === 0) updateMetrics();
    } else {
      lastT = t;
    }
    raf = requestAnimationFrame(loop);
  }

  function applyControl(event) {
    const target = event.currentTarget;
    if (target === controls.trails) {
      api.state.trails = controls.trails.checked;
      syncLabels();
      config.onTrails?.(api);
      return;
    }
    if (target === controls.seed) {
      api.state.seed = Number(controls.seed.value) || api.state.seed;
      syncLabels();
      reset();
      return;
    }
    api.state[target.name] = Number(target.value);
    syncLabels();
    if (target.name === "count" && !config.liveCount) reset();
  }

  function randomizeSeed() {
    api.state.seed = Math.floor(Math.random() * 90000) + 10000;
    controls.seed.value = String(api.state.seed);
    syncLabels();
    reset();
  }

  function applyPreset(name) {
    const preset = config.presets?.[name];
    if (!preset) return;
    Object.assign(api.state, preset);
    controls.count.value = api.state.count;
    controls.speed.value = api.state.speed;
    controls.turbulence.value = api.state.turbulence;
    controls.attraction.value = api.state.attraction;
    controls.trails.checked = api.state.trails;
  }

  function setVariation(name) {
    api.state.variation = name;
    applyPreset(name);
    syncLabels();
    reset();
  }

  const variationClick = (event) => setVariation(event.currentTarget.dataset.variation);

  function togglePause() {
    running = !running;
    syncLabels();
    api.log(running ? "Resumed." : "Paused.");
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    api.pointer = pointer;
  }

  function pointerLeave() {
    pointer = null;
    api.pointer = null;
  }

  controls.count.addEventListener("input", applyControl);
  controls.speed.addEventListener("input", applyControl);
  controls.turbulence.addEventListener("input", applyControl);
  controls.attraction.addEventListener("input", applyControl);
  controls.seed.addEventListener("change", applyControl);
  controls.trails.addEventListener("change", applyControl);
  controls.randomize.addEventListener("click", randomizeSeed);
  controls.reset.addEventListener("click", reset);
  controls.pause.addEventListener("click", togglePause);
  controls.variationButtons.forEach((button) => button.addEventListener("click", variationClick));
  if (config.usePointer) {
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerleave", pointerLeave);
  }

  resizeObserver = new ResizeObserver(() => {
    resize();
    reset();
  });
  resizeObserver.observe(canvas.parentElement);
  if (chartCanvas) resizeObserver.observe(chartCanvas.parentElement);

  // First paint: apply the preset for the initial variation so the controls and
  // the world agree from frame zero.
  resize();
  applyPreset(api.state.variation);
  syncLabels();
  reset();
  config.draw(api);
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
      controls.reset.removeEventListener("click", reset);
      controls.pause.removeEventListener("click", togglePause);
      controls.variationButtons.forEach((button) => button.removeEventListener("click", variationClick));
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      config.dispose?.(api);
    }
  };
}

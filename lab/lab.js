import { labArchitecture, labProjects } from "./experiments.js?v=20260615-lab3";
import { mountAgentArena } from "./simulations/agent-arena.js?v=20260615-variations";
import { mountLudicGeometry } from "./simulations/ludic-geometry.js?v=20260615-variations";
import { mountParticleField } from "./simulations/particle-field.js?v=20260615-variations";
import { mountGridworldPrompt } from "./simulations/gridworld-prompt.js?v=20260615-lab2";
import { mountMazeChase } from "./simulations/maze-chase.js?v=20260615-lab2";
import { mountSnakeSwarm } from "./simulations/snake-swarm.js?v=20260615-lab2";
import { mountLightCycle } from "./simulations/light-cycle.js?v=20260615-lab2";
import { mountFrozenLake } from "./simulations/frozen-lake.js?v=20260615-lab2";
import { mountCartpole } from "./simulations/cartpole.js?v=20260615-lab2";
import { mountBoids3d } from "./simulations/boids-3d.js?v=20260615-lab2";
import { mountTerrainDescent3d } from "./simulations/terrain-descent-3d.js?v=20260615-lab2";
import { mountReactionDiffusion } from "./simulations/reaction-diffusion.js?v=20260615-lab3";
import { mountQLearning } from "./simulations/q-learning.js?v=20260615-lab3";
import { mountPathfinding } from "./simulations/pathfinding.js?v=20260615-lab3";
import { mountWumpus } from "./simulations/wumpus.js?v=20260615-lab3";
import { mountNBody3d } from "./simulations/nbody-3d.js?v=20260615-lab3";

const rendererRegistry = {
  "behavior-prompt-gridworld": mountGridworldPrompt,
  "agent-arena": mountAgentArena,
  "maze-chase": mountMazeChase,
  "snake-growth": mountSnakeSwarm,
  "light-cycle-arena": mountLightCycle,
  "frozen-lake": mountFrozenLake,
  "q-learning-gridworld": mountQLearning,
  "cartpole-control": mountCartpole,
  "pathfinding-search": mountPathfinding,
  "wumpus-world": mountWumpus,
  "reaction-diffusion": mountReactionDiffusion,
  "boids-3d": mountBoids3d,
  "optimizer-landscape-3d": mountTerrainDescent3d,
  "nbody-gravity-3d": mountNBody3d,
  "ludic-geometry": mountLudicGeometry,
  "particle-policy-field": mountParticleField
};

const $ = (selector, root = document) => root.querySelector(selector);

// Category → accent RGB triplet, matching the main site's accent palette.
const ACCENTS = {
  "Game AI": "167, 139, 250",
  "AI Agent": "96, 165, 250",
  "Game Prototype": "52, 211, 153",
  Simulation: "96, 165, 250",
  "Math Visualization": "251, 191, 36",
  "Research Tool": "244, 114, 182",
  "Experimental Tool": "167, 139, 250"
};
const accentFor = (category) => ACCENTS[category] || "96, 165, 250";
const projectCards = $("#projectCards");
const projectDetail = $("#projectDetail");
const architectureTree = $("#architectureTree");
const addSteps = $("#addSteps");
const heroCanvas = $("#heroCanvas");
const heroMetrics = {
  projects: $("#metricProjects"),
  renderers: $("#metricRenderers"),
  modules: $("#metricModules"),
  live: $("#metricLive")
};

let mountedSimulation = null;

function statusLabel(status) {
  return status.replace("-", " ");
}

function renderProjectCards(selectedId) {
  projectCards.innerHTML = labProjects
    .map((project) => `
      <button class="project-card ${project.id === selectedId ? "active" : ""}" type="button" data-project-id="${project.id}" data-category="${project.category}" style="--accent: ${accentFor(project.category)}">
        <span class="status-line">
          <span class="badge ${project.status === "live" ? "live" : ""}">${statusLabel(project.status)}</span>
          <span class="tiny mono">${project.simulationType}</span>
        </span>
        <span class="card-kicker">${project.category}</span>
        <h2>${project.title}</h2>
        <p>${project.description}</p>
        <div class="tags">
          ${project.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          <span class="tag">${project.variations.length} variations</span>
        </div>
      </button>
    `)
    .join("");

  projectCards.querySelectorAll("[data-project-id]").forEach((card) => {
    card.addEventListener("click", () => selectProject(card.dataset.projectId, true));
  });
}

function projectTemplate(project) {
  const canRender = Boolean(rendererRegistry[project.id]);
  const metricLabels = project.metricLabels;
  return `
    <div class="project-layout">
      <section class="panel" aria-labelledby="overview-title">
        <p class="eyebrow">Project Template</p>
        <h2 id="overview-title">${project.title}</h2>
        <p class="hero-lead">${project.subtitle}</p>
        <div class="overview-copy">
          ${project.overview.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </div>
        <div class="facts-grid">
          ${project.facts.map((fact) => `
            <div class="fact">
              <span>${fact.label}</span>
              <strong>${fact.value}</strong>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="viewport-panel" aria-labelledby="viewport-title">
        <div class="viewport-header">
          <div>
            <span class="tiny mono">Interactive viewport</span>
            <h3 id="viewport-title">${project.simulationType}</h3>
          </div>
          <div class="viewport-tools">
            <button class="ghost-button" type="button" data-control="pause">Pause</button>
            <button class="ghost-button" type="button" data-control="reset">Reset</button>
          </div>
        </div>
        ${canRender
          ? `<div class="viewport-stage"><canvas id="simulationCanvas" aria-label="${project.title} simulation viewport"></canvas></div>`
          : `<div class="empty-stage"><div><strong>${project.title} is registered.</strong><br />Add a renderer module to turn this slot into a live experiment.</div></div>`}
      </section>

      <section class="panel" aria-labelledby="analysis-title">
        <div class="analysis-header">
          <div>
            <span class="tiny mono">Visual analysis / data</span>
            <h3 id="analysis-title">Runtime Signals</h3>
          </div>
          <span class="badge ${project.status === "live" ? "live" : ""}">${statusLabel(project.status)}</span>
        </div>
        <div class="analysis-grid">
          <div class="chart-wrap">
            ${canRender ? `<canvas id="analysisChart" aria-label="Live metric chart"></canvas>` : `<div class="empty-stage">Metrics will mount here.</div>`}
          </div>
          <div>
            <div class="metric-grid">
              <div class="metric"><span>${metricLabels.energy}</span><strong id="metricEnergy">0.00</strong></div>
              <div class="metric"><span>${metricLabels.order}</span><strong id="metricOrder">0.00</strong></div>
              <div class="metric"><span>${metricLabels.spread}</span><strong id="metricSpread">0.00</strong></div>
              <div class="metric"><span>${metricLabels.fps}</span><strong id="metricFps">0</strong></div>
            </div>
            <ul class="log-list" id="simulationLog" aria-live="polite">
              <li>Simulation log is ready.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="math-title">
        <span class="tiny mono">Mathematical context</span>
        <h3 id="math-title">${project.mathTopics.join(" / ")}</h3>
        <div class="math-list">
          ${project.equations.map((equation) => `<div class="equation">\\[${equation}\\]</div>`).join("")}
        </div>
      </section>

      <section class="panel" aria-labelledby="future-title">
        <span class="tiny mono">Extension notes</span>
        <h3 id="future-title">How this grows</h3>
        <ol class="steps">
          ${project.futureWork.map((item) => `<li>${item}</li>`).join("")}
        </ol>
      </section>
    </div>

    <aside class="control-panel" aria-labelledby="controls-title">
      <div class="control-header">
        <div>
          <span class="tiny mono">Controls / parameters</span>
          <h3 id="controls-title">Runtime Console</h3>
        </div>
      </div>
      <div class="controls">
        ${canRender ? controlsTemplate(project) : placeholderControlsTemplate(project)}
      </div>
    </aside>
  `;
}

function controlsTemplate(project) {
  const labels = project.controlLabels;
  return `
    <div class="preset-row">
      ${project.variations.map((variation, index) => `
        <button class="ghost-button ${index === 0 ? "active" : ""}" type="button" data-variation="${variation.id}" title="${variation.description}">
          ${variation.label}
        </button>
      `).join("")}
    </div>

    <label class="control">
      <span class="control-row"><span>${labels.count}</span><output id="countValue">180</output></span>
      <input id="countControl" name="count" type="range" min="48" max="360" step="4" value="180" />
    </label>
    <label class="control">
      <span class="control-row"><span>${labels.speed}</span><output id="speedValue">1.80</output></span>
      <input id="speedControl" name="speed" type="range" min="0.4" max="3.4" step="0.05" value="1.8" />
    </label>
    <label class="control">
      <span class="control-row"><span>${labels.turbulence}</span><output id="turbulenceValue">0.35</output></span>
      <input id="turbulenceControl" name="turbulence" type="range" min="0" max="1.2" step="0.01" value="0.35" />
    </label>
    <label class="control">
      <span class="control-row"><span>${labels.attraction}</span><output id="attractionValue">0.22</output></span>
      <input id="attractionControl" name="attraction" type="range" min="0" max="0.9" step="0.01" value="0.22" />
    </label>
    <label class="toggle">
      <span>${labels.trails}</span>
      <input id="trailsControl" type="checkbox" checked />
    </label>
    <label class="control">
      <span class="control-row"><span>Seed</span><output id="seedValue">42</output></span>
      <input id="seedControl" type="number" min="1" max="999999" value="42" />
    </label>
    <button class="solid-button" type="button" data-control="randomize">Randomize seed</button>
  `;
}

function placeholderControlsTemplate(project) {
  return `
    <p class="overview-copy">${project.title} already has metadata, documentation, math, and future-work sections. Add a simulation module to activate controls.</p>
    <button class="solid-button" type="button" disabled>Renderer pending</button>
  `;
}

function mountSelectedSimulation(project) {
  mountedSimulation?.dispose?.();
  mountedSimulation = null;

  const renderer = rendererRegistry[project.id];
  if (!renderer) return;

  mountedSimulation = renderer({
    canvas: $("#simulationCanvas"),
    chartCanvas: $("#analysisChart"),
    controls: {
      pause: $('[data-control="pause"]'),
      reset: $('[data-control="reset"]'),
      randomize: $('[data-control="randomize"]'),
      variationButtons: [...document.querySelectorAll("[data-variation]")],
      count: $("#countControl"),
      countValue: $("#countValue"),
      speed: $("#speedControl"),
      speedValue: $("#speedValue"),
      turbulence: $("#turbulenceControl"),
      turbulenceValue: $("#turbulenceValue"),
      attraction: $("#attractionControl"),
      attractionValue: $("#attractionValue"),
      trails: $("#trailsControl"),
      seed: $("#seedControl"),
      seedValue: $("#seedValue")
    },
    metrics: {
      energy: $("#metricEnergy"),
      order: $("#metricOrder"),
      spread: $("#metricSpread"),
      fps: $("#metricFps")
    },
    log: $("#simulationLog")
  });
}

function renderMath() {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }
}

function selectProject(id, updateHash = false) {
  const project = labProjects.find((item) => item.id === id) || labProjects[0];
  if (updateHash) history.replaceState(null, "", project.route);
  renderProjectCards(project.id);
  projectDetail.style.setProperty("--accent", accentFor(project.category));
  projectDetail.innerHTML = projectTemplate(project);
  mountSelectedSimulation(project);
  renderMath();
}

function renderArchitecture() {
  architectureTree.textContent = labArchitecture.folders.join("\n");
  addSteps.innerHTML = labArchitecture.addSteps.map((step) => `<li>${step}</li>`).join("");
}

function runHeroCanvas() {
  const ctx = heroCanvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  const points = Array.from({ length: 84 }, (_, i) => ({
    x: 0,
    y: 0,
    phase: i * 0.37,
    radius: 1.5 + (i % 5) * 0.35
  }));

  function resize() {
    const rect = heroCanvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    heroCanvas.width = Math.floor(width * dpr);
    heroCanvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    frame += 1;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(5, 7, 11, 0.5)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const t = frame * 0.008;
    points.forEach((point, index) => {
      const ring = 0.18 + (index % 9) * 0.038;
      const angle = t + point.phase + Math.sin(t * 0.7 + index) * 0.25;
      point.x = width * (0.5 + Math.cos(angle) * ring * 1.2);
      point.y = height * (0.54 + Math.sin(angle * 1.37) * ring);
      const hue = 180 + (index % 12) * 13;
      ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.45)`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length; i += 3) {
      const a = points[i];
      const b = points[(i + 17) % points.length];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < width * 0.34) {
        ctx.globalAlpha = Math.max(0, 0.22 - distance / (width * 1.4));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(heroCanvas.parentElement);
  resize();
  draw();
}

function boot() {
  heroMetrics.projects.textContent = String(labProjects.length);
  heroMetrics.renderers.textContent = String(Object.keys(rendererRegistry).length);
  heroMetrics.modules.textContent = String(5 + Object.keys(rendererRegistry).length);
  heroMetrics.live.textContent = String(labProjects.filter((project) => project.status === "live").length);

  renderArchitecture();
  runHeroCanvas();

  // Cursor spotlight on project cards (matches the main site's card glow).
  document.addEventListener(
    "pointermove",
    (event) => {
      const card = event.target.closest?.(".project-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      card.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    },
    { passive: true }
  );

  selectProject(location.hash.replace("#", "") || labProjects[0].id);

  window.addEventListener("hashchange", () => {
    selectProject(location.hash.replace("#", "") || labProjects[0].id);
  });
}

boot();

import { labArchitecture, labProjects } from "./experiments.js?v=20260615-lab8";
import { mountAgentArena } from "./simulations/agent-arena.js?v=20260615-variations";
import { mountLudicGeometry } from "./simulations/ludic-geometry.js?v=20260615-variations";
import { mountParticleField } from "./simulations/particle-field.js?v=20260615-variations";
import { mountGridworldPrompt } from "./simulations/gridworld-prompt.js?v=20260615-lab8";
import { mountMazeChase } from "./simulations/maze-chase.js?v=20260615-lab8";
import { mountSnakeSwarm } from "./simulations/snake-swarm.js?v=20260615-lab8";
import { mountLightCycle } from "./simulations/light-cycle.js?v=20260615-lab8";
import { mountFrozenLake } from "./simulations/frozen-lake.js?v=20260615-lab8";
import { mountCartpole } from "./simulations/cartpole.js?v=20260615-lab8";
import { mountBoids3d } from "./simulations/boids-3d.js?v=20260615-lab8";
import { mountTerrainDescent3d } from "./simulations/terrain-descent-3d.js?v=20260615-lab8";
import { mountReactionDiffusion } from "./simulations/reaction-diffusion.js?v=20260615-lab8";
import { mountQLearning } from "./simulations/q-learning.js?v=20260615-lab8";
import { mountPathfinding } from "./simulations/pathfinding.js?v=20260615-lab8";
import { mountWumpus } from "./simulations/wumpus.js?v=20260615-lab8";
import { mountNBody3d } from "./simulations/nbody-3d.js?v=20260615-lab8";
import { mountNeuroFlappy } from "./simulations/neuroevolution-flappy.js?v=20260615-lab8";
import { mountConnectFour } from "./simulations/connect-four.js?v=20260615-lab8";
import { mountGame2048 } from "./simulations/game-2048.js?v=20260615-lab8";
import { mountMinesweeper } from "./simulations/minesweeper.js?v=20260615-lab8";
import { mountArcRobot } from "./simulations/arc-adaptive-robot.js?v=20260615-lab8";
import { mountDoublePendulum } from "./simulations/double-pendulum.js?v=20260615-lab8";
import { mountVerletCloth } from "./simulations/verlet-cloth.js?v=20260615-lab8";
import { mountFallingSand } from "./simulations/falling-sand.js?v=20260615-lab8";
import { mountPlinko } from "./simulations/plinko.js?v=20260615-lab8";
import { mountLunarLander } from "./simulations/lunar-lander.js?v=20260615-lab8";
import { mountBreakoutAI } from "./simulations/breakout-ai.js?v=20260615-lab8";
import { mountTetrisAI } from "./simulations/tetris-ai.js?v=20260615-lab8";

const rendererRegistry = {
  "behavior-prompt-gridworld": mountGridworldPrompt,
  "arc-adaptive-unit": mountArcRobot,
  "double-pendulum": mountDoublePendulum,
  "verlet-cloth": mountVerletCloth,
  "falling-sand": mountFallingSand,
  "plinko": mountPlinko,
  "lunar-lander": mountLunarLander,
  "breakout-ai": mountBreakoutAI,
  "tetris-ai": mountTetrisAI,
  "agent-arena": mountAgentArena,
  "neuroevolution-flappy": mountNeuroFlappy,
  "connect-four": mountConnectFour,
  "game-2048": mountGame2048,
  "minesweeper": mountMinesweeper,
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

// Category -> a muted, earthy hue (RGB triplet) used only as a small wayfinding
// dot in the index and figure tag. All emphasis (active state, math highlight)
// uses the single clay brand accent defined in the stylesheet.
const ACCENTS = {
  "AI Agent": "94, 122, 145",
  "Game AI": "179, 106, 74",
  "Game Prototype": "110, 138, 106",
  Simulation: "124, 110, 150",
  "Math Visualization": "176, 138, 79",
  "Research Tool": "110, 138, 106",
  "Experimental Tool": "124, 110, 150"
};
const accentFor = (category) => ACCENTS[category] || "141, 137, 126";

// The project list is grouped and filterable so the (long) catalog stays tidy.
const GROUP_ORDER = ["Agents", "Games", "Learning", "Physics", "Generative"];
let currentFilter = "All";
let currentProjectId = null;

// Synced math highlight: the equation matching the simulation's current step
// lights up. A sim sets api.stage to drive it; otherwise it auto-cycles through
// the equations while the sim runs.
let currentEqEls = [];
let hlIdx = 0;
let hlAccum = 0;
let hlLast = 0;
const projectCards = $("#projectCards");
const railFilter = $("#railFilter");
const viewportMount = $("#viewportMount");
const detailMount = $("#detailMount");
const controlMount = $("#controlMount");
const architectureTree = $("#architectureTree");
const addSteps = $("#addSteps");
const heroCanvas = $("#heroCanvas");
const heroMetrics = {
  projects: $("#metricProjects"),
  renderers: $("#metricRenderers"),
  live: $("#metricLive")
};

let mountedSimulation = null;

function statusLabel(status) {
  return status.replace("-", " ");
}

function sortedProjects() {
  return [...labProjects].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}

// Stable catalogue number per sim (01..N), in the grouped reading order. Used
// both as the index entry number and the figure number, so every experiment is
// referable by a fixed "Fig. N" the way a paper numbers its figures.
const FIG_NUM = new Map(sortedProjects().map((p, i) => [p.id, i + 1]));
const figNo = (project) => String(FIG_NUM.get(project.id) || 0).padStart(2, "0");

function cardHTML(project, selectedId) {
  return `
    <button class="project-card ${project.id === selectedId ? "active" : ""}" type="button" data-project-id="${project.id}" data-category="${project.category}" style="--accent: ${accentFor(project.category)}">
      <span class="card-index">${figNo(project)}</span>
      <span class="card-body">
        <span class="status-line">
          <span class="card-kicker">${project.category}</span>
          ${project.status === "live" ? `<span class="badge live">Live</span>` : ""}
        </span>
        <h2>${project.title}</h2>
        <p>${project.description}</p>
      </span>
    </button>`;
}

function renderFilter() {
  if (!railFilter) return;
  const counts = {};
  labProjects.forEach((p) => { counts[p.group] = (counts[p.group] || 0) + 1; });
  const chips = ["All", ...GROUP_ORDER];
  railFilter.innerHTML = chips
    .map((g) => `<button class="chip ${g === currentFilter ? "active" : ""}" type="button" data-filter="${g}">${g}<span class="chip-n">${g === "All" ? labProjects.length : counts[g] || 0}</span></button>`)
    .join("");
  railFilter.querySelectorAll("[data-filter]").forEach((b) => {
    b.addEventListener("click", () => {
      currentFilter = b.dataset.filter;
      renderFilter();
      renderProjectCards(currentProjectId);
    });
  });
}

function renderProjectCards(selectedId) {
  const list = sortedProjects().filter((p) => currentFilter === "All" || p.group === currentFilter);
  let html = "";
  let lastGroup = null;
  for (const p of list) {
    if (currentFilter === "All" && p.group !== lastGroup) {
      html += `<div class="rail-group">${p.group}</div>`;
      lastGroup = p.group;
    }
    html += cardHTML(p, selectedId);
  }
  projectCards.innerHTML = html;
  projectCards.querySelectorAll("[data-project-id]").forEach((card) => {
    card.addEventListener("click", () => selectProject(card.dataset.projectId, true));
  });
}

// CENTER - top: the figure (live simulation) with a journal-style caption.
function viewportHTML(project) {
  const canRender = Boolean(rendererRegistry[project.id]);
  const n = figNo(project);
  return `
    <figure class="viewport-panel" aria-labelledby="viewport-title">
      <figcaption class="viewport-header">
        <div>
          <span class="kicker">Figure ${n} &middot; ${project.category}</span>
          <h3 id="viewport-title">${project.title}</h3>
        </div>
        <div class="viewport-tools">
          <button class="text-button" type="button" data-control="pause">Pause</button>
          <button class="text-button" type="button" data-control="reset">Reset</button>
          <button class="text-button" type="button" data-control="copyLink">Copy link</button>
        </div>
      </figcaption>
      ${canRender
        ? `<div class="viewport-stage"><canvas id="simulationCanvas" aria-label="${project.title} simulation"></canvas></div>
           <p class="viewport-caption"><b>Fig. ${n}.</b> ${project.subtitle}. ${project.simulationType}; adjust parameters in the Controls panel and switch regimes with the mode buttons.</p>`
        : `<div class="empty-stage"><div><strong>${project.title} is registered.</strong><br />A renderer module will activate this figure.</div></div>`}
    </figure>
  `;
}

// CENTER - bottom: live signals, the synced math, and the detail.
function detailHTML(project) {
  const canRender = Boolean(rendererRegistry[project.id]);
  const metricLabels = project.metricLabels;
  return `
    <section class="panel panel-signals" aria-labelledby="analysis-title">
      <div class="analysis-header">
        <div>
          <span class="kicker">Measurements</span>
          <h3 id="analysis-title">Runtime signals</h3>
        </div>
        <span class="badge ${project.status === "live" ? "live" : ""}">${project.status === "live" ? "Live" : statusLabel(project.status)}</span>
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

    <section class="panel panel-math" aria-labelledby="math-title">
      <span class="kicker">Model &middot; the lit term tracks the current step</span>
      <h3 id="math-title">${project.mathTopics.join(" &middot; ")}</h3>
      <div class="math-list">
        ${project.equations.map((equation) => `<div class="equation">\\[${equation}\\]</div>`).join("")}
      </div>
    </section>

    <section class="panel panel-about" aria-labelledby="overview-title">
      <span class="kicker">Description</span>
      <h3 id="overview-title">${project.subtitle}</h3>
      <div class="overview-copy">
        ${project.overview.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      </div>
      <div class="facts-grid">
        ${project.facts.map((fact) => `<div class="fact"><span>${fact.label}</span><strong>${fact.value}</strong></div>`).join("")}
      </div>
    </section>

    <section class="panel panel-future" aria-labelledby="future-title">
      <span class="kicker">Notes</span>
      <h3 id="future-title">Extensions</h3>
      <ol class="steps">
        ${project.futureWork.map((item) => `<li>${item}</li>`).join("")}
      </ol>
    </section>
  `;
}

// RIGHT - controls and parameters.
function controlHTML(project) {
  const canRender = Boolean(rendererRegistry[project.id]);
  return `
    <div class="control-header">
      <div>
        <span class="kicker">Controls</span>
        <h3 id="controls-title">Parameters</h3>
      </div>
    </div>
    <div class="controls">
      ${canRender ? controlsTemplate(project) : placeholderControlsTemplate(project)}
    </div>
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
    <button class="outline-button" type="button" data-control="randomize">Randomize seed</button>
  `;
}

function placeholderControlsTemplate(project) {
  return `
    <p class="overview-copy">${project.title} already has its description, model, and notes. A renderer module will activate these controls.</p>
    <button class="outline-button" type="button" disabled>Renderer pending</button>
  `;
}

function mountSelectedSimulation(project) {
  mountedSimulation?.dispose?.();
  mountedSimulation = null;

  const copyLink = $('[data-control="copyLink"]');
  if (copyLink) {
    copyLink.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}${project.route}`;
      try {
        await navigator.clipboard.writeText(url);
        copyLink.textContent = "Copied";
        setTimeout(() => { copyLink.textContent = "Copy link"; }, 1300);
      } catch {
        copyLink.textContent = "Link ready";
        setTimeout(() => { copyLink.textContent = "Copy link"; }, 1300);
      }
    }, { once: false });
  }

  const renderer = rendererRegistry[project.id];
  if (!renderer) return;

  mountedSimulation = renderer({
    canvas: $("#simulationCanvas"),
    chartCanvas: $("#analysisChart"),
    controls: {
      pause: $('[data-control="pause"]'),
      reset: $('[data-control="reset"]'),
      copyLink: $('[data-control="copyLink"]'),
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

// Tag the right-hand side of each rendered equation (everything after the main
// relation), so the highlight lands on that sub-part instead of the whole box.
function markEquationParts() {
  currentEqEls.forEach((eq) => {
    const html = eq.querySelector(".katex-html");
    if (!html) return;
    [...html.querySelectorAll(".eqk")].forEach((s) => s.classList.remove("eqk"));
    const bases = [...html.children].filter((c) => c.classList && c.classList.contains("base"));
    bases.forEach((base) => {
      const kids = [...base.children].filter((c) => !c.classList || !c.classList.contains("strut"));
      const relIdx = kids.findIndex((k) => k.classList && k.classList.contains("mrel"));
      if (relIdx < 0) return;
      for (let i = relIdx + 1; i < kids.length; i++) {
        if (kids[i].classList) kids[i].classList.add("eqk");
      }
    });
  });
}

function selectProject(id, updateHash = false) {
  const project = labProjects.find((item) => item.id === id) || labProjects[0];
  currentProjectId = project.id;
  if (updateHash) history.replaceState(null, "", project.route);
  renderProjectCards(project.id);
  const accent = accentFor(project.category);
  viewportMount.style.setProperty("--accent", accent);
  detailMount.style.setProperty("--accent", accent);
  controlMount.style.setProperty("--accent", accent);
  viewportMount.innerHTML = viewportHTML(project);
  detailMount.innerHTML = detailHTML(project);
  controlMount.innerHTML = controlHTML(project);
  mountSelectedSimulation(project);
  renderMath();
  currentEqEls = [...detailMount.querySelectorAll(".equation")];
  markEquationParts();
  hlIdx = 0;
  hlAccum = 0;
  currentEqEls.forEach((el, i) => el.classList.toggle("eq-active", i === 0));
  revealActiveCard();
}

function navigateProject(delta) {
  const projects = sortedProjects();
  const idx = Math.max(0, projects.findIndex((p) => p.id === currentProjectId));
  const next = projects[(idx + delta + projects.length) % projects.length];
  currentFilter = "All";
  renderFilter();
  selectProject(next.id, true);
}

function navigateVariation(delta) {
  const buttons = [...document.querySelectorAll("[data-variation]")];
  if (!buttons.length) return;
  const idx = Math.max(0, buttons.findIndex((button) => button.classList.contains("active")));
  buttons[(idx + delta + buttons.length) % buttons.length].click();
}

// Keep the active index entry in view by scrolling ONLY the rail list, never the
// window. (Window-level scrollIntoView is what made the page jump to the top when
// re-selecting; controls live in a non-scrollable sticky panel.)
function revealActiveCard() {
  const card = projectCards.querySelector(".project-card.active");
  if (!card) return;
  const listRect = projectCards.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (cardRect.top < listRect.top) {
    projectCards.scrollTop -= listRect.top - cardRect.top + 8;
  } else if (cardRect.bottom > listRect.bottom) {
    projectCards.scrollTop += cardRect.bottom - listRect.bottom + 8;
  }
}

function highlightLoop(ts) {
  if (currentEqEls.length) {
    const sim = mountedSimulation;
    const running = sim && sim.isRunning ? sim.isRunning() : true;
    const stage = sim && sim.getStage ? sim.getStage() : -1;
    let idx;
    if (typeof stage === "number" && stage >= 0) {
      idx = stage % currentEqEls.length;
    } else {
      const dt = hlLast ? ts - hlLast : 0;
      if (running) hlAccum += dt;
      if (hlAccum > 1500) {
        hlAccum = 0;
        hlIdx = (hlIdx + 1) % currentEqEls.length;
      }
      idx = hlIdx;
    }
    for (let i = 0; i < currentEqEls.length; i++) {
      currentEqEls[i].classList.toggle("eq-active", i === idx);
    }
  }
  hlLast = ts;
  requestAnimationFrame(highlightLoop);
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
  if (heroMetrics.projects) heroMetrics.projects.textContent = String(labProjects.length);
  if (heroMetrics.renderers) heroMetrics.renderers.textContent = String(Object.keys(rendererRegistry).length);
  if (heroMetrics.live) heroMetrics.live.textContent = String(labProjects.filter((project) => project.status === "live").length);

  renderFilter();
  if (heroCanvas) runHeroCanvas();

  selectProject(location.hash.replace("#", "") || labProjects[0].id);
  requestAnimationFrame(highlightLoop);

  window.addEventListener("hashchange", () => {
    selectProject(location.hash.replace("#", "") || labProjects[0].id);
  });

  window.addEventListener("keydown", (event) => {
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "j") navigateProject(1);
    if (event.key === "k") navigateProject(-1);
    if (event.key === "]") navigateVariation(1);
    if (event.key === "[") navigateVariation(-1);
  });
}

boot();

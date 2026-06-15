/**
 * Project metadata registry for the Laboratory hub.
 *
 * Add a new experiment by appending a record here, then register its renderer in
 * lab/lab.js. The page layout, sidebar, tags, documentation, math, controls,
 * variations, and metrics render from this schema.
 *
 * @typedef {Object} LabProject
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} description
 * @property {string} category
 * @property {string[]} tags
 * @property {string} thumbnail
 * @property {string} route
 * @property {"live" | "prototype" | "research" | "planned"} status
 * @property {"intro" | "intermediate" | "advanced"} difficulty
 * @property {string} createdAt
 * @property {string[]} mathTopics
 * @property {string} simulationType
 * @property {{id: string, label: string, description: string}[]} variations
 * @property {{count: string, speed: string, turbulence: string, attraction: string, trails: string}} controlLabels
 * @property {{energy: string, order: string, spread: string, fps: string}} metricLabels
 * @property {string[]} overview
 * @property {{label: string, value: string}[]} facts
 * @property {string[]} equations
 * @property {string[]} futureWork
 */

const sharedPerformanceNotes = [
  "Keep the simulation mount/dispose boundary clean so the renderer can later move into React without changing project metadata.",
  "Move expensive updates into a Web Worker when agent counts, pathfinding, or numerical solvers become heavy.",
  "Use URL hashes and stored seeds for reproducible public demos."
];

export const labProjects = [
  {
    id: "behavior-prompt-gridworld",
    title: "Behavior-Prompt Gridworld",
    subtitle: "Can a prompt teach an agent the rule it cannot see?",
    description:
      "A live reconstruction of the BehaviorPrompt Games thesis: an agent infers a latent procedural, causal, or social rule from a prompt condition and acts in DoorKey, SwitchBridge, and Ownership worlds.",
    category: "Game AI",
    tags: ["Behavior Prompting", "Gridworld", "MDP", "Rule Inference"],
    thumbnail: "An agent walks a 7x7 world; the prompt condition decides whether it keeps the hidden rule.",
    route: "#behavior-prompt-gridworld",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Prompt conditions", "Latent rules", "Sufficiency vs compliance"],
    simulationType: "7x7 Gridworld",
    variations: [
      { id: "none", label: "No prompt", description: "Direct-greedy plan that reaches the goal but breaks the latent rule." },
      { id: "text", label: "Text", description: "Text-rule plan that satisfies the prerequisite before the goal." },
      { id: "behavior", label: "Behavior", description: "Demonstration-shaped plan with a brief hesitation, then the rule." },
      { id: "hybrid", label: "Text + behavior", description: "Combined plan using both prompt channels." }
    ],
    controlLabels: {
      count: "History window",
      speed: "Playback speed",
      turbulence: "Execution slip",
      attraction: "Plan preview",
      trails: "Visited heatmap"
    },
    metricLabels: {
      energy: "Episode reward",
      order: "Goal reached",
      spread: "Rule compliance",
      fps: "FPS"
    },
    overview: [
      "Three 7x7 environments hide a different kind of rule: DoorKey is procedural (key before door), SwitchBridge is causal (lever before bridge), and Ownership is social (ask the owner before opening the chest).",
      "Switching the prompt condition swaps the agent's plan. The no-prompt plan greedily reaches the goal but violates the latent rule; text, behavior, and hybrid plans satisfy the prerequisite first. The dashboard tracks goal-reach rate against rule-compliance rate, which is the exact sufficiency-versus-compliance distinction the paper sharpens.",
      "This is the reference template for studying the BehaviorPrompt benchmark on a static page: deterministic rollouts, readable violations, and the social-convention case as the hardest edge."
    ],
    facts: [
      { label: "Environments", value: "DoorKey / SwitchBridge / Ownership" },
      { label: "Prompt conditions", value: "None / text / behavior / hybrid" },
      { label: "Signals", value: "Reward, goal-reach, compliance" },
      { label: "Source", value: "behaviorprompt-games core engine" }
    ],
    equations: [
      "\\pi_{\\text{cond}} : \\text{prompt} \\to \\text{plan}",
      "\\text{success}=\\mathbb{1}[\\text{goal}],\\quad \\text{compliance}=\\mathbb{1}[v=0]",
      "r = 10\\cdot\\mathbb{1}[\\text{goal}] - 5\\,v - 0.1\\,t"
    ],
    futureWork: [
      "Add the six baseline agents (Random Walk through Oracle) and a condition-by-agent sufficiency matrix.",
      "Export per-step trajectory traces matching the benchmark JSON schema.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "particle-policy-field",
    title: "Particle Policy Field",
    subtitle: "Steering agents through a living vector field",
    description:
      "A responsive canvas system for testing how simple policy rules create collective motion, readable traces, and emergent clusters.",
    category: "Simulation",
    tags: ["Canvas", "Agents", "Vector Field", "Realtime"],
    thumbnail: "Gradient-following agents leave luminous traces across a calibrated field.",
    route: "#particle-policy-field",
    status: "live",
    difficulty: "intro",
    createdAt: "2026-06-15",
    mathTopics: ["Dynamical systems", "Vector fields", "Collective behavior"],
    simulationType: "2D Canvas",
    variations: [
      { id: "calm", label: "Calm", description: "Low-noise field lines with gentle convergence." },
      { id: "swarm", label: "Swarm", description: "Dense collective motion with stronger pointer response." },
      { id: "trace", label: "Trace", description: "Long-exposure paths for visual analysis." },
      { id: "vortex", label: "Vortex", description: "Circular attractors and rotating local flow." },
      { id: "comet", label: "Comet", description: "Fast directional streams with trailing clusters." },
      { id: "lattice", label: "Lattice", description: "Quantized flow directions with grid-like drift." }
    ],
    controlLabels: {
      count: "Agent count",
      speed: "Speed",
      turbulence: "Turbulence",
      attraction: "Pointer pull",
      trails: "Persistent traces"
    },
    metricLabels: {
      energy: "Kinetic energy",
      order: "Alignment",
      spread: "Spatial spread",
      fps: "FPS"
    },
    overview: [
      "This template treats each point as a lightweight agent. Every frame, agents sample a procedural vector field, blend that direction with noise and pointer attraction, then leave a short visual trace.",
      "The new variation layer turns the same renderer into distinct research moods: calm flow, dense swarm, long-exposure trace, vortex, comet stream, and quantized lattice.",
      "Use this as the base pattern for game prototypes, math notebooks, AI-agent sandboxes, or heavier simulations moved into a Web Worker later."
    ],
    facts: [
      { label: "Renderer", value: "Canvas 2D + requestAnimationFrame" },
      { label: "Variation count", value: "6 field policies" },
      { label: "Controls", value: "Sliders, seed, toggle, presets" },
      { label: "Performance path", value: "Worker-ready simulation boundary" }
    ],
    equations: [
      "\\theta_i(t) = \\operatorname{atan2}(F_y(p_i,t), F_x(p_i,t)) + \\eta_i",
      "v_i(t+1) = \\alpha v_i(t) + (1-\\alpha) s[\\cos\\theta_i, \\sin\\theta_i]",
      "p_i(t+1) = p_i(t) + v_i(t+1)\\Delta t"
    ],
    futureWork: [
      "Add flocking rules such as separation, cohesion, and alignment.",
      "Record parameter snapshots as shareable URLs.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "agent-arena",
    title: "Agent Arena",
    subtitle: "A compact sandbox for competing policies",
    description:
      "A live game-AI environment for comparing pursuit, evasion, patrol, and pressure policies in a small playable world.",
    category: "AI Agent",
    tags: ["Game AI", "Policy", "Evaluation", "Canvas"],
    thumbnail: "Competing policies, state logs, and compact game boards in one interface.",
    route: "#agent-arena",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Markov decision processes", "Reward shaping", "Evaluation"],
    simulationType: "Canvas Grid",
    variations: [
      { id: "pursuit", label: "Pursuit", description: "Seekers chase nearest runners with direct policy pressure." },
      { id: "evasion", label: "Evasion", description: "Runners prioritize distance, corners, and safe corridors." },
      { id: "patrol", label: "Patrol", description: "Seekers sweep between patrol anchors before chasing." },
      { id: "pressure", label: "Pressure", description: "Seekers bias toward enclosing the center of mass." }
    ],
    controlLabels: {
      count: "Population budget",
      speed: "Policy speed",
      turbulence: "Decision noise",
      attraction: "Goal bias",
      trails: "Show traces"
    },
    metricLabels: {
      energy: "Reward",
      order: "Capture rate",
      spread: "Coverage",
      fps: "FPS"
    },
    overview: [
      "Agent Arena is a miniature policy playground. Seekers, runners, goals, and obstacles update inside a compact world so you can compare how simple strategy changes affect behavior.",
      "The variation buttons switch the policy prior without leaving the standardized project page. This is the pattern to reuse for future LLM planners, accessibility agents, or playable test environments.",
      "Metrics are intentionally lightweight: reward, capture rate, coverage, and frame rate. They are meant to be replaced with real experiment outputs as the project matures."
    ],
    facts: [
      { label: "Renderer", value: "Canvas grid arena" },
      { label: "Agent types", value: "Seekers, runners, goals" },
      { label: "Variation count", value: "4 policy modes" },
      { label: "Evaluation", value: "Reward, capture, coverage" }
    ],
    equations: [
      "V^\\pi(s)=\\mathbb{E}_\\pi\\left[\\sum_{t=0}^{T}\\gamma^t r_t \\mid s_0=s\\right]",
      "\\pi(a\\mid s) = \\operatorname{softmax}(Q(s,a)/\\tau)"
    ],
    futureWork: [
      "Define a formal environment API: reset, step, observe, render, dispose.",
      "Add replay export for comparing agent decisions over time.",
      "Connect policy modules to behavior trees, search agents, or LLM-generated plans.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "maze-chase",
    title: "Maze Chase",
    subtitle: "Pursuit and evasion in a generated maze",
    description:
      "A self-playing chase: a prey agent runs a BFS toward pellets while keeping distance from hunters that descend a distance field rooted at the prey.",
    category: "Game Prototype",
    tags: ["Pathfinding", "BFS", "Pursuit", "Maze"],
    thumbnail: "Hunters close in along the shortest path while the prey threads pellets and corridors.",
    route: "#maze-chase",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Graph search", "Distance fields", "Pursuit-evasion"],
    simulationType: "Maze / Grid",
    variations: [
      { id: "classic", label: "Classic", description: "Balanced hunters and a tight maze." },
      { id: "aggressive", label: "Aggressive", description: "Four direct hunters with low noise." },
      { id: "scatter", label: "Scatter", description: "Fewer, noisier hunters that wander." },
      { id: "open", label: "Open", description: "Looped, open arena with more escape routes." }
    ],
    controlLabels: {
      count: "Maze size",
      speed: "Tick rate",
      turbulence: "Decision noise",
      attraction: "Hunter focus",
      trails: "Path heatmap"
    },
    metricLabels: { energy: "Pellets", order: "Survival", spread: "Coverage", fps: "FPS" },
    overview: [
      "The maze is carved with a randomized recursive backtracker, then hunters and prey play on the passage lattice.",
      "Each tick the prey solves a BFS to the nearest pellet and weighs it against distance from the closest hunter; hunters follow the gradient of a BFS distance field rooted at the prey. The maps are the 'Maze Chase' classic-inspired template from the benchmark catalog.",
      "Reuse this as the base for route pressure, level pacing, or accessibility pursuit studies."
    ],
    facts: [
      { label: "Renderer", value: "Maze lattice + BFS" },
      { label: "Agents", value: "Prey + 2-4 hunters" },
      { label: "Generation", value: "Recursive backtracker" },
      { label: "Signals", value: "Pellets, survival, coverage" }
    ],
    equations: ["d(s)=\\operatorname{BFS}(s_{\\text{prey}})", "a^* = \\arg\\min_{a} d(s'_a)"],
    futureWork: [
      "Add a learned pursuit policy and compare against the BFS baseline.",
      "Score route pressure and bottlenecks for level-design feedback.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "snake-growth",
    title: "Snake Growth",
    subtitle: "A snake AI that tries not to trap itself",
    description:
      "One or more self-playing snakes choose moves with a greedy-toward-food term and a flood-fill safety term that estimates reachable free space.",
    category: "Game Prototype",
    tags: ["Heuristic AI", "Flood Fill", "Self-Play", "Snake"],
    thumbnail: "Snakes chase food while reserving room to breathe, measured by reachable space.",
    route: "#snake-growth",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Heuristic search", "Connectivity", "Safety estimation"],
    simulationType: "Grid Board",
    variations: [
      { id: "solo", label: "Solo", description: "A single snake with room to grow." },
      { id: "duel", label: "Duel", description: "Two snakes sharing the board." },
      { id: "swarm", label: "Swarm", description: "Four snakes competing for food." },
      { id: "torus", label: "Torus", description: "Edges wrap; no walls to die on." }
    ],
    controlLabels: {
      count: "Board size",
      speed: "Tick rate",
      turbulence: "Move noise",
      attraction: "Food greed",
      trails: "Trail fade"
    },
    metricLabels: { energy: "Longest", order: "Eat rate", spread: "Board fill", fps: "FPS" },
    overview: [
      "Each tick a snake scores its legal moves: distance to the nearest food (weighted by greed) plus the size of the free region a flood fill can reach from the candidate head cell.",
      "The safety term is what keeps the snake from sealing itself into a pocket as it grows. Maps the 'Snake-like Growth' classic-inspired template.",
      "A clean target for swapping in a search or learned policy and measuring efficiency against this heuristic."
    ],
    facts: [
      { label: "Renderer", value: "Grid board + flood fill" },
      { label: "Snakes", value: "1-4 self-playing" },
      { label: "Policy", value: "Greedy + safety heuristic" },
      { label: "Signals", value: "Length, eat rate, fill" }
    ],
    equations: ["\\text{score}(a)=\\lambda_f\\,(-\\lVert h'-f\\rVert_1)+\\lambda_s\\,\\operatorname{flood}(h')"],
    futureWork: [
      "Add Hamiltonian-cycle and lookahead policies as comparison baselines.",
      "Log near-trap recoveries to study the safety term's effect.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "light-cycle-arena",
    title: "Light Cycle Arena",
    subtitle: "Two autonomous cycles, last wall standing",
    description:
      "Tron-style agents pick turns by estimating reachable open space ahead, with an optional aggression term that biases toward cutting off the opponent.",
    category: "AI Agent",
    tags: ["Game AI", "Flood Fill", "Adversarial", "Tron"],
    thumbnail: "Neon trails fill the arena as each cycle hunts for space and survival.",
    route: "#light-cycle-arena",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Adversarial play", "Space control", "Survival"],
    simulationType: "Arena Grid",
    variations: [
      { id: "duel", label: "Duel", description: "Two cycles, space-maximizing play." },
      { id: "triple", label: "Triple", description: "Three cycles competing for territory." },
      { id: "survival", label: "Survival", description: "Aggressive cut-off bias." },
      { id: "torus", label: "Torus", description: "Wrap-around arena edges." }
    ],
    controlLabels: {
      count: "Arena size",
      speed: "Cycle speed",
      turbulence: "Risk taking",
      attraction: "Aggression",
      trails: "Persistent walls"
    },
    metricLabels: { energy: "Round length", order: "Win balance", spread: "Territory", fps: "FPS" },
    overview: [
      "Each cycle considers turning left, going straight, or turning right, and scores each by the open area a flood fill can reach from the next cell. Aggression adds a term that pulls the cycle toward cutting off its rival.",
      "Last cycle alive wins the round; a win tally accrues across rounds. This is the 'Light Cycle Arena' template, and it deliberately echoes the endless AI-vs-AI match in the main site's hero.",
      "A compact adversarial environment for space-control policies."
    ],
    facts: [
      { label: "Renderer", value: "Arena grid + flood fill" },
      { label: "Cycles", value: "2-3 autonomous" },
      { label: "Policy", value: "Space + aggression" },
      { label: "Signals", value: "Round length, win balance" }
    ],
    equations: ["a^*=\\arg\\max_{a}\\operatorname{area}(\\operatorname{flood}(s'_a))"],
    futureWork: [
      "Add minimax or Monte-Carlo rollouts for deeper cut-off play.",
      "Track territory share over time for strategy analysis.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "frozen-lake",
    title: "FrozenLake Value Iteration",
    subtitle: "Solve the MDP, watch the policy slip",
    description:
      "The classic stochastic gridworld solved live with value iteration: a value heatmap, a greedy policy field, and an agent acting under the slippery transition model.",
    category: "Simulation",
    tags: ["MDP", "Value Iteration", "RL", "Policy"],
    thumbnail: "Value spreads out from the goal; arrows show the policy; the agent slips on the ice.",
    route: "#frozen-lake",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Markov decision processes", "Dynamic programming", "Stochastic policies"],
    simulationType: "RL Gridworld",
    variations: [
      { id: "fourbyfour", label: "4x4", description: "Small lake, fast convergence." },
      { id: "eightbyeight", label: "8x8", description: "Larger lake with more holes." },
      { id: "slippery", label: "Slippery", description: "High slip probability." },
      { id: "deterministic", label: "Deterministic", description: "No slip; pure shortest path." }
    ],
    controlLabels: {
      count: "Grid size",
      speed: "Agent speed",
      turbulence: "Ice slip",
      attraction: "Discount γ",
      trails: "Value heatmap"
    },
    metricLabels: { energy: "Success rate", order: "V(start)", spread: "Coverage", fps: "FPS" },
    overview: [
      "Value iteration runs to convergence over the gridworld, with the slip probability and discount factor wired to the sliders so you can watch the value function and policy reshape in real time.",
      "The agent then follows the greedy policy, but the slippery dynamics push it sideways, so reaching the goal is never guaranteed. Maps the 'FrozenLake' CS/RL template.",
      "An honest, legible window into dynamic programming and stochastic control."
    ],
    facts: [
      { label: "Solver", value: "Value iteration to 1e-5" },
      { label: "Dynamics", value: "Slippery transitions" },
      { label: "Render", value: "Value heatmap + policy arrows" },
      { label: "Signals", value: "Success, V(start), coverage" }
    ],
    equations: [
      "V_{k+1}(s)=\\max_{a}\\sum_{s'}P(s'\\mid s,a)\\,[r+\\gamma V_k(s')]",
      "\\pi(s)=\\arg\\max_{a} Q(s,a)"
    ],
    futureWork: [
      "Add Q-learning and SARSA so learned values can be compared to the optimum.",
      "Overlay state-visitation counts from the acting agent.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "cartpole-control",
    title: "CartPole Control",
    subtitle: "An ensemble of pole balancers",
    description:
      "A population of inverted-pendulum controllers running the classic cartpole dynamics under PD and energy-pumping control, with disturbance noise and gain on the sliders.",
    category: "Simulation",
    tags: ["Control", "Physics", "RL", "Dynamics"],
    thumbnail: "Lanes of cartpoles stabilize, swing up, or fight the wind together.",
    route: "#cartpole-control",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Classical control", "Nonlinear dynamics", "Stability"],
    simulationType: "Physics Ensemble",
    variations: [
      { id: "balance", label: "Balance", description: "Start near upright; PD keeps it there." },
      { id: "swingup", label: "Swing-up", description: "Start hanging; energy pumping then capture." },
      { id: "windy", label: "Windy", description: "Random lateral disturbances." },
      { id: "heavy", label: "Heavy", description: "Longer, heavier pole." }
    ],
    controlLabels: {
      count: "Ensemble size",
      speed: "Sim speed",
      turbulence: "Disturbance",
      attraction: "Controller gain",
      trails: "Motion blur"
    },
    metricLabels: { energy: "Upright", order: "Balance", spread: "Position spread", fps: "FPS" },
    overview: [
      "Every lane integrates the standard cartpole equations of motion. Near the top the controller is a proportional-derivative law on angle and cart position; the swing-up variation adds an energy-pumping controller that injects energy until the pole can be caught.",
      "Watching a whole ensemble exposes how gain, disturbance, and pole inertia move the population between balanced and unstable. Maps the 'CartPole Balance' template.",
      "A drop-in surface for comparing controllers, including learned policies."
    ],
    facts: [
      { label: "Integrator", value: "Semi-implicit Euler, dt 0.02" },
      { label: "Controllers", value: "PD + energy swing-up" },
      { label: "Ensemble", value: "1-12 lanes" },
      { label: "Signals", value: "Upright, balance, spread" }
    ],
    equations: [
      "\\ddot\\theta = \\frac{g\\sin\\theta - \\cos\\theta\\,\\frac{F+m_p\\ell\\dot\\theta^2\\sin\\theta}{m_c+m_p}}{\\ell\\left(\\frac{4}{3}-\\frac{m_p\\cos^2\\theta}{m_c+m_p}\\right)}",
      "u = -(k_1\\theta + k_2\\dot\\theta + k_3 x + k_4\\dot x)"
    ],
    futureWork: [
      "Add an LQR controller and a learned policy as ensemble members.",
      "Plot phase portraits for individual controllers.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "boids-3d",
    title: "Boids 3D",
    subtitle: "Flocking in a volume, not a plane",
    description:
      "Reynolds separation, alignment, and cohesion in full 3D, projected with a hand-rolled pinhole camera. Depth cues sell the volume; a predator variation adds a chaser.",
    category: "Simulation",
    tags: ["3D", "Flocking", "Emergence", "Agents"],
    thumbnail: "A swarm wheels through a wireframe cube as the camera orbits.",
    route: "#boids-3d",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Collective behavior", "3D projection", "Steering"],
    simulationType: "3D Canvas",
    variations: [
      { id: "flock", label: "Flock", description: "Balanced cohesion and alignment." },
      { id: "scatter", label: "Scatter", description: "Strong separation, loose flock." },
      { id: "predator", label: "Predator", description: "A chaser the flock evades." },
      { id: "vortex", label: "Vortex", description: "A tangential field stirs the swarm." }
    ],
    controlLabels: {
      count: "Boid count",
      speed: "Flight speed",
      turbulence: "Jitter",
      attraction: "Cohesion",
      trails: "Motion blur"
    },
    metricLabels: { energy: "Mean speed", order: "Alignment", spread: "Spread", fps: "FPS" },
    overview: [
      "Each boid steers by three local rules within a perception radius, all computed in three dimensions, then the scene is projected to the canvas with a yaw and pitch camera orbit. No external 3D library is used, so the whole project stays static-site friendly.",
      "Draw order, size, and alpha follow depth so the cube reads as a real volume. The predator and vortex variations show how a single global force reshapes the emergent flock.",
      "A reusable 3D substrate for swarm, crowd, or particle research."
    ],
    facts: [
      { label: "Renderer", value: "Canvas 2D + pinhole 3D" },
      { label: "Rules", value: "Separation / alignment / cohesion" },
      { label: "Camera", value: "Orbiting yaw + pitch" },
      { label: "Signals", value: "Speed, alignment, spread" }
    ],
    equations: [
      "\\mathbf{v}_i \\mathrel{+}= w_s\\mathbf{s}_i + w_a\\mathbf{a}_i + w_c\\mathbf{c}_i",
      "\\hat p = K\\,R_y(\\psi)R_x(\\phi)(p-c)"
    ],
    futureWork: [
      "Add obstacle avoidance and a depth-sorted shaded body model.",
      "Move the neighbor query into a spatial hash for larger flocks.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "optimizer-landscape-3d",
    title: "Optimizer Landscape 3D",
    subtitle: "Agents descending a loss surface",
    description:
      "A rotating wireframe height field with a population of optimizers doing gradient descent, momentum, SGD, or annealing on the analytic gradient toward minima.",
    category: "Math Visualization",
    tags: ["3D", "Optimization", "Gradient Descent", "Landscape"],
    thumbnail: "Optimizers roll downhill across a glowing wireframe of wells and ridges.",
    route: "#optimizer-landscape-3d",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Optimization", "Gradients", "3D surfaces"],
    simulationType: "3D Surface",
    variations: [
      { id: "descent", label: "Descent", description: "Plain gradient descent." },
      { id: "momentum", label: "Momentum", description: "Heavy-ball momentum." },
      { id: "noisy", label: "Noisy (SGD)", description: "Stochastic gradient noise." },
      { id: "annealing", label: "Annealing", description: "Noise that cools over time." }
    ],
    controlLabels: {
      count: "Optimizer count",
      speed: "Learning rate",
      turbulence: "Gradient noise",
      attraction: "Momentum",
      trails: "Descent paths"
    },
    metricLabels: { energy: "Fitness", order: "Converged", spread: "Spread", fps: "FPS" },
    overview: [
      "The loss surface is a gentle bowl plus a handful of gaussian wells, drawn as a projected wireframe mesh colored by height. A population of optimizers descends the analytic gradient with momentum and noise wired to the sliders.",
      "Watching many optimizers at once exposes the difference between plain descent, momentum overshoot, stochastic exploration, and cooling annealing, and shows which minima trap which runs. It renders the 'agents navigating a value landscape' idea literally.",
      "A teaching surface for optimization and a 3D companion to the RL environments."
    ],
    facts: [
      { label: "Surface", value: "Bowl + gaussian wells" },
      { label: "Optimizers", value: "Descent / momentum / SGD / anneal" },
      { label: "Camera", value: "Orbiting wireframe" },
      { label: "Signals", value: "Fitness, converged, spread" }
    ],
    equations: [
      "\\theta_{t+1} = \\theta_t - \\eta\\,\\nabla f(\\theta_t) + \\mu\\,\\Delta\\theta_t",
      "f(x,y)=\\tfrac{1}{2}\\lVert p\\rVert^2 - \\sum_k d_k\\,e^{-\\lVert p-c_k\\rVert^2/2s_k^2}"
    ],
    futureWork: [
      "Add Adam and RMSProp as optimizer variations.",
      "Let users place wells by clicking the surface.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "ludic-geometry",
    title: "Ludic Geometry Notebook",
    subtitle: "Interactive math sketches for play and HCI research",
    description:
      "A live visual notebook for geometry, probability, and interaction models with responsive diagrams and math context.",
    category: "Math Visualization",
    tags: ["Canvas", "Math", "Notebook", "Visual Proof"],
    thumbnail: "Equation blocks and dynamic diagrams share the same research surface.",
    route: "#ludic-geometry",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Geometry", "Probability", "Interaction modeling"],
    simulationType: "Parametric Canvas",
    variations: [
      { id: "orbit", label: "Orbit", description: "Nested orbital curves with harmonic phase offsets." },
      { id: "rose", label: "Rose", description: "Polar curves for symmetry and rhythm studies." },
      { id: "interference", label: "Interference", description: "Wave interference fields and crossing contours." },
      { id: "boundary", label: "Boundary", description: "Decision-boundary sketches with moving samples." },
      { id: "chaos", label: "Chaos", description: "Noisy phase maps with sensitive initial conditions." }
    ],
    controlLabels: {
      count: "Sample count",
      speed: "Motion rate",
      turbulence: "Distortion",
      attraction: "Coupling",
      trails: "Trace memory"
    },
    metricLabels: {
      energy: "Curvature",
      order: "Symmetry",
      spread: "Coverage",
      fps: "FPS"
    },
    overview: [
      "This project turns the lab into an interactive math notebook. Each variation draws a different family of geometric or probabilistic forms while preserving the same documentation and metric structure.",
      "The goal is not to be a full CAS. It is a refined visual explanation surface where equations, diagrams, and interaction parameters live together.",
      "This can later become an MDX-backed notebook if the website moves to a build system."
    ],
    facts: [
      { label: "Renderer", value: "Parametric Canvas" },
      { label: "Variation count", value: "5 visual systems" },
      { label: "Use case", value: "Research explanation and teaching demos" },
      { label: "Migration path", value: "MDX + KaTeX-ready content" }
    ],
    equations: [
      "r(\\theta)=a\\cos(k\\theta + \\phi)",
      "P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}",
      "d(x, C)=\\min_{c\\in C}\\lVert x-c\\rVert_2"
    ],
    futureWork: [
      "Add draggable handles, diagram snapshots, and shareable parameter URLs.",
      "Introduce D3 or SVG renderers for diagrams that need precise labeling.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "reaction-diffusion",
    title: "Reaction–Diffusion",
    subtitle: "Two chemicals, one emergent skin",
    description:
      "A Gray–Scott reaction-diffusion system: local diffusion and reaction rules grow corals, mitosis, worms, spots, and waves. Drag on the canvas to seed reagent.",
    category: "Simulation",
    tags: ["Generative", "PDE", "Emergence", "Canvas"],
    thumbnail: "Tiny changes to feed and kill rates flip the pattern from spots to worms to coral.",
    route: "#reaction-diffusion",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Reaction-diffusion", "Partial differential equations", "Pattern formation"],
    simulationType: "Grid PDE",
    variations: [
      { id: "coral", label: "Coral", description: "Branching coral growth." },
      { id: "mitosis", label: "Mitosis", description: "Self-replicating cells." },
      { id: "worms", label: "Worms", description: "Wandering labyrinthine stripes." },
      { id: "spots", label: "Spots", description: "Stable spotted texture." },
      { id: "waves", label: "Waves", description: "Travelling wave fronts." }
    ],
    controlLabels: {
      count: "Resolution",
      speed: "Iterations / frame",
      turbulence: "Seeding",
      attraction: "Kill balance",
      trails: "Warm palette"
    },
    metricLabels: { energy: "Mean V", order: "Peak", spread: "Active area", fps: "FPS" },
    overview: [
      "Each cell holds two reagent concentrations that diffuse at different rates and react where they meet. The feed rate f and kill rate k decide which pattern is stable, and the variation buttons jump between five classic regimes.",
      "It is a canonical demonstration that purely local rules produce global structure — the same theme as the agent simulations, in continuous form. Drag the pointer to inject reagent and watch the field heal.",
      "Computed on a downsampled grid and drawn through an ImageData buffer for speed."
    ],
    facts: [
      { label: "Model", value: "Gray–Scott, 9-point Laplacian" },
      { label: "Render", value: "ImageData buffer, scaled" },
      { label: "Interaction", value: "Pointer seeding" },
      { label: "Regimes", value: "5 feed/kill presets" }
    ],
    equations: [
      "\\dot u = D_u\\nabla^2 u - uv^2 + f(1-u)",
      "\\dot v = D_v\\nabla^2 v + uv^2 - (f+k)v"
    ],
    futureWork: [
      "Move the solver into a Web Worker or WebGL fragment shader for full-resolution grids.",
      "Add a live (f, k) parameter map so users can dial in new regimes.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "q-learning-gridworld",
    title: "Q-Learning Gridworld",
    subtitle: "A value table that learns on screen",
    description:
      "A tabular temporal-difference agent learning by trial and error across Cliff Walking, Four Rooms, Maze, and Open layouts. The value heatmap and policy arrows improve live.",
    category: "AI Agent",
    tags: ["Reinforcement Learning", "TD", "Q-Learning", "Policy"],
    thumbnail: "ε-greedy exploration cools as the value function spreads back from the goal.",
    route: "#q-learning-gridworld",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Reinforcement learning", "Temporal-difference learning", "Exploration"],
    simulationType: "RL Gridworld",
    variations: [
      { id: "cliff", label: "Cliff Walking", description: "A cliff edge punishes greedy shortcuts." },
      { id: "fourrooms", label: "Four Rooms", description: "Four rooms joined by doorways." },
      { id: "maze", label: "Maze", description: "A carved maze to navigate." },
      { id: "open", label: "Open", description: "An open room, fast convergence." }
    ],
    controlLabels: {
      count: "Grid size",
      speed: "Steps / frame",
      turbulence: "Exploration ε",
      attraction: "Learning rate α",
      trails: "Value heatmap"
    },
    metricLabels: { energy: "Success", order: "Avg return", spread: "Coverage", fps: "FPS" },
    overview: [
      "Unlike the FrozenLake project, which solves the MDP with dynamic programming, this agent has no model — it learns Q-values from experience using the temporal-difference update, with ε-greedy exploration that decays as it improves.",
      "The Cliff Walking and Four Rooms layouts come straight from the benchmark catalog. The chart is a live learning curve: success rate, average return, and coverage as episodes accumulate.",
      "A clean substrate for comparing exploration schedules or swapping in SARSA, Expected-SARSA, or function approximation."
    ],
    facts: [
      { label: "Algorithm", value: "Tabular Q-learning (TD)" },
      { label: "Layouts", value: "Cliff / Four Rooms / Maze / Open" },
      { label: "Exploration", value: "Decaying ε-greedy" },
      { label: "Signals", value: "Success, return, coverage" }
    ],
    equations: [
      "Q(s,a) \\leftarrow Q(s,a) + \\alpha\\,[\\,r + \\gamma\\max_{a'}Q(s',a') - Q(s,a)\\,]",
      "\\pi(s) = \\arg\\max_a Q(s,a)"
    ],
    futureWork: [
      "Add SARSA and Expected-SARSA as comparison agents on the same layout.",
      "Plot per-state visitation and TD-error to show where learning is active.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "pathfinding-search",
    title: "Pathfinding Search",
    subtitle: "A*, Dijkstra, Greedy, and BFS, side by side",
    description:
      "A search visualizer that expands the open and closed sets across an obstacle field, then reconstructs the path — making the difference between informed and uninformed search visible.",
    category: "Math Visualization",
    tags: ["Search", "A*", "Graphs", "Heuristics"],
    thumbnail: "A* threads toward the goal while Dijkstra and BFS flood outward in rings.",
    route: "#pathfinding-search",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Graph search", "Heuristics", "Optimality"],
    simulationType: "Search Grid",
    variations: [
      { id: "astar", label: "A*", description: "Cost-so-far plus a Manhattan heuristic." },
      { id: "dijkstra", label: "Dijkstra", description: "Uniform-cost, no heuristic." },
      { id: "greedy", label: "Greedy", description: "Heuristic only — fast but not optimal." },
      { id: "bfs", label: "BFS", description: "First-in-first-out flood fill." }
    ],
    controlLabels: {
      count: "Grid size",
      speed: "Expansions / frame",
      turbulence: "Obstacle density",
      attraction: "Heuristic weight",
      trails: "Show frontier"
    },
    metricLabels: { energy: "Path quality", order: "Efficiency", spread: "Explored", fps: "FPS" },
    overview: [
      "All four strategies share one expansion loop and differ only in how they prioritize the open set, so the contrast is exact: A*'s heuristic focuses the search, Dijkstra and BFS flood outward uniformly, and greedy charges at the goal but can take long detours.",
      "Raising the heuristic weight turns A* toward greedy behavior — fewer expansions, less optimal paths. When the field has no route, the search reports it and regenerates.",
      "A direct visual companion to the catalog's search-based environments."
    ],
    facts: [
      { label: "Strategies", value: "A* / Dijkstra / Greedy / BFS" },
      { label: "Heuristic", value: "Manhattan, weightable" },
      { label: "Output", value: "Frontier, closed set, path" },
      { label: "Signals", value: "Path quality, efficiency, explored" }
    ],
    equations: ["f(n) = g(n) + w\\,h(n)", "h(n) = \\lVert n - \\text{goal}\\rVert_1"],
    futureWork: [
      "Add jump-point search and a side-by-side expansion counter across strategies.",
      "Allow click-to-draw walls and draggable start/goal.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "wumpus-world",
    title: "Wumpus World",
    subtitle: "Reasoning under partial observation",
    description:
      "A partially observable cave where pits, a wumpus, and gold are hidden. The agent only sees local percepts and infers which cells are provably safe before exploring.",
    category: "Game AI",
    tags: ["POMDP", "Logical Inference", "Exploration", "Risk"],
    thumbnail: "No breeze and no stench proves the neighbors safe; the agent grows its safe frontier.",
    route: "#wumpus-world",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Partial observability", "Logical inference", "Decision under uncertainty"],
    simulationType: "POMDP Gridworld",
    variations: [
      { id: "classic", label: "Classic", description: "Balanced cave, moderate pits." },
      { id: "small", label: "Small", description: "A compact cave to read clearly." },
      { id: "large", label: "Large", description: "A bigger cave to explore." },
      { id: "dense", label: "Dense", description: "Many pits — frequent hard choices." }
    ],
    controlLabels: {
      count: "Cave size",
      speed: "Playback",
      turbulence: "Pit density",
      attraction: "Caution",
      trails: "Knowledge overlay"
    },
    metricLabels: { energy: "Gold", order: "Survival", spread: "Explored", fps: "FPS" },
    overview: [
      "The agent perceives only breeze (a pit is adjacent), stench (the wumpus is adjacent), and glitter (gold is here). The key inference is sound: a visited cell with neither breeze nor stench proves every neighbor safe.",
      "It explores the reachable safe frontier first; when none remains, it takes the least-suspected gamble (or, if too cautious, abandons the cave). The knowledge overlay shows visited, proven-safe, and suspected cells — the agent's belief, not the ground truth.",
      "A compact stand-in for the catalog's POMDP environments and the social/causal inference theme."
    ],
    facts: [
      { label: "Observability", value: "Local percepts only" },
      { label: "Inference", value: "Safe-neighbor deduction" },
      { label: "Fallback", value: "Least-risk frontier choice" },
      { label: "Signals", value: "Gold, survival, explored" }
    ],
    equations: ["\\neg\\text{breeze}(s)\\wedge\\neg\\text{stench}(s)\\;\\Rightarrow\\;\\forall n\\in N(s):\\ \\text{safe}(n)"],
    futureWork: [
      "Add a full propositional/SAT knowledge base for complete inference.",
      "Track and visualize per-cell pit/wumpus probabilities.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "nbody-gravity-3d",
    title: "N-Body Gravity 3D",
    subtitle: "Orbits, clusters, and collisions in 3D",
    description:
      "Softened Newtonian gravity for a population of bodies, rendered in 3D with an orbiting camera — circular orbits, gravitational clusters, binary systems, and colliding clouds.",
    category: "Simulation",
    tags: ["3D", "Physics", "Gravity", "Dynamics"],
    thumbnail: "Satellites trace orbits around a heavy primary as the camera circles the scene.",
    route: "#nbody-gravity-3d",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Newtonian gravity", "N-body dynamics", "Numerical integration"],
    simulationType: "3D Physics",
    variations: [
      { id: "orbits", label: "Orbits", description: "A heavy primary with orbiting satellites." },
      { id: "cluster", label: "Cluster", description: "A self-gravitating cloud." },
      { id: "binary", label: "Binary", description: "Two stars and their entourage." },
      { id: "collision", label: "Collision", description: "Two clouds on a collision course." }
    ],
    controlLabels: {
      count: "Body count",
      speed: "Time step",
      turbulence: "Velocity spread",
      attraction: "Gravity G",
      trails: "Motion trails"
    },
    metricLabels: { energy: "Kinetic", order: "Ang. momentum", spread: "Radius", fps: "FPS" },
    overview: [
      "Every body feels the softened gravitational pull of every other, integrated each frame. The softening term keeps close encounters from blowing up, and the initial conditions per variation set circular orbits, a diffuse cluster, a binary pair, or two colliding clouds.",
      "The same hand-rolled pinhole camera as the other 3D scenes projects and depth-sorts the bodies, with motion trails tracing the orbits. No external 3D library is used.",
      "A physics companion to the Boids and Optimizer 3D scenes."
    ],
    facts: [
      { label: "Force", value: "Softened Newtonian gravity" },
      { label: "Integration", value: "Semi-implicit Euler" },
      { label: "Render", value: "Pinhole 3D, depth-sorted" },
      { label: "Signals", value: "Kinetic, angular momentum, radius" }
    ],
    equations: [
      "\\mathbf{a}_i = G\\sum_{j\\neq i}\\frac{m_j(\\mathbf{r}_j-\\mathbf{r}_i)}{(\\lVert\\mathbf{r}_j-\\mathbf{r}_i\\rVert^2+\\epsilon)^{3/2}}"
    ],
    futureWork: [
      "Add a Barnes–Hut tree so body counts can scale far higher.",
      "Track total energy and momentum to show integration drift.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "accessibility-signal-lab",
    title: "Accessibility Signal Lab",
    subtitle: "Telemetry sketches for inclusive game assistance",
    description:
      "A registered research slot for visualizing player state, intervention timing, and assistant confidence in accessibility-centered game AI.",
    category: "Research Tool",
    tags: ["Accessibility", "Game UX", "Telemetry", "AI Assistant"],
    thumbnail: "Player signals, confidence bands, and intervention windows on a shared timeline.",
    route: "#accessibility-signal-lab",
    status: "prototype",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Time series", "Uncertainty", "Human-AI interaction"],
    simulationType: "Timeline / Charts",
    variations: [
      { id: "confidence", label: "Confidence", description: "Assistant confidence and uncertainty bands." },
      { id: "intervention", label: "Intervention", description: "Timing windows for help, hint, or automation." },
      { id: "fatigue", label: "Fatigue", description: "Long-session signal drift and adaptation." }
    ],
    controlLabels: {
      count: "Signal density",
      speed: "Playback speed",
      turbulence: "Noise",
      attraction: "Assistant weight",
      trails: "Show history"
    },
    metricLabels: {
      energy: "Confidence",
      order: "Agreement",
      spread: "Signal drift",
      fps: "FPS"
    },
    overview: [
      "This slot is ready for an accessibility-focused research tool: time-series signals, confidence bands, intervention windows, and assistant decisions.",
      "It is intentionally registered before the renderer exists, so the dashboard can scale as soon as real data or design studies are ready."
    ],
    facts: [
      { label: "Planned renderer", value: "SVG timelines or Canvas charts" },
      { label: "Data model", value: "Player events + assistant state" },
      { label: "Research fit", value: "Game accessibility and GAIA studies" }
    ],
    equations: [
      "u_t = \\lambda u_{t-1} + (1-\\lambda)x_t",
      "H(p)=-\\sum_i p_i\\log p_i"
    ],
    futureWork: [
      "Define a JSON event schema for player signals and assistant interventions.",
      "Add event brushing, confidence intervals, and replay controls.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "procedural-playtest-board",
    title: "Procedural Playtest Board",
    subtitle: "Fast prototypes for level pacing and player routes",
    description:
      "A future level-design workbench for testing procedural layouts, pacing curves, route pressure, and player flow.",
    category: "Game Prototype",
    tags: ["Level Design", "Procedural", "Playtest", "Flow"],
    thumbnail: "Small generated boards with routes, heatmaps, and pacing markers.",
    route: "#procedural-playtest-board",
    status: "planned",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Graphs", "Search", "Procedural generation"],
    simulationType: "Grid / Heatmap",
    variations: [
      { id: "maze", label: "Maze", description: "Sparse paths and controlled bottlenecks." },
      { id: "arena", label: "Arena", description: "Open pressure spaces with local cover." },
      { id: "quest", label: "Quest", description: "Objective chains and route pacing." }
    ],
    controlLabels: {
      count: "Room count",
      speed: "Playback",
      turbulence: "Generation noise",
      attraction: "Goal pressure",
      trails: "Route heatmap"
    },
    metricLabels: {
      energy: "Pacing",
      order: "Route clarity",
      spread: "Coverage",
      fps: "FPS"
    },
    overview: [
      "This planned project is a board-level prototype surface for procedural game ideas.",
      "It can reuse the Agent Arena environment boundary once a formal grid API is ready."
    ],
    facts: [
      { label: "Planned renderer", value: "Grid canvas + heatmap" },
      { label: "Core algorithms", value: "Search, graph scoring, procedural rules" },
      { label: "Output", value: "Playable layouts and pacing diagnostics" }
    ],
    equations: [
      "G=(V,E),\\quad c(P)=\\sum_{e\\in P}w(e)"
    ],
    futureWork: [
      "Create a layout generator interface with seed, constraints, and scoring.",
      "Add route heatmaps and path comparison views.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "narrative-state-space",
    title: "Narrative State Space",
    subtitle: "Mapping story beats, choices, and agent memory",
    description:
      "A planned visualization for branching narrative state, memory traces, player choices, and AI-authored story transitions.",
    category: "Experimental Tool",
    tags: ["Narrative AI", "State Space", "Memory", "HCI"],
    thumbnail: "Branching story states with memory links and transition confidence.",
    route: "#narrative-state-space",
    status: "research",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["State graphs", "Embedding spaces", "Transition models"],
    simulationType: "Graph / Embedding Map",
    variations: [
      { id: "branching", label: "Branching", description: "Choice trees and narrative alternatives." },
      { id: "memory", label: "Memory", description: "Agent memory traces and recall intensity." },
      { id: "embedding", label: "Embedding", description: "Semantic clusters for authored states." }
    ],
    controlLabels: {
      count: "State count",
      speed: "Transition speed",
      turbulence: "Semantic drift",
      attraction: "Memory weight",
      trails: "Show paths"
    },
    metricLabels: {
      energy: "Coherence",
      order: "Agency",
      spread: "Branching",
      fps: "FPS"
    },
    overview: [
      "This research slot is designed for future narrative-AI experiments where story states, choice consequences, and agent memory need to be seen rather than only logged.",
      "The standardized lab shell keeps the eventual graph renderer, documentation, and math together."
    ],
    facts: [
      { label: "Planned renderer", value: "Force graph or embedding map" },
      { label: "Research use", value: "Narrative AI and interaction analysis" },
      { label: "Core data", value: "States, choices, memory links" }
    ],
    equations: [
      "s_{t+1}\\sim P(s'\\mid s_t, a_t, m_t)",
      "\\operatorname{sim}(x,y)=\\frac{x\\cdot y}{\\lVert x\\rVert\\lVert y\\rVert}"
    ],
    futureWork: [
      "Define a graph schema for story states, choices, and memory traces.",
      "Add graph filtering by character, theme, branch depth, and confidence.",
      ...sharedPerformanceNotes
    ]
  }
];

export const labArchitecture = {
  folders: [
    "laboratory.html                 # Hub shell and semantic page structure",
    "lab/lab.css                     # Design system (shared with the main site)",
    "lab/lab.js                      # Page controller and project template renderer",
    "lab/experiments.js              # Project metadata, controls, metrics, variations",
    "lab/simulations/_shared.js      # Sim harness: control wiring, loop, 3D, dispose",
    "lab/simulations/gridworld-prompt.js   # Behavior-Prompt Gridworld (core thesis)",
    "lab/simulations/maze-chase.js         # BFS pursuit/evasion",
    "lab/simulations/snake-growth.js       # Flood-fill snake AI",
    "lab/simulations/light-cycle.js        # Tron space-control agents",
    "lab/simulations/frozen-lake.js        # Value iteration + slippery policy",
    "lab/simulations/cartpole.js           # Cartpole control ensemble",
    "lab/simulations/boids-3d.js           # 3D flocking (hand-rolled camera)",
    "lab/simulations/terrain-descent-3d.js # 3D optimizer landscape",
    "lab/simulations/nbody-3d.js           # 3D gravitational N-body",
    "lab/simulations/reaction-diffusion.js # Gray-Scott PDE",
    "lab/simulations/q-learning.js         # tabular TD reinforcement learning",
    "lab/simulations/pathfinding.js        # A*/Dijkstra/Greedy/BFS visualizer",
    "lab/simulations/wumpus.js             # POMDP logical-inference explorer",
    "lab/simulations/particle-field.js",
    "lab/simulations/agent-arena.js",
    "lab/simulations/ludic-geometry.js"
  ],
  addSteps: [
    "Create a project record in lab/experiments.js with metadata, metric labels, controls, math, and variations.",
    "Add a renderer module under lab/simulations; most can be a thin config passed to createSimHarness in _shared.js.",
    "Register the renderer in lab/lab.js by project id (the id must match the metadata record).",
    "Reuse the common mount/dispose contract so future work can move into React, workers, or separate engines cleanly."
  ]
};

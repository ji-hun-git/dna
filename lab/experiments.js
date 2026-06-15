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
    group: "Agents",
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
    id: "arc-adaptive-unit",
    group: "Physics",
    title: "ARC Adaptive Unit",
    subtitle: "A drone or mech that re-controls itself when you break it",
    description:
      "Inspired by ARC Raiders' flying drones and walking mechs: a unit patrols toward targets while you shoot out its rotors or legs (hover a part) - and it re-solves its control on the fly to keep operating.",
    category: "Game AI",
    tags: ["Fault Tolerance", "Control Allocation", "Legged Gait", "Adaptation"],
    thumbnail: "Destroy a rotor and the flyer re-allocates thrust; break a leg and the mech re-phases its gait.",
    route: "#arc-adaptive-unit",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Control allocation", "Fault-tolerant control", "Legged stability"],
    simulationType: "Adaptive Control",
    variations: [
      { id: "quadrotor", label: "Quadrotor", description: "Flying drone, 4 rotors." },
      { id: "hexrotor", label: "Hexrotor", description: "Flying drone, 6 rotors - more redundancy." },
      { id: "quadruped", label: "Quadruped", description: "Walking mech, 4 legs." },
      { id: "hexapod", label: "Hexapod", description: "Walking mech, 6 legs - graceful gaits." }
    ],
    controlLabels: {
      count: "Agility",
      speed: "Sim speed",
      turbulence: "Damage rate",
      attraction: "Controller gain",
      trails: "Motion trail"
    },
    metricLabels: { energy: "Tracking", order: "Capacity", spread: "Stability", fps: "FPS" },
    overview: [
      "A flyer treats its rotors as a redundant thrust array. The controller computes a desired wrench to chase the target, then distributes it across the intact rotors with a least-norm pseudo-inverse. Knock a rotor out and the allocation matrix loses a column, so it re-solves and keeps tracking - degrading gracefully as redundancy runs out, exactly the fault-tolerant-control idea.",
      "A walker runs a phase-based gait. Lose a leg and it re-phases the remaining legs (and stiffens the duty factor) to keep the centre of mass inside the support polygon, switching gait the way damage-recovery robots do. When support is lost it wobbles, then re-stabilizes.",
      "Hover the cursor over a rotor or leg to disable it, or let parts fail on their own; some repair over time so you can watch it adapt both ways. The math panel highlights the live control step and flashes the adaptation equation the instant a part breaks."
    ],
    facts: [
      { label: "Flyer", value: "Thrust-allocation pseudo-inverse" },
      { label: "Walker", value: "Gait re-phasing + support polygon" },
      { label: "Damage", value: "Hover-to-disable + auto faults" },
      { label: "Signals", value: "Tracking, capacity, stability" }
    ],
    equations: [
      "w_{des}=K_p(p^{*}-p)-K_d\\,\\dot p",
      "f = M^{\\top}\\,(MM^{\\top})^{-1}\\,w_{des}",
      "\\varphi_i=(\\varphi_0+i\\,\\Delta\\varphi)\\bmod 1,\\quad \\Delta\\varphi=\\tfrac{1}{k}",
      "M \\leftarrow M_{\\setminus\\mathcal{D}},\\quad k \\leftarrow |\\,\\text{intact}\\,|",
      "w_{ach}=M f,\\quad \\mathrm{CoM}\\in\\mathrm{conv}(\\text{stance feet})"
    ],
    futureWork: [
      "Add a self-model the unit relearns online (model-identification recovery).",
      "Give the flyer real out-of-plane rotor dynamics and the walker inverse kinematics.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "particle-policy-field",
    group: "Generative",
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
    group: "Agents",
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
    group: "Games",
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
    group: "Games",
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
    group: "Games",
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
    group: "Learning",
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
    group: "Physics",
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
    group: "Physics",
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
    group: "Learning",
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
    group: "Generative",
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
    group: "Generative",
    title: "Reaction-Diffusion",
    subtitle: "Two chemicals, one emergent skin",
    description:
      "A Gray-Scott reaction-diffusion system: local diffusion and reaction rules grow corals, mitosis, worms, spots, and waves. Drag on the canvas to seed reagent.",
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
      "It is a canonical demonstration that purely local rules produce global structure - the same theme as the agent simulations, in continuous form. Drag the pointer to inject reagent and watch the field heal.",
      "Computed on a downsampled grid and drawn through an ImageData buffer for speed."
    ],
    facts: [
      { label: "Model", value: "Gray-Scott, 9-point Laplacian" },
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
    group: "Learning",
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
      "Unlike the FrozenLake project, which solves the MDP with dynamic programming, this agent has no model - it learns Q-values from experience using the temporal-difference update, with ε-greedy exploration that decays as it improves.",
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
    group: "Agents",
    title: "Pathfinding Search",
    subtitle: "A*, Dijkstra, Greedy, and BFS, side by side",
    description:
      "A search visualizer that expands the open and closed sets across an obstacle field, then reconstructs the path - making the difference between informed and uninformed search visible.",
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
      { id: "greedy", label: "Greedy", description: "Heuristic only - fast but not optimal." },
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
      "Raising the heuristic weight turns A* toward greedy behavior - fewer expansions, less optimal paths. When the field has no route, the search reports it and regenerates.",
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
    group: "Agents",
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
      { id: "dense", label: "Dense", description: "Many pits - frequent hard choices." }
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
      "It explores the reachable safe frontier first; when none remains, it takes the least-suspected gamble (or, if too cautious, abandons the cave). The knowledge overlay shows visited, proven-safe, and suspected cells - the agent's belief, not the ground truth.",
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
    group: "Physics",
    title: "N-Body Gravity 3D",
    subtitle: "Orbits, clusters, and collisions in 3D",
    description:
      "Softened Newtonian gravity for a population of bodies, rendered in 3D with an orbiting camera - circular orbits, gravitational clusters, binary systems, and colliding clouds.",
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
      "Add a Barnes-Hut tree so body counts can scale far higher.",
      "Track total energy and momentum to show integration drift.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "neuroevolution-flappy",
    group: "Learning",
    title: "Neuroevolution Flappy",
    subtitle: "A population that learns to play by evolution",
    description:
      "Each bird is driven by a tiny neural network; a genetic algorithm selects, crosses over, and mutates the fittest into the next generation. Watch a random swarm become an expert flyer.",
    category: "Game AI",
    tags: ["Neuroevolution", "Genetic Algorithm", "Neural Net", "Self-Play"],
    thumbnail: "Generation after generation, more birds clear the pipes as their brains improve.",
    route: "#neuroevolution-flappy",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Neuroevolution", "Genetic algorithms", "Neural networks"],
    simulationType: "Game + Evolution",
    variations: [
      { id: "easy", label: "Easy", description: "Wide gaps, gentle pace." },
      { id: "normal", label: "Normal", description: "Standard difficulty." },
      { id: "hard", label: "Hard", description: "Narrow gaps, faster pipes." },
      { id: "insane", label: "Insane", description: "Brutal gaps - only the best survive." }
    ],
    controlLabels: {
      count: "Population",
      speed: "Game speed",
      turbulence: "Mutation rate",
      attraction: "Elitism",
      trails: "Show all birds"
    },
    metricLabels: { energy: "Mean score", order: "Best ever", spread: "Alive", fps: "FPS" },
    overview: [
      "Every generation, the whole population plays the same pipe sequence so fitness is comparable. When all birds die, the fittest are kept (elitism), and the rest of the next generation is bred by crossing over two parents' weights and mutating them.",
      "There is no gradient and no labels - only survival. The chart tracks best fitness per generation, so you can watch learning happen as a curve.",
      "A direct, visual answer to 'can an agent learn to play a game without being told how?'"
    ],
    facts: [
      { label: "Brain", value: "4→6→1 neural net (tanh/sigmoid)" },
      { label: "Optimizer", value: "Genetic algorithm" },
      { label: "Selection", value: "Elitism + crossover + mutation" },
      { label: "Signals", value: "Mean score, best ever, alive" }
    ],
    equations: [
      "\\hat y = \\sigma\\!\\left(W_2\\tanh(W_1 x + b_1) + b_2\\right)",
      "g' = \\operatorname{mutate}\\big(\\operatorname{crossover}(g_a, g_b)\\big)"
    ],
    futureWork: [
      "Add NEAT-style topology evolution and speciation.",
      "Compare against a policy-gradient learner on the same game.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "connect-four",
    group: "Games",
    title: "Connect Four - Minimax",
    subtitle: "Two adversarial agents, alpha-beta search",
    description:
      "Two game-playing agents face off with depth-limited minimax, alpha-beta pruning, and a window-scoring heuristic. Search depth sets each agent's strength.",
    category: "Game AI",
    tags: ["Minimax", "Alpha-Beta", "Adversarial", "Board Game"],
    thumbnail: "A deeper-searching agent calmly sets up threats the shallow one never sees.",
    route: "#connect-four",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Adversarial search", "Alpha-beta pruning", "Heuristic evaluation"],
    simulationType: "Board Game AI",
    variations: [
      { id: "easy", label: "Easy", description: "Both agents search shallow (depth 2)." },
      { id: "medium", label: "Medium", description: "Balanced mid-depth search." },
      { id: "hard", label: "Hard", description: "Deep search (depth 6)." },
      { id: "mixed", label: "Mixed", description: "A strong agent vs a weak one." }
    ],
    controlLabels: {
      count: "Restart delay",
      speed: "Move pace",
      turbulence: "Move randomness",
      attraction: "Extra lookahead",
      trails: "Highlight last move"
    },
    metricLabels: { energy: "Moves", order: "Win balance", spread: "Board fill", fps: "FPS" },
    overview: [
      "Each turn an agent runs minimax to its depth, scoring leaf positions by counting two-, three-, and four-in-a-row windows for and against it, and prunes with alpha-beta so deeper search stays cheap.",
      "The Mixed variation pits a deep searcher against a shallow one to make the value of lookahead obvious. Move randomness lets near-equal moves vary so games don't repeat.",
      "The canonical adversarial game-AI demo, drawn with animated disc drops."
    ],
    facts: [
      { label: "Search", value: "Minimax + alpha-beta" },
      { label: "Heuristic", value: "Window scoring + center bias" },
      { label: "Depth", value: "2-7 plies" },
      { label: "Signals", value: "Moves, win balance, fill" }
    ],
    equations: [
      "\\hat v(s)=\\sum_{w\\in\\text{windows}}\\operatorname{score}(w)",
      "\\text{prune when } \\alpha \\ge \\beta"
    ],
    futureWork: [
      "Add a transposition table and iterative deepening.",
      "Drop in a learned value network as one of the agents.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "game-2048",
    group: "Games",
    title: "2048 - Expectimax",
    subtitle: "An agent playing the tiles",
    description:
      "An expectimax agent plays 2048: it maximizes over the four slides and averages over the random tile spawns, scoring boards by empty cells, monotonicity, smoothness, and a max-tile corner.",
    category: "AI Agent",
    tags: ["Expectimax", "Search", "Heuristics", "Stochastic"],
    thumbnail: "Empties, monotonic rows, and a pinned corner - the agent climbs toward 2048.",
    route: "#game-2048",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Expectimax", "Decision under chance", "Heuristics"],
    simulationType: "Board Game AI",
    variations: [
      { id: "classic", label: "Classic", description: "4×4, depth-3 expectimax." },
      { id: "deep", label: "Deep", description: "Deeper search, stronger play." },
      { id: "greedy", label: "Greedy", description: "Depth-1 - fast and shortsighted." },
      { id: "big", label: "Big", description: "A 5×5 board." }
    ],
    controlLabels: {
      count: "Restart delay",
      speed: "Move pace",
      turbulence: "Randomness",
      attraction: "Extra depth",
      trails: "Show numbers"
    },
    metricLabels: { energy: "Max tile", order: "Best tile", spread: "Empty", fps: "FPS" },
    overview: [
      "Slides are the agent's choices (max nodes); tile spawns are chance nodes the agent averages over, sampling empty cells to keep the tree affordable. The board score rewards open space, ordered rows, and keeping the largest tile in a corner.",
      "Greedy (depth 1) versus Deep shows how much lookahead is worth in a stochastic game. A little randomness can be injected to vary games.",
      "A clean expectimax demo on a game everyone knows."
    ],
    facts: [
      { label: "Search", value: "Expectimax (max + chance)" },
      { label: "Heuristic", value: "Empty / monotonicity / corner" },
      { label: "Depth", value: "1-5 plies" },
      { label: "Signals", value: "Max tile, best tile, empties" }
    ],
    equations: [
      "V(s)=\\max_a\\ \\mathbb{E}_{s'\\sim P(\\cdot\\mid s,a)}\\big[V(s')\\big]",
      "h(s)=w_e\\,\\#\\text{empty} + w_m\\,\\text{mono}(s) + w_c\\,\\text{corner}(s)"
    ],
    futureWork: [
      "Add transposition caching across plies.",
      "Compare expectimax against a learned (CNN) value function.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "minesweeper",
    group: "Games",
    title: "Minesweeper - Logic Solver",
    subtitle: "Constraint propagation, then the least-risky guess",
    description:
      "An agent plays Minesweeper by sound deduction: a number with all its mines flagged makes the rest safe; a number whose hidden neighbours equal its remaining mines flags them all. When stuck, it guesses the lowest-probability cell.",
    category: "Game AI",
    tags: ["Constraint Propagation", "Logic", "Inference", "Probability"],
    thumbnail: "Safe reveals cascade from each satisfied number; the agent flags forced mines.",
    route: "#minesweeper",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Constraint satisfaction", "Logical inference", "Probability"],
    simulationType: "Board Game AI",
    variations: [
      { id: "easy", label: "Easy", description: "Small board, low mine density." },
      { id: "medium", label: "Medium", description: "Standard density." },
      { id: "hard", label: "Hard", description: "Denser mines, harder deductions." },
      { id: "expert", label: "Expert", description: "Large board, dense mines." }
    ],
    controlLabels: {
      count: "Board size",
      speed: "Pace",
      turbulence: "Mine density",
      attraction: "Caution",
      trails: "Show focus"
    },
    metricLabels: { energy: "Cleared", order: "Win rate", spread: "Explored", fps: "FPS" },
    overview: [
      "Two deduction rules drive the solver: if a number equals its flagged neighbours, every other neighbour is safe; if a number's remaining mines equal its hidden neighbours, they are all mines. These cascade until no more certainty exists.",
      "Only then does the agent guess, choosing the hidden cell with the lowest estimated mine probability - and a cautious agent will abandon a board rather than take a bad gamble. A logical-inference counterpart to Wumpus World.",
      "The first reveal is always safe; mines are placed around it."
    ],
    facts: [
      { label: "Method", value: "Constraint propagation" },
      { label: "Fallback", value: "Lowest-probability guess" },
      { label: "First move", value: "Guaranteed safe" },
      { label: "Signals", value: "Cleared, win rate, explored" }
    ],
    equations: [
      "n(c)-f(c)=0 \\;\\Rightarrow\\; \\text{hidden neighbours safe}",
      "n(c)-f(c)=|H(c)| \\;\\Rightarrow\\; \\text{all are mines}"
    ],
    futureWork: [
      "Add full subset/equation-solving for tank-style deductions.",
      "Compute exact frontier probabilities for optimal guessing.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "double-pendulum",
    group: "Physics",
    title: "Double Pendulum",
    subtitle: "Deterministic chaos you can watch",
    description:
      "A field of double pendulums with almost identical starts. They move together briefly, then sensitive dependence on initial conditions pulls them apart.",
    category: "Simulation",
    tags: ["Chaos", "Dynamics", "ODE", "Physics"],
    thumbnail: "Near-identical pendulums fan out as tiny differences blow up exponentially.",
    route: "#double-pendulum",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Nonlinear dynamics", "Chaos", "Lyapunov divergence"],
    simulationType: "Chaotic ODE",
    variations: [
      { id: "fan", label: "Fan", description: "A spread of starting angles." },
      { id: "pair", label: "Pair", description: "Two almost-identical pendulums." },
      { id: "storm", label: "Storm", description: "Many fast pendulums." },
      { id: "damped", label: "Damped", description: "Energy bleeds away over time." }
    ],
    controlLabels: { count: "Pendulums", speed: "Sim speed", turbulence: "Start spread", attraction: "Damping", trails: "Tip trails" },
    metricLabels: { energy: "Mean speed", order: "Divergence", spread: "Spread", fps: "FPS" },
    overview: [
      "Each pendulum integrates the exact double-pendulum equations of motion. With a spread of nearly identical starting angles, the cloud tracks itself for a moment and then scatters, which is the butterfly effect made visible.",
      "The divergence line on the chart measures how fast the tips pull apart - the signature of a positive Lyapunov exponent."
    ],
    facts: [
      { label: "Model", value: "Exact double-pendulum EoM" },
      { label: "Integrator", value: "Semi-implicit Euler, substepped" },
      { label: "Count", value: "40-260 pendulums" },
      { label: "Signals", value: "Speed, divergence, spread" }
    ],
    equations: [
      "\\ddot\\theta_1 = \\frac{-g(2m_1+m_2)\\sin\\theta_1 - \\dots}{\\ell_1(2m_1+m_2-m_2\\cos 2\\Delta)}",
      "\\delta(t) \\approx \\delta_0\\,e^{\\lambda t}"
    ],
    futureWork: [
      "Estimate the Lyapunov exponent numerically and plot it.",
      "Add a Poincare section view.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "verlet-cloth",
    group: "Physics",
    title: "Verlet Cloth",
    subtitle: "Mass-spring fabric you can grab and tear",
    description:
      "A grid of point masses joined by distance constraints, integrated with Verlet and relaxed each frame. Pinned at the top, blown by wind, and grabbable.",
    category: "Simulation",
    tags: ["Verlet", "Soft Body", "Constraints", "Physics"],
    thumbnail: "Drag the cursor through the cloth to push it; stress the links until they tear.",
    route: "#verlet-cloth",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Verlet integration", "Distance constraints", "Soft-body physics"],
    simulationType: "Mass-spring system",
    variations: [
      { id: "drape", label: "Drape", description: "Calm hanging cloth." },
      { id: "breeze", label: "Breeze", description: "A steady wind." },
      { id: "flag", label: "Flag", description: "A strong gust that ripples it." },
      { id: "loose", label: "Loose", description: "Fewer relaxation passes, stretchier." }
    ],
    controlLabels: { count: "Resolution", speed: "Sim speed", turbulence: "Wind", attraction: "Stiffness", trails: "Show nodes" },
    metricLabels: { energy: "Motion", order: "Intact links", spread: "Drop", fps: "FPS" },
    overview: [
      "Verlet integration stores position history instead of velocity, so constraints can be satisfied by simply moving points back toward their rest distance. A few relaxation passes per frame make the fabric stiffer.",
      "Drag the cursor to push the cloth around; pull hard enough and over-stretched links snap and the cloth tears."
    ],
    facts: [
      { label: "Integrator", value: "Verlet (position-based)" },
      { label: "Constraints", value: "Distance links, relaxed" },
      { label: "Interaction", value: "Drag and tear" },
      { label: "Signals", value: "Motion, intact links, drop" }
    ],
    equations: [
      "x_{t+1} = 2x_t - x_{t-1} + a\\,\\Delta t^2",
      "\\lVert p_i - p_j\\rVert \\to L_{ij}"
    ],
    futureWork: [
      "Add self-collision and a draped sphere.",
      "Expose tear threshold and bending constraints.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "falling-sand",
    group: "Physics",
    title: "Falling Sand",
    subtitle: "A cellular-automaton playground",
    description:
      "Sand piles and slides, water flows and levels out, fire climbs wood and burns out - all from simple per-cell rules. Paint materials with the cursor.",
    category: "Simulation",
    tags: ["Cellular Automata", "Granular", "Fluids", "Sandbox"],
    thumbnail: "Paint sand, water, and fire; watch local rules make global behavior.",
    route: "#falling-sand",
    status: "live",
    difficulty: "intro",
    createdAt: "2026-06-15",
    mathTopics: ["Cellular automata", "Granular flow", "Emergence"],
    simulationType: "Cellular Automaton",
    variations: [
      { id: "sand", label: "Sand", description: "Granular piling and sliding." },
      { id: "water", label: "Water", description: "Flowing, self-leveling liquid." },
      { id: "fire", label: "Fire", description: "Fire that spreads on wood." },
      { id: "mixed", label: "Mixed", description: "Sand and water together." }
    ],
    controlLabels: { count: "Resolution", speed: "Steps/frame", turbulence: "Emit rate", attraction: "Brush size", trails: "Smooth" },
    metricLabels: { energy: "Filled", order: "Fire", spread: "Coverage", fps: "FPS" },
    overview: [
      "Every cell follows a tiny rule - move down, slide diagonally, flow sideways if liquid, spread if fire - and the bulk behavior (piles, puddles, flame fronts) emerges for free.",
      "Paint with the cursor and the simulation reacts immediately. A classic demonstration that complexity needs no central plan."
    ],
    facts: [
      { label: "Model", value: "Falling-sand cellular automaton" },
      { label: "Materials", value: "Sand / water / wood / fire / wall" },
      { label: "Interaction", value: "Paint with the cursor" },
      { label: "Signals", value: "Filled, fire, coverage" }
    ],
    equations: ["g_{t+1}(x,y) = R\\big(g_t(\\mathcal{N}(x,y))\\big)"],
    futureWork: [
      "Add steam, oil, acid, and plants with reaction rules.",
      "Move the grid update into a Web Worker.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "plinko",
    group: "Physics",
    title: "Plinko / Galton Board",
    subtitle: "The bell curve, built by bouncing",
    description:
      "Balls fall through a triangular peg field, deflecting at each row, and land in bins. A normal distribution emerges from pure physics.",
    category: "Simulation",
    tags: ["Probability", "Physics", "Central Limit", "Collisions"],
    thumbnail: "Hundreds of independent left/right bounces add up to a bell curve.",
    route: "#plinko",
    status: "live",
    difficulty: "intro",
    createdAt: "2026-06-15",
    mathTopics: ["Probability", "Central limit theorem", "Elastic collisions"],
    simulationType: "Physics + statistics",
    variations: [
      { id: "classic", label: "Classic", description: "A standard Galton board." },
      { id: "tall", label: "Tall", description: "More rows, sharper curve." },
      { id: "chaotic", label: "Chaotic", description: "Noisy bounces, wider spread." },
      { id: "gentle", label: "Gentle", description: "Low gravity, slow fall." }
    ],
    controlLabels: { count: "Rows / rate", speed: "Sim speed", turbulence: "Bounce noise", attraction: "Gravity", trails: "Ball trails" },
    metricLabels: { energy: "In flight", order: "Normality", spread: "Peak", fps: "FPS" },
    overview: [
      "Each ball makes a sequence of near-random left/right deflections off the pegs. Summing many independent steps is exactly the setup of the central limit theorem, so the histogram of landing bins converges to a normal distribution.",
      "More rows make the curve sharper; more bounce noise widens it."
    ],
    facts: [
      { label: "Physics", value: "Gravity + peg reflection" },
      { label: "Statistics", value: "Central limit theorem" },
      { label: "Output", value: "Live landing histogram" },
      { label: "Signals", value: "In flight, normality, peak" }
    ],
    equations: ["S_n = \\sum_{i=1}^{n} X_i \\ \\xrightarrow{d}\\ \\mathcal{N}(0,\\sigma^2)"],
    futureWork: [
      "Overlay the fitted Gaussian and report the fit error.",
      "Let users bias the pegs to show skewed distributions.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "lunar-lander",
    group: "Physics",
    title: "Lunar Lander",
    subtitle: "Autonomous soft landing",
    description:
      "A squad of landers fall under gravity toward a pad. Each runs a PD controller on descent rate and horizontal offset, firing thrusters on a fuel budget.",
    category: "Simulation",
    tags: ["Control", "Physics", "PD", "Autonomy"],
    thumbnail: "Touch down slow and on the pad to score; come in hot and it crashes.",
    route: "#lunar-lander",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Classical control", "Newtonian motion", "PD control"],
    simulationType: "Control + physics",
    variations: [
      { id: "squad", label: "Squad", description: "A group landing together." },
      { id: "solo", label: "Solo", description: "A single lander, up close." },
      { id: "windy", label: "Windy", description: "Lateral disturbances." },
      { id: "lowgain", label: "Low gain", description: "A sluggish controller that overshoots." }
    ],
    controlLabels: { count: "Squad size", speed: "Sim speed", turbulence: "Wind", attraction: "Controller gain", trails: "Flight trails" },
    metricLabels: { energy: "Success", order: "Upright", spread: "Fuel left", fps: "FPS" },
    overview: [
      "The controller targets a safe descent rate that shrinks near the ground, throttling the main engine to track it, and steers sideways toward the pad. Fuel is limited, so it cannot just hover.",
      "Watch the success rate as you change the gain: too low and it overshoots and crashes, too high and it fights the wind cleanly."
    ],
    facts: [
      { label: "Dynamics", value: "Gravity + thrust + fuel" },
      { label: "Controller", value: "PD on descent and offset" },
      { label: "Goal", value: "Slow, upright, on the pad" },
      { label: "Signals", value: "Success, upright, fuel" }
    ],
    equations: [
      "u = K_p(\\dot y^* - \\dot y) + K_x\\,\\Delta x",
      "\\ddot y = g - \\tfrac{u}{m}"
    ],
    futureWork: [
      "Add terrain and an optimal fuel-minimizing controller.",
      "Compare PD against a learned landing policy.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "breakout-ai",
    group: "Games",
    title: "Breakout AI",
    subtitle: "A paddle that reads the bounce",
    description:
      "The paddle predicts where the ball will cross its line, reflecting off the walls, and slides to intercept with a reaction lag. It clears the brick field as the ball speeds up.",
    category: "Game Prototype",
    tags: ["Game AI", "Prediction", "Physics", "Arcade"],
    thumbnail: "The agent forecasts the ball's path and positions the paddle to meet it.",
    route: "#breakout-ai",
    status: "live",
    difficulty: "intermediate",
    createdAt: "2026-06-15",
    mathTopics: ["Trajectory prediction", "Reflection", "Reaction control"],
    simulationType: "Arcade game AI",
    variations: [
      { id: "classic", label: "Classic", description: "A balanced agent and field." },
      { id: "wide", label: "Wide", description: "A bigger brick wall." },
      { id: "fast", label: "Fast", description: "A quick ball that tests reactions." },
      { id: "shaky", label: "Shaky", description: "A noisy, less accurate agent." }
    ],
    controlLabels: { count: "Brick wall", speed: "Ball speed", turbulence: "Aim noise", attraction: "Reaction", trails: "Ball trail" },
    metricLabels: { energy: "Bricks", order: "Endurance", spread: "Cleared", fps: "FPS" },
    overview: [
      "Each step the agent forward-simulates the ball (bouncing off side walls) to find where it will reach the paddle line, then eases toward that point at a fixed reaction speed.",
      "A faster ball and more aim noise make interception harder; a higher reaction makes the paddle snappier."
    ],
    facts: [
      { label: "Agent", value: "Forward-prediction paddle" },
      { label: "Physics", value: "Ball reflection + brick hits" },
      { label: "Tuning", value: "Reaction speed and noise" },
      { label: "Signals", value: "Bricks, endurance, cleared" }
    ],
    equations: ["x_{\\text{hit}} = \\operatorname{reflect}\\big(x + v\\,t_{\\text{paddle}}\\big)"],
    futureWork: [
      "Add power-ups and a learned controller comparison.",
      "Score interception error over time.",
      ...sharedPerformanceNotes
    ]
  },
  {
    id: "tetris-ai",
    group: "Games",
    title: "Tetris AI",
    subtitle: "A heuristic stacker",
    description:
      "For every piece the agent tries each rotation and column, drops it, and scores the result by lines cleared, aggregate height, holes, and bumpiness, then plays the best.",
    category: "Game Prototype",
    tags: ["Game AI", "Heuristics", "Search", "Arcade"],
    thumbnail: "The agent evaluates every placement and keeps the stack flat and hole-free.",
    route: "#tetris-ai",
    status: "live",
    difficulty: "advanced",
    createdAt: "2026-06-15",
    mathTopics: ["Heuristic evaluation", "Search", "Feature weighting"],
    simulationType: "Arcade game AI",
    variations: [
      { id: "classic", label: "Classic", description: "Balanced weights." },
      { id: "fast", label: "Fast", description: "Quick placement." },
      { id: "greedy", label: "Greedy", description: "Heavily rewards clearing lines." },
      { id: "noisy", label: "Noisy", description: "Adds evaluation noise." }
    ],
    controlLabels: { count: "Restart delay", speed: "Pace", turbulence: "Eval noise", attraction: "Line weight", trails: "Ghost piece" },
    metricLabels: { energy: "Lines", order: "Low stack", spread: "Fill", fps: "FPS" },
    overview: [
      "The agent enumerates every rotation and column for the current piece, simulates the drop, and scores the resulting board with a weighted sum of features. The classic Dellacherie-style weights keep the stack low, flat, and free of holes.",
      "Raise the line weight to make it gamble on clears; add noise to watch it make mistakes."
    ],
    facts: [
      { label: "Search", value: "All rotations x columns" },
      { label: "Features", value: "Height / holes / lines / bumpiness" },
      { label: "Board", value: "Standard 10 x 20" },
      { label: "Signals", value: "Lines, stack height, fill" }
    ],
    equations: ["\\text{score} = w_\\ell L - w_h H - w_o O - w_b B"],
    futureWork: [
      "Add lookahead with the next piece and a hold slot.",
      "Auto-tune the weights with evolution.",
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
    "lab/simulations/arc-adaptive-robot.js # fault-tolerant drone/mech control",
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
    "lab/simulations/neuroevolution-flappy.js # GA-trained neural-net players",
    "lab/simulations/connect-four.js       # minimax + alpha-beta board agent",
    "lab/simulations/game-2048.js          # expectimax game agent",
    "lab/simulations/minesweeper.js        # constraint-propagation solver",
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

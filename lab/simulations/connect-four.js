/**
 * Connect Four - Minimax with alpha-beta
 *
 * Two game-playing agents face off. Each runs a depth-limited minimax search with
 * alpha-beta pruning and a window-scoring heuristic, then drops a disc. Search
 * depth sets each agent's strength, so you can watch a strong agent dismantle a
 * shallow one. A canonical adversarial game-AI demo.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const COLS = 7;
const ROWS = 6;

export function mountConnectFour(refs) {
  const at = (b, c, r) => b[r * COLS + c];
  const setAt = (b, c, r, v) => { b[r * COLS + c] = v; };

  function dropRow(b, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (at(b, c, r) === 0) return r;
    return -1;
  }

  function validMoves(b) {
    const m = [];
    for (let c = 0; c < COLS; c++) if (at(b, c, 0) === 0) m.push(c);
    return m;
  }

  function wins(b, p) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (at(b, c, r) !== p) continue;
        // four directions
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (const [dc, dr] of dirs) {
          let k = 1;
          while (k < 4) {
            const nc = c + dc * k;
            const nr = r + dr * k;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || at(b, nc, nr) !== p) break;
            k++;
          }
          if (k === 4) return true;
        }
      }
    }
    return false;
  }

  function scoreWindow(cells, p) {
    const o = p === 1 ? 2 : 1;
    let mine = 0;
    let opp = 0;
    let empty = 0;
    for (const c of cells) {
      if (c === p) mine++;
      else if (c === o) opp++;
      else empty++;
    }
    if (mine === 4) return 100000;
    if (mine === 3 && empty === 1) return 80;
    if (mine === 2 && empty === 2) return 8;
    if (opp === 3 && empty === 1) return -90;
    if (opp === 2 && empty === 2) return -6;
    return 0;
  }

  function evaluate(b, p) {
    let score = 0;
    // center preference
    for (let r = 0; r < ROWS; r++) if (at(b, 3, r) === p) score += 4;
    const windows = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS - 3; c++)
        windows.push([at(b, c, r), at(b, c + 1, r), at(b, c + 2, r), at(b, c + 3, r)]);
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS - 3; r++)
        windows.push([at(b, c, r), at(b, c, r + 1), at(b, c, r + 2), at(b, c, r + 3)]);
    for (let c = 0; c < COLS - 3; c++)
      for (let r = 0; r < ROWS - 3; r++)
        windows.push([at(b, c, r), at(b, c + 1, r + 1), at(b, c + 2, r + 2), at(b, c + 3, r + 3)]);
    for (let c = 0; c < COLS - 3; c++)
      for (let r = 3; r < ROWS; r++)
        windows.push([at(b, c, r), at(b, c + 1, r - 1), at(b, c + 2, r - 2), at(b, c + 3, r - 3)]);
    for (const win of windows) score += scoreWindow(win, p);
    return score;
  }

  function minimax(b, depth, alpha, beta, maxing, me) {
    const opp = me === 1 ? 2 : 1;
    if (wins(b, me)) return 1000000 - (10 - depth);
    if (wins(b, opp)) return -1000000 + (10 - depth);
    const moves = validMoves(b);
    if (depth === 0 || moves.length === 0) return evaluate(b, me);
    // order center-first for better pruning
    moves.sort((a, c) => Math.abs(3 - a) - Math.abs(3 - c));
    if (maxing) {
      let best = -Infinity;
      for (const c of moves) {
        const r = dropRow(b, c);
        setAt(b, c, r, me);
        best = Math.max(best, minimax(b, depth - 1, alpha, beta, false, me));
        setAt(b, c, r, 0);
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const c of moves) {
      const r = dropRow(b, c);
      setAt(b, c, r, opp);
      best = Math.min(best, minimax(b, depth - 1, alpha, beta, true, me));
      setAt(b, c, r, 0);
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseMove(api, b, player, depth) {
    const moves = validMoves(b);
    let bestScore = -Infinity;
    const scored = [];
    for (const c of moves) {
      const r = dropRow(b, c);
      setAt(b, c, r, player);
      const s = minimax(b, depth - 1, -Infinity, Infinity, false, player);
      setAt(b, c, r, 0);
      scored.push({ c, s });
      bestScore = Math.max(bestScore, s);
    }
    // temperature: with randomness, pick among near-best moves
    const slack = api.state.turbulence * 60;
    const pool = scored.filter((m) => m.s >= bestScore - slack);
    return pool[Math.floor(api.rand() * pool.length)].c;
  }

  function depthFor(api, player) {
    const v = api.state.variation;
    const base = v === "easy" ? 2 : v === "hard" ? 6 : v === "mixed" ? (player === 1 ? 5 : 2) : 4;
    return clamp(base + Math.round(api.state.attraction * 2), 2, 7);
  }

  function newGame(api) {
    const w = api.custom;
    w.board = new Int8Array(COLS * ROWS);
    w.turn = (w.starter = w.starter === 1 ? 2 : 1);
    w.winner = 0;
    w.lastMove = null;
    w.anim = null;
    w.phase = "think";
    w.moveCount = 0;
  }

  function step(api) {
    const w = api.custom;
    if (w.phase === "over") {
      w.overT -= 1;
      if (w.overT <= 0) newGame(api);
    } else if (w.phase === "anim") {
      w.anim.t += clamp(0.08 + api.state.speed * 0.06, 0.05, 0.5);
      if (w.anim.t >= 1) {
        const { c, r, p } = w.anim;
        setAt(w.board, c, r, p);
        w.lastMove = { c, r, p };
        w.moveCount += 1;
        w.anim = null;
        if (wins(w.board, p)) {
          w.winner = p;
          w.wins[p] = (w.wins[p] || 0) + 1;
          api.log(`Player ${p === 1 ? "red" : "yellow"} wins in ${w.moveCount} moves.`);
          w.phase = "over";
          w.overT = clamp(Math.round(api.state.count / 6), 8, 64);
        } else if (validMoves(w.board).length === 0) {
          api.log("Draw.");
          w.draws = (w.draws || 0) + 1;
          w.phase = "over";
          w.overT = clamp(Math.round(api.state.count / 6), 8, 64);
        } else {
          w.turn = w.turn === 1 ? 2 : 1;
          w.phase = "think";
          w.thinkT = clamp(Math.round(18 / Math.max(0.2, api.state.speed)), 3, 40);
        }
      }
    } else if (w.phase === "think") {
      w.thinkT = (w.thinkT || 0) - 1;
      if (w.thinkT <= 0) {
        const c = chooseMove(api, w.board, w.turn, depthFor(api, w.turn));
        const r = dropRow(w.board, c);
        w.anim = { c, r, p: w.turn, t: 0, y0: -1 };
        w.phase = "anim";
      }
    }
    const total = (w.wins[1] || 0) + (w.wins[2] || 0) + (w.draws || 0) || 1;
    const bal = 1 - Math.abs(((w.wins[1] || 0) - (w.wins[2] || 0)) / total);
    const fill = w.board.reduce((s, v) => s + (v ? 1 : 0), 0) / (COLS * ROWS);
    api.push(clamp(w.moveCount / 42, 0, 1), clamp(bal, 0, 1), clamp(fill, 0, 1));
  }

  function draw(api) {
    const { ctx, custom: w } = api;
    ctx.fillStyle = "rgba(7,7,13,0.97)";
    ctx.fillRect(0, 0, api.w, api.h);
    if (!w.board) return;
    const cell = Math.min((api.w * 0.9) / COLS, (api.h * 0.82) / ROWS);
    const bw = cell * COLS;
    const bh = cell * ROWS;
    const ox = (api.w - bw) / 2;
    const oy = (api.h - bh) / 2 + 6;

    // board frame
    ctx.fillStyle = "rgba(96,165,250,0.1)";
    ctx.strokeStyle = "rgba(96,165,250,0.3)";
    ctx.lineWidth = 2;
    const fr = 10;
    ctx.beginPath();
    ctx.roundRect(ox - 6, oy - 6, bw + 12, bh + 12, fr);
    ctx.fill();
    ctx.stroke();

    const disc = (c, r, p, scale = 1) => {
      const x = ox + (c + 0.5) * cell;
      const y = oy + (r + 0.5) * cell;
      ctx.beginPath();
      ctx.fillStyle = p === 1 ? "rgba(248,113,113,0.95)" : p === 2 ? "rgba(251,191,36,0.95)" : "rgba(10,11,20,0.92)";
      ctx.arc(x, y, cell * 0.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) disc(c, r, at(w.board, c, r));

    if (w.anim) {
      const x = ox + (w.anim.c + 0.5) * cell;
      const targetY = oy + (w.anim.r + 0.5) * cell;
      const startY = oy - cell * 0.5;
      const e = w.anim.t * w.anim.t;
      const y = startY + (targetY - startY) * e;
      ctx.beginPath();
      ctx.fillStyle = w.anim.p === 1 ? "rgba(248,113,113,0.95)" : "rgba(251,191,36,0.95)";
      ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (w.lastMove && !w.anim) {
      const x = ox + (w.lastMove.c + 0.5) * cell;
      const y = oy + (w.lastMove.r + 0.5) * cell;
      ctx.strokeStyle = "rgba(245,245,247,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(245,245,247,0.92)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const turnTxt = w.winner ? `winner ${w.winner === 1 ? "red" : "yellow"}` : `${w.turn === 1 ? "red" : "yellow"} to move`;
    ctx.fillText(`${api.state.variation} · red ${w.wins[1] || 0} · yellow ${w.wins[2] || 0} · ${turnTxt}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 4,
    firstVariation: "medium",
    liveCount: true,
    chartColors: ["rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)", "rgba(251,191,36,0.95)"],
    metricFormat: {
      energy: (_v, api) => String(api.custom.moveCount || 0),
      order: (v) => `${Math.round(v * 100)}%`,
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      easy: { count: 120, speed: 1.6, turbulence: 0.25, attraction: 0.3, trails: true },
      medium: { count: 140, speed: 1.6, turbulence: 0.15, attraction: 0.3, trails: true },
      hard: { count: 160, speed: 1.4, turbulence: 0.05, attraction: 0.3, trails: true },
      mixed: { count: 140, speed: 1.6, turbulence: 0.1, attraction: 0.3, trails: true }
    },
    reset(api) {
      api.custom.wins = {};
      api.custom.draws = 0;
      api.custom.starter = 2;
      newGame(api);
      api.log(`${api.state.variation} · two minimax agents (alpha-beta).`);
    },
    step,
    draw
  });
}

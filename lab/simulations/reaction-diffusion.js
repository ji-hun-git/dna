/**
 * Reaction-Diffusion (Gray-Scott)
 *
 * Two virtual chemicals diffuse and react on a torus; tiny parameter changes
 * grow corals, mitosis, worms, spots, or waves. A canonical "simulation" -
 * pure local rules, global emergence. Click/drag to seed reagent.
 */

import { createSimHarness, clamp } from "./_shared.js?v=20260615-lab2";

const DU = 0.16;
const DV = 0.08;

export function mountReactionDiffusion(refs) {
  function idx(w, x, y) {
    return ((y + w.gh) % w.gh) * w.gw + ((x + w.gw) % w.gw);
  }

  function seed(api, cx, cy, r, amount) {
    const w = api.custom;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        w.b[idx(w, cx + x, cy + y)] = amount;
      }
    }
  }

  function buildPalette(w) {
    // index 0..255 → rgb; "trails" off uses a cooler violet→teal→white ramp,
    // on uses a warm magma-ish ramp.
    w.pal = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r, g, b;
      if (w.warm) {
        r = clamp(40 + t * 255, 0, 255);
        g = clamp(t * t * 240, 0, 255);
        b = clamp(60 + Math.sin(t * Math.PI) * 120, 0, 255);
      } else {
        r = clamp(60 + t * 130, 0, 255);
        g = clamp(80 + t * 170, 0, 255);
        b = clamp(150 + (1 - t) * 90, 0, 255);
      }
      w.pal[i * 3] = r;
      w.pal[i * 3 + 1] = g;
      w.pal[i * 3 + 2] = b;
    }
  }

  function step(api) {
    const w = api.custom;
    if (!w.a) return;
    const { gw, gh } = w;
    const f = w.f;
    const k = w.k + (api.state.attraction - 0.3) * 0.01;
    const iters = clamp(Math.round(api.state.speed * 1.8), 1, 7);

    // pointer seeding
    if (api.pointer) {
      const px = Math.floor((api.pointer.x / api.w) * gw);
      const py = Math.floor((api.pointer.y / api.h) * gh);
      seed(api, px, py, 3, 1);
    }

    for (let it = 0; it < iters; it++) {
      const a = w.a;
      const b = w.b;
      const a2 = w.a2;
      const b2 = w.b2;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const i = y * gw + x;
          const av = a[i];
          const bv = b[i];
          // 9-point Laplacian (toroidal)
          const lA =
            -av +
            0.2 * (a[idx(w, x - 1, y)] + a[idx(w, x + 1, y)] + a[idx(w, x, y - 1)] + a[idx(w, x, y + 1)]) +
            0.05 * (a[idx(w, x - 1, y - 1)] + a[idx(w, x + 1, y - 1)] + a[idx(w, x - 1, y + 1)] + a[idx(w, x + 1, y + 1)]);
          const lB =
            -bv +
            0.2 * (b[idx(w, x - 1, y)] + b[idx(w, x + 1, y)] + b[idx(w, x, y - 1)] + b[idx(w, x, y + 1)]) +
            0.05 * (b[idx(w, x - 1, y - 1)] + b[idx(w, x + 1, y - 1)] + b[idx(w, x - 1, y + 1)] + b[idx(w, x + 1, y + 1)]);
          const abb = av * bv * bv;
          a2[i] = clamp(av + (DU * lA - abb + f * (1 - av)), 0, 1);
          b2[i] = clamp(bv + (DV * lB + abb - (k + f) * bv), 0, 1);
        }
      }
      w.a = a2;
      w.b = b2;
      w.a2 = a;
      w.b2 = b;
    }

    // metrics
    let mean = 0;
    let active = 0;
    let max = 0;
    const b = w.b;
    for (let i = 0; i < b.length; i++) {
      mean += b[i];
      if (b[i] > 0.2) active++;
      if (b[i] > max) max = b[i];
    }
    const n = b.length;
    api.push(clamp((mean / n) * 4, 0, 1), clamp(max, 0, 1), clamp(active / n, 0, 1));
  }

  function draw(api) {
    const w = api.custom;
    if (!w.a) return;
    const { gw, gh } = w;
    const img = w.img;
    const data = img.data;
    const b = w.b;
    const a = w.a;
    for (let i = 0; i < gw * gh; i++) {
      const v = clamp((b[i] - a[i] * 0.0 + b[i]) * 1.0, 0, 1);
      const c = Math.min(255, Math.floor((b[i] / 0.4) * 255));
      const o = i * 4;
      const p = c * 3;
      data[o] = w.pal[p];
      data[o + 1] = w.pal[p + 1];
      data[o + 2] = w.pal[p + 2];
      data[o + 3] = 255;
      void v;
    }
    w.bufCtx.putImageData(img, 0, 0);
    api.ctx.imageSmoothingEnabled = true;
    api.ctx.clearRect(0, 0, api.w, api.h);
    api.ctx.drawImage(w.buf, 0, 0, gw, gh, 0, 0, api.w, api.h);

    api.ctx.fillStyle = "rgba(245,245,247,0.92)";
    api.ctx.font = "600 12px Inter, sans-serif";
    api.ctx.textAlign = "left";
    api.ctx.textBaseline = "top";
    api.ctx.fillText(`Gray-Scott · ${api.state.variation} · f ${w.f.toFixed(3)} · k ${w.k.toFixed(3)}`, 14, 12);
  }

  return createSimHarness(refs, {
    seedDefault: 7,
    firstVariation: "coral",
    usePointer: true,
    chartColors: ["rgba(167,139,250,0.95)", "rgba(96,165,250,0.95)", "rgba(52,211,153,0.95)"],
    metricFormat: {
      energy: (v) => v.toFixed(2),
      order: (v) => v.toFixed(2),
      spread: (v) => `${Math.round(v * 100)}%`
    },
    presets: {
      coral: { count: 200, speed: 2.2, turbulence: 0.3, attraction: 0.32, trails: false },
      mitosis: { count: 200, speed: 2.2, turbulence: 0.3, attraction: 0.36, trails: false },
      worms: { count: 200, speed: 2.0, turbulence: 0.3, attraction: 0.4, trails: true },
      spots: { count: 200, speed: 2.2, turbulence: 0.3, attraction: 0.34, trails: false },
      waves: { count: 200, speed: 2.4, turbulence: 0.3, attraction: 0.3, trails: true }
    },
    reset(api) {
      const w = api.custom;
      const params = {
        coral: { f: 0.0545, k: 0.062 },
        mitosis: { f: 0.0367, k: 0.0649 },
        worms: { f: 0.058, k: 0.065 },
        spots: { f: 0.03, k: 0.062 },
        waves: { f: 0.014, k: 0.054 }
      };
      const p = params[api.state.variation] || params.coral;
      w.f = p.f;
      w.k = p.k;
      w.warm = api.state.trails;
      buildPalette(w);

      const scale = clamp(Math.round(6 - api.state.count / 90), 3, 7);
      w.gw = Math.max(80, Math.floor(api.w / scale));
      w.gh = Math.max(50, Math.floor(api.h / scale));
      const n = w.gw * w.gh;
      w.a = new Float32Array(n).fill(1);
      w.b = new Float32Array(n).fill(0);
      w.a2 = new Float32Array(n);
      w.b2 = new Float32Array(n);

      const seeds = 6 + Math.floor(api.state.turbulence * 14);
      for (let s = 0; s < seeds; s++) {
        seed(api, Math.floor(api.rand() * w.gw), Math.floor(api.rand() * w.gh), 3 + Math.floor(api.rand() * 4), 1);
      }

      w.buf = document.createElement("canvas");
      w.buf.width = w.gw;
      w.buf.height = w.gh;
      w.bufCtx = w.buf.getContext("2d");
      w.img = w.bufCtx.createImageData(w.gw, w.gh);
      api.log(`${api.state.variation} · ${w.gw}×${w.gh} grid · drag to seed reagent.`);
    },
    onTrails(api) {
      api.custom.warm = api.state.trails;
      buildPalette(api.custom);
    },
    step,
    draw
  });
}

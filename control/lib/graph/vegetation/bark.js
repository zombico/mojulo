// vegetation/bark — bark is fracture of a brittle skin on a growing cylinder.
//
// The outer bark is dead. Each year the trunk's circumference grows (2π Δr, from the pipe model's ring history), and
// the bark must follow. Three things can happen to that stretch, and a species is a choice among them:
//   · DILATATION: living tissue in the bark divides and keeps up (share δ). Beech: δ ≈ 1, the bark stays smooth.
//   · OPENING: existing fissures widen and take the rest.
//   · NUCLEATION: a plate (the bark between two fissures) wider than a critical width cracks down its middle. For thin
//     brittle layers that critical width scales with the layer's thickness (the channel-crack / fracture-saturation
//     law, spacing ≈ k·h with k of order 1–3: Hutchinson & Suo 1992; Bai, Pollard & Gao 2000). Bark thickness grows
//     with the stem, so spacing grows with the stem — the pattern is roughly self-similar across trunk sizes.
// Hoop strain is the only strain (the stem does not stretch along its length), so cracks run ALONG the stem. A new
// crack propagates up and down while the plate it enters is still wide enough (β·w_c), wandering toward the plate's
// middle (the stress maximum), and stops — joining its neighbour — where the plate narrows. That is the interlaced
// ridge network of oak and ash. Plated barks (pine) also break across, at a spacing that scales with the plate.
// CHIRALITY: cracks follow the fibres, so they lean at the spiral-grain angle of the year they formed (sweet
// chestnut's spiral bark; conifers lean left young and right old — Säll 2002).
// The domain is the unrolled trunk (u around, v up), periodic in BOTH directions, so the result tiles as a texture.
import { mulberry32 } from './grow.js';

export const BARKS = {
  beech:    { label: 'beech (smooth)', delta: 1.0, k: 1.6, beta: 0.6, h0: 0.002, h1: 0.012, start: 4, grain: () => 0, plates: 0,
              top: [150, 150, 146], floor: [120, 118, 112], mottle: 0.10, lenticels: 0.5 },
  oak:      { label: 'oak (interlaced ridges)', delta: 0.12, k: 1.25, beta: 0.52, h0: 0.003, h1: 0.06, start: 6, persist: 40, grain: (y) => 1.5, plates: 0,
              top: [136, 130, 120], floor: [66, 58, 50], mottle: 0.16, lenticels: 0 },
  pine:     { label: 'pine (plates)', delta: 0.08, k: 2.6, beta: 0.72, h0: 0.003, h1: 0.07, start: 5, persist: 22, grain: (y) => (y < 30 ? 3 * Math.min(1, y / 4) * (1 - y / 70) : Math.max(-1.2, 3 * (1 - y / 70))), plates: 1.4,
              top: [132, 104, 88], floor: [178, 96, 58], mottle: 0.12, lenticels: 0 },
  chestnut: { label: 'sweet chestnut (spiral)', delta: 0.12, k: 1.15, beta: 0.5, h0: 0.003, h1: 0.05, start: 6, persist: 45, grain: (y) => Math.min(35, 12 + 0.4 * y), plates: 0,
              top: [120, 112, 104], floor: [74, 56, 44], mottle: 0.14, lenticels: 0 },
  // the conifers (conifer.js): spruce is a thin layer broken across into small scales; silver fir keeps up with the
  // stretch like beech, grey, with resin blisters; a Scots pine's upper trunk is thin papery orange (its lower is `pine`)
  spruce:   { label: 'spruce (small scales)', delta: 0.12, k: 2.2, beta: 0.72, h0: 0.002, h1: 0.022, start: 5, persist: 14, grain: (y) => (y < 30 ? 3 * Math.min(1, y / 4) * (1 - y / 70) : Math.max(-1.2, 3 * (1 - y / 70))), plates: 1.1,
              top: [140, 102, 82], floor: [92, 62, 48], mottle: 0.16, lenticels: 0 },
  silverfir: { label: 'silver fir (smooth, blistered)', delta: 1.0, k: 1.6, beta: 0.6, h0: 0.002, h1: 0.012, start: 4, grain: () => 0, plates: 0,
              top: [168, 168, 162], floor: [126, 126, 120], mottle: 0.1, lenticels: 0.9 },
  pineUpper: { label: 'pine upper (papery orange)', delta: 0.5, k: 1.2, beta: 0.72, h0: 0.001, h1: 0.004, start: 5, persist: 6, grain: (y) => (y < 30 ? 3 * Math.min(1, y / 4) * (1 - y / 70) : Math.max(-1.2, 3 * (1 - y / 70))), plates: 3.2,
              top: [214, 136, 82], floor: [170, 92, 54], mottle: 0.2, lenticels: 0 },
};

/**
 * Grow the bark on a trunk whose radius history is `rHist[y-1]` (metres), over a patch `height` metres tall.
 * Returns { rows, C, height, spec, cracks, thickness, render(px) }.
 */
export function growBark(rHist, specIn, { rows = 320, height = 0.8, seed = 1, sector = 1 } = {}) {
  const spec = typeof specIn === 'string' ? BARKS[specIn] : specIn; const rng = mulberry32((seed * 2246822519) >>> 0);
  const Y = rHist.length; const dv = height / rows;
  const R = rows; const row = Array.from({ length: R }, () => []);          // each: sorted [{u, g, born, id, ang}]
  let C = 2 * Math.PI * rHist[0] * sector; let nextId = 1; const H = (y) => spec.h0 + spec.h1 * Math.pow(rHist[Math.min(Y, y) - 1], 0.8);
  const flaw = new Float32Array(R * 64).map(() => 0.8 + 0.4 * rng());
  const plateAt = (cr, Cc, u) => {                     // the plate containing u in a row: [left crack index, right]
    const n = cr.length; if (!n) return { a: 0, b: Cc, w: Cc, li: -1, ri: -1, mid: u };
    let i = 0; while (i < n && cr[i].u < u) i++;
    const L = cr[(i - 1 + n) % n], Rr = cr[i % n];
    let a = L.u + L.g / 2; if (i === 0) a -= Cc; let b = Rr.u - Rr.g / 2; if (i === n) b += Cc;
    return { a, b, w: b - a, li: (i - 1 + n) % n, ri: i % n, mid: (a + b) / 2 };
  };
  const wrapU = (u, Cc) => ((u % Cc) + Cc) % Cc;
  const insert = (cr, c) => { let i = 0; while (i < cr.length && cr[i].u < c.u) i++; cr.splice(i, 0, c); };
  for (let y = 2; y <= Y; y++) {
    const Cn = 2 * Math.PI * rHist[y - 1] * sector; const s = Cn / C; const dC = Cn - C;
    // a fissure's opening saturates at about the bark's thickness: its floor is new bark (the phellogen keeps
    // making it), so past that the stretch becomes new plate material between the fissures — which then cracks
    const gMax = (spec.gamma ?? 0.6) * H(y);
    for (const cr of row) {
      for (const c of cr) c.u *= s;
      if (cr.length) { const share = ((1 - spec.delta) * dC) / cr.length; for (const c of cr) c.g = Math.min(gMax, c.g + share); }
      // merge fissures whose gaps now overlap
      for (let i = 0; cr.length > 1 && i < cr.length; i++) { const a = cr[i], b = cr[(i + 1) % cr.length]; const d = i + 1 < cr.length ? b.u - a.u : b.u + Cn - a.u; if (d < (a.g + b.g) / 2) { a.g = Math.max(a.g, d + b.g); if (b.born < a.born) { a.born = b.born; } cr.splice((i + 1) % cr.length, 1); i--; } }
    }
    C = Cn;
    // the outermost bark weathers and falls away: a fissure older than the species' persistence leaves with it,
    // and the surface below is younger, continuous bark that will crack again where it is now stretched
    if (spec.persist) for (const cr of row) for (let i = cr.length - 1; i >= 0; i--) if (y - cr[i].born > spec.persist) cr.splice(i, 1);
    if (y < spec.start || spec.delta >= 1) continue;
    const wc = spec.k * H(y); const g0 = 0.15 * H(y);
    // nucleation: the widest plates (relative to their flaw-scaled critical width) crack first, then propagate
    const cand = [];
    for (let r = 0; r < R; r++) {
      const cr = row[r];
      if (!cr.length) { cand.push({ r, u: rng() * Cn, over: Cn / (wc * flaw[r * 64]) }); continue; }
      for (let i = 0; i < cr.length; i++) { const p = plateAt(cr, Cn, cr[i].u + cr[i].g / 2 + 1e-9); const f = flaw[r * 64 + (i % 64)]; if (p.w > wc * f) cand.push({ r, u: p.mid, over: p.w / (wc * f) }); }
    }
    cand.sort((a, b) => b.over - a.over || a.r - b.r || a.u - b.u);
    for (const cd of cand) {
      const p0 = plateAt(row[cd.r], Cn, wrapU(cd.u, Cn)); const f0 = flaw[cd.r * 64 + (Math.floor(cd.u * 97) & 63)];
      if (p0.w <= wc * f0) continue;                                    // an earlier crack already relieved it
      const id = nextId++; const ang = (spec.grain(y) * Math.PI) / 180; const tg = Math.tan(ang);
      const u0 = wrapU(p0.a + p0.w * (0.5 + (rng() - 0.5) * 0.3), Cn);
      insert(row[cd.r], { u: u0, g: g0, born: y, id, ang });
      for (const dir of [1, -1]) {
        let u = u0; let wob = 0;
        for (let step = 1; step < R; step++) {
          const r = (((cd.r + dir * step) % R) + R) % R; u = wrapU(u + tg * dv * dir, Cn);
          const p = plateAt(row[r], Cn, u);
          if (p.w < spec.beta * wc) break;                               // the plate narrows: the crack meets its neighbour
          if (row[r].some((c) => c.id === id)) break;                    // wrapped all the way round
          wob += (rng() - 0.5) * 0.08; wob *= 0.97; u = wrapU(u + (p.mid - u) * 0.05 + wob * dv, Cn);   // a smooth wander, not per-row jitter
          insert(row[r], { u, g: g0, born: y, id, ang });
        }
      }
    }
  }
  const cracks = row.reduce((s, cr) => s + cr.length, 0);
  return { rows: row, C, height, spec, Y, thickness: H(Y), wc: spec.k * H(Y), cracks, render: (px) => renderBark(row, C, height, spec, Y, H, px, seed) };
}

// value noise for mottling (deterministic)
function hash2(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

/** Raster the bark: height (m, 0 = fissure floor) and colour, `px` pixels per metre. Tiles in u and v. */
function renderBark(row, C, height, spec, Y, H, px, seed) {
  const W = Math.max(8, Math.round(C * px)), Hh = Math.max(8, Math.round(height * px)); const R = row.length;
  const hgt = new Float32Array(W * Hh); const col = new Uint8Array(W * Hh * 3); const hT = H(Y);
  for (let j = 0; j < Hh; j++) {
    const r = Math.min(R - 1, Math.floor(((Hh - 1 - j) / Hh) * R)); const cr = row[r]; const v = ((Hh - 1 - j) / Hh) * height;
    for (let i = 0; i < W; i++) {
      const u = ((i + 0.5) / W) * C; let depthT = 1, fissure = 0, plateW = C, edgeD = C, pairKey = 0;
      if (cr.length) {
        let k = 0; while (k < cr.length && cr[k].u < u) k++;
        const L = cr[(k - 1 + cr.length) % cr.length], Rr = cr[k % cr.length];
        const dl = k === 0 ? u + C - L.u : u - L.u, dr = k === cr.length ? Rr.u + C - u : Rr.u - u;
        const near = dl < dr ? L : Rr; const d = Math.min(dl, dr);
        if (d < near.g / 2) { fissure = 1 - d / (near.g / 2); depthT = 0; }
        plateW = dl + dr - L.g / 2 - Rr.g / 2; edgeD = Math.min(dl - L.g / 2, dr - Rr.g / 2); pairKey = L.id * 7919 + Rr.id;
      }
      let h;
      if (depthT === 0) h = hT * 0.12 * (1 - Math.sqrt(fissure));                        // the fissure floor: fresh inner bark
      else {
        h = hT * (0.15 + 0.85 * (1 - Math.exp(-edgeD / (0.3 * hT + 1e-6))));          // a rounded ridge
        if (spec.plates > 0 && cr.length) {                                               // plated bark breaks across too
          const Lp = spec.plates * Math.max(plateW, 0.2 * hT); const ph = hash2(pairKey, 3, seed) * Lp; const t = ((v + ph) % Lp) / Lp;
          const gapT = Math.min(t, 1 - t) * Lp; if (gapT < 0.35 * hT) h *= 0.25 + 0.75 * (gapT / (0.35 * hT)) ** 0.7;
        }
        h *= 0.86 + 0.28 * vnoise(u * 40, v * 14, seed);                                  // flaking, vertical-grained
      }
      const m = 1 + spec.mottle * (vnoise(u * 9, v * 5, seed + 7) - 0.5) * 2;
      const t = Math.max(0, Math.min(1, h / hT));
      let c = spec.floor.map((x, q) => (x + (spec.top[q] - x) * Math.pow(t, 0.7)) * m);
      if (spec.lenticels > 0) { const lv = vnoise(u * 60, v * 400, seed + 11); if (lv > 0.88) c = c.map((x) => x * (1 - spec.lenticels * (lv - 0.88) * 4)); }
      const o = j * W + i; hgt[o] = h; col[o * 3] = Math.max(0, Math.min(255, c[0])); col[o * 3 + 1] = Math.max(0, Math.min(255, c[1])); col[o * 3 + 2] = Math.max(0, Math.min(255, c[2]));
    }
  }
  return { W, H: Hh, height: hgt, color: col, px, hT };
}

/** Relief-shade a bark raster (light from the upper left) into RGB for a flat texture preview or a World texture. */
export function shadeBark(map, { light = [-0.5, 0.6, 0.62], strength = 1 } = {}) {
  const { W, H, height, color, px } = map; const out = Buffer.alloc(W * H * 3); const L = light.map((x) => x / Math.hypot(...light));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const hx = (height[j * W + ((i + 1) % W)] - height[j * W + ((i - 1 + W) % W)]) * px * 0.5 * strength;
    const hy = (height[((j - 1 + H) % H) * W + i] - height[((j + 1) % H) * W + i]) * px * 0.5 * strength;
    const n = [-hx, -hy, 1]; const l = Math.hypot(...n); const d = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / l;
    const s = 0.5 + 0.62 * Math.max(0, d);
    for (let k = 0; k < 3; k++) out[(j * W + i) * 3 + k] = Math.max(0, Math.min(255, color[(j * W + i) * 3 + k] * s));
  }
  return out;
}
/** Crack statistics: orientation (degrees from the stem axis, signed: + leans right) and spacing per row. */
export function barkStats(b) {
  const byId = new Map();
  b.rows.forEach((cr, r) => { for (const c of cr) { if (!byId.has(c.id)) byId.set(c.id, []); byId.get(c.id).push([r, c.u]); } });
  const angles = []; const dv = b.height / b.rows.length;
  for (const pts of byId.values()) {
    if (pts.length < 6) continue; pts.sort((a, b) => a[0] - b[0]);
    // unwrap rows and u; least squares du/dv
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; const u0 = pts[0][1];
    for (const [r, u] of pts) { let du = u - u0; if (du > b.C / 2) du -= b.C; if (du < -b.C / 2) du += b.C; const x = r * dv; n++; sx += x; sy += du; sxx += x * x; sxy += x * du; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); angles.push((Math.atan(slope) * 180) / Math.PI);
  }
  const counts = b.rows.map((cr) => cr.length); const meanCount = counts.reduce((a, c) => a + c, 0) / counts.length;
  const meanPlate = meanCount > 0 ? b.C / meanCount : b.C;
  angles.sort((a, c) => a - c);
  return { cracks: byId.size, meanAngle: angles.length ? angles.reduce((a, c) => a + c, 0) / angles.length : null, medianAngle: angles.length ? angles[Math.floor(angles.length / 2)] : null,
    fissuresAround: +meanCount.toFixed(1), meanPlateM: +meanPlate.toFixed(4), thicknessM: +b.thickness.toFixed(4), plateOverThickness: +(meanPlate / b.thickness).toFixed(2) };
}

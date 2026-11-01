/**
 * THE READS: a scene's FINGERPRINT, measured from its resolved payload (worlds/world-scene.js, a gen-7 geocube path or
 * trail), no render. Each read is what a person walking it would notice, as a number with its range:
 *
 *   openness     0–1   the share of the sky seen from eye height along the walk (a hemisphere of rays, the ground and
 *                      the crowns blocking them): an enclosed wood near 0, an open meadow near 1
 *   canopy       0–1   the share of the walk under a tree's crown
 *   reveal       −1–1  the landmark seen late and hidden early (1), seen all along (0), seen early and lost (−1); null
 *                      without a landmark
 *   verticality  { range m, grade }: how far the walk rises and falls, and its mean steepness (rise over run)
 *   walk         { metres, seconds }: the walk's length out to the trail's exit, and its time end to end at the trail's run
 *   flora        { trees, bushes, species: { name: share }, heightSpread }: what stands, and how its heights vary
 *                      (their spread over their mean)
 *   ground       { cover, tall, medium, short }: the share of the land in grass, and each sward length's share of it
 *   drifts       { id: share }: the drift kinds standing in the grass (wheat, chaff, flowers, a grass kind)
 *   autumn       0–1   how far into the fall
 *   colour       { hueSpread, key, chroma }: the cube's named colours, their hues' spread round the wheel (0–1), their
 *                      mean lightness and saturation (0–1)
 *
 *   fingerprint(payload, { colours?, detail? }) → the reads above (colours: the cube's #rrggbb by name; detail: where
 *                      along the walk the landmark is seen)
 *   READS: each read's range, for normalizing one against another
 */
import { FLORA_STRIDE } from '../form/flora-read.js';
import { SWARD_LENGTH } from '../scene/channels/form-grass.js';

const fz = Object.freeze;
export const READS = fz({
  openness: fz([0, 1]), canopy: fz([0, 1]), reveal: fz([-1, 1]), 'verticality.range': fz([0, 30]), 'verticality.grade': fz([0, 0.6]),
  'walk.metres': fz([0, 200]), 'flora.heightSpread': fz([0, 1]), 'ground.cover': fz([0, 1]), autumn: fz([0, 1]),
  'colour.hueSpread': fz([0, 1]), 'colour.key': fz([0, 1]), 'colour.chroma': fz([0, 1]),
});
/** How the reads are sampled: the eye's height, a point of the walk every `step` m, the sky's rays (`az` round ×
 *  `el` up, from `lo` to `hi` degrees), how far a ray looks (`reach` m) in steps of `ray` m. */
export const SAMPLING = fz({ eye: 1.7, step: 4, az: 16, el: fz([8, 20, 35, 55, 75]), reach: 60, ray: 1.5 });

const b64 = (s) => { const b = Buffer.from(s, 'base64'); return b; };
const f32 = (s) => { const b = b64(s); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const r3 = (v) => Math.round(v * 1000) / 1000;

// the ground's height at a point, from the grass map (16 bits over its range, bilinear), or null off it
function groundOf(G) {
  if (!G) return () => null;
  const px = b64(G.px), [nx, ny] = G.size, zq = (i, j) => { const q = (j * nx + i) * 4; return G.z[0] + ((px[q] * 256 + px[q + 1]) / 65535) * G.z[1]; };
  return (x, y) => {
    const u = (x - G.origin[0]) / G.cell, v = (y - G.origin[1]) / G.cell, i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) return null;
    const f = u - i, g = v - j;
    return (zq(i, j) * (1 - f) + zq(i + 1, j) * f) * (1 - g) + (zq(i, j + 1) * (1 - f) + zq(i + 1, j + 1) * f) * g;
  };
}
// the trees as crowns: a sphere each (its centre up its height, its radius the template's), the bushes apart
function plantsOf(F) {
  if (!F) return { crowns: [], trees: [], bushes: 0 };
  const P = f32(F.trees), crowns = [], trees = []; let bushes = 0;
  for (let i = 0; i < F.n; i++) {
    const b = i * FLORA_STRIDE, T = F.templates[P[b + 11]], s = P[b + 3], h = T.height * s;
    if (T.kind !== 'tree') { bushes++; continue; }
    const r = Math.max(0.5, T.radius * s);
    trees.push({ name: T.name, h });
    crowns.push({ x: P[b], y: P[b + 1], z: P[b + 2] + Math.max(r, h - r), r, foot: P[b + 2] });
  }
  return { crowns, trees, bushes };
}
const inCrown = (C, x, y, z) => { for (const c of C) { const dx = x - c.x, dy = y - c.y, dz = z - c.z; if (dx * dx + dy * dy + dz * dz < c.r * c.r) return true; } return false; };

// a ray from p along d: blocked by the ground or a crown within reach
function blocked(p, d, ground, crowns, reach = SAMPLING.reach, to = null) {
  const n = Math.ceil((to ?? reach) / SAMPLING.ray);
  for (let k = 1; k <= n; k++) {
    const t = Math.min(k * SAMPLING.ray, to ?? reach), x = p[0] + d[0] * t, y = p[1] + d[1] * t, z = p[2] + d[2] * t;
    const g = ground(x, y); if (g !== null && z < g) return true;
    if (inCrown(crowns, x, y, z)) return true;
  }
  return false;
}

// the walk's points every `step` m, at eye height over the ground, out to the trail's exit (the walker's path comes back
// the way it went: only the way out is the walk, or a reveal would read the same both halves)
function walkOf(payload, ground) {
  const path = payload.walkers?.[0]?.path ?? [], beats = payload.outTrail?.beats ?? [], end = beats.length ? Math.max(...beats.map((b) => b.s)) : Infinity;
  const pts = []; let acc = SAMPLING.step, len = 0;
  for (let i = 0; i < path.length; i++) {
    if (i) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (len + d > end) break; len += d; acc += d; }
    if (acc >= SAMPLING.step) { acc = 0; const g = ground(path[i][0], path[i][1]) ?? path[i][2]; pts.push([path[i][0], path[i][1], g + SAMPLING.eye, g]); }
  }
  return { pts, metres: len };
}

const hsl = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16), r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
};

export function fingerprint(payload, { colours = null, detail = false } = {}) {
  const L = payload.form?.land, G = L?.grass, ground = groundOf(G), { crowns, trees, bushes } = plantsOf(payload.form?.flora);
  const { pts, metres } = walkOf(payload, ground);
  // openness: the share of the sky's rays unblocked, over the walk's points
  let open = 0, rays = 0;
  for (const p of pts) for (let a = 0; a < SAMPLING.az; a++) for (const e of SAMPLING.el) {
    const az = (2 * Math.PI * a) / SAMPLING.az, el = (e * Math.PI) / 180, d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    rays++; if (!blocked(p, d, ground, crowns)) open++;
  }
  // canopy: the walk's points under a crown (within its radius across, below its top)
  const under = pts.filter((p) => crowns.some((c) => Math.hypot(p[0] - c.x, p[1] - c.y) < c.r && p[2] < c.z + c.r)).length;
  // reveal: the landmark's top seen from each point, the late half against the early
  const lm = (payload.anchors ?? []).find((a) => a.beat === 'landmark');
  let reveal = null, seenAt = null;
  if (lm && pts.length > 1) {
    // (its top: the highest ground the map holds over its footprint, which is the landmark itself; a sight line stops at
    // the footprint's edge, or it would meet the landmark as ground)
    const rad = (lm.size ?? 2) / 2 + 0.5;
    let hz = lm.at[2] + (lm.size ?? 2);
    for (let a = 0; a < 8; a++) for (const f of [0, 0.5, 1]) { const g = ground(lm.at[0] + Math.cos(a * 0.785) * rad * f, lm.at[1] + Math.sin(a * 0.785) * rad * f); if (g !== null) hz = Math.max(hz, g); }
    const top = [lm.at[0], lm.at[1], hz - 0.3];
    const seen = pts.map((p) => { const v = [top[0] - p[0], top[1] - p[1], top[2] - p[2]], d = Math.hypot(...v); return d < rad || !blocked(p, v.map((c) => c / d), ground, crowns, d, d - rad - 0.5); });
    const h = Math.floor(seen.length / 2), share = (a) => a.filter(Boolean).length / Math.max(1, a.length);
    reveal = r3(share(seen.slice(h)) - share(seen.slice(0, h))); seenAt = seen;
  }
  // verticality: the walk's ground, its range and its mean grade
  const zs = pts.map((p) => p[3]);
  let rise = 0; for (let i = 1; i < zs.length; i++) rise += Math.abs(zs[i] - zs[i - 1]);
  // flora: species shares and the heights' spread
  const species = {}; for (const t of trees) species[t.name] = (species[t.name] ?? 0) + 1;
  for (const k of Object.keys(species)) species[k] = r3(species[k] / trees.length);
  const hm = trees.reduce((a, t) => a + t.h, 0) / Math.max(1, trees.length), hsd = Math.sqrt(trees.reduce((a, t) => a + (t.h - hm) ** 2, 0) / Math.max(1, trees.length));
  // ground: the share of the land in grass, each sward length's share of the grass (the map's cover and fourth channel)
  const gr = { cover: 0, tall: 0, medium: 0, short: 0 };
  if (G) {
    const px = b64(G.px); let n = 0, g = 0;
    for (let q = 0; q < px.length; q += 4) { n++; const c = px[q + 2] / 255; if (c <= 0.05) continue; g++; const sw = px[q + 3] / 255;
      const w = Math.abs(sw - SWARD_LENGTH.tall) <= SWARD_LENGTH.band ? 'tall' : Math.abs(sw - SWARD_LENGTH.medium) <= SWARD_LENGTH.band ? 'medium' : 'short'; gr[w]++; }
    gr.cover = r3(g / Math.max(1, n)); for (const w of ['tall', 'medium', 'short']) gr[w] = r3(gr[w] / Math.max(1, g));
  }
  const drifts = Object.fromEntries((G?.drifts?.kinds ?? []).map((K) => [K.id, 1]));
  // colour: the cube's named colours as hues round the wheel (their spread: 1 − the mean vector's length), lightness, saturation
  let colour = null;
  if (colours) {
    const C = Object.values(colours).filter((v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)).map(hsl);
    const cx = C.reduce((a, c) => a + Math.cos(2 * Math.PI * c.h) * c.s, 0), cy = C.reduce((a, c) => a + Math.sin(2 * Math.PI * c.h) * c.s, 0), sw = C.reduce((a, c) => a + c.s, 0) || 1;
    colour = { hueSpread: r3(1 - Math.hypot(cx, cy) / sw), key: r3(C.reduce((a, c) => a + c.l, 0) / C.length), chroma: r3(C.reduce((a, c) => a + c.s, 0) / C.length) };
  }
  return {
    openness: r3(open / Math.max(1, rays)), canopy: r3(under / Math.max(1, pts.length)), reveal,
    verticality: { range: r3(zs.length ? Math.max(...zs) - Math.min(...zs) : 0), grade: r3(rise / Math.max(1, metres)) },
    walk: { metres: r3(metres), seconds: payload.outTrail?.run ?? null },
    flora: { trees: trees.length, bushes, species, heightSpread: r3(hm ? hsd / hm : 0) },
    ground: gr, drifts, autumn: payload.form?.flora?.autumn ?? 0, colour,
    // (detail: where along the walk the landmark is seen, a point every SAMPLING.step m, for a brief to say where)
    ...(detail ? { detail: { landmarkSeen: seenAt } } : {}),
  };
}

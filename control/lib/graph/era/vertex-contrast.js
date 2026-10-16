/**
 * VERTEX CONTRAST — how a level's light is shaped across its surfaces, baked into the vertex the way a Wii-era level
 * baked it: the cube's own concern (geocube `contrast`), apart from its light (each kind's bake under the cube's
 * reference) and its colour (the cube's ramps and tone). It runs once over the finished faces of a world the cube paints,
 * after the AO bake, so every piece of the world (the land, the stage, the city, its props) takes the same rules.
 *
 *   hemi       the sky's colour on what faces up, the ground's on what faces down: up keeps its value, down darkens
 *   foot       a wall darker toward the floor beneath it (`height`: metres the gradient rises, `depth`: how dark at
 *              the foot); a floor is not its own foot
 *   crevice    a concave corner (a wall meeting the floor, a fold) darkened toward the shade colour
 *   ridge      a convex lip lifted a little: the lit edge a facet catches
 *   contact    the AO bake's occlusion (`vao`) tinted to the shade colour and folded in (the `vao` is consumed)
 *   warmCool   the side the key light reaches leans to its colour, the rest to the shade's
 *   variation  a slow seeded drift of value across the world, so a small tile never repeats flatly
 *
 * Every term is a multiplier on the baked colour, in linear light; every darkening leans to the shade colour, never to
 * black. Under a tone (`mode: 'value'`) only value moves: the tone's ramps colour it on the page.
 *
 *   CONTRAST_PRESETS          the starters (`wii`)
 *   readContrast(spec)        'wii' | { from?, …terms } | false | absent → the checked terms, or null
 *   contrastFaces(faces, vc)  a face list shaped by a resolved contrast (geocube.js cubeContrast resolves one)
 *
 * Pure and deterministic: arithmetic over the faces in their order, seeded value noise (dirt.js), no clock.
 */
import { vnoise } from './dirt.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`contrast: ${msg}`); };

/** The starters. Numbers are read off the era's frames by eye: the eyes gate's to move. */
export const CONTRAST_PRESETS = Object.freeze({
  wii: Object.freeze({ hemi: 0.55, foot: Object.freeze({ height: 1.6, depth: 0.4 }), crevice: 0.55, ridge: 0.35, contact: 0.7, warmCool: 0.45, variation: 0.3 }),
});
export const CONTRAST_TERMS = Object.freeze(['hemi', 'foot', 'crevice', 'ridge', 'contact', 'warmCool', 'variation']);
const UNIT_TERMS = CONTRAST_TERMS.filter((k) => k !== 'foot');

/** A cube's `contrast` → { hemi, foot: { height, depth }, crevice, ridge, contact, warmCool, variation }, or null. */
export function readContrast(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (typeof spec === 'string') {
    if (!CONTRAST_PRESETS[spec]) no(`'${spec}' is not a preset (presets: ${Object.keys(CONTRAST_PRESETS).join(', ')}); or name the terms`);
    return readContrast({ ...CONTRAST_PRESETS[spec], foot: { ...CONTRAST_PRESETS[spec].foot } });
  }
  if (!isObj(spec)) no(`contrast is a preset (${Object.keys(CONTRAST_PRESETS).join(', ')}), { from?, ${CONTRAST_TERMS.join(', ')} } or false`);
  for (const k of Object.keys(spec)) if (k !== 'from' && !CONTRAST_TERMS.includes(k)) no(`${k} is not a term (${CONTRAST_TERMS.join(', ')})`);
  let base = { hemi: 0, foot: { height: 1.6, depth: 0 }, crevice: 0, ridge: 0, contact: 0, warmCool: 0, variation: 0 };
  if (spec.from !== undefined) {
    if (!CONTRAST_PRESETS[spec.from]) no(`from: '${spec.from}' is not a preset (presets: ${Object.keys(CONTRAST_PRESETS).join(', ')})`);
    base = { ...CONTRAST_PRESETS[spec.from], foot: { ...CONTRAST_PRESETS[spec.from].foot } };
  }
  const out = { ...base };
  for (const k of UNIT_TERMS) {
    if (spec[k] === undefined) continue;
    if (!(typeof spec[k] === 'number' && spec[k] >= 0 && spec[k] <= 1)) no(`${k} is 0 (none) to 1`);
    out[k] = spec[k];
  }
  if (spec.foot !== undefined) {
    if (!isObj(spec.foot)) no('foot is { height, depth }: the metres the gradient rises and how dark the foot is');
    for (const k of Object.keys(spec.foot)) if (!['height', 'depth'].includes(k)) no(`foot.${k} is not a setting (foot: height, depth)`);
    const f = { ...base.foot, ...spec.foot };
    if (!(typeof f.height === 'number' && f.height >= 0.25 && f.height <= 10)) no('foot.height is the metres the gradient rises, 0.25 to 10');
    if (!(typeof f.depth === 'number' && f.depth >= 0 && f.depth <= 1)) no('foot.depth is how dark the foot is, 0 (none) to 1');
    out.foot = f;
  }
  return out;
}

// ── colour in linear light ───────────────────────────────────────────────────────────────────────────────────────
const HEX = /^#[0-9a-f]{6}$/i;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const srgb = (c) => c.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// a colour's hue at unit luminance, its channels held to [0.25, 2.5] so a saturated sky cannot blow a channel out
function hat(hex) {
  const c = lin(hexRgb(hex)), l = lum(c);
  if (l < 1e-5) return [1, 1, 1];
  const h = c.map((v) => Math.max(0.25, Math.min(2.5, v / l))), hl = lum(h);
  return h.map((v) => v / hl);
}
const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const toward = (tint, w) => [1 - w + w * tint[0], 1 - w + w * tint[1], 1 - w + w * tint[2]];
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// the depth a full darkening reaches (ruleLand's): a shadow keeps a third of its light, in the shade's colour
const DEEP = 0.35, K = 5, LIFT = 0.22;
// a shaped colour rolls off before white (the stage's shoulder, on luminance so the hue holds)
const KNEE = 0.8;
const shoulder = (v) => (v <= KNEE ? v : KNEE + (1 - KNEE) * (1 - Math.exp(-(v - KNEE) / (1 - KNEE))));
// what the shaping leaves alone: what lights itself, what is drawn as the air (far layers, clouds), water and spray
const SELF_LIT = new Set(['stage:fixture', 'stage:glass', 'isekai:ridge', 'isekai:cloud', 'isekai:spray']);

// ── the geometry the terms read ──────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function newell(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit(n);
}
const normalOf = (f) => (Array.isArray(f.outNormal) ? unit(f.outNormal) : Array.isArray(f.normal) ? unit(f.normal) : newell(f.corners));
// a corner welded to its neighbours at a centimetre (the emitter's de-collide nudge is a twentieth of that)
const keyOf = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)},${Math.round(c[2] * 100)}`;

function shapedFace(f) {
  if (!f || !Array.isArray(f.corners) || f.corners.length < 3) return false;
  if (f.emissive || f.glow || f.crystal || f.metal || f.water || SELF_LIT.has(f.group)) return false;
  if (typeof f.texture === 'string' && !f.textureLit) return false;
  return HEX.test(f.fill ?? '') || (Array.isArray(f.cornerFills) && f.cornerFills.length && f.cornerFills.every((h) => HEX.test(h)));
}

/** Concavity at every welded corner (ruleLand's measure on any soup): −0.5 a sharp ridge … +0.5 a sharp crease. */
function concavity(faces, idx, normals) {
  const V = new Map();
  const at = (c) => { const k = keyOf(c); let v = V.get(k); if (!v) V.set(k, (v = { p: c, n: [0, 0, 0], nb: new Set(), cav0: 0, cav: 0 })); return v; };
  for (const i of idx) {
    const f = faces[i], vs = f.corners.map(at), n = vs.length, fn = normals[i];
    vs.forEach((v, j) => { v.n[0] += fn[0]; v.n[1] += fn[1]; v.n[2] += fn[2]; for (const s of [1, n - 1]) { const w = vs[(j + s) % n]; if (w !== v) v.nb.add(w); } });
  }
  const all = [...V.values()];
  for (const v of all) {
    const n = unit(v.n); let h = 0, e = 0;
    for (const w of v.nb) { const d = sub(w.p, v.p); h += dot(d, n); e += Math.hypot(d[0], d[1], d[2]); }
    v.cav0 = v.nb.size ? h / Math.max(e, 1e-6) : 0;
  }
  for (const v of all) { let s = 0; for (const w of v.nb) s += w.cav0; v.cav = v.nb.size ? 0.5 * v.cav0 + 0.5 * s / v.nb.size : 0; }
  return (c) => V.get(keyOf(c))?.cav ?? 0;
}

/** The floor beneath a point: the highest up-facing face (its plane at the point) at or below it, on a coarse grid. */
function floorFinder(faces, idx, normals) {
  const ups = idx.filter((i) => normals[i][2] > 0.7);
  if (!ups.length) return () => -Infinity;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of ups) for (const c of faces[i].corners) { x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]); }
  const cell = Math.max(1, Math.max(x1 - x0, y1 - y0) / 256);
  const G = new Map();
  for (const i of ups) {
    const cs = faces[i].corners, n = normals[i], p = cs[0], d = dot(n, p);
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    for (const c of cs) { a0 = Math.min(a0, c[0]); b0 = Math.min(b0, c[1]); a1 = Math.max(a1, c[0]); b1 = Math.max(b1, c[1]); }
    const plane = { n, d, a0, b0, a1, b1 };
    for (let gx = Math.floor((a0 - x0) / cell); gx <= Math.floor((a1 - x0) / cell); gx++) {
      for (let gy = Math.floor((b0 - y0) / cell); gy <= Math.floor((b1 - y0) / cell); gy++) {
        const k = gx * 65536 + gy, L = G.get(k);
        if (L) L.push(plane); else G.set(k, [plane]);
      }
    }
  }
  const PAD = 0.05;
  return (c) => {
    const L = G.get(Math.floor((c[0] - x0) / cell) * 65536 + Math.floor((c[1] - y0) / cell));
    if (!L) return -Infinity;
    let best = -Infinity;
    for (const q of L) {
      if (c[0] < q.a0 - PAD || c[0] > q.a1 + PAD || c[1] < q.b0 - PAD || c[1] > q.b1 + PAD) continue;
      const z = (q.d - q.n[0] * c[0] - q.n[1] * c[1]) / q.n[2];
      if (z <= c[2] + PAD && z > best) best = z;
    }
    return best;
  };
}

/**
 * A face list shaped by a resolved contrast (`vc`: the terms plus `sky`, `ground`, `shade`, `key` colours, `toLight`,
 * `seed` and `mode`). Faces it leaves alone come back as they are; a shaped face comes back with a colour per corner
 * (`cornerFills`), its `fill` their mean, and its `vao` folded in when the contrast takes the contact.
 */
export function contrastFaces(faces, vc) {
  if (!vc || !Array.isArray(faces) || !faces.length) return faces;
  const idx = [];
  faces.forEach((f, i) => { if (shapedFace(f)) idx.push(i); });
  if (!idx.length) return faces;
  const normals = new Array(faces.length);
  for (const i of idx) normals[i] = normalOf(faces[i]);
  const value = vc.mode === 'value';
  const sky = hat(vc.sky), ground = hat(vc.ground), shade = hat(vc.shade), key = hat(vc.key), toLight = unit(vc.toLight);
  const cav = vc.crevice > 0 || vc.ridge > 0 ? concavity(faces, idx, normals) : null;
  const foot = vc.foot && vc.foot.depth > 0 ? vc.foot : null, floorOf = foot ? floorFinder(faces, idx, normals) : null;
  const dark = (m, x) => { if (x <= 0) return; const t = Math.min(1, x); for (let j = 0; j < 3; j++) m[j] *= (1 - t) + t * DEEP * shade[j]; };
  const out = faces.slice();
  for (const i of idx) {
    const f = faces[i], n = normals[i], cs = f.corners;
    // a corner past the end of a shorter `cornerFills` takes the face's fill (faceListToMesh's rule), else the first
    const own = HEX.test(f.fill ?? '') ? f.fill : f.cornerFills[0];
    const fills = cs.map((_, k) => (Array.isArray(f.cornerFills) && HEX.test(f.cornerFills[k] ?? '') ? f.cornerFills[k] : own));
    const vao = vc.contact > 0 && Array.isArray(f.vao) && f.vao.length ? f.vao : null;
    const vaoMean = vao ? vao.reduce((s, x) => s + x, 0) / vao.length : 1;
    // the terms that hold over the whole face
    const m0 = [1, 1, 1];
    if (vc.hemi > 0) {
      // what faces the sky keeps its value (the exposure is the light's); what turns from it darkens toward the ground
      const t = 0.5 + 0.5 * n[2], L = 1 - vc.hemi * 0.5 * (1 - t), tint = toward(mixv(ground, sky, t), vc.hemi * 0.35);
      for (let j = 0; j < 3; j++) m0[j] *= L * tint[j];
    }
    if (vc.warmCool > 0 && !value) {
      const tint = toward(mixv(shade, key, smooth(0, 0.5, dot(n, toLight))), vc.warmCool * 0.3);
      for (let j = 0; j < 3; j++) m0[j] *= tint[j];
    }
    const wall = 1 - Math.max(0, n[2]);
    const cornerFills = cs.map((c, k) => {
      const m = [...m0];
      if (foot && wall > 0) {
        const h = c[2] - floorOf(c);
        if (Number.isFinite(h)) dark(m, foot.depth * wall * (1 - smooth(0, foot.height, h)) / (1 - DEEP));
      }
      if (cav) {
        const v = cav(c);
        if (v > 0) dark(m, Math.min(1, v * K) * vc.crevice);
        else if (v < 0) { const up = 1 + Math.min(1, -v * K) * vc.ridge * LIFT; for (let j = 0; j < 3; j++) m[j] *= up; }
      }
      if (vao) dark(m, (vc.contact * (1 - (k < vao.length ? vao[k] : vaoMean))) / (1 - DEEP));
      if (vc.variation > 0) {
        const s = 4, nz = vnoise((c[0] + c[2] * 0.37) / s, (c[1] - c[2] * 0.21) / s, vc.seed | 0);
        const g = 1 + vc.variation * 0.3 * (nz - 0.5);
        for (let j = 0; j < 3; j++) m[j] *= g;
      }
      if (value) { const s = lum(m); m[0] = s; m[1] = s; m[2] = s; }
      const base = lin(hexRgb(fills[k])), o = [base[0] * m[0], base[1] * m[1], base[2] * m[2]], l = lum(o);
      const r = l > KNEE ? shoulder(l) / l : 1;
      return toHex(srgb(o.map((v) => Math.min(1, v * r))));
    });
    const mean = [0, 1, 2].map((j) => cornerFills.reduce((a, h) => a + hexRgb(h)[j], 0) / cornerFills.length);
    const { vao: _vao, ...rest } = f;
    out[i] = { ...(vao ? rest : f), fill: toHex(mean), cornerFills };
  }
  return out;
}

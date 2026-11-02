/**
 * THE FIELD'S WEAR: a field vehicle's history on its surface, after its livery (livery-cut.js) and before the light. One
 * word, the vehicle sheet's own (facets.js WEARS): pristine | used | battered, a field vehicle `used` unless it is asked
 * otherwise. What it lays, each from the vehicle's own space and the seed:
 *
 *   caked mud   cut into the body as geometry, its own slot (`mud`, rough): low on the hull and in a ring round each arch,
 *               where the tyres throw it, its edge broken by the field's noise
 *   chips       the paint off to bare steel (`worn`) along the plates' rounded edges and where hands and boots go (the grab
 *               bars, the steps, the latches, the rim, the bumper), cut as geometry
 *   dust        per corner (cornerAlbedo): the soil's colour rising up the flanks from the ground and settling on what
 *               faces up, broken by the field's noise
 *   sun fade    per corner: what faces the sky paled and greyed
 *   grounding   per corner, the occlusion a lit page cannot see: the wells round the wheels, under the body, the tub's
 *               inside, what faces down (laid at every wear, pristine too)
 *   the wheels  the tyres darkened with the soil's mud, the rims dusted
 *
 * The soil is the setting's, read from the livery's camo (a desert's dust, the snow's slush, a city's ash-grey grit, a
 * green land's mud) unless the wear names its own.
 *
 *   wear  'pristine' | 'used' | 'battered' | { level, soil?: 'mud' | 'dust' | 'slush' | 'ash' }
 *
 *   readWear(wear)                                   → { level, …the level's numbers, soil? } or throws
 *   soilFor(livery)                                  → the soil a livery's camo reads
 *   weather(faces, W, { hubs, r, zones, seed, soil, scale? }) → the body's faces worn (its heights by `scale`, the
 *                                                    vehicle's wheel against a light 4x4's)
 *   weatherWheel(faces, W, { soil })                 → a wheel's faces worn (its tyre and rim)
 *   wetMaterials(materials), wetFaces(faces)         → in the rain: the slots glossier, the porous ones soaked darker
 *   groundOf(soil)                                   → the colour its ground bounces up, for the light (form-light.js)
 *
 * Pure and deterministic.
 */
import { cutByField, noise3 } from './livery-cut.js';

export const WEAR = Object.freeze({
  pristine: Object.freeze({ reads: 'kept: no dust, no mud, not a chip', dust: 0, top: 0.01, up: 0, mud: 0, mudTop: 0.01, chips: 0, fade: 0 }),
  used: Object.freeze({ reads: 'a working vehicle: dust up its flanks, mud low and round its arches, chipped where hands and boots go', dust: 0.55, top: 1.0, up: 0.28, mud: 0.5, mudTop: 0.72, chips: 0.5, fade: 0.1 }),
  battered: Object.freeze({ reads: 'run hard: mud to the doors, dust over everything, the paint off its edges', dust: 0.72, top: 1.4, up: 0.42, mud: 0.85, mudTop: 0.98, chips: 1, fade: 0.18 }),
});
export const WEAR_LEVELS = Object.freeze(Object.keys(WEAR));
// a soil: the dust it settles as and the mud it cakes as
export const SOILS = Object.freeze({
  // (dried, as a field vehicle carries it: a pale film of dust, and mud lighter than the paint it cakes, so it reads on a
  // dark camo as on a pale one)
  mud: Object.freeze({ dust: '#a29379', caked: '#6e5d45' }),
  dust: Object.freeze({ dust: '#c9b48c', caked: '#94805e' }),
  slush: Object.freeze({ dust: '#b2b0a8', caked: '#6a675f' }),
  ash: Object.freeze({ dust: '#a3a09a', caked: '#625f59' }),
});
const SOIL_OF_CAMO = Object.freeze({ desert: 'dust', winter: 'slush', urban: 'ash', digital: 'ash' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The wear read: its level's numbers, and its own soil when it names one. */
export function readWear(wear) {
  const W = typeof wear === 'string' ? { level: wear } : wear;
  const fail = (m) => new Error(`wear: ${m} (a wear is ${WEAR_LEVELS.join(' | ')}, or { level, soil?: ${Object.keys(SOILS).join(' | ')} })`);
  if (!isObj(W)) throw fail('it is a word or an object');
  for (const k of Object.keys(W)) if (!['level', 'soil'].includes(k)) throw fail(`'${k}' is not one of its words`);
  if (!WEAR[W.level]) throw fail(`'${W.level}' is no level`);
  if (W.soil !== undefined && !SOILS[W.soil]) throw fail(`'${W.soil}' is no soil`);
  return { level: W.level, ...WEAR[W.level], ...(W.soil ? { soil: W.soil } : {}) };
}
/** The soil a livery's camo reads: the setting's ground. */
export const soilFor = (L) => SOIL_OF_CAMO[L?.pattern] ?? 'mud';

// colour arithmetic on '#rrggbb'
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const centre = (P) => [0, 1, 2].map((k) => P.reduce((s, q) => s + q[k], 0) / P.length);

// where hands and boots wear the paint through
const TOUCH = Object.freeze(['grab', 'step', 'bonnet.latch', 'tub.rim', 'bumper', 'rollbar.foot', 'spare.carrier', 'rack', 'screen.hinge']);
// what the light pass leaves as it is: glass, lit lamps
const UNTOUCHED = Object.freeze(['glass', 'lamp', 'tail', 'marker', 'sign']);
const MUDDABLE = Object.freeze(['milPaint', 'steel', 'primer', 'carbon']);

/** The body's faces worn: mud and chips cut in, then dust, fade and grounding laid per corner. */
export function weather(faces, W, { hubs = [], r = 0.4, zones = {}, seed = 1, soil = 'mud', scale = 1 } = {}) {
  // (its heights by the vehicle's size: a truck's mud climbs as far up its wheels as a 4x4's does up its own)
  const S = SOILS[W.soil ?? soil], s = (seed * 7907 + 3) | 0, mudTop = W.mudTop * scale, top = W.top * scale;
  const nz = (p, k, f) => noise3([p[0] / k, p[1] / k, p[2] / k], s + f);
  // ── caked mud: low on the body and in a ring round each arch, where the tyres throw it
  let out = faces;
  if (W.mud > 0) {
    const ring = (p) => Math.max(0, ...hubs.map((h) => {
      if (Math.abs(p[0] - h[0]) > 0.5) return 0;
      const d = Math.hypot(p[1] - h[1], p[2] - h[2]), t = (d - r * 1.12) / 0.17;
      return 0.95 * Math.exp(-t * t) * (p[2] > h[2] - 0.1 ? 1 : 0.55);
    }));
    const near = (p) => hubs.some((h) => Math.abs(p[0] - h[0]) < 0.5 && Math.hypot(p[1] - h[1], p[2] - h[2]) < r * 1.6);
    // (the mud's line about 0.15 m under mudTop, broken up and down by the noise: a working vehicle's to its sills, a
    // battered one's halfway up its flanks)
    const valueAt = (p) => (mudTop - p[2]) / (0.35 * scale) + ring(p) + 0.9 * (nz(p, 0.22 * scale, 11) - 0.5) + 0.45 * (nz(p, 0.09 * scale, 13) - 0.5);
    const level = 0.45;
    out = cutByField(out, {
      // (low on the body, or close round a wheel)
      select: (f) => MUDDABLE.includes(f.material) && f.part !== 'mark' && (Math.min(...f.corners.map((p) => p[2])) < mudTop + 0.1 * scale || near(centre(f.corners))),
      valueAt, levels: [level], hMax: 0.3 * scale, hMin: 0.1 * scale, stripH: 0.13 * scale,
      remake: (f, poly, band) => (band ? { part: f.part, material: 'mud', albedo: S.caked } : null),
    });
  }
  // ── chips: the paint off its rounded edges and where it is handled, to bare steel
  if (W.chips > 0) {
    const touched = (f) => TOUCH.includes(f.part);
    const valueAt = (p) => 0.7 * nz(p, 0.07, 21) + 0.3 * nz(p, 0.18, 23);
    // (the edges one sees, the upper body's that face up or out, and whatever is handled)
    out = cutByField(out, {
      select: (f) => f.material === 'milPaint' && (touched(f) || (f.edge && centre(f.corners)[2] > 0.7 * scale && f.outNormal[2] > 0.15)),
      valueAt, levels: [0.8 - 0.1 * W.chips], hMax: 0.09, hMin: 0.035, stripH: 0.06,
      remake: (f, poly, band) => (band ? { part: f.part, material: 'worn', albedo: '#6f6d66' } : null),
    });
  }
  // ── per corner: grounding, sun fade, dust
  const dust = rgb(S.dust), tub = zones.tub ?? null, floor = zones.floor ?? 0.6;
  const occlusion = (p, n) => {
    let o = 0;
    if (p[2] < floor) o += 0.3 * clamp((floor - p[2]) / (0.35 * scale));
    if (n[2] < -0.4) o += 0.22;
    for (const h of hubs) {
      if (Math.abs(p[0] - h[0]) > 0.5) continue;
      const d = Math.hypot(p[1] - h[1], p[2] - h[2]);
      if (d < r * 1.45) o += 0.4 * (1 - d / (r * 1.45));
    }
    if (tub && Math.abs(p[0]) < tub.x - 0.035 && p[1] > tub.y[0] && p[1] < tub.y[1] && p[2] < tub.z[1] && p[2] > tub.z[0] - 0.02) o += 0.28 * clamp((tub.z[1] - p[2]) / 0.45);
    return Math.min(0.62, o);
  };
  return out.map((f) => {
    if (UNTOUCHED.includes(f.material)) return f;
    const base = rgb(f.albedo), ns = f.cornerNormals ?? f.corners.map(() => f.outNormal);
    const corner = f.corners.map((p, j) => {
      const n = ns[j];
      let c = base;
      if (W.fade > 0 && n[2] > 0.4 && f.material === 'milPaint') { const l = (c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722) * 1.12 + 10; c = mix(c, [l, l, l], W.fade * n[2]); }
      if (W.dust > 0 && f.material !== 'mud') {
        const rise = W.dust * Math.pow(clamp((top - p[2]) / (top - 0.3 * scale)), 0.8) * (0.55 + 0.9 * nz(p, 0.35, 31));
        const settle = W.up * Math.max(0, n[2]) * (0.45 + nz(p, 0.5, 37));
        c = mix(c, dust, Math.min(0.85, (rise + settle) * (f.material === 'worn' ? 0.5 : 1)));
      }
      return hex(c.map((v) => v * (1 - occlusion(p, n))));
    });
    return corner.every((h) => h === f.albedo) ? f : { ...f, cornerAlbedo: corner };
  });
}

/** A wheel's faces worn: its rubber darkened with the soil's mud (the tread more), its rim dusted. */
export function weatherWheel(faces, W, { soil = 'mud' } = {}) {
  if (!(W.mud > 0 || W.dust > 0)) return faces;
  const S = SOILS[W.soil ?? soil], caked = rgb(S.caked), dust = rgb(S.dust);
  return faces.map((f) => {
    if (f.material === 'rubber') return { ...f, albedo: hex(mix(rgb(f.albedo), caked, (f.part === 'tyre.lug' || f.part === 'tyre' ? 0.62 : 0.4) * W.mud)) };
    if (f.material === 'milPaint') return { ...f, albedo: hex(mix(rgb(f.albedo), dust, 0.45 * W.dust)) };
    return f;
  });
}

// ── wet ─────────────────────────────────────────────────────────────────────────
// how each slot takes the rain: a film of water on paint and rubber (glossier, a little darker), porous canvas and mud
// soaked (darker, a dull sheen); bare steel and glass as they are
const WET = Object.freeze({
  milPaint: Object.freeze({ roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.2, dark: 0.86 }),
  mud: Object.freeze({ roughness: 0.32, dark: 0.66 }),
  canvas: Object.freeze({ roughness: 0.68, dark: 0.7 }),
  rubber: Object.freeze({ roughness: 0.42, dark: 0.9 }),
  primer: Object.freeze({ roughness: 0.4, dark: 0.85 }),
  weld: Object.freeze({ roughness: 0.45, dark: 0.88 }),
});
/** The slots' response in the rain: each wet slot its film's roughness (and the paint a thin coat of water). */
export function wetMaterials(materials) {
  return Object.freeze(Object.fromEntries(Object.entries(materials).map(([k, m]) => {
    const w = WET[k];
    if (!w) return [k, m];
    const { dark, ...film } = w;
    void dark;
    return [k, Object.freeze({ ...m, ...film })];
  })));
}
/** Faces darkened as their slots soak (their colour and their corners' alike). */
export function wetFaces(faces) {
  const dim = (h, k) => hex(rgb(h).map((v) => v * k));
  return faces.map((f) => {
    const k = WET[f.material]?.dark;
    if (!k) return f;
    return { ...f, albedo: dim(f.albedo, k), ...(f.cornerAlbedo ? { cornerAlbedo: f.cornerAlbedo.map((c) => dim(c, k)) } : {}) };
  });
}
/** The colour the ground bounces up under a vehicle on this soil ([r, g, b]). */
export const groundOf = (soil) => rgb(SOILS[soil].dust).map((v) => Math.round(v * 0.8));

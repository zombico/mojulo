/**
 * THE CAVERN'S SET — the set designer in a cave (era/cavern.js): the scene composer's reading of a walk (its roles, the
 * set piece at each role's focus, the dressing round it, the light plot over it: era/compose-roles.js, compose-dress.js,
 * compose-plot.js) laid on a cavern's trail, its pieces painted in the cave's colour key (era/cavern-key.js) and lit by
 * the cave's own light. A room's composer reads rooms; a cavern's reads the trail's BEATS (era/out-trail.js), one room
 * of the walk each.
 *
 *   trail.ground.cavern.set: true | 'base' | 'temple' | 'grotto' | { use?, mood? }
 *     use    what the cave is used as (SET_USES): a base in the rock (crates, drums, sandbags, a generator), a temple
 *            (urns, braziers, standards, an altar), a grotto (glowing crystals and fungus, a geode). true, the
 *            register's own (CAVE_USE: fluorescent a base, torch a temple, bio a grotto, daylight a temple)
 *     mood   the light plot's (compose-plot.js MOODS: even | drama | noir), 'drama' by default: how much brighter each
 *            focus stands than the walk round it
 *
 *   BEAT_ROLE              { beat: role }: a trail's beat as a room's role (the trailhead the arrival, a pinch a passage,
 *                          the landmark the landmark, a reveal a rest, the exit the climax…): one great object a walk
 *   SET_USES, CAVE_USE     the uses: their pieces, their set pieces by role, what their surfaces are made of
 *   CAVE_PIECES            the cave's own pieces (compose-dress.js PIECES' shape), beside the rooms' a base borrows
 *   readSet(v, light, at)  → { use, mood } | null
 *   laySet(site, C, { rocks, seed }) → [{ id, kind, beat, role, at: [x, y], z0, t: [ux, uy], set?, scale? }]: each beat's set
 *                          piece at its focus off the walk (a great object at the hall's scale where it fits), on a
 *                          plinth where the land falls under it, and its clusters along the walk's edge on level ground;
 *                          none in the walk, on a rock or a formation or in the water; a passage left clear
 *   setFaces(items, K, use) → { faces, anchors, lamps }: the pieces in the key (flat colour, lit by the cavern; a glowing
 *                          part its own light, `lamp`), a prop anchor each (a collider), and the lamps their fires and
 *                          glows give
 *   plotKeys(items, K, mood, lightAt) → { lamps, plot }: a key light over each focus, its colour across the temperature
 *                          from the cave's own light (a sodium in a cold cave, the day's in a warm or a glowing one), a
 *                          tight pool, its strength solved so the focus stands at the mood's ratio
 *                          over the walk round it (a model of the bake: each lamp's light by its falloff and the ceiling)
 *   setLaws(site, items, plot) → laws: nothing in the walk, every focus lit at its ratio
 *
 * Pure: seeded dice only.
 */
import { PIECES } from './compose-dress.js';
import { MOODS, MOOD_IDS, LIGHT_PLOT } from './compose-plot.js';
import { CAVE_LIGHTS } from './cave.js';
import { warmth } from './cavern-key.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export const BEAT_ROLE = Object.freeze({
  trailhead: 'arrival', pinch: 'passage', crossing: 'passage', pit: 'passage', reveal: 'rest', landmark: 'landmark', pocket: 'pocket', rest: 'rest', exit: 'climax',
});

const B = (u0, u1, v0, v1, z0, z1, s) => [u0, u1, v0, v1, z0, z1, s];
// a cave's own pieces, in the rooms' shape (compose-dress.js PIECES): parts painted with a surface of the key (stone,
// wood, clay, metal, cloth, glow); `light` what a glowing part gives (SET_LIGHTS)
export const CAVE_PIECES = Object.freeze({
  brazier: { class: 'barrel', w: 0.8, d: 0.8, h: 1.25, light: 'fire', parts: [['prism', 0.4, 0.4, 0.07, 0, 0.85, 6, 'metal'], ['prism', 0.4, 0.4, 0.36, 0.85, 1.0, 8, 'metal'], ['prism', 0.4, 0.4, 0.22, 1.0, 1.25, 6, 'glow']] },
  urn: { class: 'barrel', w: 0.6, d: 0.6, h: 0.8, parts: [['prism', 0.3, 0.3, 0.18, 0, 0.12, 8, 'clay'], ['prism', 0.3, 0.3, 0.28, 0.12, 0.55, 8, 'clay'], ['prism', 0.3, 0.3, 0.15, 0.55, 0.8, 8, 'clay']] },
  'tall-urn': { class: 'barrel', w: 0.7, d: 0.7, h: 1.3, parts: [['prism', 0.35, 0.35, 0.2, 0, 0.15, 8, 'clay'], ['prism', 0.35, 0.35, 0.32, 0.15, 0.95, 8, 'clay'], ['prism', 0.35, 0.35, 0.16, 0.95, 1.3, 8, 'clay']] },
  standard: { class: 'sign', solid: false, w: 0.9, d: 0.3, h: 3.2, parts: [['prism', 0.45, 0.15, 0.05, 0, 3.2, 6, 'metal'], B(0.08, 0.82, 0.13, 0.17, 1.7, 3.0, 'cloth')] },
  altar: { class: 'set-piece', w: 3.2, d: 1.8, h: 1.5, light: 'fire', parts: [B(0, 3.2, 0, 1.8, 0, 0.3, 'stone'), B(0.3, 2.9, 0.25, 1.55, 0.3, 1.0, 'stone'), B(0.1, 3.1, 0.1, 1.7, 1.0, 1.15, 'stone'),
    B(1.2, 2.0, 0, 1.8, 1.15, 1.18, 'cloth'), ['prism', 0.45, 0.9, 0.12, 1.15, 1.5, 6, 'glow'], ['prism', 2.75, 0.9, 0.12, 1.15, 1.5, 6, 'glow']] },
  reliquary: { class: 'set-piece', w: 1.0, d: 1.0, h: 1.6, parts: [B(0, 1, 0, 1, 0, 0.9, 'stone'), B(0.2, 0.8, 0.2, 0.8, 0.9, 1.4, 'cloth'), B(0.15, 0.85, 0.15, 0.85, 1.4, 1.6, 'metal')] },
  crystal: { class: 'boulder', w: 1.0, d: 1.0, h: 1.6, light: 'glow', parts: [['prism', 0.5, 0.5, 0.4, 0, 0.15, 7, 'stone'], ['prism', 0.5, 0.5, 0.16, 0.1, 1.6, 5, 'glow'],
    ['prism', 0.25, 0.35, 0.11, 0.1, 1.0, 5, 'glow'], ['prism', 0.72, 0.62, 0.09, 0.1, 0.8, 5, 'glow']] },
  fungus: { class: 'boulder', w: 0.9, d: 0.9, h: 1.0, light: 'glow', parts: [['prism', 0.45, 0.45, 0.08, 0, 0.8, 6, 'wood'], ['prism', 0.45, 0.45, 0.4, 0.8, 0.95, 10, 'glow'],
    ['prism', 0.2, 0.25, 0.05, 0, 0.45, 6, 'wood'], ['prism', 0.2, 0.25, 0.18, 0.45, 0.55, 8, 'glow']] },
  geode: { class: 'set-piece', w: 3.0, d: 3.0, h: 3.2, light: 'glow', parts: [['prism', 1.5, 1.5, 1.4, 0, 0.6, 9, 'stone'], ['prism', 1.5, 1.5, 0.35, 0.5, 3.2, 5, 'glow'], ['prism', 0.9, 1.2, 0.25, 0.5, 2.2, 5, 'glow'],
    ['prism', 2.1, 1.8, 0.22, 0.5, 1.9, 5, 'glow'], ['prism', 1.6, 0.7, 0.2, 0.5, 1.6, 5, 'glow'], ['prism', 1.2, 2.1, 0.18, 0.5, 1.4, 5, 'glow']] },
});
const pieceOf = (kind) => CAVE_PIECES[kind] ?? PIECES[kind];

// the rooms' surfaces (compose-dress.js) and the cave's, as the key's made colours: a base's bulk its drab, its frames its
// metal, its concrete the rock's stone; a set piece's paint the key's accent (the focus reads by it)
const SURFACES = Object.freeze({
  cabinet: 'drab', services: 'drab', paint: 'drab', trim: 'metal', beam: 'metal', column: 'metal', grate: 'metal', concrete: 'stone',
  stone: 'stone', wood: 'wood', clay: 'wood', metal: 'metal', cloth: 'cloth',
});
export const SET_USES = Object.freeze({
  base: Object.freeze({ words: 'a base in the rock: crates, drums and sandbags along the walk, a generator at its heart', pieces: Object.freeze(['crate', 'ammo-crate', 'drum', 'tool-chest', 'crate']),
    roles: Object.freeze({ arrival: 'barrier', landmark: 'generator', pocket: 'find', climax: 'prize', rest: 'mess-table' }) }),
  temple: Object.freeze({ words: 'a temple in the rock: urns and braziers along the walk, standards at its way in, an altar at its heart', pieces: Object.freeze(['urn', 'tall-urn', 'brazier', 'urn']),
    roles: Object.freeze({ arrival: 'standard', landmark: 'altar', pocket: 'urn', climax: 'reliquary', rest: 'brazier' }) }),
  grotto: Object.freeze({ words: 'a grotto: glowing crystals and fungus by the walk, a geode at its heart', pieces: Object.freeze(['crystal', 'fungus', 'fungus', 'crystal']),
    roles: Object.freeze({ arrival: 'crystal', landmark: 'geode', pocket: 'crystal', climax: 'crystal', rest: 'fungus' }) }),
});
export const SET_USE_IDS = Object.freeze(Object.keys(SET_USES));
export const CAVE_USE = Object.freeze({ fluorescent: 'base', torch: 'temple', bio: 'grotto', daylight: 'temple' });
// what a glowing part gives: a fire's light (the key's), a growth's (the key's, softer)
const SET_LIGHTS = Object.freeze({ fire: Object.freeze({ strength: 0.55, near: 1.3, reach: 8 }), glow: Object.freeze({ strength: 0.3, near: 1.2, reach: 6 }) });
// how many clusters a role takes (a passage is left clear: compose-dress.js), how many pieces a cluster, and the set's
// metres: off the walk's edge, a focus farther, how far along a beat a cluster may stand, a level footprint's most fall
const CLUSTERS = Object.freeze({ arrival: 1, passage: 0, landmark: 2, pocket: 1, climax: 1, rest: 1 });
// (a set piece may stand on a slope of `plinth` metres under it, levelled on a plinth when it falls more than `level`)
const SET = Object.freeze({ edge: 1.0, focus: 2.2, along: 6, fall: 0.45, plinth: 1.6, level: 0.15, clear: 0.35, great: 1.4 });

export function readSet(v, light, at = 'trail.ground.cavern.set') {
  if (v === undefined || v === false) return null;
  const use0 = CAVE_USE[light] ?? 'temple';
  if (v === true) return { use: use0, mood: 'drama' };
  if (typeof v === 'string') v = { use: v };
  if (!isObj(v)) throw new Error(`stage: ${at} is true, a use (${SET_USE_IDS.join(', ')}) or { use?, mood? }`);
  for (const k of Object.keys(v)) if (!['use', 'mood'].includes(k)) throw new Error(`stage: ${at}.${k} is not a set setting (use, mood)`);
  if (v.use !== undefined && !SET_USE_IDS.includes(v.use)) throw new Error(`stage: ${at}.use is one of ${SET_USE_IDS.join(', ')}`);
  if (v.mood !== undefined && !MOOD_IDS.includes(v.mood)) throw new Error(`stage: ${at}.mood is one of ${MOOD_IDS.join(', ')}`);
  return { use: v.use ?? use0, mood: v.mood ?? 'drama' };
}

// a piece's footprint corners at its centre `c`, `t` along the walk and `n` toward it (its back away from the walk)
function footprint(P, c, t, n, k = 1) {
  const hw = (P.w * k) / 2, hd = (P.d * k) / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [c[0] + t[0] * u + n[0] * v, c[1] + t[1] * u + n[1] * v]);
}

/** Each beat's set piece at its focus and its clusters along the walk's edge, every one off the walk and on level rock. */
export function laySet(site, C, { rocks = [], seed = 1 } = {}) {
  const S = C.set;
  if (!S) return [];
  const U = SET_USES[S.use], beats = (site.out?.anchors ?? []).filter((a) => a.kind === 'beat'), items = [];
  const placed = [];
  const wet = (x, y) => (site.wet && site.wet(x, y)) || (site.water && site.water.clear(x, y));
  // (a footprint clear: off the walk, out of the water, inside the hall, level, off every rock, formation and piece)
  const clear = (cs, c, r, fall) => {
    for (const [x, y] of [...cs, c]) if (site.trailDist(x, y) < site.halfWAt(y) + 0.5 || wet(x, y) || y < 2 || y > site.D - 2 || x < site.grid.x0 + 1 || x > site.W - 1) return false;
    const zs = cs.map(([x, y]) => site.ground(x, y));
    if (Math.max(...zs) - Math.min(...zs) > fall) return false;
    if (rocks.some((q) => Math.hypot(q.x - c[0], q.y - c[1]) < q.r + r + SET.clear)) return false;
    return !placed.some((q) => Math.hypot(q.c[0] - c[0], q.c[1] - c[1]) < q.r + r + 0.1);
  };
  // (the walk's frame at a station: `t` the way on, `n` across it)
  const frame = (y) => { const dx = site.trailX(y + 0.5) - site.trailX(y - 0.5), l = Math.hypot(dx, 1), t = [dx / l, 1 / l]; return { t, n: [t[1], -t[0]] }; };
  // the places a piece may stand, nearest first: at `at` when it is given (a pocket's middle), facing the walk; else beside
  // the walk at the station, `out` off its edge, either side, a little along and farther out until one is clear
  function* spots(P, y0, { out, sides, at, scale }) {
    if (at) { const { n } = frame(at[1]), sg = (at[0] - site.trailX(at[1])) * n[0] >= 0 ? 1 : -1; yield { c: at, toward: [-n[0] * sg, -n[1] * sg] }; }
    for (const da of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6]) for (const sg of sides) for (const dout of [0, 1, 2, 3.5]) {
      const y = y0 + da, { n } = frame(y), off = site.halfWAt(y) + out + dout + (P.d * scale) / 2, x0 = site.trailX(y);
      yield { c: [x0 + n[0] * sg * off, y + n[1] * sg * off], toward: [-n[0] * sg, -n[1] * sg] };
    }
  }
  const put = (kind, beat, role, y0, { set = false, scale = 1, out = SET.edge, sides = [1, -1], at = null, id }) => {
    const P = pieceOf(kind);
    if (!P) return null;
    for (const { c, toward } of spots(P, y0, { out, sides, at, scale })) {
      const along = [toward[1], -toward[0]], cs = footprint(P, c, along, toward, scale), r = (Math.hypot(P.w, P.d) * scale) / 2;
      if (!clear(cs, c, r, set ? SET.plinth : SET.fall)) continue;
      placed.push({ c, r });
      // (a set piece on a slope stands on a PLINTH, its top the ground's highest under it: the set builder's level pad)
      const zs = cs.map(([x, yy]) => site.ground(x, yy)), lo = Math.min(...zs), hi = Math.max(...zs), plinth = set && hi - lo > SET.level;
      const z0 = plinth ? hi : lo - 0.04;
      const it = { id, kind, beat: beat.id, role, at: [r5(c[0]), r5(c[1])], z0: r5(z0), t: [r5(along[0]), r5(along[1])], ...(set ? { set: true } : {}), ...(scale !== 1 ? { scale } : {}), ...(plinth ? { plinth: r5(lo - 0.15) } : {}) };
      items.push(it);
      return it;
    }
    return null;
  };
  for (const [bi, b] of beats.entries()) {
    const role = BEAT_ROLE[b.beat], y = b.at[1];
    if (!role) continue;
    // the SET PIECE at the role's focus: farther off the walk than its dressing, a great object scaled to the hall
    const sp = U.roles[role];
    if (sp) {
      const great = role === 'landmark' || (role === 'climax' && S.use === 'grotto');
      // (a pocket's in the pocket: its beat stands at the pocket's middle)
      const at = b.beat === 'pocket' && b.r ? [b.at[0], b.at[1]] : null;
      // (at the way in, a standard each side of the walk, the walker passing between them)
      if (role === 'arrival' && sp === 'standard') for (const sg of [1, -1]) put(sp, b, role, y, { set: true, out: 0.6, sides: [sg], id: `${b.id}/focus/${sp}-${sg > 0 ? 'a' : 'b'}` });
      // (a great object at the hall's scale where it fits, else as it is)
      else put(sp, b, role, y, { set: true, scale: great ? SET.great : 1, out: SET.focus, at, id: `${b.id}/focus/${sp}` }) ?? (great ? put(sp, b, role, y, { set: true, out: SET.focus, at, id: `${b.id}/focus/${sp}` }) : null);
    }
    // its CLUSTERS along the walk's edge, a few pieces each from the use's, stacked where a piece stacks
    for (let ci = 0; ci < (CLUSTERS[role] ?? 0); ci++) {
      const n = 2 + Math.floor(hash(bi, ci, seed + 701) * 3), sg = hash(bi, ci + 7, seed + 703) < 0.5 ? 1 : -1, ya = y + (ci % 2 ? -1 : 1) * (2 + SET.along * hash(bi, ci + 3, seed + 707));
      for (let k = 0; k < n; k++) {
        const kind = U.pieces[Math.floor(hash(bi, ci * 7 + k, seed + 709) * U.pieces.length)];
        const it = put(kind, b, role, ya + k * 1.1, { sides: [sg, -sg], id: `${b.id}/edge-${ci + 1}/${kind}-${k + 1}` });
        // (a crate stacked on another, as a dressing stacks it)
        const P = pieceOf(kind);
        if (it && P.stack > 1 && hash(bi, ci * 11 + k, seed + 719) < 0.45) items.push({ ...it, id: `${it.id}/on`, z0: r5(it.z0 + P.h), on: true });
      }
    }
  }
  return items;
}

// a part's world corners: (u, v, z) in the piece's frame (u along `t`, v toward the walk from its back), scaled by k
function frameOf(it, P) {
  const k = it.scale ?? 1, t = it.t, n = [-t[1], t[0]], c = it.at;
  return { k, P: (u, v, z) => [r5(c[0] + t[0] * (u - P.w / 2) * k + n[0] * (v - P.d / 2) * k), r5(c[1] + t[1] * (u - P.w / 2) * k + n[1] * (v - P.d / 2) * k), r5(it.z0 + z * k)] };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => r5(v / l)); };
const quadOf = (cs) => unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0])));

/** The pieces in the cave's key: their faces (flat colour, lit by the cavern; a glowing part its own light), a prop anchor
 *  each, and the lamps their fires and glows give. */
export function setFaces(items, K, use) {
  const faces = [], anchors = [], lamps = [];
  const glowAt = (i) => (use === 'grotto' && K.glow && i % 2 ? K.glow : K.fixture ?? CAVE_LIGHTS.torch.fixture);
  for (const it of items) {
    const P = pieceOf(it.kind);
    if (!P) continue;
    const { k, P: W } = frameOf(it, P), colourOf = (s) => (s === 'paint' && it.set ? K.accent : K.made[SURFACES[s] ?? 'drab']);
    let gi = 0;
    const face = (cs, s) => { const glow = s === 'glow'; faces.push({ corners: cs, normal: quadOf(cs), outNormal: quadOf(cs), group: glow ? 'cave:lamp' : 'cave:set', fill: glow ? glowAt(gi) : colourOf(s), node: it.id, ...(glow ? { lamp: true } : {}) }); };
    for (const p of P.parts) {
      if (p[0] === 'prism') {
        const [, cu, cv, rad, z0, z1, sides, s] = p, ring = (z) => Array.from({ length: sides }, (_, i) => { const a = (2 * Math.PI * (i + 0.5)) / sides; return W(cu + Math.cos(a) * rad, cv + Math.sin(a) * rad, z); });
        const lo = ring(z0), hi = ring(z1);
        for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; face([lo[i], lo[j], hi[j], hi[i]], s); }
        face([...hi], s); face([...lo].reverse(), s);
        if (s === 'glow') gi++;
      } else {
        const [u0, u1, v0, v1, z0, z1, s] = p, c = (u, v, z) => W(u, v, z);
        face([c(u0, v0, z0), c(u1, v0, z0), c(u1, v0, z1), c(u0, v0, z1)], s); face([c(u1, v1, z0), c(u0, v1, z0), c(u0, v1, z1), c(u1, v1, z1)], s);
        face([c(u0, v1, z0), c(u0, v0, z0), c(u0, v0, z1), c(u0, v1, z1)], s); face([c(u1, v0, z0), c(u1, v1, z0), c(u1, v1, z1), c(u1, v0, z1)], s);
        face([c(u0, v0, z1), c(u1, v0, z1), c(u1, v1, z1), c(u0, v1, z1)], s); face([c(u0, v1, z0), c(u1, v1, z0), c(u1, v0, z0), c(u0, v0, z0)], s);
      }
    }
    // (its plinth: a stone slab under its footprint, a hand wider, from below the low side's ground up to its foot)
    if (it.plinth !== undefined) {
      const m = 0.25 / k, c = (u, v, z) => W(u, v, 0).slice(0, 2).concat(r5(z)), [a0, a1, b0, b1, z0, z1] = [-m, P.w + m, -m, P.d + m, it.plinth, it.z0];
      face([c(a0, b0, z0), c(a1, b0, z0), c(a1, b0, z1), c(a0, b0, z1)], 'stone'); face([c(a1, b1, z0), c(a0, b1, z0), c(a0, b1, z1), c(a1, b1, z1)], 'stone');
      face([c(a0, b1, z0), c(a0, b0, z0), c(a0, b0, z1), c(a0, b1, z1)], 'stone'); face([c(a1, b0, z0), c(a1, b1, z0), c(a1, b1, z1), c(a1, b0, z1)], 'stone');
      face([c(a0, b0, z1), c(a1, b0, z1), c(a1, b1, z1), c(a0, b1, z1)], 'stone');
    }
    if (!it.on) anchors.push({ id: it.id, kind: 'prop', form: P.class, beat: it.beat, role: it.role, at: [it.at[0], it.at[1], it.z0], ...(P.solid === false ? {} : { solid: true }), ...(it.set ? { set: true } : {}) });
    // (its fire or its glow a lamp of its own, at its top, in the key's light)
    const L = P.light && SET_LIGHTS[P.light];
    if (L && !it.on) lamps.push({ at: [it.at[0], it.at[1], r5(it.z0 + P.h * k + 0.2)], kind: 'set', light: { colour: K.light ?? CAVE_LIGHTS.torch.colour, ...L } });
  }
  return { faces, anchors, lamps };
}

// the light plot's key: hung over its focus, its falloff (cave.js lampLight's), the ring round a focus it is measured over
const KEY = Object.freeze({ over: 2.5, near: 1.0, reach: 7, strength: 1, ring: Object.freeze([4, 7]), around: 8 });
// the colours a key may take: the day's (the crack's) and a sodium's warm white, the one across the temperature from the
// cave's own light
const SODIUM = Object.freeze([1, 0.74, 0.42]);
const lumOf = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/**
 * The LIGHT PLOT: a key over each focus whose role has a weight (compose-plot.js LIGHT_PLOT.roles), its colour across
 * the temperature from the cave's own light (the plot's own rule, compose-plot.js: a key stands apart from its fill), a
 * tight pool, its strength solved so the focus stands at the mood's ratio over the ring of walk round it. `lightAt(p, n, lamps)` the cave's light at a point with these lamps added (era/cavern.js).
 */
export function plotKeys(items, K, mood, lightAt) {
  // (a cold cave's key a sodium's warm white; a warm or a glowing one's the day's, a cool shaft)
  const M = MOODS[mood] ?? MOODS.drama, colour = warmth(K.light ?? K.crack) < 0 ? SODIUM : K.crack;
  const lamps = [], plot = [];
  for (const it of items.filter((q) => q.set && !q.on)) {
    const w = LIGHT_PLOT.roles[it.role];
    if (!w) continue;
    const P = pieceOf(it.kind), k = it.scale ?? 1, target = Math.max(1, M.ratio * w);
    const focus = [it.at[0], it.at[1], it.z0 + P.h * k * 0.6], up = [0, 0, 1];
    const ring = KEY.ring.flatMap((r) => Array.from({ length: KEY.around }, (_, i) => { const a = (2 * Math.PI * i) / KEY.around; return [focus[0] + Math.cos(a) * r, focus[1] + Math.sin(a) * r, it.z0 + 0.1]; }));
    const lamp = (s) => ({ at: [focus[0], focus[1], r5(it.z0 + P.h * k + KEY.over)], kind: 'key', light: { colour, strength: s, near: KEY.near, reach: KEY.reach } });
    // E(focus) / mean E(ring) = target: the key adding a·s at the focus and b·s to the ring's mean → s = (target·Fm − Ff) / (a − target·b)
    const Ff = lumOf(lightAt(focus, up, [])), Fm = ring.reduce((a, p) => a + lumOf(lightAt(p, up, [])), 0) / ring.length;
    const a = lumOf(lightAt(focus, up, [lamp(1)])) - Ff, b = ring.reduce((s, p) => s + lumOf(lightAt(p, up, [lamp(1)])), 0) / ring.length - Fm;
    const den = a - target * b, short = den <= 1e-9, s = short ? KEY.strength * M.ratio : Math.max(0, (target * Fm - Ff) / den);
    lamps.push(lamp(r5(Math.min(s, KEY.strength * 12))));
    plot.push({ beat: it.beat, role: it.role, piece: it.kind, target: r5(target), ...(short ? { short: true } : {}) });
  }
  return { lamps, plot };
}

/** The set's laws: nothing in the walk; every focus at its ratio (measured on the plot's model). */
export function setLaws(site, items, plot, measured = {}) {
  const inWalk = items.filter((it) => site.trailDist(it.at[0], it.at[1]) < site.halfWAt(it.at[1]) + 0.5).map((it) => it.id);
  const short = plot.filter((p) => p.short || (measured[p.beat] !== undefined && measured[p.beat] < p.target * 0.9)).map((p) => p.beat);
  return [
    { id: 'walk-clear', ok: !inWalk.length, value: inWalk.length ? `in the walk: ${inWalk.join(', ')}` : 'every piece off the walk' },
    { id: 'focus-lit', ok: !short.length, value: short.length ? `short of its ratio: ${short.join(', ')}` : 'every focus at its ratio over the walk round it' },
  ];
}

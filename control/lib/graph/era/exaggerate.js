/**
 * EXAGGERATE — the shape a cube's art director draws its builders' work in, beside how it is coloured (`colour`), shaded
 * and inked (`register`). Architecture is plumb; a hand is not: walls lean, eaves wander out of level, a steep gable gets
 * steeper and a lamp leans tired over its road. The PLAN never moves: streets, lots, pads, colliders, anchors, doors and
 * routes are what they were; only the faces above each foot bend.
 *
 *   exaggerate   a NAME (EXAGGERATE_PRESETS: storybook, crooked, street), { from: name, …changes }, or the terms:
 *     lean       degrees off plumb at a foot, at most (0–8)
 *     sway       metres between the lean's turns across the world (8–200): longer than a lot, so neighbours lean together
 *     sag        how far eaves and ridges wander out of level, a share of the height they stand at (0–0.12)
 *     reach      metres: the height past which the lean stops growing (2–60): a cottage slumps, a tower only sways
 *     elements   0–1: the language CARICATURED, each building element's number pushed from the middle of its rail
 *                toward the end it already leans to (× 1 + 2·elements), inside the rail: a style made more itself
 *     kit        { chunk (1–2: a piece's thin dimensions thickened), lean (degrees, 0–10) }: the street's furniture,
 *                exaggerated hardest because small things carry a style nearest the eye
 *     seed       the field's own dice (an integer)
 *
 * THE BEND is one field over the world, never a tilt per building, so a wall two buildings share moves once and a
 * terrace never cracks: a point (x, y, z) standing t = z − foot over its building's foot moves by
 *   d = g(t) · (A·vx(x, y), A·vy(x, y), sag·s(x, y)),   g(t) = t·R / (t + R) (0 at and under the foot), A = tan(lean)
 * where v and s are sums of three seeded waves each (|v| ≤ 1, |s| ≤ 1). Its Lipschitz bound `fold` says what it can do:
 * under 1 the bent world is the plumb one moved without a fold, so a gap g between two things stays at least
 * (1 − fold)·g: no crack opens and no two buildings touch that did not.
 *
 *   readExaggerate(spec, no)            → the terms (a name and its changes resolved), checked; null for false
 *   exaggerateField(E)                  → { at(x, y, z, foot) → [dx, dy, dz], dir(x, y) → [vx, vy], fold }
 *   bendFaces(faces, spans, E, opts)    bends spans [from, to, foot] of `faces` in place (foot a number or (x, y) → z);
 *                                       opts.lit(normal, face) → the light factor a face was shaded by (null: unlit);
 *                                       opts.kit: the furniture's lean (tan(kit.lean), linear in t)
 *   chunkFaces(faces, c)                a piece's faces thickened: its two thinner dimensions × c about its middle
 *   leanFaces(faces, dir, tanA, lit)    a piece's faces sheared toward dir by tanA a metre up from z 0, re-lit
 *   exaggerateAnchor(anchor, E)         a town anchor (an id or { elements, compose, … }) with its building elements
 *                                       caricatured, its id kept (its dice keep the town); the anchor itself when E
 *                                       caricatures nothing
 *   exaggerateLaws(E)                   → [{ law, ok, value, want }]: advice, never a refusal
 *   exaggerateCard(E)                   the style guide's card
 *
 * Pure; seeded dice and dmath only. Absent, nothing is bent and no byte changes.
 */
import { sin, cos, tan } from '../../util/dmath.js';
import { ELEMENT_KINDS, ELEMENT_SETS } from './out-anchor-elements.js';
import { scaleHex } from '../polygonizer/vexar.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const DEG = Math.PI / 180;

export const EXAGGERATE_TERMS = Object.freeze({
  lean: [0, 8], sway: [8, 200], sag: [0, 0.12], reach: [2, 60], elements: [0, 1], seed: null, kit: null,
});
const KIT_TERMS = Object.freeze({ chunk: [1, 2], lean: [0, 10] });
/** Every term at plumb: a written spec starts here. */
const PLUMB = Object.freeze({ lean: 0, sway: 30, sag: 0, reach: 12, elements: 0, kit: Object.freeze({ chunk: 1, lean: 0 }), seed: 1 });

/** The named hands. */
export const EXAGGERATE_PRESETS = Object.freeze({
  // a picture book's village: walls settled a little, eaves soft, the language a shade more itself, a lamp that leans
  storybook: Object.freeze({ lean: 2.5, sway: 34, sag: 0.03, reach: 10, elements: 0.35, kit: Object.freeze({ chunk: 1.25, lean: 3 }), seed: 1 }),
  // a crooked town: every wall off plumb, eaves wandering, steep things steeper, the lamps tired
  crooked: Object.freeze({ lean: 5, sway: 22, sag: 0.05, reach: 12, elements: 0.6, kit: Object.freeze({ chunk: 1.35, lean: 6 }), seed: 1 }),
  // urban art: the masses near plumb, the language pushed to its ends, the street's furniture fat and loud
  street: Object.freeze({ lean: 1.2, sway: 48, sag: 0.015, reach: 8, elements: 0.85, kit: Object.freeze({ chunk: 1.7, lean: 2 }), seed: 1 }),
});
export const EXAGGERATE_NAMES = Object.freeze(Object.keys(EXAGGERATE_PRESETS));

const fail = (msg) => { throw new Error(`exaggerate: ${msg}`); };
const say = 'exaggerate is a name (storybook, crooked, street), { from: name, …changes }, or { lean?, sway?, sag?, reach?, elements?, kit?, seed? }';

/** The cube's `exaggerate`, checked and resolved → the terms (every one set), or null for false. */
export function readExaggerate(spec, no = fail) {
  if (spec === undefined || spec === null || spec === false) return null;
  let base = PLUMB, rest = spec, name;
  if (typeof spec === 'string') { if (!EXAGGERATE_PRESETS[spec]) no(`exaggerate '${spec}' is not a hand (${EXAGGERATE_NAMES.join(', ')}); or write the terms`); base = EXAGGERATE_PRESETS[spec]; rest = {}; name = spec; }
  else if (!isObj(spec)) no(say);
  else if (spec.from !== undefined) {
    if (!EXAGGERATE_PRESETS[spec.from]) no(`exaggerate.from '${spec.from}' is not a hand (${EXAGGERATE_NAMES.join(', ')})`);
    ({ from: name, ...rest } = spec); base = EXAGGERATE_PRESETS[name];
  }
  for (const k of Object.keys(rest)) if (!(k in EXAGGERATE_TERMS) && k !== 'name') no(`exaggerate.${k} is not a term (exaggerate: ${Object.keys(EXAGGERATE_TERMS).join(', ')})`);
  if (rest.name !== undefined && rest.name !== name && !EXAGGERATE_PRESETS[rest.name]) no(`exaggerate.name '${rest.name}' is not a hand (${EXAGGERATE_NAMES.join(', ')})`);
  const E = { ...base, ...rest, kit: { ...base.kit, ...(isObj(rest.kit) ? rest.kit : {}) } };
  if (rest.kit !== undefined && !isObj(rest.kit)) no('exaggerate.kit is { chunk?, lean? }: the street\'s furniture');
  for (const [k, rail] of Object.entries(EXAGGERATE_TERMS)) {
    if (!rail) continue;
    if (!(typeof E[k] === 'number' && E[k] >= rail[0] && E[k] <= rail[1])) no(`exaggerate.${k} is a number from ${rail[0]} to ${rail[1]}`);
  }
  for (const k of Object.keys(E.kit)) if (!KIT_TERMS[k]) no(`exaggerate.kit.${k} is not a term (kit: chunk, lean)`);
  for (const [k, rail] of Object.entries(KIT_TERMS)) if (!(typeof E.kit[k] === 'number' && E.kit[k] >= rail[0] && E.kit[k] <= rail[1])) no(`exaggerate.kit.${k} is a number from ${rail[0]} to ${rail[1]}`);
  if (!Number.isInteger(E.seed)) no('exaggerate.seed is an integer: the field\'s own dice');
  const out = { ...(name || rest.name ? { name: rest.name ?? name } : {}), lean: E.lean, sway: E.sway, sag: E.sag, reach: E.reach, elements: E.elements, kit: { chunk: E.kit.chunk, lean: E.kit.lean }, seed: E.seed };
  return out;
}

// ── the field ────────────────────────────────────────────────────────────────────────────────────────────────────────
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Three waves at about `sway` metres, their weights summing to 1 (so |w| ≤ 1); and the bound on their gradient. */
function waves(R, sway) {
  const ws = [0, 1, 2].map(() => {
    const th = R() * 2 * Math.PI, lam = sway * (0.75 + 0.55 * R()), k = (2 * Math.PI) / lam;
    return { kx: k * cos(th), ky: k * sin(th), ph: R() * 2 * Math.PI, a: 0.5 + 0.5 * R(), k };
  });
  const sum = ws.reduce((s, w) => s + w.a, 0);
  for (const w of ws) w.a /= sum;
  return { ws, grad: ws.reduce((s, w) => s + w.a * w.k, 0) };
}
const wave = (W, x, y) => W.ws.reduce((s, w) => s + w.a * sin(w.kx * x + w.ky * y + w.ph), 0);

const FIELDS = new Map();
/** The bend's field for the terms: where a point moves, the lean's way at a place, and the bound `fold`. */
export function exaggerateField(E) {
  const key = JSON.stringify([E.lean, E.sway, E.sag, E.reach, E.seed]);
  if (FIELDS.has(key)) return FIELDS.get(key);
  const R = mulberry32((E.seed * 2654435761) >>> 0 || 1), X = waves(R, E.sway), Y = waves(R, E.sway), Sg = waves(R, E.sway * 0.8);
  const A = tan(E.lean * DEG) / Math.SQRT2, H = E.reach, g = (t) => (t > 0 ? (t * H) / (t + H) : 0);
  const at = (x, y, z, foot) => {
    const G = g(z - foot);
    if (!G) return [0, 0, 0];
    return [G * A * wave(X, x, y), G * A * wave(Y, x, y), G * E.sag * wave(Sg, x, y)];
  };
  // ‖∇d‖ ≤ √( (g·∇(A·v))² + (g·∇(sag·s))² + (g′·|(A·v, sag·s)|)² ), g ≤ H, g′ ≤ 1
  const tA = Math.SQRT2 * A, fold = Math.sqrt((H * A * Math.hypot(X.grad, Y.grad)) ** 2 + (H * E.sag * Sg.grad) ** 2 + (tA + E.sag) ** 2);
  const F = { at, dir: (x, y) => [wave(X, x, y), wave(Y, x, y)], fold: r3(fold), g };
  FIELDS.set(key, F);
  return F;
}

// ── bending faces ───────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(...n) || 1;
  return n.map((v) => v / l);
}
/** A face's corners moved, its normal (and outNormal) the bent one's, its light re-baked by `lit`'s ratio. */
function moved(f, cs, lit) {
  const n0 = f.normal ?? newell(f.corners), m = newell(cs), n = m[0] * n0[0] + m[1] * n0[1] + m[2] * n0[2] < 0 ? m.map((v) => -v) : m;
  const out = { ...f, corners: cs.map((p) => p.map(r5)) };
  if (f.normal) out.normal = n.map(r5);
  if (f.outNormal) out.outNormal = n.map(r5);
  const a = lit ? lit(n0, f) : null, b = a ? lit(n, f) : null;
  if (a && b && Math.abs(b / a - 1) > 1e-6 && typeof f.fill === 'string') {
    const k = b / a;
    out.fill = scaleHex(f.fill, k);
    if (f.cornerFills) out.cornerFills = f.cornerFills.map((h) => (typeof h === 'string' ? scaleHex(h, k) : h));
  }
  return out;
}

/** Bend the spans [from, to, foot] of `faces` in place by the cube's field. `foot` a height or (x, y) → height. */
export function bendFaces(faces, spans, E, { lit = null, kit = false } = {}) {
  if (!E || !spans.length) return faces;
  const F = exaggerateField(E), kA = tan(E.kit.lean * DEG);
  if (kit ? !kA : !(E.lean || E.sag)) return faces;
  for (const [from, to, foot] of spans) {
    for (let i = from; i < to; i++) {
      const f = faces[i];
      if (!f?.corners) continue;
      const cs = f.corners.map((p) => {
        const ft = typeof foot === 'function' ? foot(p[0], p[1]) : foot;
        if (kit) {
          // (a piece of furniture leans straight, a metre over for every tan(kit.lean) up, the field's way)
          const t = p[2] - ft;
          if (t <= 0) return p;
          const [vx, vy] = F.dir(p[0], p[1]), l = Math.hypot(vx, vy) || 1;
          return [p[0] + (t * kA * vx) / l, p[1] + (t * kA * vy) / l, p[2]];
        }
        const d = F.at(p[0], p[1], p[2], ft);
        return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
      });
      faces[i] = moved(f, cs, lit);
    }
  }
  return faces;
}

/** A piece's faces thickened: its two thinner dimensions × c about its middle (its length kept, so an arm still reaches). */
export function chunkFaces(faces, c) {
  if (!(c > 1) || !faces.length) return faces;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const p of f.corners) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  const dims = [0, 1, 2].map((i) => hi[i] - lo[i]), long = dims.indexOf(Math.max(...dims));
  // (an upright piece stands on its foot: thickened about its middle across, never pushed down through the ground)
  const mid = [0, 1, 2].map((i) => (i === 2 ? lo[2] : (lo[i] + hi[i]) / 2));
  const s = [0, 1, 2].map((i) => (i === long ? 1 : c));
  if (long !== 2) mid[2] = (lo[2] + hi[2]) / 2;
  return faces.map((f) => ({ ...f, corners: f.corners.map((p) => p.map((v, i) => r5(mid[i] + (v - mid[i]) * s[i]))) }));
}

/** A piece's faces sheared toward dir ([dx, dy], a unit) by tanA a metre up from z 0, re-lit by `lit` (normal → factor). */
export function leanFaces(faces, dir, tanA, lit = null) {
  if (!tanA) return faces;
  return faces.map((f) => moved(f, f.corners.map((p) => [p[0] + p[2] * tanA * dir[0], p[1] + p[2] * tanA * dir[1], p[2]]), lit && ((n) => lit(n))));
}

// ── the language caricatured ──────────────────────────────────────────────────────────────────────────────────────
/** An anchor with its building elements caricatured: each numeric param pushed from its rail's middle × (1 + 2·e). */
export function exaggerateAnchor(anchor, E) {
  if (!E || !(E.elements > 0)) return anchor;
  const raw = typeof anchor === 'string' ? ELEMENT_SETS[anchor] : anchor;
  if (!isObj(raw) || !isObj(raw.elements)) return anchor;
  const k = 1 + 2 * E.elements, elements = {};
  for (const [name, el] of Object.entries(raw.elements)) {
    const K = isObj(el) ? ELEMENT_KINDS[el.kind] : null;
    // (a door is the plan's: the way in stays where it was and as wide as it was)
    if (!K || K.family !== 'building' || el.kind === 'door') { elements[name] = el; continue; }
    const next = { ...el };
    for (const [p, def] of Object.entries(K.params)) {
      const rail = def.rail, v = el[p];
      // (a household's own rhythm, its bays and its count of lights, is where the door falls: kept, so the door is kept)
      if (!(Array.isArray(rail) && rail.length === 2 && typeof rail[0] === 'number' && typeof v === 'number') || isObj(def.hold)) continue;
      const [lo, hi] = rail, mid = (lo + hi) / 2;
      let w = Math.max(lo, Math.min(hi, mid + (v - mid) * k));
      // (a counted param stays whole)
      if (Number.isInteger(v) && Number.isInteger(lo) && Number.isInteger(hi) && hi - lo <= 10) w = Math.round(w);
      next[p] = r3(w);
    }
    elements[name] = next;
  }
  return { ...raw, elements, id: raw.id ?? (typeof anchor === 'string' ? anchor : undefined) };
}

// ── the laws and the card ─────────────────────────────────────────────────────────────────────────────────────────
/** A door's head over its foot (m): what the `foot` law reads the bend at. */
export const DOOR_HEAD = 2.2;
export function exaggerateLaws(E) {
  if (!E) return [];
  const F = exaggerateField(E), foot = F.g(DOOR_HEAD) * Math.hypot(tan(E.lean * DEG), E.sag);
  return [
    { law: 'foot', want: 'a door\'s head moves under a quarter of a door (25 cm): the way in stays where the plan put it', ok: foot < 0.25, value: `${r3(foot * 100)} cm` },
    { law: 'fold', want: 'the bend\'s Lipschitz bound under 1: no crack opens, no two buildings touch that did not', ok: F.fold < 1, value: F.fold },
    { law: 'plumb', want: 'a wall at most 8° off plumb, a lamp at most 10°', ok: E.lean <= 8 && E.kit.lean <= 10, value: `${E.lean}°, the street's ${E.kit.lean}°` },
  ];
}

/** The style guide's card: the hand, its terms, and what it does. */
export function exaggerateCard(E) {
  if (!E) return null;
  return {
    kind: 'exaggerate', id: E.name ?? 'its own',
    read: `walls ${E.lean}° off plumb at most, turning every ~${E.sway} m; eaves out of level by ${Math.round(E.sag * 100)}% of their height; the lean grows to ${E.reach} m up; the language pushed ${Math.round(E.elements * 100)}% toward its rails' ends; the street's furniture ${E.kit.chunk}× as thick, leaning ${E.kit.lean}°`,
    terms: { lean: E.lean, sway: E.sway, sag: E.sag, reach: E.reach, elements: E.elements, kit: { ...E.kit }, seed: E.seed },
    laws: exaggerateLaws(E),
  };
}

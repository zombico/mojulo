/**
 * SHEET → PLAN: an Egocube sheet (egocube.js rollEgocube) compiled into a first `create_character` call, the way the
 * Pale Warden was built by hand (docs/egocube.md). It is the loop's FIRST READING, a starter recipe: every amount here
 * is a documented default the character loop iterates in place (`update_sketch`, `update_character`), never a verdict.
 *
 *   planFromSheet(sheet, { title? }) → { door, thesis, create, after, ledger }
 *
 *   door     'creature' (the creature door: a ring plan) or 'hero' (the hero door: a hero spec), as the sheet says
 *   thesis   the creature loop's step 0, five traits: silhouette · stance · head · the iconic feature · scale
 *   create   the create_character call ({ as, title, spec })
 *   after    update_sketch patches to apply once minted (a dial the mint does not set)
 *   ledger   one row per sheet note: where it landed in the call (`at`), or `pending` and why
 *
 * The creature door wears a library head (creature-heads; a people with none wears STAND_IN_HEAD, named pending), a biped body scaled from the Pale Warden's (digitigrade or
 * plantigrade, a tail by kind, three or four fingers), cover from the lineage's plan hints (fur, scales, chitin as
 * tiles, a ruff as a mass first), a dress kit from the role, the archetype's reading and the order, and its colours
 * from the sheet. The hero door gets the cast, a tune for the build, the western expression channels, the gesture,
 * the hair and the swatches; a sheet rolled in an anime game's setting (setting.js) gets the anime head, its
 * proportions, the character light (`create.toon`), its graphic face and its own expression and hair words, and a sheet
 * rolled in any setting is clothed in its world's colours. Pure and deterministic: the same sheet, the same call.
 *
 * THE SIXTH GENERATION: the creature door's biped (`biped`, `dialsAndRig`) with a library head on its neck stub is the
 * beast-kin's sixth-generation body. Its seventh stands on the tiered body (lib/graph/beast); this one stays as it is for
 * every row minted on it, held byte for byte by creature-gen6.char.test.js.
 */
import { readDerive, dialKey } from './channels.js';
import { ARCHETYPE_IDS, ROLES } from './facets.js';
import { CHANNEL_RANGES } from '../polygonizer/humanoid-head.js';
import { ANIME_SCULPT } from '../polygonizer/anime-sculpt.js';
import { HEAD_LIBRARY, headPlan, headFor } from '../creature-heads/index.js';
import { PLAN_SCHEMA } from '../polygonizer/station-loft-plan.js';
import { outfitFromSheet, adornFromSheet, heroOutfitOf, outfitPalette, ERA_GEAR, eraLookOf, lookGear, lookTones, lookArmor } from './outfit.js';
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { variantOf, UNDEAD_CARDS } from '../undead/index.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s); const unit = (v) => mul(v, 1 / Math.hypot(...v));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hasDerive = (sheet, d) => Object.values(sheet.derives).some((list) => list.includes(d));
const derivesOf = (sheet, chs) => chs.flatMap((c) => sheet.derives[c] || []);

/** a colour moved toward white (t > 0) or black (t < 0) */
export function shade(hex, t) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const o = c.map((v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return `#${o.map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

// ══════════ the readings: first defaults, each a table ══════════

/** height in metres by build, scaled by age */
export const HEIGHT = Object.freeze({ lithe: 1.95, canonical: 1.9, heroic: 2.0, stout: 1.6, brute: 2.15 });
export const AGE_SCALE = Object.freeze({ child: 0.6, youth: 0.94, adult: 1, seasoned: 1, elder: 0.97 });
/** girth (radii across) by build */
export const GIRTH = Object.freeze({ lithe: 0.88, canonical: 1, heroic: 1.08, stout: 1.15, brute: 1.25 });
/** tails: radii base → tip, a length factor and how it is CARRIED (`carry`, its joints at 2 m from the root; absent, it
 * hangs): a cat's thin tail lifts in an S, a heavy tail is held level behind as the counterweight; a tail that hangs to
 * the floor reads as a third leg */
const HANG = [[0, -0.17, 0.95], [0, -0.36, 0.83], [0, -0.52, 0.67], [0, -0.64, 0.5], [0, -0.72, 0.35], [0, -0.76, 0.22]];
export const TAILS = Object.freeze({
  thin: { r: [0.045, 0.04, 0.035, 0.028, 0.02, 0.01], len: 1.35, carry: [[0, -0.17, 0.95], [0, -0.33, 0.85], [0, -0.5, 0.79], [0, -0.63, 0.83], [0, -0.7, 0.95], [0, -0.69, 1.08]] },
  thick: { r: [0.13, 0.11, 0.09, 0.065, 0.042, 0.016], len: 1.25, carry: [[0, -0.17, 0.95], [0, -0.36, 0.85], [0, -0.55, 0.74], [0, -0.74, 0.65], [0, -0.92, 0.6], [0, -1.08, 0.59]] },
  brush: { r: [0.07, 0.12, 0.14, 0.13, 0.095, 0.035], len: 1 },
  stub: { r: [0.08, 0.09, 0.08, 0.06, 0.04, 0.02], len: 0.3 },
});
export const FINGER_COUNT = Object.freeze({ draconic: 3, avian: 3, insectoid: 3 });
/** a sheet's face derives, as the creature head's expression controls (species-neutral, station-loft-head.js) */
export const HEAD_EXPRESSION = Object.freeze({
  'expression.browRaise +': { browRaise: 0.35 }, 'expression.browRaise -': { browRaise: -0.2 },
  'expression.browTilt +': { browFurrow: 0.3 }, 'expression.browTilt -': { browFurrow: 0.3, browRaise: 0.15 },
  'sculpt.browAngle +': { browFurrow: 0.5, sneer: 0.25, earAttitude: -0.4 },
  'expression.mouthCorner +': { cornerRetract: 0.3 }, 'expression.mouthCorner -': { cornerRetract: -0.25 },
  'expression.aperture +': { lidClose: -0.2 }, 'expression.aperture -': { lidClose: 0.2 }, 'sculpt.lidWeight +': { lidClose: 0.2 },
  'axes.confidence -': { earAttitude: -0.25 }, 'axes.confidence +': { earAttitude: 0.2 },
});
/** cover kinds, as tile parameters (the dragon's scales, the bear's tufts) */
const COVER = Object.freeze({
  fur: (h) => ({ sides: 3, coverage: 1.25, inset: 0.85, height: h, lean: -1.2, thin: 0.5, wobble: 0.3, jitter: 0.35, edgeFade: 0.25, group: ['Fur', 'FurAlt'] }),
  scales: (h) => ({ sides: 6, coverage: 1.2, inset: 0.35, height: h * 0.35, lean: -0.8, thin: 0.4, wobble: 0.2, jitter: 0.3, edgeFade: 0.2, group: ['Scales', 'ScalesAlt'] }),
  chitin: (h) => ({ sides: 4, coverage: 1.05, inset: 0.2, height: h * 0.4, lean: -0.3, wobble: 0.1, group: ['Chitin', 'ChitinAlt'] }),
});
/** the dress kit: pieces by role; the archetype's reading and the order add or mirror (one focal metal piece at most) */
export const ROLE_KIT = Object.freeze({
  frontline: ['pauldron', 'bracers'], flanker: ['wraps', 'baldric'], ranged: ['baldric', 'quiver'], support: ['satchels', 'pack'],
  controller: ['medallion', 'satchel'], caster: ['medallion', 'wraps'], 'non-combatant': ['medallion'],
});
export const READING_KIT = Object.freeze({ 'caregiver/shadow': ['pack', 'satchels', 'wraps'], 'explorer/light': ['pack'], 'explorer/shadow': ['pack', 'wraps'], 'creator/light': ['satchels'], 'creator/shadow': ['satchels', 'bracers'], 'ruler/light': ['medallion'], 'ruler/shadow': ['medallion', 'pauldron'], 'hero/light': ['medallion'] });

// ══════════ the creature door ══════════

/** the head a people with no library head wears meanwhile (a neutral short-muzzled skull, its ears and crest taken off),
 * so the rig has a skull to anchor to; the ledger says so */
export const STAND_IN_HEAD = 'felid';

function headOf(sheet) {
  const named = derivesOf(sheet, ['structure']).map(readDerive).find((r) => r.family === 'head');
  if (named) return { id: named.word, provisional: false };
  return headFor(sheet.facets.ancestry) || { id: STAND_IN_HEAD, provisional: true, standIn: true };
}

/** what the frame's notes add to the biped: wings on the arms, a second pair of arms */
const noted = (sheet, re) => Object.values(sheet.notes).flat().some((n) => re.test(n.line));
function topologyOf(sheet) { return { wings: noted(sheet, /wings on the arms/), arms2: noted(sheet, /second pair of arms/) }; }

function expressionOf(sheet) {
  const x = {};
  for (const d of derivesOf(sheet, ['rest', 'eyes', 'stance'])) for (const [k, v] of Object.entries(HEAD_EXPRESSION[d] || {})) x[k] = (x[k] || 0) + v;
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, r3(clamp(v, -1, 1))]).filter(([, v]) => v !== 0));
}

function stanceOf(sheet) {
  const d = derivesOf(sheet, ['stance', 'frame']);
  const lean = clamp(4 + (d.includes('axes.confidence -') ? 8 : 0) + (d.includes('axes.energy -') ? 6 : 0) - (d.includes('axes.confidence +') ? 5 : 0), -5, 22);
  return { lean, crouch: d.includes('axes.weight +') ? 0.12 : 0.04, guard: d.includes('gesture = guard') };
}

function kitOf(sheet) {
  const f = sheet.facets, readings = sheet.reading.reads === 'turning' ? ['light', 'shadow'] : [sheet.reading.reads];   // turning: both show
  const pieces = [...(ROLE_KIT[f.role] || []), ...readings.flatMap((r) => READING_KIT[`${f.archetype}/${r}`] || []), 'belt'];
  const kit = [...new Set(pieces)];
  if (kit.includes('pauldron') && kit.includes('medallion')) kit.splice(kit.indexOf('medallion'), 1);   // one focal metal piece
  if (kit.includes('satchels') && kit.includes('satchel')) kit.splice(kit.indexOf('satchel'), 1);       // the pair holds the one
  if (kit.includes('pack') && kit.includes('quiver')) kit.splice(kit.indexOf('quiver'), 1);              // one thing on the back
  return { kit, mirrored: f.order < 1 / 3, mended: f.motivation > 1 / 3 && f.motivation < 0.85 };
}

/** the served biped's joints at 2.0 m (the Pale Warden's): the template the audit's sameness reads plans against */
const UPPER = { shoulder: [0.37, 0.02, 1.56], elbow: [0.47, -0.04, 1.19], wrist: [0.45, 0.13, 0.87], knuckles: [0.45, 0.23, 0.78], neckBase: [0, 0.03, 1.63], neckTop: [0, 0.15, 1.86] };
export const BIPED_TEMPLATE = Object.freeze({
  digitigrade: Object.freeze({ hip: [0.17, 0, 0.92], knee: [0.2, 0.17, 0.56], hock: [0.21, -0.15, 0.3], toeBase: [0.21, 0.1, 0.06], toeTip: [0.21, 0.31, 0.03], ...UPPER }),
  plantigrade: Object.freeze({ hip: [0.15, 0, 0.92], knee: [0.16, 0.04, 0.5], hock: [0.16, -0.02, 0.1], toeBase: [0.16, 0.12, 0.045], toeTip: [0.16, 0.24, 0.025], ...UPPER }),
});

/** the biped: the Pale Warden's body at height h, girth g, with its legs, tail, fingers and claws by kind */
/** MASSES BEFORE DETAIL (the designed creatures' first principle): a body is a chest over a waist over the hips, not a
 * box. Half-widths at girth 1 (the build's GIRTH scales them all): the chest by pole, the waist a share of it by build
 * (a heroic or lithe V, a stout or brute barrel), the shoulder line a little past the chest (the male's) or inside it
 * (the female's), the hips the female's wider than her waist; a keel forward on the male's chest, a bust on the
 * female's. Every limb swells to a muscle belly (`rMid`) instead of running as a cone. */
export const MASS = Object.freeze({
  pole: { male: { chest: 0.3, shoulder: 0.33, hips: 0.22, keel: 0.02, bust: 0 }, female: { chest: 0.26, shoulder: 0.27, hips: 0.25, keel: 0, bust: 0.03 } },
  waist: { lithe: 0.6, heroic: 0.6, canonical: 0.68, stout: 0.86, brute: 0.82 },
});
export function biped({ k, g, legs, tail, fingers, claws, ruff, pole = 'male', build = 'canonical', wings = false, arms2 = false }) {
  const P = (p) => mul(p, k), R = (r) => (Array.isArray(r) ? r.map((x) => r3(x * k * g)) : r3(r * k * g));
  const M = MASS.pole[pole] ?? MASS.pole.male, Wst = M.chest * (MASS.waist[build] ?? MASS.waist.canonical);
  // the shoulder joint sits just inside the shoulder line (the template's 0.37 inside its 0.40)
  const J = Object.fromEntries(Object.entries(BIPED_TEMPLATE[legs]).map(([n, p]) => [n, P(UPPER[n] && n !== 'neckBase' && n !== 'neckTop' ? [p[0] * g * (M.shoulder / 0.4), p[1], p[2]] : p)]));
  const T = tail && TAILS[tail];
  if (T) J.tail = (T.carry ?? HANG)
    .map((p, i, a) => P(i === 0 ? p : add(a[0], mul(add(p, mul(a[0], -1)), T.len))));
  const FINGERS = ['A', 'B', 'C', 'D'].slice(0, fingers);
  const FG = { spread: 0.04 * k * g, prox: 0.075 * k, dist: 0.06 * k, proxDir: [0, 0.7, -0.6], distDir: [0, 0.5, -0.85], clawDir: [0, 0.35, -0.95] };
  const fingerJoints = (i) => { const kk = add(J.knuckles, [(i - (fingers - 1) / 2) * FG.spread, 0, 0]); const m = add(kk, mul(unit(FG.proxDir), FG.prox)); return { k: kk, m, e: add(m, mul(unit(FG.distDir), FG.dist)) }; };
  const joints = { hip: J.hip, knee: J.knee, hock: J.hock, toeBase: J.toeBase, toeTip: J.toeTip, shoulder: J.shoulder, elbow: J.elbow, wrist: J.wrist, knuckles: J.knuckles, neckBase: J.neckBase, neckTop: J.neckTop };
  if (T) J.tail.forEach((p, i) => { joints[`tail${i}`] = p; });
  for (const [i, X] of FINGERS.entries()) { const { k: kk, m, e } = fingerJoints(i); joints[`finger${X}k`] = kk; joints[`finger${X}m`] = m; joints[`finger${X}e`] = e; }
  const limb = (name, from, to, rA, rB, opts, group, prev, next) => ({ name, kind: 'segment', from, to, rA: R(rA), rB: R(rB), ...opts, group, tint: '#cccccc', mirror: 'name', bind: { bone: name, prev, next } });
  const z = (v) => r3(v * k);
  const segments = [
    { name: 'pelvis', kind: 'trunk', stations: [{ z: z(0.8), r: R([M.hips * 0.86, 0.16]) }, { z: z(0.92), r: R([M.hips, 0.17]) }, { z: z(1.04), r: R([M.hips * 0.96, 0.18]), yc: z(0.01) }],
      caps: { back: P([0, 0, 0.74]), tip: P([0, 0, 1.1]) }, group: 'Pelvis', tint: '#cccccc', mirror: 'plane', bind: { bone: 'pelvis' } },
    { name: 'torso', kind: 'trunk', stations: [
      { z: z(0.92), r: R([M.hips * 0.96, 0.19]), yc: z(0.02) }, { z: z(1.14), r: R([Wst, Wst * 0.86]), yc: z(0.03), e: 2.1 },
      { z: z(1.36), r: R([M.chest, M.chest * 0.84]), yc: z(0.05), e: 2.2, ...(M.keel || M.bust ? { push: { ...(M.keel ? { front: [0, r3(M.keel * k * g), 0] } : {}), ...(M.bust ? { frontR: [0, r3(M.bust * k * g), z(-0.01)] } : {}) } } : {}) },
      { z: z(1.54), r: R([M.shoulder, M.chest * 0.8]), yc: z(0.02), e: 2.3 }, { z: z(1.66), r: R(ruff ? [0.33, 0.24] : [0.24, 0.18]), yc: 0 },
    ], caps: { back: P([0, 0.02, 0.86]), tip: P([0, 0, 1.72]) }, group: 'Torso', tint: '#cccccc', mirror: 'plane',
      bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 }, st4: { torso: 0.6, neck: 0.4 }, tip: { neck: 1 } } } },
    { name: 'neck', kind: 'segment', from: 'neckBase', to: 'neckTop', rA: R(ruff ? [0.23, 0.21] : [0.15, 0.14]), rB: R(ruff ? [0.13, 0.13] : [0.1, 0.1]), slots: 'ring8', over: [0.3, 0.4], group: 'Neck', tint: '#cccccc', mirror: 'plane',
      bind: { bone: 'neck', blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st2: { neck: 0.5, head: 0.5 }, tip: { head: 1 } } } },
    ...(T ? [{ name: 'tail', kind: 'chain', joints: [0, 1, 2, 3, 4, 5].map((i) => `tail${i}`), r: T.r.map((x) => r3(x * k * g)), over: { first: 0.4, last: 0.3, inner: 0.6 }, group: 'Tail', tint: '#cccccc', mirror: 'plane', bind: { root: 'pelvis' } }] : []),
    limb('thighR', 'hip', 'knee', [0.12, 0.14], [0.085, 0.095], { e: 2.2, over: [0.5, 0.6], mid: 0.4, rMid: R([0.115, 0.13]) }, 'Legs', 'pelvis', 'shinR'),
    limb('shinR', 'knee', 'hock', 0.085, 0.055, { over: [0.6, 0.6], mid: 0.35, rMid: R([0.08, 0.088]) }, 'Legs', 'thighR', 'metaR'),
    limb('metaR', 'hock', 'toeBase', 0.055, [0.075, 0.05], { over: [0.6, 0.4] }, 'Legs', 'shinR', 'toesR'),
    limb('toesR', 'toeBase', 'toeTip', [0.08, 0.045], [0.065, 0.028], { over: [0.3, 0.3] }, 'Feet', 'metaR', null),
    limb('upperArmR', 'shoulder', 'elbow', 0.095, 0.075, { over: [0.6, 0.6], mid: 0.45, rMid: R([0.088, 0.092]) }, 'Arms', 'torso', 'foreArmR'),
    limb('foreArmR', 'elbow', 'wrist', 0.075, 0.055, { over: [0.6, 0.6], mid: 0.3, rMid: R([0.074, 0.068]) }, 'Arms', 'upperArmR', 'handR'),
    limb('handR', 'wrist', 'knuckles', [0.065, 0.055], [0.085, 0.035], { over: [0.4, 0.3] }, 'Hands', 'foreArmR', null),
    ...FINGERS.flatMap((X) => [
      limb(`finger${X}1R`, `finger${X}k`, `finger${X}m`, 0.021, 0.019, { over: [0.5, 0.5] }, 'Hands', 'handR', `finger${X}2R`),
      limb(`finger${X}2R`, `finger${X}m`, `finger${X}e`, 0.019, 0.015, { over: [0.5, 0.5] }, 'Hands', `finger${X}1R`, null),
    ]),
  ];
  // TOPOLOGY from the frame's notes. Wings on the arms: five flight feathers, flat vanes (thin across, broad front to
  // back) trailing down and back from the hand (the primaries) and the forearm (the secondaries)
  const extraArms = [];
  if (wings) {
    const along = (t) => add(J.elbow, mul(add(J.knuckles, mul(J.elbow, -1)), t));
    const VANES = [['wingPrim1', 'hand', 0.92, [0.1, -0.08, -0.4], [0.042, 0.02]], ['wingPrim2', 'hand', 0.8, [0.13, -0.14, -0.4], [0.044, 0.02]], ['wingPrim3', 'foreArm', 0.66, [0.14, -0.19, -0.38], [0.075, 0.045]],
      ['wingSec1', 'foreArm', 0.45, [0.125, -0.22, -0.35], [0.075, 0.045]], ['wingSec2', 'foreArm', 0.22, [0.105, -0.23, -0.31], [0.075, 0.045]]];
    for (const [i, [n, bone, t, d, [wA, wB]]] of VANES.entries()) {
      J[`${n}b`] = along(t); J[`${n}t`] = add(J[`${n}b`], mul(d, k * 1.05));
      segments.push({ name: `${n}R`, kind: 'segment', from: `${n}b`, to: `${n}t`, rA: [r3(0.008 * k), r3(wA * k)], rB: [r3(0.005 * k), r3(wB * k)], group: i % 2 ? 'FlightAlt' : 'Flight', tint: '#cccccc', mirror: 'name', bind: { bone: `${bone}R` } });
      extraArms.push(`${n}R`, `${n}L`);
    }
  }
  // a second pair of arms, smaller, under the first and folded forward at rest (an insect's working hands)
  if (arms2) {
    Object.assign(J, { shoulder2: P([0.17 * g, 0.03, 1.27]), elbow2: P([0.29 * g, 0.09, 1.1]), wrist2: P([0.23 * g, 0.27, 1.07]), knuckles2: P([0.19 * g, 0.34, 1.03]) });
    segments.push(
      limb('upperArm2R', 'shoulder2', 'elbow2', 0.055, 0.044, { over: [0.6, 0.6], mid: 0.45, rMid: R([0.052, 0.054]) }, 'Arms', 'torso', 'foreArm2R'),
      limb('foreArm2R', 'elbow2', 'wrist2', 0.046, 0.034, { over: [0.6, 0.6] }, 'Arms', 'upperArm2R', 'hand2R'),
      limb('hand2R', 'wrist2', 'knuckles2', [0.04, 0.03], [0.045, 0.02], { over: [0.4, 0.3] }, 'Hands', 'foreArm2R', null));
    extraArms.push('upperArm2R', 'upperArm2L', 'foreArm2R', 'foreArm2L', 'hand2R', 'hand2L');
  }
  // claws: three at each toe tip, one at each finger tip; blunt and short, or long
  const W = 1 / 3, THIRDS = [W, W, W], c = claws === 'long' ? 1.9 : 1, FT = J.toeTip, footDir = [0, 0.9, -0.3];
  const claw = (name, base, dir, length, radius, pin) => ({ name, kind: 'claw', base, dir, length: r3(length * k * c), radius: r3(radius * k), pin, group: 'Claws', tint: '#333333', stretch: 'clawLength' });
  const details = !claws ? [] : [
    claw('clawF0R', add(FT, P([-0.04, 0.015, -0.005])), footDir, 0.05, 0.012, { parent: 'toesR', face: 'toesR/st1-st2.k5.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontL', 'toesR/st2.frontL'], handedness: 1 }),
    claw('clawF1R', add(FT, P([0, 0.015, -0.005])), footDir, 0.055, 0.013, { parent: 'toesR', face: 'toesR/st1-st2.k0.b', weights: THIRDS, tangentEdge: ['toesR/st1.front', 'toesR/st2.front'], handedness: 1 }),
    claw('clawF2R', add(FT, P([0.04, 0.015, -0.005])), footDir, 0.05, 0.012, { parent: 'toesR', face: 'toesR/st1-st2.k0.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontR', 'toesR/st2.frontR'], handedness: 1 }),
    ...FINGERS.map((X, i) => { const { e } = fingerJoints(i); const parent = `finger${X}2R`;
      return claw(`clawH${i}R`, add(e, mul(unit(FG.distDir), 0.006 * k)), FG.clawDir, 0.035, 0.009, { parent, face: `${parent}/st1-st2.k0.b`, weights: THIRDS, tangentEdge: [`${parent}/st1.front`, `${parent}/st2.front`], handedness: 1 }); }),
  ];
  for (const n of [...['wingPrim1', 'wingPrim2', 'wingPrim3', 'wingSec1', 'wingSec2'].flatMap((w) => [`${w}b`, `${w}t`]), 'shoulder2', 'elbow2', 'wrist2', 'knuckles2']) if (J[n]) joints[n] = J[n];
  return { J, joints, segments, details, FINGERS, fingerJoints, hasTail: !!T, extraArms, arms2 };
}

export function dialsAndRig({ J, FINGERS, fingerJoints, hasTail, extraArms = [], arms2 = false }, stance) {
  const legParts = ['thighR', 'thighL', 'shinR', 'shinL', 'metaR', 'metaL', 'toesR', 'toesL'];
  const fingerParts = FINGERS.flatMap((X) => ['R', 'L'].flatMap((S) => [`finger${X}1${S}`, `finger${X}2${S}`]));
  const armParts = ['upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'handR', 'handL', ...fingerParts, ...extraArms];
  const all5 = { st0: 1, st1: 1, st2: 1, back: 1, tip: 1 };
  const tailLinks = [1, 2, 3, 4].map((t) => ({ pivot: `tail${t}/back`, parts: [1, 2, 3, 4].filter((j) => j >= t).map((j) => `tail${j}`) }));
  const dials = {
    bulk: { min: 0.85, max: 1.3, rest: 1, doc: 'x scale of the torso and arms about the mirror plane', op: 'scale', axis: 'x', pivot: 0, parts: ['torso', ...armParts], blend: { ...all5, st3: 1, st4: 1 } },
    gut: { min: 0, max: 0.15, rest: 0, doc: 'metres the belly front slots move forward at the waist', op: 'offset', axis: 'y', slots: ['front', 'frontR', 'frontL'], parts: ['torso', 'pelvis'], blend: { st0: 0.6, st1: 1, st2: 0.5 } },
    stance: { min: 0.8, max: 1.35, rest: 1, doc: 'x scale of the legs about the mirror plane', op: 'scale', axis: 'x', pivot: 0, parts: legParts, blend: all5 },
    clawLength: { min: 0.5, max: 1.8, rest: 1, doc: 'stretch of every claw along its own axis', op: 'stretch', parts: [] },
    head: { op: 'include', name: 'head' },
    lean: { min: -10, max: 25, rest: 0, doc: 'degrees the torso, arms, neck and head hinge forward about the pelvis tip; the legs stay planted', op: 'hinge', parts: ['torso', 'neck', 'cranium', 'jaw', ...armParts], pivot: 'pelvis/tip', axis: 'x', sign: -1 },
    ...(hasTail ? {
      tailCurl: { min: -20, max: 20, rest: 0, doc: 'degrees per tail joint about x (+ lifts the tip)', op: 'chain', axis: 'x', sign: -1, links: tailLinks },
      tailSway: { min: -15, max: 15, rest: 0, doc: 'degrees per tail joint about z (+ swings the tip right)', op: 'chain', axis: 'z', sign: 1, links: tailLinks },
    } : {}),
    grip: { min: 0, max: 45, rest: 0, doc: 'degrees per finger joint, both hands, toward the palm', op: 'chain', axis: 'x', sign: -1,
      links: ['R', 'L'].flatMap((S) => FINGERS.flatMap((X) => [{ pivot: `finger${X}1${S}/back`, parts: [`finger${X}1${S}`, `finger${X}2${S}`] }, { pivot: `finger${X}2${S}/back`, parts: [`finger${X}2${S}`] }])) },
  };
  const rigJoints = {
    pelvisHub: { at: [0, 0, J.hip[2]] }, navel: { at: [0, J.hip[1] + 0.02, r3((J.hip[2] + J.neckBase[2]) / 2)] }, neckHub: { at: J.neckBase }, headBase: { at: J.neckTop }, headTop: { at: 'head.cranium.tip' },
    jawHinge: { at: 'head.jawOpen.pivot', rides: 'head' }, jawTip: { at: 'head.jaw.tip', rides: 'head' },
    hip$S: { at: J.hip }, knee$S: { at: J.knee }, ankle$S: { at: J.hock }, shoulder$S: { at: J.shoulder }, elbow$S: { at: J.elbow }, wrist$S: { at: J.wrist },
    knuckles$S: { at: J.knuckles, rides: 'foreArm$S' }, toeBase$S: { at: J.toeBase }, toeTip$S: { at: J.toeTip },
    // the second pair rides the torso, held folded (its own bones skin it; no clip key poses it yet)
    ...(arms2 ? { shoulder2$S: { at: J.shoulder2, rides: 'torso' }, elbow2$S: { at: J.elbow2, rides: 'torso' }, wrist2$S: { at: J.wrist2, rides: 'torso' }, knuckles2$S: { at: J.knuckles2, rides: 'torso' } } : {}),
  };
  for (const S of ['R', 'L']) for (const [i, X] of FINGERS.entries()) { const { k, m, e } = fingerJoints(i); const f = (p) => (S === 'R' ? p : [-p[0], p[1], p[2]]);
    rigJoints[`finger${X}k${S}`] = { at: f(k), rides: `hand${S}` }; rigJoints[`finger${X}m${S}`] = { at: f(m), rides: `hand${S}` }; rigJoints[`finger${X}e${S}`] = { at: f(e), rides: `hand${S}` }; }
  if (hasTail) J.tail.forEach((p, i) => { rigJoints[`tail${i}`] = { at: p, rides: 'pelvis' }; });
  const downstream = (t) => [1, 2, 3, 4, 5].filter((j) => j > t).map((j) => `tail${j}`);
  const tailChain = (axis, sign) => ({ axis, sign, links: [1, 2, 3, 4].map((t) => ({ pivot: `tail${t}`, joints: downstream(t) })) });
  const rig = {
    joints: rigJoints,
    bones: [
      { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
      { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' }, { id: 'jaw', head: 'jawHinge', tail: 'jawTip' },
      { perSide: [
        { id: 'upperArm$S', head: 'shoulder$S', tail: 'elbow$S' }, { id: 'foreArm$S', head: 'elbow$S', tail: 'wrist$S' }, { id: 'hand$S', head: 'wrist$S', tail: 'knuckles$S' },
        ...FINGERS.flatMap((X) => [{ id: `finger${X}1$S`, head: `finger${X}k$S`, tail: `finger${X}m$S` }, { id: `finger${X}2$S`, head: `finger${X}m$S`, tail: `finger${X}e$S` }]),
        ...(arms2 ? [{ id: 'upperArm2$S', head: 'shoulder2$S', tail: 'elbow2$S' }, { id: 'foreArm2$S', head: 'elbow2$S', tail: 'wrist2$S' }, { id: 'hand2$S', head: 'wrist2$S', tail: 'knuckles2$S' }] : []),
        { id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shin$S', head: 'knee$S', tail: 'ankle$S' }, { id: 'meta$S', head: 'ankle$S', tail: 'toeBase$S' }, { id: 'toes$S', head: 'toeBase$S', tail: 'toeTip$S' },
      ] },
      ...(hasTail ? [0, 1, 2, 3, 4].map((t) => ({ id: `tail${t}`, head: `tail${t}`, tail: `tail${t + 1}` })) : []),
    ],
    chains: {
      ...(hasTail ? { tail: tailChain('x', -1), tailSway: tailChain('z', 1) } : {}),
      grip: { axis: 'x', sign: -1, links: [{ perSide: FINGERS.flatMap((X) => [{ pivot: `finger${X}k$S`, joints: [`finger${X}m$S`, `finger${X}e$S`] }, { pivot: `finger${X}m$S`, joints: [`finger${X}e$S`] }]) }] },
      jaw: { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] },
    },
    legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
    reach: 'reject',
  };
  const arms = stance.guard ? { armL: { x: -0.35, y: 0.8, z: -0.3 }, armR: { x: 0.35, y: 0.8, z: -0.3 }, elbowL: 'half', elbowR: 'half', grip: 30 }
    : { armL: { x: -0.2, y: 0.28, z: -0.94 }, armR: { x: 0.2, y: 0.28, z: -0.94 }, elbowL: 'slight', elbowR: 'slight', grip: 4 };
  const READY = { ...arms, jaw: 0, crouch: stance.crouch, ...(hasTail ? { tail: 0 } : {}) };
  const clips = {
    idle: hasTail ? [READY, { ...READY, tailSway: 6 }, READY, { ...READY, tailSway: -6 }] : [READY, { ...READY, crouch: stance.crouch + 0.03 }],
    crouch: [READY, { ...READY, crouch: 0.55, heelL: 10, heelR: 10, elbowL: 'half', elbowR: 'half', armL: { x: -0.35, y: 0.8, z: -0.45 }, armR: { x: 0.35, y: 0.8, z: -0.45 }, head: { x: 0, y: 0.95, z: 0.25 }, grip: 25 }],
  };
  return { dials, rig, clips };
}

/** THE SHAPES THAT BREAK THE OUTLINE (station-loft-body.js `locks`). They lie ALONG THE CONTOUR of the body (no `flow`:
 * down the part as its surface curves; `against` on a trunk or a neck, whose parts rise) unless a shape is meant to
 * stand against it for contrast (a crest of spines, a raised crest), which names its own flow. By kind: a section (`profile`), how far it stands
 * off the skin (`lift`), how much its tip flicks (`curl`), its thickness to its width */
export const LOCK_KINDS = Object.freeze({
  tuft: { profile: 'blade', lift: 0.35, curl: 0.22 },
  feather: { profile: 'feather', lift: 0.15, curl: 0.05, thin: 0.15 },
  quill: { profile: 'quill', lift: 0.45, curl: 0 },
  spine: { profile: 'spine', lift: 0.88, curl: 0 },
  bump: { profile: 'bump', lift: 1, curl: 0 },
});
const lockOf = (kind, k) => (id, parts, s, t, rows, count, length, width, extra = {}) => { const K = LOCK_KINDS[kind], m = (v) => r3(v * k);
  return { id, parts, share: true, s, t, rows, count, length: length.map(m), width: m(width), ...(K.thin ? { thick: m(width * K.thin) } : {}), lift: K.lift, curl: K.curl, ...(K.profile !== 'blade' ? { profile: K.profile } : {}), group: ['Fur', 'FurAlt'], ...extra }; };
const noFlow = (L) => L.map(({ flow, ...x }) => (flow ? { ...x, flow } : x));
/** FEATHERS AS SHAPES: a short cape of broad flat feathers over the upper arm's back, the thigh's feathering, a crest on
 * the crown when the sheet's feathers say so; the body's rows stay painted (skin-paint.js `feathers`) */
function featherLocks(k, { crest = false } = {}) {
  const lock = lockOf('feather', k), L = [];
  L.push(lock('cape', ['upperArmR', 'upperArmL'], [0.05, 0.55], [0.45, 1], 2, 3, [0.15, 0.12], 0.055));
  L.push(lock('thighFeathers', ['thighR', 'thighL'], [0.25, 0.8], [0.2, 1], 2, 4, [0.12, 0.1], 0.05));
  if (crest) L.push(lock('crest', ['cranium'], [0.06, 0.32], [0, 0.15], 3, 2, [0.16, 0.12], 0.04, { lift: 0.6, flow: [0, -1, 0.35], curl: 0.08 }));
  return noFlow(L);
}
/** SPINES down the back: a paired row either side of the spine from the nape down the back, stout and standing (a
 * dragon-kin's crest of spikes) */
function spineLocks(k) {
  const lock = lockOf('spine', k);
  // one row on the midline (one side's window at the ring's back)
  return noFlow([lock('spines', ['torso'], [0.3, 0.95], [0.97, 1], 6, 1, [0.1, 0.14], 0.04, { flow: [0, -0.5, 0.6], sides: ['R'] }),
    lock('spinesNeck', ['neck'], [0.1, 0.9], [0.97, 1], 3, 1, [0.12, 0.09], 0.034, { flow: [0, -0.6, 0.5], sides: ['R'] })]);
}
/** QUILLS: long stiff needles over the back and the shoulders, standing and swept back (a porcupine-kin's) */
function quillLocks(where, k) {
  const lock = lockOf('quill', k);
  return noFlow([lock('quills', ['torso'], [0.35, 0.98], [0.55, 1], 4, 6, [0.2, 0.26], 0.014, { against: true, jitter: 0.25 }),
    ...(where.has('forearm') ? [lock('quillsArm', ['upperArmR', 'upperArmL'], [0.05, 0.5], [0.5, 1], 2, 3, [0.14, 0.12], 0.012)] : [])]);
}

/** FUR AS SHAPES (station-loft-body.js `locks`), DEPICTED, not patterned: a coat is drawn as a few CLUMPS where fur
 * would break the outline, each a fan of pointed blades of graded length from one root (long, short, middling), the
 * blades' colours alternating, the body between them smooth (the way a designed creature's fur is drawn: a mane, a ruff,
 * the backs of the joints, a tail's brush, never an even cover). Clumps lie along the contour: a ruff over the shoulders
 * and up the neck when the people has one, two at the back of the outer thigh, a brush down the tail (its links carry
 * the offset on); then a few CHOICE SPOTS (FUR_SPOTS) for variety. Sizes by the body */
function furLocks(where, k, hasTail, tail, spots = []) {
  const L = [], lock = (...a) => L.push(lockOf('tuft', k)(...a)), clump = (n) => ({ clump: n, jitter: 0.2 });
  if (where.has('ruff')) { lock('ruff', ['torso'], [0.78, 1], [0.05, 0.95], 2, 4, [0.2, 0.15], 0.042, { lift: 0.45, against: true, ...clump(5) }); lock('ruffNeck', ['neck'], [0.15, 0.75], [0.1, 0.9], 2, 3, [0.15, 0.11], 0.036, { against: true, ...clump(3) }); }
  if (where.has('thigh')) lock('thigh', ['thighR', 'thighL'], [0.4, 0.75], [0.55, 0.9], 2, 1, [0.11, 0.08], 0.032, clump(3));
  for (const id of spots) { const S = FUR_SPOTS[id]; lock(id, S.parts, S.s, S.t, 1, 1, S.length, S.width, { ...clump(S.clump ?? 3), ...(S.curl ? { curl: S.curl } : {}) }); }
  if (where.has('tail') && hasTail) lock('tail', [0, 1, 2, 3, 4].map((i) => `tail${i}`), [0.2, 0.8], [0.1, 0.9], 1, tail === 'brush' ? 3 : 2, tail === 'brush' ? [0.15, 0.15] : [0.08, 0.08], tail === 'brush' ? 0.04 : 0.028, { curl: 0.25, lift: 0.3, ...clump(tail === 'brush' ? 3 : 1) });
  return noFlow(L);
}
/** CHEEKS: a mammal's cheek fur as clumps swept back along the jaw line below the eye (the cranium's cheek row and down,
 * toward its back), in place of the head's own field of tiles there (`CHEEK_ROW`, the head rows' cheek slot) */
const CHEEK_ROW = 3;
function cheekLocks(k) {
  return noFlow([lockOf('tuft', k)('cheeks', ['cranium'], [0.1, 0.28], [0.55, 0.78], 2, 2, [0.11, 0.08], 0.03, { against: true, clump: 4, jitter: 0.2, curl: 0.3 })]);
}
/** CHOICE SPOTS: where a clump gives a coat variety, none of them a must: the back of the elbow, the back of the knee,
 * round the triceps, under the wrist. A coat takes one to three of the ones its fur reaches (`reach`, the cover's
 * where), by the sheet's seed (the same sheet, the same tufts); one under something worn is not grown
 * (station-loft-body.js clears a lock under an adornment) */
export const FUR_SPOTS = Object.freeze({
  elbow: { reach: 'forearm', parts: ['foreArmR', 'foreArmL'], s: [0.06, 0.1], t: [0.8, 0.85], length: [0.1, 0.1], width: 0.03, curl: 0.3, clump: 4 },
  knee: { reach: 'thigh', parts: ['shinR', 'shinL'], s: [0.06, 0.1], t: [0.85, 0.9], length: [0.09, 0.09], width: 0.03, clump: 3 },
  tricep: { reach: 'forearm', parts: ['upperArmR', 'upperArmL'], s: [0.5, 0.55], t: [0.75, 0.8], length: [0.09, 0.09], width: 0.03, clump: 3 },
  wrist: { reach: 'forearm', parts: ['foreArmR', 'foreArmL'], s: [0.84, 0.88], t: [0.65, 0.7], length: [0.07, 0.07], width: 0.024, curl: 0.3, clump: 3 },
});
const seedOf = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
function furSpots(where, sheet) {
  const ok = Object.keys(FUR_SPOTS).filter((id) => where.has(FUR_SPOTS[id].reach)); if (!ok.length) return [];
  const rng = mulberry32(seedOf(`spots:${sheet.seed ?? 1}:${sheet.facets.ancestry}`)), deck = ok.map((id) => [rng(), id]).sort((a, b) => a[0] - b[0]).map(([, id]) => id);
  return deck.slice(0, Math.min(deck.length, 1 + Math.floor(rng() * 3))).sort((a, b) => ok.indexOf(a) - ok.indexOf(b));
}
/** BUMPS: a reptile's raised scales as shapes (the `bump` lock, a low dome straight off the skin): osteoderms in layered
 * rows down the back either side of the spine where the scales cover the body, tubercles scattered over the outer
 * forearm and thigh where they cover the limbs; the rows stand apart (a negative overlap), so they read as a pattern */
function bumpLocks(where, k) {
  const lock = lockOf('bump', k), all = where.has('belly'), L = [], G = { group: ['ScalesAlt', 'Scales'] };
  if (all) L.push(lock('osteoderms', ['torso'], [0.12, 0.92], [0.72, 0.93], 1, 1, [0.022, 0.016], 0.026, { layers: { overlap: -0.9 }, ...G }));
  if (all || where.has('forearm')) L.push(lock('tubercles', ['foreArmR', 'foreArmL'], [0.15, 0.75], [0.3, 0.7], 1, 1, [0.014, 0.014], 0.017, { layers: { overlap: -1.6 }, ...G }));
  if (all || where.has('thigh')) L.push(lock('tuberclesThigh', ['thighR', 'thighL'], [0.2, 0.75], [0.3, 0.7], 1, 1, [0.016, 0.016], 0.02, { layers: { overlap: -1.6 }, ...G }));
  return noFlow(L);
}

function coverOf(cover, k, hasTail, tail, { sheet = null, reptile = false } = {}) {
  if (!cover) return { tiles: [], locks: [], ruff: false };
  const T = COVER[cover.kind] || COVER.fur, where = new Set(cover.where);
  // a coat is SHAPES that break the outline (locks); scales and chitin lie flat (tiles), a reptile's raised ones bumps
  if (cover.kind === 'fur') return { tiles: [], locks: furLocks(where, k, hasTail, tail, sheet ? furSpots(where, sheet) : []), ruff: where.has('ruff') };
  if (cover.kind === 'quills') return { tiles: [], locks: quillLocks(where, k), ruff: false };
  const tiles = [];
  if (cover.kind === 'fur' && where.has('ruff')) tiles.push({ id: 'ruff', parts: ['torso'], s: [3.1, 4.0], t: [0, 4], grid: [2, 8], brick: true, ...T(0.09 * k), lean: -1.35 },
    { id: 'ruffNeck', parts: ['neck'], s: [0.55, 1.45], t: [0, 4], grid: [2, 8], brick: true, ...T(0.08 * k), lean: -1.35 });
  if (where.has('belly')) tiles.push({ id: 'belly', parts: ['torso'], s: [0.1, 3.9], t: [0, 0.95], grid: [10, 1], ...T(0.04 * k), sides: 4, coverage: 1.02, inset: 0.1, lean: -0.5 });
  if (where.has('forearm')) tiles.push({ id: 'forearm', parts: ['foreArmR', 'foreArmL'], s: [0.2, 1.4], t: [1.0, 2.9], grid: [3, 3], brick: true, ...T(0.02 * k) });
  if (where.has('thigh')) tiles.push({ id: 'thigh', parts: ['thighR', 'thighL'], s: [0.3, 1.6], t: [1.0, 2.6], grid: [3, 3], brick: true, ...T(0.022 * k) });
  if (where.has('shin')) tiles.push({ id: 'shin', parts: ['shinR', 'shinL'], s: [0.2, 1.8], t: [0.6, 2.6], grid: [5, 3], brick: true, ...T(0.02 * k) });
  if (where.has('tail') && hasTail) tiles.push({ id: 'tail', parts: [0, 1, 2, 3, 4].map((i) => `tail${i}`), s: [0.1, 1.9], t: [0, 2.9], grid: [3, 5], brick: true, ...T(0.045 * k) });
  return { tiles: tiles.map((t) => ({ ...t, height: r3(t.height) })), locks: cover.kind === 'scales' && reptile ? bumpLocks(where, k) : [], ruff: cover.kind === 'fur' && where.has('ruff') };
}

/** THE SKIN (skin-paint.js): a scaled people's hide painted as a reptile's is drawn, by region: fine plates over a
 * reptile's head, overlapping scales down the limbs, the tail and the back where the sheet scales them, broad scutes down
 * the throat, chest and belly. Sizes by the body (k); the drawn tier drops a region too fine to read */
const TAIL_PARTS = [0, 1, 2, 3, 4].map((i) => `tail${i}`);
function skinOf(cover, k, { reptileHead = false, hasTail = false, feathered = false, head = null } = {}) {
  // FEATHERS: a bird-kin's body, neck and upper arms in rows of feathers, its crown and nape finer (the beak, the
  // cranium's front, bare); its scaled shins after
  if (feathered) {
    const L = [{ parts: ['torso', 'pelvis', 'neck', 'upperArm', 'thigh', ...(hasTail ? TAIL_PARTS : [])], pattern: 'feathers', cell: r3(0.05 * k), contrast: 0.14 },
      { parts: ['cranium'], run: [0, 0.45], pattern: 'feathers', cell: r3(0.028 * k), contrast: 0.12 }];
    if (cover?.kind === 'scales') L.push({ parts: ['shin', 'meta'], pattern: 'scales', cell: r3(0.03 * k), contrast: 0.16 });
    return L;
  }
  // FUR: the coat's lie in tufts down the body and limbs, the tail's longer; the head's short (the muzzle bare)
  // FUR: the coat is its tufts (locks, shapes that break the outline); nothing painted under them
  if (cover?.kind === 'fur' || cover?.kind === 'quills') return [];
  // CHITIN: plates ringed round the body and every limb, a lip over a seam at each; the head's few large plates
  if (cover?.kind === 'chitin') return [{ parts: ['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shin', 'meta', 'upperArm2', 'foreArm2'], pattern: 'segments', cell: r3(0.07 * k), contrast: 0.14 },
    { parts: ['cranium'], pattern: 'plates', cell: r3(0.05 * k), contrast: 0.12 }];
  if (!cover || cover.kind !== 'scales') return reptileHead ? [{ parts: ['cranium', 'jaw'], pattern: 'plates', cell: r3(0.03 * k), contrast: 0.14 }] : [];
  const where = new Set(cover.where), all = where.has('belly'), L = [];
  const limbs = [...(all || where.has('forearm') ? ['foreArm', 'upperArm', 'hand'] : []), ...(all || where.has('thigh') ? ['thigh'] : []), ...(all || where.has('shin') ? ['shin', 'meta'] : []), ...(hasTail && (all || where.has('tail')) ? TAIL_PARTS : [])];
  if (all) L.push({ parts: ['torso', 'pelvis', 'neck'], pattern: 'scales', cell: r3(0.055 * k), contrast: 0.14 });
  if (limbs.length) L.push({ parts: limbs, pattern: 'scales', cell: r3(0.045 * k), contrast: 0.16 });
  if (all) L.push({ parts: ['torso', 'neck', 'pelvis'], t: [0, 0.3], pattern: 'bands', cell: r3(0.07 * k), contrast: 0.18 });
  if (reptileHead) L.push({ parts: ['cranium', 'jaw'], pattern: 'plates', cell: r3(0.03 * k), contrast: 0.14 });
  return L;
}

function adornOf({ kit, mirrored, mended }, k, groups) {
  const L = groups.leather, out = [];
  const sides = (S) => (mirrored ? ['R', 'L'] : [S]);
  for (const piece of kit) {
    if (piece === 'belt') out.push({ id: 'belt', mode: 'shell', part: 'pelvis', s: [1.4, 1.85], t: 'wrap', nt: 14, ns: 2, mugen: r3(0.02 * k), thick: r3(0.014 * k), group: L,
      signature: { kind: 'buckle', w: r3(0.06 * k), h: r3(0.05 * k), bar: r3(0.01 * k), standoff: r3(0.01 * k), group: L } });
    if (piece === 'baldric') out.push({ id: 'baldric', mode: 'strap', part: 'torso', path: [[3.6, 2.2, 'R'], [3.2, 1.2, 'R'], [2.5, 0.45, 'R'], [1.9, 0.05, 'R'], [1.4, 0.5, 'L'], [0.8, 1.3, 'L'], [0.4, 2.0, 'L']], width: r3(0.06 * k), thick: r3(0.01 * k), mugen: r3(0.03 * k), group: L, rad: r3(0.05 * k),
      signature: mended ? { kind: 'studs', r: r3(0.008 * k), h: r3(0.004 * k), count: 5, from: 2, m: 6, group: 'Stitch' } : { kind: 'ring', R: r3(0.04 * k), r: r3(0.009 * k), lean: [0, 0.4, 0], standoff: r3(0.02 * k), m: 12, rm: 6, group: L } });
    if (piece === 'satchel' || piece === 'satchels') for (const [S, sz] of piece === 'satchels' ? [['R', 1], ['L', 0.8]] : [['R', 1]]) out.push({ id: `satchel${S}`, mode: 'shell', part: 'pelvis', side: S, s: [0.8, 1.3], t: [1.6, 2.2], nt: 4, ns: 2, mugen: r3(0.02 * k), thick: r3(0.008 * k), group: L,
      signature: { kind: 'pack', w: r3(0.2 * k * sz), h: r3(0.2 * k * sz), d: r3(0.09 * k * sz), lift: 0, chamfer: r3(0.03 * k * sz), group: 'Satchel' } });
    if (piece === 'pack' || piece === 'quiver') out.push({ id: piece, mode: 'shell', part: 'torso', s: [1.6, 2.6], t: [3.2, 4], nt: 4, ns: 2, mugen: r3(0.03 * k), thick: r3(0.01 * k), group: L,
      signature: piece === 'pack' ? { kind: 'pack', w: r3(0.36 * k), h: r3(0.38 * k), d: r3(0.16 * k), lift: 0, chamfer: r3(0.06 * k), group: 'Satchel' } : { kind: 'pack', w: r3(0.12 * k), h: r3(0.45 * k), d: r3(0.1 * k), lift: 0, chamfer: r3(0.03 * k), group: 'Satchel' } });
    if (piece === 'wraps') for (const S of ['R', 'L']) out.push({ id: `wrap${S}`, mode: 'band', part: `foreArm${S}`, s: [1.25, 1.75], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.008 * k), thick: r3(0.006 * k), group: 'Wrap',
      signature: { kind: 'ribbon', k: 0, j: 1, spine: [[0, 0, 0], mul([0.01, -0.02, -0.04], k), mul([0.015, -0.03, -0.09], k)], width: r3(0.022 * k), thick: r3(0.002 * k), tip: 'swallow', group: 'Wrap' } });
    if (piece === 'bracers') for (const S of sides('R')) out.push({ id: `bracer${S}`, mode: 'shell', part: `foreArm${S}`, s: [0.62, 1.2], t: 'wrap', mugen: r3(0.012 * k), thick: r3(0.01 * k), group: L, rigid: true,
      signature: { kind: 'studs', r: r3(0.008 * k), h: r3(0.004 * k), count: 3, m: 6, group: L } });
    if (piece === 'pauldron') for (const S of sides('L')) out.push({ id: `pauldron${S}`, mode: 'shell', part: 'torso', over: [`upperArm${S}`], side: S, s: [2.55, 3.5], t: [1.1, 2.9], nt: 10, mugen: r3(0.014 * k), thick: r3(0.014 * k), group: 'Metal', rigid: true, rad: r3(0.09 * k), support: 3.5, ramp: 1.2,
      signature: { kind: 'boss', side: S, t: 1.5, tol: 0.2, r: r3(0.05 * k), h: r3(0.03 * k), m: 12, rim: 0.55, group: 'Emblem' } });
    if (piece === 'medallion') out.push({ id: 'cord', mode: 'shell', part: 'neck', s: [0.05, 0.3], t: 'wrap', nt: 14, ns: 2, mugen: r3(0.012 * k), thick: r3(0.006 * k), group: L,
      signature: { kind: 'medallion', k: 0, j: 0, anchor: [0, 0.01, -0.01], links: 5, len: r3(0.04 * k), clear: r3(0.05 * k), link: r3(0.005 * k), surfaces: ['torso'], out: [0, 1, 0], drop: r3(0.06 * k), dropClear: r3(0.06 * k), face: [0, 1, 0.15], r: r3(0.05 * k), h: r3(0.016 * k), m: 14, rim: 0.6, group: 'Emblem', beneath: ['torso'] } });
  }
  return out;
}

/** a body is never darker than this L* (CIELCh): a black coat drawn on the stage's dark backdrop is drawn as a deep
 * blue-black or brown-black that holds its outline, as a painter draws black fur (its hue and chroma kept) */
export const BODY_MIN_L = 24;
/** a coat this light (L*) or lighter has its skin's pattern drawn in dark lines */
export const PALE_COAT = 62;
export function legible(hex) { const [L, C, H] = hexLch(hex); return L >= BODY_MIN_L ? hex : lchHex(BODY_MIN_L, C, H); }
/** the eye is the face's one saturated accent: a people's eye colours (ancestry.js's eyes lines), the one whose hue
 * stands furthest from the coat's chosen (deterministic, no dice: the same coat, the same eyes) */
export const EYE_ACCENTS = Object.freeze({ feline: ['#8fe8c2', '#e8c23a', '#a8d84a'], lupine: ['#e0a030', '#d8e4ec'], draconic: ['#e0a830', '#c8ccd2', '#d8502a'], avian: ['#f2c422', '#e8742a'], ursine: ['#9a6428'] });
function eyeAccent(lineage, coat) {
  const opts = EYE_ACCENTS[lineage]; if (!opts) return null;
  const hc = hexLch(coat)[2], away = (hex) => { const d = Math.abs(hexLch(hex)[2] - hc) % 360; return Math.min(d, 360 - d); };
  return opts.reduce((best, x) => (away(x) > away(best) ? x : best));
}
const HEAD_TONES = Object.freeze({ Skull: 0, Body: 0, Jowl: 0.04, Jaw: 0.1, Snout: 0.12, Lip: 0.08, Brow: -0.12, Pad: -0.05, Lids: -0.08, Ears: -0.06, Fur: 0.03, FurAlt: -0.05, Folds: 0.04, Web: 0.04, Wrinkles: -0.18, Scales: -0.04, ScalesAlt: 0.04 });

function creature(sheet, title) {
  const f = sheet.facets, hints = sheet.ancestry.plan || {};
  const k = r3((HEIGHT[f.build] * AGE_SCALE[f.age]) / 2.0), g = GIRTH[f.build];
  const legs = hasDerive(sheet, 'legs = digitigrade') ? 'digitigrade' : 'plantigrade';
  const head = headOf(sheet);
  const cover = coverOf(hints.cover, k, !!hints.tail && !!TAILS[hints.tail], hints.tail, { sheet, reptile: !!head && HEAD_LIBRARY[head.id].family === 'reptile' });
  const topo = topologyOf(sheet);
  // the shapes that break the outline: the coat's (fur, quills), a bird-kin's feathers, a crest of spines when the sheet says so
  const feathered = f.ancestry === 'avian' || head.id === 'beaked';
  const shapes = [...cover.locks, ...(hints.cover?.kind === 'fur' && head && HEAD_LIBRARY[head.id].family === 'mammal' ? cheekLocks(k) : []), ...(feathered ? featherLocks(k, { crest: noted(sheet, /feathers instead of hair: a crest|swept-back plumes/) }) : []), ...(noted(sheet, /crest of spikes down the nape and spine/) ? spineLocks(k) : [])];
  const body = biped({ k, g, legs, tail: hints.tail, fingers: FINGER_COUNT[f.ancestry] || 4, claws: hints.claws, ruff: cover.ruff, pole: f.pole, build: f.build, ...topo });
  const stance = stanceOf(sheet);
  const { dials, rig, clips } = dialsAndRig(body, stance);
  const skin = legible(sheet.ancestry.colours.Skin), reptile = head && HEAD_LIBRARY[head.id].family === 'reptile';
  const shadowSide = sheet.reading.reads !== 'light';
  const groups = { leather: 'Leather' };
  const palette = {
    Torso: skin, Pelvis: skin, Neck: skin, Tail: skin, Legs: shade(skin, -0.03), Feet: shade(skin, -0.06), Arms: shade(skin, -0.03),
    Hands: reptile ? shade(skin, -0.08) : '#4a4440', Claws: reptile ? '#efe9d8' : '#3a3430',
    Fur: shade(skin, 0.04), FurAlt: shade(skin, -0.06), Scales: shade(skin, -0.05), ScalesAlt: shade(skin, 0.05), Chitin: shade(skin, -0.05), ChitinAlt: shade(skin, 0.06),
    Pad: '#4a4440', PadInner: '#3a3530', Crease: shade(skin, -0.25), Flight: shade(skin, -0.12), FlightAlt: shade(skin, 0.06),
    Leather: shadowSide ? '#6b5a4a' : '#6e4a2e', Satchel: shadowSide ? '#7a6a58' : '#7d5634', Stitch: '#d8d0bc', Wrap: '#d8d0bc', Metal: '#8e9196',
    Emblem: f.archetype === 'ruler' ? '#d5aa3a' : '#b9a46a',
  };
  const heads = [{ name: 'head', plan: (() => {
    // the skin's tones over the head's own neutral reading, but for the groups that are not skin (a beak's horn)
    const own = HEAD_LIBRARY[head.id].keep || [];
    const iris = eyeAccent(f.ancestry, skin);
    const hp = headPlan(head.id, { palette: { ...Object.fromEntries(Object.entries(HEAD_TONES).filter(([grp]) => grp in headPlan(head.id).palette && !own.includes(grp)).map(([grp, t]) => [grp, shade(skin, t)])), ...(iris ? { Iris: iris } : {}) } });
    // scale the head to the body: a head authored in metres (no units) has its 'world' sweeps in those same metres,
    // so they become head-space and scale with it (else the dragon's horns float off a scaled skull)
    if (!hp.units) hp.ornaments = (hp.ornaments || []).map((o) => (o.space === 'world' ? { ...o, space: 'head' } : o));
    hp.units = { scale: r3((hp.units?.scale ?? 1) * k), offset: hp.units?.offset ?? [0, 0, 0] };
    // a stand-in is a neutral skull: the species' own ornaments (horns, a crest) are not the people's
    if (head.standIn) { hp.ornaments = hp.ornaments.filter((o) => o.kind !== 'sweep' || o.name === 'nose'); delete hp.midline; }
    // a coat's CHEEKS are its clumps (cheekLocks, on the body's cranium), not the head's field of tiles below the cheek row
    if (hints.cover?.kind === 'fur' && hp.regions?.tiles) { const tiles = hp.regions.tiles.filter((T) => !(T.part === 'cranium' && T.t[0] >= CHEEK_ROW)); if (tiles.length) hp.regions.tiles = tiles; else delete hp.regions.tiles; }
    if (['seasoned', 'elder'].includes(f.age)) hp.regions.wrinkles = hp.regions.wrinkles.map((w) => (w.drive.cheekBunch || w.drive.browFurrow ? { ...w, rest: f.age === 'elder' ? 0.8 : 0.55 } : w));
    return hp; })(), expression: expressionOf(sheet), on: 'neckTop', bind: { cranium: 'head', jaw: 'jaw' } }];
  const plan = {
    schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y', note: `metres; ${title}, soles on z = 0` },
    symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right authored, left mirrored in x with R ↔ L renamed' },
    // the ring family the designed creatures' trunks are built in (ring12: round, not a box), an e a little past round
    style: { slots: 'ring12', e: 2.2 },
    joints: body.joints, segments: body.segments, heads, details: body.details, dials, rig, clips,
    body: { refine: [{ parts: ['upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'thighR', 'thighL', 'shinR', 'shinL', 'metaR', 'metaL', ...(body.hasTail ? [0, 1, 2, 3, 4].map((i) => `tail${i}`) : [])] }, { parts: ['torso'], slots: false }],
      volume: [['torso', { 'front*': 0.8, 'side*': 0.4 }, { st3: 1, st2: 0.4 }, r3(0.03 * k * g)], ...['R', 'L'].map((S) => [`thigh${S}`, { front: 1, 'front*': 0.7 }, { st1: 1, st0: 0.3 }, r3(0.025 * k * g)])],
      ...(cover.tiles.length ? { tiles: cover.tiles } : {}), ...(shapes.length ? { locks: shapes } : {}),
      pads: ['R', 'L'].flatMap((S) => [{ part: `hand${S}`, s: 1.3, toward: { flex: [`hand${S}`, `fingerB1${S}`], drive: { grip: 45 } }, r: 0.5 }, { part: `toes${S}`, s: 1.0, toward: { world: [0, 0, -1] }, r: 0.55 }]) },
    adorn: adornOf(kitOf(sheet), k, groups),
    // a pale coat's pattern is drawn in darker lines (light on light does not read)
    ...(() => { const sk = skinOf(hints.cover, k, { reptileHead: reptile, hasTail: body.hasTail, feathered }); return sk.length ? { skin: hexLch(skin)[0] >= PALE_COAT ? sk.map((R) => ({ ...R, lines: 'dark' })) : sk } : {}; })(),
    palette,
  };
  return { plan, k, legs, head, stance, cover, kit: kitOf(sheet), topo, shapes };
}


// ══════════ the hero door ══════════

export const BUILD_TUNE = Object.freeze({ lithe: { shoulders: 0.92, waist: 0.92, hips: 0.95 }, canonical: {}, heroic: { shoulders: 1.12, legs: 1.05, depth: 1.05 }, stout: { stature: 0.92, waist: 1.12, depth: 1.1 }, brute: { shoulders: 1.2, waist: 1.1, depth: 1.15, upperArm: 1.2, forearm: 1.2, thigh: 1.15 } });
const HAIR_STYLE = Object.freeze({ male: { bound: 'taper', mid: 'crop', free: 'swept' }, female: { bound: 'bun', mid: 'bob', free: 'long' } });
const WAVE = Object.freeze({ straight: 0.6, wavy: 1.2, curly: 1.5, coily: 1.6 });
/** the anime head's own vocabulary for the same readings: its hair families, and its curl as crown volume (it draws
 * clumps, not a wave) */
const ANIME_HAIR_STYLE = Object.freeze({ male: { bound: 'short', mid: 'short', free: 'long' }, female: { bound: 'hime', mid: 'bob', free: 'long' } });
const ANIME_VOLUME = Object.freeze({ straight: null, wavy: 1.05, curly: 1.1, coily: 1.15 });
/** the western face-at-rest derives as the anime head's expression amounts (anime-form.js ANIME_EXPRESSION_DEFS): its
 * brow is one attitude (+ the outer end up, set and hard; - the inner end up, open or worried), its mouth a smile, its
 * eyes a lid (aperture is the sculpt's lid cover there, so only a narrowing lands, as a little blink) */
function animeExpression(d) {
  const has = (x) => d.includes(x), out = {};
  const brow = has('expression.browTilt +') ? 0.5 : has('expression.browTilt -') ? -0.5 : has('expression.browRaise +') ? -0.25 : has('expression.browRaise -') ? 0.25 : 0;
  if (brow) out.brow = brow;
  if (has('expression.mouthCorner +')) out.smile = 0.4;
  if (has('expression.aperture -')) out.blink = 0.15;
  return out;
}
/** eras whose people wear their era's clothes and kit (outfit.js ERA_GEAR, ERA_LOOKS) in place of the stock jerkin and
 * the ranger's kit: the clothes an outfit build in the look's card, the role's gear as the look wears it over them */
export const KIT_ERAS = Object.freeze(Object.keys(ERA_GEAR));

/** a modern or future person's clothes: its rolled look's card at ornament 0, the role's gear worn over it in the
 * outfit's palette (the setting's tones as its base and secondary, the look's gear colour its leather) */
function eraOutfit(sheet, f, era, tones, look) {
  const pieces = lookGear(ERA_GEAR[era], look, f.role).map(({ why: _w, ...p }) => p);
  const own = outfitPalette(sheet, sheet.ancestry.colours.Skin);
  const palette = { ...own, ...(tones.Top ? { base: tones.Top } : {}), ...(tones.Bottom ? { secondary: tones.Bottom } : {}), leather: look.gear };
  return { type: 'outfit', style: look.style, dials: { ornament: 0 }, ...(pieces.length ? { pieces, intent: { palette } } : {}) };
}

/** when cloth reads as the skin it is worn over: within 25 L* of it and within 35° of its hue (timber and soil ramps
 * are skin-hued), or within 18 L* whatever its hue (outfit.js outfitPalette's step); a grey (chroma under 8) has no hue */
const readsAsSkin = (hex, skin) => {
  const [L, C, H] = hexLch(hex), [Ls, , Hs] = hexLch(skin), dH = Math.abs(((H - Hs + 540) % 360) - 180);
  return Math.abs(L - Ls) < 18 || (C >= 8 && dH < 35 && Math.abs(L - Ls) < 25);
};

/**
 * The clothes' tones in a game's setting (none without one: the stock clothed body, as before). From its RAMPS: the top
 * from the ramp the archetype falls on, the bottom from the one the role does (so a cast in one world wears its colours,
 * not one shirt), each from its middle stop, a stop lighter or darker as the sheet's palette derives say, then walked
 * along the ramp, away from the skin, until it no longer reads as skin; a ramp with no such stop gives way to the next.
 * A world with no ramps (a room kit), or none that clears the skin: the outfit's own palette by archetype (outfit.js).
 */
function settingTones(sheet, f, d) {
  if (!sheet.setting) return {};
  const skin = sheet.ancestry.colours.Skin, ramps = sheet.setting.ramps ?? [], own = () => outfitPalette(sheet, skin);
  const away = hexLch(skin)[0] > 50 ? -1 : 1;
  const shift = (group) => (d.includes(`palette.${group} +`) ? 1 : d.includes(`palette.${group} -`) ? -1 : 0);
  const tone = (r, k) => {
    let i = clamp(Math.floor(r.stops.length / 2) + k, 0, r.stops.length - 1);
    while (readsAsSkin(r.stops[i], skin) && i + away >= 0 && i + away < r.stops.length) i += away;
    return readsAsSkin(r.stops[i], skin) ? null : r.stops[i];
  };
  // (the bottom a clear step from the top too: 10 L*, or the two read as one garment)
  const from = (start, k, not = null) => { for (let j = 0; j < ramps.length; j++) { const t = tone(ramps[(start + j) % ramps.length], k); if (t && !(not && Math.abs(hexLch(t)[0] - hexLch(not)[0]) < 10)) return t; } return null; };
  const top = ARCHETYPE_IDS.indexOf(f.archetype) % Math.max(1, ramps.length);
  const bottom = ramps.length > 1 ? (top + 1 + (Object.keys(ROLES).indexOf(f.role) % (ramps.length - 1))) % ramps.length : top;
  const Top = from(top, shift('Top')) ?? own().base;
  // no ramp gives a bottom apart from the top: the top's own hue a tonal step darker or lighter, whichever clears the
  // skin, so the pair stays in the world's colours
  const [Lt, Ct, Ht] = hexLch(Top);
  const tonal = [Lt - 22, Lt + 22, Lt + 34].filter((L) => L >= 8 && L <= 92).map((L) => lchHex(L, Ct * 0.8, Ht)).find((t) => !readsAsSkin(t, skin));
  return { Top, Bottom: from(bottom, shift('Bottom'), Top) ?? tonal ?? own().secondary };
}

function hero(sheet) {
  const f = sheet.facets, d = Object.values(sheet.derives).flat();
  // the game's tradition is the body's rule (setting.js): an anime game's person wears the anime head, its proportions
  // and the character light, and the sheet's graphic-face derives land on its sculpt
  const anime = sheet.setting?.tradition === 'anime', era = sheet.setting?.era;
  const tune = { ...BUILD_TUNE[f.build] };
  // a thread node's growth (thread.js) is lowered as amounts below, never as a step per dial over the adult cast
  const grown = sheet.growth ?? null, fromGrowth = new Set(grown?.keys ?? []);
  for (const x of d.map(readDerive).filter((r) => r.family === 'tune' && !fromGrowth.has(dialKey(r)))) tune[x.key] = r3(clamp((tune[x.key] ?? 1) + (x.dir === '+' ? 0.06 : -0.06), 0.85, 1.15));
  if (f.age === 'elder') tune.stature = r3((tune.stature ?? 1) * 0.97);
  // a youth is its share of adult height, its head larger for that height (the child wears the child build instead)
  if (grown?.stature && f.age !== 'child') {
    tune.stature = r3(clamp((tune.stature ?? 1) * grown.stature, 0.85, 1.15));
    tune.head = r3(clamp((tune.head ?? 1) * (grown.head / grown.stature), 0.85, 1.15));
  }
  const expression = anime ? animeExpression(d) : {};
  if (!anime) for (const x of d.map(readDerive).filter((r) => r.family === 'expression')) {
    const [lo, hi] = CHANNEL_RANGES[x.key], mid = x.key === 'aperture' ? 1 : 0;
    expression[x.key] = r3(mid + (x.dir === '+' ? (hi - mid) : (lo - mid)) * 0.5);
  }
  const sculpt = {};
  if (anime) for (const x of d.map(readDerive).filter((r) => r.family === 'sculpt')) {
    const mid = ANIME_SCULPT.DEFAULT[x.key], [lo, hi] = ANIME_SCULPT.RANGES[x.key];
    sculpt[x.key] = r3(mid + (x.dir === '+' ? (hi - mid) : (lo - mid)) * 0.5);
  }
  const gesture = d.map(readDerive).find((r) => r.family === 'gesture')?.word;
  const texture = (sheet.notes.hair || []).map((n) => n.line.match(/^(straight|wavy|curly|coily) hair$/)?.[1]).find(Boolean) || 'straight';
  const kept = f.order < 1 / 3 ? 'bound' : f.order > 2 / 3 ? 'free' : 'mid';
  const style = (anime ? ANIME_HAIR_STYLE : HAIR_STYLE)[f.pole][kept];
  const hair = anime ? { style, ...(ANIME_VOLUME[texture] ? { volume: ANIME_VOLUME[texture] } : {}), ...(f.age === 'elder' ? { length: 0.85 } : {}) }
    : { style, wave: WAVE[texture], ...(f.age === 'elder' ? { length: 0.8 } : {}) };
  const tones = settingTones(sheet, f, d), eraKit = KIT_ERAS.includes(era), look = eraKit ? eraLookOf(sheet) : null;
  // an armour look wears its hardsuit (bareheaded on the anime head) in place of clothes and kit
  const armor = look?.armor ? lookArmor(look, { anime }) : null;
  const spec = {
    // a child is its pole's child build (a child's radii on her or his own landmarks); the bare 'child' word kept adult radii and the male head
    cast: f.age === 'child' ? { pole: f.pole, build: 'child' } : f.pole,
    ...(anime ? { head: 'anime', proportions: 'anime' } : {}),
    ...(Object.keys(tune).length ? { tune } : {}),
    ...(Object.keys(expression).length ? { expression } : {}),
    ...(Object.keys(sculpt).length ? { sculpt } : {}),
    ...(gesture && gesture !== 'rest' ? { gesture } : {}),
    hair,
    palette: { Skin: sheet.ancestry.colours.Skin, ...(sheet.ancestry.colours.Hair ? { Hair: f.age === 'elder' ? shade(sheet.ancestry.colours.Hair, 0.45) : sheet.ancestry.colours.Hair } : {}), ...tones, ...(look ? lookTones(look) : {}), ...(armor?.palette ?? {}) },
    ...(armor ? { adorn: armor.adorn } : eraKit ? { outfit: eraOutfit(sheet, f, era, tones, look) } : { detail: 'clothed' }),
    // the era's silhouette (stylism/): a modern world grounded and boxy, a future one heightened and sleek
    ...(look?.stylism ? { stylism: look.stylism } : {}),
    ...(['flanker', 'ranged', 'frontline'].includes(f.role) && !eraKit ? { adorn: 'ranger' } : {}),
  };
  return { spec, style, texture, anime, eraKit, era, look };
}

// ══════════ the ledger and the thesis ══════════

const CREATURE_AT = { frame: 'plan.joints, plan.segments', structure: 'plan.heads[0] (a library head)', colouring: 'plan.palette, the head palette', cover: 'plan.body.tiles', ornament: 'plan.details (claws), the head ornaments',
  rest: 'plan.heads[0].expression', eyes: 'plan.heads[0].expression', stance: 'the lean dial, the clips', silhouette: 'the form and the kit', dress: 'plan.adorn', hair: null, palette: 'plan.palette', wear: 'the head wrinkles at rest' };
const HERO_AT = { frame: 'spec.cast, spec.tune', structure: null, colouring: 'spec.palette', cover: null, ornament: null, rest: 'spec.expression', eyes: 'spec.expression', stance: 'spec.gesture', silhouette: 'spec.tune, spec.adorn', dress: 'spec.detail, spec.adorn', hair: 'spec.hair', palette: 'spec.palette', wear: null };

function ledgerOf(sheet, door, built) {
  const rows = [];
  for (const [ch, notes] of Object.entries(sheet.notes)) for (const n of notes) {
    let at = (door === 'creature' ? CREATURE_AT : HERO_AT)[ch];
    if (door === 'hero' && built.anime && (ch === 'rest' || ch === 'eyes')) at = 'spec.expression, spec.sculpt (the anime head\'s graphic face)';
    // a designed dress lands where it is worn: the creature's outfit, the hero's outfit build (its cut and its pieces)
    if (built.outfit && (ch === 'dress' || ch === 'silhouette')) at = door === 'creature' ? (ch === 'dress' ? 'plan.outfit' : 'the form and plan.outfit') : (ch === 'dress' ? 'spec.outfit (the cut and its pieces)' : 'spec.tune, spec.outfit.pieces');
    let pending = at ? null : door === 'hero' && ['cover', 'ornament'].includes(ch) ? 'the hero grammar has no pass for it' : ch === 'wear' ? 'no wear dials yet' : 'no landing in this door yet';
    if (door === 'creature') {
      if (ch === 'cover' && !built.cover.tiles.length && !built.cover.locks.length) { at = null; pending = 'no cover hint for this people'; }
      if (ch === 'wear' && !['seasoned', 'elder'].includes(sheet.facets.age)) { at = null; pending = 'no wear dials yet'; }
      if (ch === 'structure' && built.head.standIn) { at = null; pending = `no library head for ${sheet.facets.ancestry} yet: the ${built.head.id} head stands in; draw one from the nearest (creature-heads)`; }
      if (ch === 'ornament' && /horns|antennae|tusks|wings|crest|frill/.test(n.line) && !(built.head?.id === 'dragon' && /horns|crest/.test(n.line)) && !(built.head?.id === 'mandibled' && /antennae/.test(n.line))) { at = null; pending = 'an ornament the library head and the body plan do not carry yet'; }
      if (ch === 'silhouette' && /wings|crest|frill|a pair/.test(n.line) && !(built.topo?.wings && /wings on the arms/.test(n.line)) && !(/crest of spikes/.test(n.line) && built.shapes?.some((L) => L.id === 'spines'))) { at = null; pending = 'not in the body plan yet (folded wings, a crest, a familiar)'; }
      if (built.topo?.wings && /wings on the arms/.test(n.line)) at = 'plan.segments wingPrim1-3, wingSec1-2 (flight feathers on the hand and forearm)';
      if (built.topo?.arms2 && /second pair of arms/.test(n.line)) at = 'plan.segments upperArm2, foreArm2, hand2 (rigged)';
    }
    rows.push({ channel: ch, line: n.line, from: n.from, ...(at ? { at } : { pending }) });
  }
  // the era's clothes and the role's kit in it: said, so the ledger shows where the dress came from
  if (built.eraKit && !built.outfit) rows.push({ channel: 'dress', line: `the ${sheet.facets.role}'s ${built.era} clothes and kit: the ${built.look.id} look`, from: `setting.era.${built.era}`, at: built.look.armor ? 'spec.adorn (the look\'s hardsuit)' : 'spec.outfit (the look\'s card and the role\'s pieces), spec.stylism (the era\'s silhouette)' });
  return rows;
}

function thesisOf(sheet, door, built) {
  const sil = derivesOf(sheet, ['silhouette']).map(readDerive).find((r) => r.family === 'silhouette')?.word || 'column';
  const iconic = (sheet.notes.cover || sheet.notes.ornament || sheet.notes.dress || [])[0]?.line || 'none named';
  if (door === 'hero') return `${sil} · biped, ${sheet.facets.build} · a ${sheet.ancestry.kind === 'human' ? 'human' : 'near-human'} face · ${iconic} · ${Math.round(HEIGHT[sheet.facets.build] * AGE_SCALE[sheet.facets.age] * 100) / 100} m`;
  const head = built.head.standIn ? `head pending (the ${built.head.id} stands in)` : `${HEAD_LIBRARY[built.head.id]?.head ?? 'a skull of its own bones'} (${built.head.id}${built.head.provisional ? ', provisional' : ''})`;
  return `${sil} · ${built.legs} biped${built.stance.lean > 8 ? ', leaning forward' : ''} · ${head} · ${iconic} · ${Math.round(built.k * 200) / 100} m`;
}

/** the choices a first reading made, flat, for a contrast pair */
function choicesOf(p) {
  const c = { door: p.door, thesis: p.thesis };
  if (p.door === 'creature') {
    const plan = p.create.spec.plan, h = plan.heads[0];
    Object.assign(c, { head: h?.plan.name, lean: p.after.find((x) => x.path === '/dials/lean')?.value, kit: plan.adorn.map((a) => a.id).join(', '),
      cover: (plan.body.tiles || []).map((t) => t.id).join(', ') || 'none', tail: plan.segments.some((x) => x.name === 'tail') ? 'yes' : 'no',
      expression: Object.entries(h?.expression || {}).map(([kk, v]) => `${kk} ${v}`).join(', ') || 'neutral', leather: plan.palette.Leather, emblem: plan.palette.Emblem });
  } else {
    const sp = p.create.spec;
    Object.assign(c, { cast: sp.cast, tune: JSON.stringify(sp.tune || {}), expression: JSON.stringify(sp.expression || {}), gesture: sp.gesture || 'none', hair: JSON.stringify(sp.hair), adorn: sp.adorn || 'none' });
  }
  return c;
}

/**
 * A CONTRAST PAIR: the same roll twice, the second with one facet changed, and the choices that moved. A pair teaches
 * the mapping from a note to a choice; one example would teach a destination. `roll` is rollEgocube's arguments.
 */
export function contrastPair(roll, change, rollEgocube) {
  const a = rollEgocube(roll), b = rollEgocube({ ...roll, facets: { ...(roll.facets || {}), ...change } });
  const ca = choicesOf(planFromSheet(a)), cb = choicesOf(planFromSheet(b));
  const moved = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].filter((k) => ca[k] !== cb[k]).map((k) => ({ choice: k, a: ca[k], b: cb[k] }));
  return { change, a: { facets: a.facets, reads: a.reads }, b: { facets: b.facets, reads: b.reads }, moved, note: 'A first reading of each sheet, side by side: how one facet moves the choices, not what to choose. Neither is a body to copy.' };
}

/** the humanity a creature is CLOTHED at (every designed creature in the trials, insect-kin at 0.34 among them, wore
 * cloth); below it, ADORNED */
export const CLOTHED_H = 0.25;

/** `dress: 'designed'`: the outfit DESIGNED from the sheet (outfit.js: its archetype, role, order, motivation, age and
 * lineage, the visual-interest laws run over it) in place of the stock kit by role. A creature is CLOTHED from the cut
 * at humanity CLOTHED_H and over, else ADORNED, on a body DRAWN for its target (adornFromSheet, creature-drawn.js): its frame shows; a person wears the cut as the hero's outfit
 * build. Absent, the kit as before. */
export function planFromSheet(sheet, { title, dress } = {}) {
  const door = sheet.ancestry.door;
  const name = title || `${sheet.facets.ancestry} ${sheet.facets.role}, ${sheet.reading.reads === 'shadow' ? sheet.reading.shadow : `the ${sheet.facets.archetype}`} (egocube seed ${sheet.seed})`;
  if (door === 'creature') {
    const built = creature(sheet, name);
    // a people near the beast is adorned, not clothed: its frame shows (outfit.js adornFromSheet); one with enough of a
    // person in it is clothed from the cut, which reads its anatomy (breeches over furred legs, a short coat over a tail,
    // no sleeves on wings, a kilt over plated legs)
    if (dress === 'designed') { const coat = legible(sheet.ancestry.colours.Skin), { outfit, laws } = sheet.facets.humanity >= CLOTHED_H ? outfitFromSheet(sheet, { coat }) : adornFromSheet(sheet, { coat }); built.plan = { ...built.plan, adorn: [], outfit, style: { ...(built.plan.style || {}), drawn: { markings: { pattern: 'both', ventral: 'panel' } } } }; built.outfit = { outfit, laws }; }
    return { door, thesis: thesisOf(sheet, door, built), create: { as: 'creature', title: name, spec: { plan: built.plan } },
      after: [{ op: 'set', path: '/dials/lean', value: built.stance.lean }], ledger: ledgerOf(sheet, door, built), ...(built.outfit ? { outfit: built.outfit } : {}) };
  }
  // an UNDEAD form on the hero door (undead/tiered.js): a person's body, the form's card over it, bare and one tone
  if (sheet.ancestry.form) {
    const f = sheet.facets, tune = { ...BUILD_TUNE[f.build] };
    const spec = { form: 'tiered', cast: f.pole, ...(Object.keys(tune).length ? { tune } : {}), palette: { Skin: legible(sheet.ancestry.colours.Skin) },
      undead: { form: sheet.ancestry.form, build: f.build, seed: sheet.seed, ...(sheet.ancestry.layers?.length ? { layers: [...sheet.ancestry.layers] } : {}) } };
    const built = { spec, undead: { form: sheet.ancestry.form, build: f.build } };
    return { door, thesis: `${sheet.ancestry.reads} on the tiered body: ${UNDEAD_CARDS[variantOf(sheet.ancestry.form, f.build)].reads}`, create: { as: 'hero', title: name, spec }, after: [], ledger: ledgerOf(sheet, door, built) };
  }
  const built = hero(sheet);
  // a person, dressed by the same principles: the cut as the hero's outfit build, in place of the stock clothed body
  // (the designed dress replaces the stock clothed body and the archer's kit a role was given: its pieces are its own)
  // (an armour look keeps its hardsuit: the designed dress is cloth)
  if (dress === 'designed' && !built.look?.armor) { const { outfit, laws } = outfitFromSheet(sheet, { coat: sheet.ancestry.colours.Skin }); const { detail: _d, adorn: _a, ...spec } = built.spec; built.spec = { ...spec, outfit: heroOutfitOf(outfit) }; built.outfit = { outfit, laws }; }
  return { door, thesis: thesisOf(sheet, door, built), create: { as: 'hero', title: name, spec: built.spec, ...(built.anime ? { toon: { light: true } } : {}) }, after: [], ledger: ledgerOf(sheet, door, built), ...(built.outfit ? { outfit: built.outfit } : {}) };
}


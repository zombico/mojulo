// CHIMERA: the griffinizing dial. From `pure` (the animal's own extremities) to `chimera` (the animal grafted with what
// it should not have), the grafts come in the order they break the silhouette: horns on a hornless head, a ridge of
// plates down the back and the tail, another creature's tail, wings, and at the end a second crown and the wings at
// their widest. Each graft is made in the creature's motif (motif.js), sized against its own body, and chosen among
// its kinds by the creature's seed and motif, so two chimeras of one species differ.
//
//   chimera   pure 0 · touched 0.33 · hybrid 0.66 · chimera 1, or 0 … 1 (stylism.js reads the word)
//     ≥ 0.15  horns           (a head without them; a worn head mesh takes none)
//     ≥ 0.35  plates          (a ridge of plates nape → tail tip: they stand in for a crest, never beside one)
//     ≥ 0.5   tail            (serpent, scorpion, lion or dragon: the species' tail replaced, rooted where it was)
//     ≥ 0.66  wings           (feathered or membrane by the motif, carried half raised; a winged animal keeps its own)
//     ≥ 0.9   crown           (a second pair of horns at the brow, the wings wider)
// The grafts are new parts: they ride the skeleton's nearest bones (phase 2's rig binds them rigidly), and no joint the
// species has moves.
import { MOTIFS } from './motif.js';
import { featherWing, membraneWing } from '../fauna/makers/wing.js';

export const CHIMERA_WORDS = Object.freeze({ pure: 0, touched: 0.33, hybrid: 0.66, chimera: 1 });
export const GRAFTS = Object.freeze([['horns', 0.15], ['plates', 0.35], ['tail', 0.5], ['wings', 0.66], ['crown', 0.9]]);
const TAILS = ['serpent', 'scorpion', 'lion', 'dragon'];
// the motif leans the tail and the wing: fire and shadow and metal are a dragon's, gold and ice and spark a griffin's
const LEAN = { horn: ['dragon', 'scorpion'], bone: ['serpent', 'scorpion'], ice: ['lion', 'serpent'], crystal: ['dragon', 'serpent'], metal: ['scorpion', 'dragon'],
  flame: ['dragon', 'scorpion'], spark: ['serpent', 'lion'], toxin: ['scorpion', 'serpent'], shade: ['dragon', 'serpent'], gold: ['lion', 'dragon'] };
const FEATHERED = new Set(['gold', 'ice', 'spark']);
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const fnv = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const shade = (h, f) => (/^#[0-9a-f]{6}$/i.test(h ?? '') ? hex(rgb(h).map((x) => (f < 0 ? x * (1 + f) : x + (255 - x) * f))) : h);

/** the grafts a chimera level reaches, in order */
export const graftsAt = (c) => GRAFTS.filter(([, at]) => c >= at).map(([g]) => g);

// the trunk in the species' own units: its back cap (the rump), its length, its top over the shoulders, its side there
function trunk(Q) {
  const T = Q.torso, ys = T.map((st) => st.at[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), L = y1 - y0, b = Q.bulk ?? 1;
  const fr = (r) => (Array.isArray(r) ? r[1] : r) * b, sd = (r) => (Array.isArray(r) ? r[0] : r) * b;
  const sh = Q.joints?.shoulder?.[1] ?? y1 - 0.2 * L, near = T.reduce((p, st) => (Math.abs(st.at[1] - sh) < Math.abs(p.at[1] - sh) ? st : p), T[0]);
  const rump = Q.torsoCaps?.back ?? [0, y0 - 0.1 * L, T[0].at[2]];
  return { L, rump, shoulder: { y: near.at[1], top: near.at[2] + fr(near.r), side: sd(near.r) } };
}

/** A graft tail: stations [x, y, z, r] and a tip, in the species' units, rooted at the old tail's root. */
export function graftTail(kind, root, L, r0) {
  const st = [], tip = [];
  if (kind === 'scorpion') {
    // an arch up and over the back, segmented, ending in a stinger
    const rho = 0.42 * L, C = [0, root[1] - 0.04 * L, root[2] + rho];
    for (let i = 0; i <= 10; i++) { const t = i / 10, phi = (t * 205 * Math.PI) / 180;
      st.push([0, C[1] - rho * Math.sin(phi), C[2] - rho * Math.cos(phi), r0 * (1 - 0.45 * t) * (i % 2 ? 0.82 : 1)]); }
    const e = st.at(-1), p = st.at(-2), d = [0, e[1] - p[1], e[2] - p[2]], n = Math.hypot(d[1], d[2]) || 1;
    for (const [s, k] of [[0, 1.5], [0.1, 1.7], [0.22, 0.9], [0.34, 0.25]]) tip.push([0, e[1] + (d[1] / n) * s * L, e[2] + (d[2] / n) * s * L, r0 * 0.55 * k]);
  } else if (kind === 'serpent') {
    // a long whip back and down in an S, rising at the end into a spade
    for (let i = 0; i <= 10; i++) { const t = i / 10;
      st.push([0, root[1] - 1.35 * L * t, Math.max(0.12 * L, root[2] - 0.55 * L * t + 0.18 * L * Math.sin(2.2 * Math.PI * t)), r0 * (1 - 0.8 * t)]); }
    const e = st.at(-1);
    for (const [s, k] of [[0, 0.2], [0.06, 0.55], [0.13, 0.5], [0.2, 0.05]]) tip.push([0, e[1] - s * L, e[2] + 0.4 * s * L, r0 * k]);
  } else if (kind === 'lion') {
    // a long thin tail hanging in a curve, the end lifted, a tuft
    for (let i = 0; i <= 7; i++) { const t = i / 7;
      st.push([0, root[1] - 0.75 * L * t, Math.max(0.18 * L, root[2] - 0.75 * L * Math.sin(Math.PI * 0.5 * t) + 0.2 * L * t * t), r0 * 0.55 * (1 - 0.4 * t)]); }
    const e = st.at(-1);
    for (const [s, k] of [[0, 0.6], [0.06, 1.3], [0.13, 0.9]]) tip.push([0, e[1] - s * L, e[2] + 0.3 * s * L, r0 * k]);
  } else {
    // a dragon's: thick at the root, long, carried level then lowered, tapering to a point
    for (let i = 0; i <= 9; i++) { const t = i / 9;
      st.push([0, root[1] - 1.25 * L * t, Math.max(0.1 * L, root[2] - 0.15 * L * t - 0.35 * L * t * t), r0 * 1.4 * (1 - 0.88 * t)]); }
    const e = st.at(-1);
    for (const [s, k] of [[0, 0.17], [0.08, 0.1], [0.16, 0.02]]) tip.push([0, e[1] - s * L, e[2] - 0.1 * s * L, r0 * k]);
  }
  const round = (a) => a.map((p) => p.map(r4));
  const T = round(tip), f = T[0], l = T.at(-1), d = [0, l[1] - T.at(-2)[1], l[2] - T.at(-2)[2]], n = Math.hypot(d[1], d[2]) || 1;
  return { tail: round(st), tip: T, tipCaps: { back: [0, r4(f[1] - (d[1] / n) * 0.02 * L), r4(f[2] - (d[2] / n) * 0.02 * L)], tip: [0, r4(l[1] + (d[1] / n) * 0.03 * L), r4(l[2] + (d[2] / n) * 0.03 * L)] } };
}

/**
 * Species params (oozed) with a chimera's param-level grafts (the tail, the wings) → `{ Q, notes, grafts }`. `c` is the
 * level (0 … 1), `motif` the creature's, `seed` its dice; `push` the composed push (its colours for the wings).
 */
export function graftParams(Q, { c, motif = 'horn', seed = 0, color }) {
  const grafts = graftsAt(c), notes = [], out = { ...Q };
  if (!grafts.length || !Array.isArray(Q.torso) || !Q.torso.length) return { Q, notes, grafts: [] };
  const M = MOTIFS[motif] ?? MOTIFS.horn, B = trunk(Q), pick = (list, key) => list[fnv(`${seed}|${key}`) % list.length];
  const coat = Q.colors?.coat ?? '#6b5f52';
  if (grafts.includes('tail')) {
    const kind = pick(LEAN[motif] ?? TAILS, 'tail'), root = Q.tail?.[0] ?? [0, B.rump[1], B.rump[2]];
    const r0 = Math.max(Q.tail?.[0]?.[3] ?? 0, 0.06 * B.L);
    Object.assign(out, graftTail(kind, root, B.L, r0), { tailBush: 1, tailGroup: undefined });
    // a tail authored as an extra segment (a monkey's) is the old tail too: the graft replaces it
    if ((Q.extraSegments || []).some((g) => g.name === 'tail' || g.name === 'tailTip')) out.extraSegments = Q.extraSegments.filter((g) => g.name !== 'tail' && g.name !== 'tailTip');
    out.colors = { ...(out.colors || {}), tip: kind === 'lion' ? shade(coat, -0.45) : color ?? M.color };
    notes.push({ stage: 'chimera', technique: `${kind} tail`, where: 'the tail', principle: 'a silhouette broken by what the animal should not have',
      why: { serpent: 'a long whip in an S, ending in a spade', scorpion: 'an arch up over the back, segmented, ending in a stinger', lion: 'a long thin tail ending in a tuft', dragon: 'a heavy tail, long and tapering' }[kind] });
  }
  if (grafts.includes('wings') && !Q.wings) {
    const feathered = FEATHERED.has(motif), wide = grafts.includes('crown') ? 1.25 : 1;
    const wing = feathered ? featherWing() : membraneWing(1);
    const arm = wing.arm.reduce((s, b) => s + b.len, 0), target = (feathered ? 1.05 : 0.8) * B.L * wide * (Q.scale ?? 1);
    // carried half raised: the spread plane lifted up and back off the shoulders, the fold a quarter in
    const W = { ...wing, frame: { ...wing.frame, spread: { S: [0.62, -0.18, 0.76], C: [0, 1, 0.12] } } };
    out.joints = { ...out.joints, wingRoot: [r4(0.55 * B.shoulder.side), r4(B.shoulder.y - 0.04 * B.L), r4(0.94 * B.shoulder.top)] };
    const dark = shade(coat, -0.35), light = shade(coat, 0.25), accent = color ?? M.color;
    const palette = feathered
      ? { WingBone: dark, FlightA: dark, FlightB: shade(coat, -0.25), FlightC: shade(coat, -0.15), FlightUnder: light, CovertA: coat, CovertB: shade(coat, 0.1), CovertC: shade(coat, -0.05),
        CovertTip: accent, CovertUnder: light, LesserA: shade(coat, 0.15), LesserB: shade(coat, 0.2), LesserC: shade(coat, 0.1), LesserTip: accent }
      : { MembraneBack: dark, MembraneUnder: shade(coat, -0.15), MembraneRim: shade(coat, -0.55), Vein: accent, WingBone: shade(coat, -0.45), Claw: accent };
    out.wings = { wing: W, at: 'wingRoot', fold: 0.25, scale: r4(target / arm), core: 0.03, coreFit: true, palette };
    notes.push({ stage: 'chimera', technique: `${feathered ? 'feathered' : 'membrane'} wings`, where: 'the shoulders', principle: 'the biggest shape a creature can be given',
      why: `${feathered ? 'a griffin\'s feathered wings' : 'a dragon\'s membrane wings'}, carried half raised, ${Math.round(target * 100) / 100} m to the wrist, edged in ${M.reads}` });
  } else if (grafts.includes('wings')) notes.push({ stage: 'chimera', technique: 'wings (its own)', where: 'the shoulders', principle: 'what the animal has stands', why: 'a winged animal keeps its own wings' });
  return { Q: out, notes, grafts };
}

/** The plan-level grafts as pushes over the composed one (horns, plates, the crown) → `{ push, notes }`. */
export function graftPush(push, grafts, can) {
  const out = { ...(push || {}) }, notes = [];
  if (grafts.includes('horns') && can.horns && !out.horns?.size) {
    out.horns = { size: 1 }; notes.push({ stage: 'chimera', technique: 'horns', where: 'the head', principle: 'a silhouette broken by what the animal should not have', why: 'a pair of horns on a head that had none' });
  }
  if (grafts.includes('crown') && can.horns) {
    out.horns = { ...(out.horns || { size: 1 }), pairs: 2 }; notes.push({ stage: 'chimera', technique: 'crown', where: 'the head', principle: 'the focal richest', why: 'a second pair of horns at the brow, forward' });
  }
  if (grafts.includes('plates') && can.hackles) {
    const h = out.hackles?.height ?? 0.5;
    out.plates = { count: 11, height: Math.max(0.55, h) };
    if (out.hackles) delete out.hackles;
    notes.push({ stage: 'chimera', technique: 'plates', where: 'the back and the tail', principle: 'one hook, never two', why: 'a ridge of plates from the nape to the tail tip, standing in for the crest' });
  }
  return { push: out, notes };
}

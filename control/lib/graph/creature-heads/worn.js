/**
 * THE RELATIONAL CREATURE HEAD WORN on the tiered body (./relational.js; the word `beast.head: { relational, relations? }`,
 * beast/head.js): the head netted as ONE SKIN on the realistic hero's route (polygonizer/hero-one-skin.js oneSkinHead),
 * in place of the library head the creature biped wore.
 *
 *   the fit    the plan's (beast/head.js creatureHeadPlan): the head's STAND units times the figure's height and the
 *              head's scale, its nape over the neck's top ring, so the neck runs into the back of the skull as a beast's does
 *   the seam   the neck ends on its highest ring standing wholly outside the head by the join's width, and the skin starts
 *              on that ring (`seamSlots` points round it, on the neck's own edges): one ring, no gap, no shell inside another
 *   the skin   the head's field (the globes and the ears out) joined smoothly to the neck's column, netted, sealed to the
 *              seam, its lips cut along the mouth's line from the front back along the muzzle's sides to the corners (the
 *              upper lip the head's, the lower the jaw's; turned in along the skin's facing), a mouth bag the length of the
 *              muzzle behind them, the nose's pad painted
 *   the bind   the seam's points carry the neck's blend; up the head they ease to { jaw, head }: the jaw's share ahead of the
 *              ramus (the jaw's angle to its hinge) and under the mouth's line, the cut deciding between the corners
 *   the eyes   each globe its own part (hero-one-skin.js globePart), seen through the socket the skin leaves
 *   the ears   each its own closed part, netted from its own field, bound to the head; its inner face painted (EarInner)
 *
 *   creatureHeadOn(recipe, worn)  → the recipe wearing the head (`worn`: the plan's `creatureHead`); absent, as it was
 *   CREATURE_WEAR                  the density and the joins
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { relationalCreatureHead } from './relational.js';
import { oneSkinHead } from '../polygonizer/hero-one-skin.js';
import { neckField } from '../polygonizer/hero-relational-head.js';
import { netSkin, soundMesh, simplifyMesh, fieldNormals } from '../polygonizer/skin-net.js';
import { mixW, four } from '../polygonizer/body-relational-resample.js';
import { r6 } from '../polygonizer/body-relational-vec.js';

/** the worn head's density and joins: the neck's join (m: the smooth union's width, and how far outside the head the
 * seam ring stands), the seam's points, the skin's net cell and its faces, the ears' cell and faces, the lips' reach and
 * turn-in (m), the mouth bag's share of the muzzle (its width and its height, of the jaw's), how broadly the jaw's share
 * eases behind the corners (m) */
export const CREATURE_WEAR = Object.freeze({
  join: 0.012, seamSlots: 48, cell: 0.0025, faces: 10000, earCell: 0.0009, earFaces: 900,
  lipDepth: 0.004, lipWindow: 0.008, bagWide: 0.7, bagHigh: 0.7, jawEase: 0.03,
});

const ramp = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const rp = (p) => p.map(r6);
const n4 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4);
const P3 = (q) => ({ x: q[0], y: q[1], z: q[2] });

/** the head the word builds, globes and ears out (the parts the skin leaves them to) */
export const wornHead = (worn) => relationalCreatureHead({ preset: worn.preset, relations: worn.relations ?? {}, globes: false, ears: false });

/** an EAR's closed part: its blade netted from its own field (hero metres), simplified, shaded by the field; its faces
 * turned along the ear's facing and inside its rim painted the inner ear */
function earPart(fE, box, facing, axis, C, group) {
  const net = netSkin((p) => fE([p.x, p.y, p.z]), box, { cell: C.earCell });
  const F0 = soundMesh(net.V, net.F, { out: (q) => { const m = axis.mid; return [q[0] - m[0], q[1] - m[1], q[2] - m[2]]; }, min: 8 });
  const S = simplifyMesh(net.V, F0, { target: C.earFaces, turn: 0.5 });
  const N = fieldNormals(S.V, (p) => fE([p.x, p.y, p.z]), 1e-5), points = {}, normals = {}, faces = {}, groups = {};
  S.V.forEach((p, v) => { points[`v${v}`] = rp(p); normals[`v${v}`] = n4(N[v]); });
  S.F.forEach((t, fi) => {
    const id = `f${fi}`, c = mean(t.map((v) => S.V[v])), n = mean(t.map((v) => N[v]));
    faces[id] = t.map((v) => `v${v}`);
    // (the inner ear: a face turned along the facing, inside the blade's rim: within most of its half width of its axis)
    const o = [c[0] - axis.a[0], c[1] - axis.a[1], c[2] - axis.a[2]], along = o[0] * axis.u[0] + o[1] * axis.u[1] + o[2] * axis.u[2];
    const off = Math.hypot(o[0] - axis.u[0] * along, o[1] - axis.u[1] * along, o[2] - axis.u[2] * along), s = Math.max(0, Math.min(1, along / axis.len));
    if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] > 0.55 && off < 0.62 * (axis.r0 + (axis.r1 - axis.r0) * s) && s < 0.92) groups[id] = 'EarInner';
  });
  return { layer: 1, closure: 'closed', group, mesh: { points, faces, groups, normals }, bind: 'head' };
}
/** the left of a mesh part: its points mirrored across the midline, its faces wound back */
function mirrorMesh(P) {
  const m = P.mesh, points = Object.fromEntries(Object.entries(m.points).map(([k, p]) => [k, [r6(-p[0]), p[1], p[2]]]));
  const normals = Object.fromEntries(Object.entries(m.normals).map(([k, n]) => [k, [-n[0] || 0, n[1], n[2]]]));
  const faces = Object.fromEntries(Object.entries(m.faces).map(([k, t]) => [k, [t[0], t[2], t[1]]]));
  return { ...P, mesh: { ...m, points, faces, normals } };
}

/** worn heads kept by what a build reads (the word, the fit, the neck): a build costs seconds, and a world's beast is
 * re-expanded every render */
const WORN = new Map(), WORN_KEPT = 8;

export function creatureHeadOn(recipe, worn) {
  if (!worn) return recipe;
  const C = { ...CREATURE_WEAR, ...(worn.opts ?? {}) };
  const r = structuredClone(recipe);
  if (!r.parts.neck?.stations?.length) throw new Error('creature-heads/worn: the recipe carries no neck to wear the head on');
  const key = JSON.stringify([worn, r.parts.neck, C]);
  let built = WORN.get(key);
  if (built) { WORN.delete(key); WORN.set(key, built); }
  else { built = buildHead(r.parts.neck, worn, C); WORN.set(key, built); if (WORN.size > WORN_KEPT) WORN.delete(WORN.keys().next().value); }
  const B = structuredClone(built);
  Object.assign(r.parts, B.parts);
  // (a dial that moved the head's parts moves what replaced them; the library head's jaw dial leaves with its jaw)
  if (r.dials?.jawOpen) delete r.dials.jawOpen;
  r.creatureHead = { preset: worn.preset, ...(worn.relations ? { relations: worn.relations } : {}), fit: worn.fit, stats: B.stats };
  const J = r.rig.joints, at = (name, p) => { if (J[name]) J[name] = Array.isArray(J[name]) ? rp(p) : { ...J[name], at: rp(p) }; };
  for (const [name, p] of Object.entries(B.joints)) at(name, p);
  return r;
}

/** the head built on a neck: { parts (the neck ended on its seam, the skin, the mouth, the globes, the ears), joints, stats } */
function buildHead(neck0, worn, C) {
  const neck = structuredClone(neck0), parts = { neck };
  const head = wornHead(worn), { k, ty, men } = worn.fit;
  const toHero = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const inHead = (f) => (q) => f({ x: q[0] / k, y: (q[1] - ty) / k, z: (q[2] - men) / k }) * k;
  const S2 = (q) => ({ x: q[0] / k, y: (q[1] - ty) / k, z: (q[2] - men) / k });
  const fH = inHead(head.field);
  // THE SEAM: the highest neck ring standing wholly outside the head by the join's width
  let seam = -1;
  for (let i = neck.stations.length - 1; i >= 0 && seam < 0; i--) if (neck.slots.every((s) => fH(neck.stations[i].points[s]) > C.join)) seam = i;
  if (seam < 0) throw new Error('creature-heads/worn: no neck ring stands clear of the head');
  const fN = neckField(neck, Math.max(0, seam - 1)), seamSt = neck.stations[seam], N = neck.slots.length, mult = Math.max(1, Math.round(C.seamSlots / N)), H = N * mult;
  const seamPts = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / mult), t = (j % mult) / mult; return lerp3(seamSt.points[neck.slots[i]], seamSt.points[neck.slots[(i + 1) % N]], t); });
  const nb = neck.bind?.blend || {}, nbone = typeof neck.bind === 'string' ? neck.bind : neck.bind?.bone ?? 'neck';
  const neckW = (s) => nb[`${seamSt.id}.${s}`] || nb[seamSt.id] || { [nbone]: 1 };
  const seamW = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / mult), t = (j % mult) / mult; return mixW(neckW(neck.slots[i]), neckW(neck.slots[(i + 1) % N]), t); });
  // THE MOUTH: its line level along the muzzle (its height the seated groove's), from the front back to the corners
  const P = head.points, c0 = mean(seamPts), O = [0, c0[1], toHero(P.porionR)[2]];
  const ch = toHero(P.chR), sto = toHero(P.sto), zL = (ch[2] + sto[2]) / 2, lipZ = () => zL, gn = toHero(P.gn);
  const go = toHero(P.goR), cd = toHero(P.condyleR), ry = cd[1] - go[1], rz = cd[2] - go[2], rl = Math.hypot(ry, rz);
  const ahead = (p) => ((p[1] - go[1]) * rz - (p[2] - go[2]) * ry) / rl;
  // the jaw's share: ahead of the ramus and under the mouth's line; between the corners the cut decides (`side`: +1 the
  // upper lip's, −1 the lower's, 0 a point the cut does not reach), behind them it eases over the cheek
  const jawW = (p, side = 0) => {
    const front = ramp((p[1] - ch[1]) / 0.006 + 0.5), cut = side > 0 ? 0 : side < 0 ? 1 : ramp((zL - p[2] + 0.0005) / 0.001);
    const below = front * cut + (1 - front) * ramp((zL - p[2]) / C.jawEase);
    const wj = r6(ramp((ahead(p) + 0.006) / 0.018) * below);
    return wj > 0 ? (wj < 1 ? { head: r6(1 - wj), jaw: wj } : { jaw: 1 }) : { head: 1 };
  };
  // (the mouth bag the muzzle's length behind the lips, its width and height shares of the jaw's)
  const jawDepth = (head.relations.jawDepth * 0.23 / 1.8) * k, bagLen = Math.max(0.01, sto[1] - ch[1] - C.lipDepth);
  const bag = { x: Math.abs(ch[0]) * C.bagWide, y: ch[1] + bagLen / 2, depth: bagLen * 0.9, height: jawDepth * C.bagHigh, gap: 0.001, wide: 0, rings: 10, slots: 24 };
  const skin = oneSkinHead({ head: { ...head, globes: head.globes }, k, toHero, inHead, S2, fN, join: C.join, seamPts, seamW, O, lipZ, ch, sto, jawW,
    opts: { cell: C.cell, faces: C.faces, lipDepth: C.lipDepth, lipWindow: C.lipWindow, mouthBack: sto[1] - ch[1], lipInward: true, seamNearest: true, globeEdges: 'slot', bag } });
  // THE NOSE'S PAD painted on the skin: a face whose middle the head paints the nose
  const hs = skin.parts.headSkin, mg = hs.mesh.groups;
  for (const [id, t] of Object.entries(hs.mesh.faces)) { if (mg[id]) continue; const c = mean(t.map((v) => hs.mesh.points[v])); if (head.paint(S2(c)) === 'nose') mg[id] = 'NosePad'; }
  hs.group = worn.group ?? 'Skin'; hs.coverChart = true;
  // the neck ends on the seam; its tip capped inside the skin
  const kept = new Set(neck.stations.slice(0, seam + 1).map((s) => s.id));
  neck.stations = neck.stations.slice(0, seam + 1);
  neck.caps = { ...neck.caps, tip: rp([c0[0], c0[1], c0[2] + 0.004]) };
  if (neck.bind?.blend) {
    for (const key of Object.keys(nb)) { const st = key.split('.')[0]; if (st !== 'back' && st !== 'tip' && !kept.has(st)) delete nb[key]; }
    nb.tip = four(mixW(seamW[0], seamW[H / 2], 0.5));
  }
  Object.assign(parts, skin.parts);
  // THE EARS, each its own part on its own field
  const E = head.earFields.find((e) => e.side === 'R'), w = head.vajras.find((v) => v.name === 'earR');
  if (E && w) {
    const sc = 0.23 / 1.8, a = toHero({ x: w.a.x * sc, y: w.a.y * sc, z: w.a.z * sc }), b = toHero({ x: w.b.x * sc, y: w.b.y * sc, z: w.b.z * sc });
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...ax), u = ax.map((q) => q / len);
    const f0 = [0.35, 1, 0], fd = f0[0] * u[0] + f0[1] * u[1] + f0[2] * u[2], f = f0.map((q, i) => q - fd * u[i]), fl = Math.hypot(...f), facing = f.map((q) => q / fl);
    const R0 = w.r[0] * sc * k, pad = R0 + 3 * C.earCell, box = { min: P3([0, 1, 2].map((i) => Math.min(a[i], b[i]) - pad)), max: P3([0, 1, 2].map((i) => Math.max(a[i], b[i]) + pad)) };
    const R = earPart(inHead(E.field), box, facing, { a, u, len, mid: lerp3(a, b, 0.4), r0: R0, r1: w.r[2] * sc * k }, C, worn.group ?? 'Skin');
    R.coverChart = true; parts.earR = R; parts.earL = mirrorMesh(R);
  }
  return { parts, joints: { jawHinge: [0, cd[1], cd[2]], jawTip: gn, headTop: toHero(P.crown) }, stats: skin.stats };
}

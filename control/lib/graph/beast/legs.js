/**
 * THE BEAST-KIN'S LEGS on the tiered body: the hero's own leg chain stood the way the kin stands. The rig's leg is already
 * a digitigrade chain (station-loft-rig.js `legs`: hip, knee, hock, toe base, toe tip), a person's hock its ankle on the
 * floor, so a digitigrade leg is the same chain with its joints moved and the parts below the knee made for them:
 *
 *   DIGITIGRADE        the joints as shares of the hip's height, from the creature biped's digitigrade template (the
 *                      sixth generation's, egocube/plan.js BIPED_TEMPLATE): the knee forward, the hock raised and back,
 *                      the toes' base on the floor ahead of it
 *   HOCK_JOINT         the hock bridged as the knee is (tiered-form.js tieredJoints): the shank and the metatarsus stop
 *                      short of it, a bridge spans it, and its rings ride a FOLD pushed to the heel's side (the knee's
 *                      goes to its front: the two bend opposite ways)
 *   beastLegs(plan, hero)   → the plan before the tiered passes: a digitigrade kin's knee, hock and toes moved (the thigh
 *                      turned and stretched onto its new line about the hip, the shank on its joints as they are), the
 *                      foot a metatarsus from the hock to the toes' base on the hock's fold, a pad under the ball and
 *                      the card's toes splayed ahead of it on the toes' bone; a plantigrade kin keeps the person's foot
 *                      with the card's toes (the outer ones go). Absent a beast, the plan as it was.
 *   beastJoints(hero, list)  → the joints the tiered pass bridges: the hero's, the hock on a digitigrade kin, the second
 *                      arms' elbow and wrist (./topology.js)
 *
 * Pure. The rig stays whole: no bone is added but the hock's fold, so every clip plays.
 */
import { beastCard } from './tiered.js';
import { TIERED_JOINTS, TIERED_HOCK } from '../polygonizer/tiered-form.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { topologyJoints } from './topology.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const unit = (a) => { const l = len(a) || 1; return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
// a vector turned the way `from` turns onto `to` (Rodrigues)
const turner = (from, to) => {
  const a = unit(from), b = unit(to), k = cross(a, b), s = len(k), c = dot(a, b);
  if (s < 1e-12) return (v) => [...v];
  const kk = mul(k, 1 / s);
  return (v) => { const kv = cross(kk, v), kd = dot(kk, v); return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + kk[i] * kd * (1 - c)); };
};

/** the digitigrade joints, as shares of the hip's height over the floor: forward (+y) from the hip and up */
export const DIGITIGRADE = Object.freeze({ knee: [0.185, 0.609], hock: [-0.163, 0.326], toeBase: [0.109, 0.065], toeTip: [0.337, 0.033] });
/** the hock: bridged as the knee is, its fold to the heel's side */
export const HOCK_JOINT = TIERED_HOCK;
/** the metatarsus' radii at the hock and the toes' base, as shares of the shank's end (a person's ankle: a paw's
 * metatarsus is the heavier, or the raised foot reads as a stilt); the pad and each toe's, of the
 * metatarsus' end; how far the toes reach past the toes' base, of the toes' run; their spread, of the pad's half width */
const META = { hock: 1.3, ball: 1.0 }, PAD = { width: 1.5, height: 0.75, back: 0.35, front: 0.3 }, TOE = { r: 0.36, reach: 0.62, root: 0.1, spread: 0.72 };
const TOE_NAMES = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
/** the toes a foot keeps by the card's count: a plantigrade foot keeps the big toe, the outer ones go first; a digitigrade
 * paw's toes are the middle ones (no big toe: a dog's dewclaw, a bird's hind toe are not drawn) */
export const KEPT_TOES = Object.freeze({ plantigrade: { 3: ['hallux', 'toe2', 'toe3'], 4: ['hallux', 'toe2', 'toe3', 'toe4'], 5: TOE_NAMES },
  digitigrade: { 3: ['toe2', 'toe3', 'toe4'], 4: ['toe2', 'toe3', 'toe4', 'toe5'], 5: TOE_NAMES } });

export const beastJoints = (hero, list = TIERED_JOINTS) => { const card = beastCard(hero); return card ? [...list, ...(card.legs === 'digitigrade' ? [HOCK_JOINT] : []), ...topologyJoints(hero)] : list; };

// a ring of `slots` round centre c, square to `axis`, half widths w (across, along `side`) and h (up, along `up`)
const ring = (c, side, up, w, h, slots) => Object.fromEntries(slots.map((sl, k) => { const t = (2 * Math.PI * k) / slots.length; return [sl, add(c, add(mul(up, h * Math.cos(t)), mul(side, w * Math.sin(t)))).map(r6)]; }));
// (a foot's ring as the bare foot's are, hero-foot.js: its front slot up, its R side toward the big toe)
const RING12 = SLOT_FAMILIES.ring12, LIMB6 = SLOT_FAMILIES.limb6;

export function beastLegs(plan, hero) {
  const card = beastCard(hero);
  if (!card) return plan;
  const kept = new Set(KEPT_TOES[card.legs][card.toes] ?? TOE_NAMES), side = (n) => n.replace(/(\$S|[RL])$/, '');
  if (card.legs !== 'digitigrade') {
    // (a plantigrade kin: the person's foot, its outer toes gone from the skin and the dials)
    const gone = (n) => TOE_NAMES.includes(side(n)) && !kept.has(side(n));
    if (!TOE_NAMES.some((t) => !kept.has(t))) return plan;
    return { ...plan, segments: plan.segments.filter((s) => !gone(s.name)), dials: Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: d.parts.filter((p) => !gone(p)) } : d])) };
  }
  const J0 = plan.joints, H = J0.hip[2], hip = J0.hip;
  const at = ([f, z]) => [J0.knee[0], r6(hip[1] + f * H), r6(z * H)];
  const J = { ...J0, knee: at(DIGITIGRADE.knee), ankle: at(DIGITIGRADE.hock), toeBase: at(DIGITIGRADE.toeBase), toeTip: at(DIGITIGRADE.toeTip) };
  for (const k of ['ankle', 'toeBase', 'toeTip']) J[k] = [J0.ankle[0], J[k][1], J[k][2]];
  // THE THIGH: turned and stretched about the hip onto its new line, each station's offset from the line kept
  const thighSeg = plan.segments.find((s) => s.name === 'thighR');
  const oldAxis = sub(J0.knee, hip), newAxis = sub(J.knee, hip), turn = turner(oldAxis, newAxis), k = len(newAxis) / len(oldAxis), u0 = unit(oldAxis);
  const onLine = (p) => { const v = sub(p, hip), t = dot(v, u0), off = sub(v, mul(u0, t)); return add(hip, add(turn(mul(u0, t * k)), turn(off))).map(r6); };
  const segments = [];
  const shank = plan.segments.find((s) => s.name === 'shankR'), rEnd = rad(shank?.rB ?? 0.045);
  // the toes' frame: forward along the floor, the R side across, up
  const F = unit([J.toeTip[0] - J.toeBase[0], J.toeTip[1] - J.toeBase[1], 0]), U = [0, 0, 1], S = unit(cross(U, F)), out = mul(S, -1);   // S: toward the midline, out: away from it
  const runToes = len(sub(J.toeTip, J.toeBase)), rMeta = rEnd * META.ball, padW = rMeta * PAD.width, padH = rMeta * PAD.height;
  const pad = (() => {
    const z = padH, back = add(J.toeBase, mul(F, -runToes * PAD.back)), front = add(J.toeBase, mul(F, runToes * PAD.front));
    const st = [[back, 0.8, 0.9], [J.toeBase, 1, 1], [front, 0.85, 0.8]].map(([c, w, h], i) => ({ id: `st${i}`, points: ring([c[0], c[1], z * h], S, U, padW * w, padH * h, RING12) }));
    return { name: 'pawR', kind: 'rings', slots: 'ring12', stations: st, caps: { back: [back[0], back[1] - 0.0, padH * 0.8].map(r6), tip: add(front, mul(F, padH * 0.6)).map((x, i) => (i === 2 ? r6(padH * 0.7) : r6(x))) },
      group: 'Skin', mirror: 'name', bind: { bone: 'toesR', blend: { back: { footR: 1 }, st0: { footR: 0.6, toesR: 0.4 }, st1: { footR: 0.3, toesR: 0.7 } } } };
  })();
  const toes = [...kept].map((name, i, all) => {
    const n = all.length, s = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * padW * TOE.spread, r = rMeta * TOE.r * (n <= 3 ? 1.15 : 1);
    const root = add(add(J.toeBase, mul(F, runToes * TOE.root)), mul(out, s)), tip = add(root, mul(F, runToes * TOE.reach * (1 - 0.18 * Math.abs(s) / padW)));
    const st = [[root, 1.05, r * 1.15], [add(root, mul(sub(tip, root), 0.55)), 1, r * 1.05], [tip, 0.8, r * 0.85]].map(([c, f, z], j) => ({ id: `st${j}`, points: ring([c[0], c[1], z], S, U, r * f, r * f * 0.9, LIMB6) }));
    return { name: `${name}R`, kind: 'rings', slots: 'limb6', stations: st, caps: { back: [root[0], root[1] - r, r * 1.15].map(r6), tip: [tip[0] + F[0] * r * 0.7, tip[1] + F[1] * r * 0.7, r * 0.7].map(r6) },
      group: 'Skin', mirror: 'name', bind: { bone: 'toesR', blend: { back: { footR: 1 }, st0: { footR: 0.5, toesR: 0.5 } } } };
  });
  for (const s of plan.segments) {
    if (s.name === 'thighR' && s.kind === 'loft') { segments.push({ ...s, stations: s.stations.map((st) => ({ ...st, at: onLine(st.at) })), caps: { ...s.caps, ...(s.caps?.back ? { back: onLine(s.caps.back) } : {}), ...(s.caps?.tip ? { tip: onLine(s.caps.tip) } : {}) } }); continue; }
    if (s.name === 'footR') {
      // THE METATARSUS: the hock to the toes' base, the hock's fold at its top ring, the toes' bone at its foot
      segments.push({ name: 'footR', kind: 'segment', from: 'ankle', to: 'toeBase', rA: r6(rEnd * META.hock), rB: [r6(rMeta), r6(rMeta * 0.9)], over: [0.5, 0.35], group: s.group, mirror: 'name',
        bind: { bone: 'footR', blend: { back: { shankR: 1 }, st0: { hockFoldR: 1 }, st2: { footR: 0.5, toesR: 0.5 }, tip: { toesR: 1 } }, zone: r6(1.3 * rMeta) } });
      segments.push(pad, ...toes); continue;
    }
    if (TOE_NAMES.includes(side(s.name)) || s.name === 'toesR') continue;
    // (the shank's foot ring on the hock's fold, its knee ring on the knee's as it was)
    if (s.name === 'shankR') { segments.push({ ...s, bind: { ...s.bind, blend: { ...s.bind.blend, st2: { hockFoldR: 1 }, tip: { footR: 1 } } } }); continue; }
    segments.push(s);
  }
  // THE RIG: the joints moved, the hip's socket on the thigh's new line, the hock's fold and its bone
  const RJ = { ...plan.rig.joints };
  for (const [j, n] of [['knee', 'knee$S'], ['ankle', 'ankle$S'], ['toeBase', 'toeBase$S'], ['toeTip', 'toeTip$S']]) if (RJ[n]) RJ[n] = { ...RJ[n], at: J[j] };
  const folds = { ...plan.rig.folds };
  if (folds['hipFold$S']?.inAxis) folds['hipFold$S'] = { ...folds['hipFold$S'], inAxis: newAxis.map(r6) };
  folds['hockFold$S'] = { joint: 'ankle$S', from: 'knee$S', to: 'toeBase$S', front: [0, -1, 0], push: r6(rEnd), bones: ['shank$S', 'foot$S'], head: 'hockFold$S', tail: 'hockFoldTip$S', aim: 'hockFoldAim$S' };
  const bones = plan.rig.bones.map((b) => (b.perSide && b.perSide.some((x) => x.id === 'kneeFold$S') ? { ...b, perSide: [...b.perSide, { id: 'hockFold$S', head: 'hockFold$S', tail: 'hockFoldTip$S', aux: ['hockFold$S', 'hockFoldAim$S'] }] } : b));
  // the dials: the paw and its toes where the foot was
  const footParts = ['paw$S', ...[...kept].map((t) => `${t}$S`)];
  const dials = Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, d]) => {
    if (!Array.isArray(d.parts)) return [id, d];
    const parts = d.parts.filter((p) => !TOE_NAMES.includes(side(p)) && side(p) !== 'toes');
    return [id, { ...d, parts: d.parts.includes('foot$S') ? [...parts, ...footParts] : parts }];
  }));
  return { ...plan, joints: J, segments, dials, rig: { ...plan.rig, joints: RJ, folds, bones } };
}

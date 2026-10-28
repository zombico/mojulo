/**
 * THE LAYERS ON THE TIERED BODY: a lineage's layers (./cards.js UNDEAD_LAYERS) laid over the undead hero's plan, and the
 * flesh a bared part leaves cut from the hero's expanded recipe.
 *
 *   (what goes back to bone is ./tiered.js undeadPicks: one pick, read by the plan that lays the bones and by the
 *   recipe that cuts the flesh)
 *   undeadLayers(plan, hero, { living })   → the plan with its layers, in order: `bared` (over flesh: a limb's bones on
 *                                its side, one side's ribs, the skull), `decayed` (over bone: ./decay.js), `adorned`
 *                                (./armour.js: the armour sized to `living`, the hero's plan before its flesh went),
 *                                then `shreds` (./shreds.js), the rags hanging clear of whatever the body now is
 *   undeadRecipe(recipe, hero) → the expanded recipe with the card's heavy arm (one side swollen, the other withered), without the flesh each bared limb leaves on its side (its bridges
 *                                and its shoulder's ball with it) and without the card's seeded loss (a hand, or a
 *                                forearm and its hand, in whatever shape that side has them), the parts pinned to them
 *                                gone too, the dials pruned: the rig stays whole, so every clip still plays
 *
 * Absent `undead` or its layers, every function returns what it was given. Pure.
 */
import { undeadCard, undeadPicks } from './tiered.js';
import { boneLimb, RIBS } from './passes.js';
import { skullFrame } from './skull.js';
import { shreds } from './shreds.js';
import { decay, LIMBS } from './decay.js';
import { sectionAt } from './hero-bones.js';
import { adorned } from './armour.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const mir = (p) => [r3(-p[0]) + 0, p[1], p[2]];
const scaleR = (r, s) => (Array.isArray(r) ? r.map((x) => r3(x * s)) : r3(r * s));
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'];
const DIGITS = { thumb: ['Cmc', 'Mcp', 'Ip', 'Tip'], index: ['Mcp', 'Pip', 'Dip', 'Tip'], middle: ['Mcp', 'Pip', 'Dip', 'Tip'], ring: ['Mcp', 'Pip', 'Dip', 'Tip'], little: ['Mcp', 'Pip', 'Dip', 'Tip'] };
const TOES = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
/** the hero's flesh each bared word takes from its side (the tiered passes' bridges and the shoulder's ball with it) */
export const BARE_CUTS = Object.freeze({
  arm: ['upperArm', 'shoulderBall', 'shoulderCone', 'shoulderWeb', 'elbowBridge', 'foreArm', 'wristBridge', 'hand', ...FINGERS],
  foreArm: ['elbowBridge', 'foreArm', 'wristBridge', 'hand', ...FINGERS],
  thigh: ['thigh', 'kneeBridge'],
  shin: ['kneeBridge', 'shank', 'foot', 'toes', ...TOES],
  // (a half word cuts the limb's own flesh and the bridges at its ends; its sleeve is laid as new parts)
  halfForeArm: ['elbowBridge', 'foreArm', 'wristBridge'],
  halfUpperArm: ['upperArm', 'shoulderBall', 'shoulderCone', 'shoulderWeb', 'elbowBridge'],
  halfThigh: ['thigh', 'kneeBridge'],
  halfShin: ['kneeBridge', 'shank'],
});
const PHALANGES = FINGERS.flatMap((d) => [1, 2, 3].map((i) => `${d}${i}`));
/** what a loss takes from its side: the hand and its fingers, from the wrist or from the elbow; in every shape the side
 * may have them (the flesh's parts and bridges, a skeleton's bones, a bared limb's bones) */
export const LOSS_CUTS = Object.freeze({
  hand: ['wristBridge', 'hand', ...FINGERS, ...PHALANGES, 'boneHand', ...PHALANGES.map((n) => `bone${n}`)],
  foreArm: ['elbowBridge', 'foreArm', 'wristBridge', 'hand', ...FINGERS, ...PHALANGES, 'boneForeArm', 'boneHand', ...PHALANGES.map((n) => `bone${n}`)],
});
// the bones each bared word lays: [hero part, from, to, the bone library's name]; `fingers` the hand's phalanges
// a half word's limb: [the hero's flesh part, from, to, the bone library's name]
const HALF = { halfForeArm: ['foreArm', 'elbow', 'wrist', 'foreArm'], halfUpperArm: ['upperArm', 'shoulder', 'elbow', 'upperArm'], halfThigh: ['thigh', 'hip', 'knee', 'thigh'], halfShin: ['shank', 'knee', 'ankle', 'shin'] };
// where a whole bared limb leaves the flesh: [the joint, the flesh part it leaves from (whose radius there), which end
// of that part (a: its first ring, b: its last), the bone the collar rides, the side the bone runs to]
const EDGES = {
  arm: [['shoulder', 'upperArm', 'a', 'upperArm', 'elbow']],
  foreArm: [['elbow', 'upperArm', 'b', 'foreArm', 'wrist']],
  thigh: [['hip', 'thigh', 'a', 'thigh', 'knee'], ['knee', 'shank', 'a', 'thigh', 'hip']],
  shin: [['knee', 'thigh', 'b', 'shank', 'ankle']],
};
const BONE_TINT = '#cccccc';
const BARE_BONES = {
  arm: [['upperArm', 'shoulder', 'elbow', 'upperArm'], ['foreArm', 'elbow', 'wrist', 'foreArm'], ['hand', 'wrist', 'knuckles', 'hand'], 'fingers'],
  foreArm: [['foreArm', 'elbow', 'wrist', 'foreArm'], ['hand', 'wrist', 'knuckles', 'hand'], 'fingers'],
  thigh: [['thigh', 'hip', 'knee', 'thigh']],
  shin: [['shank', 'knee', 'ankle', 'shin'], ['foot', 'ankle', 'toeBase', 'meta'], ['toes', 'toeBase', 'toeTip', 'toes']],
};
// the hero's limbs as decay.js lays its sinew: the shin is the hero's shank, the hock its ankle
const HERO_LIMBS = LIMBS.map((L) => ({ ...L, limb: L.limb === 'shin' ? 'shank' : L.limb, to: L.to === 'hock' ? 'ankle' : L.to }));
// the hero's scale against the bone library's 2 m template
const heroK = (plan) => { const t = plan.rig?.joints?.headTop?.at; return r3(((Array.isArray(t) ? t[2] : plan.joints.headBase[2] + 0.135) + 0.06) / 2); };


// a side's bones for a bared limb word: each its own part (never mirrored), on its side's joints, riding its side's bone
function bareLimb(plan, part, side, k, joints) {
  const J = plan.joints, RJ = plan.rig?.joints ?? {}, S = side, jn = (n) => (S === 'R' ? n : `${n}__L`);
  const place = (n, p) => { joints[jn(n)] = S === 'R' ? p.map(r3) : mir(p); return jn(n); };
  const out = [];
  for (const b of BARE_BONES[part]) {
    if (b === 'fingers') {
      for (const digit of FINGERS) for (let i = 0; i < 3; i++) {
        const a = RJ[`${digit}${DIGITS[digit][i]}$S`]?.at, z = RJ[`${digit}${DIGITS[digit][i + 1]}$S`]?.at;
        if (!Array.isArray(a) || !Array.isArray(z)) continue;
        const f = boneLimb({ name: 'finger', kind: 'segment', from: place(`${digit}${DIGITS[digit][i]}`, a), to: place(`${digit}${DIGITS[digit][i + 1]}`, z) }, { k, g: 1 });
        delete f.rMid;
        out.push({ ...f, name: `bone${digit}${i + 1}${S}`, over: [0.5, 0.5], group: 'Bone', tint: '#cccccc', mirror: null, bind: { bone: `${digit}${i + 1}${S}` } });
      }
      continue;
    }
    const [name, from, to, lib] = b;
    if (!J[from] || !J[to]) continue;
    const s = boneLimb({ name: lib, kind: 'segment', from: place(from, J[from]), to: place(to, J[to]) }, { k, g: 1 });
    if (s.rMid === undefined) delete s.rMid;
    out.push({ ...s, name: `bone${name[0].toUpperCase()}${name.slice(1)}${S}`, group: 'Bone', tint: '#cccccc', mirror: null, bind: { bone: `${name}${S}` } });
  }
  return out;
}
// a flesh part's radius at an end (a: its first ring, b: its last), or along it at t
function fleshR(plan, name, end) {
  const p = plan.segments.find((x) => x.name === `${name}R`);
  if (!p) return 0.04;
  if (p.kind === 'segment') return Math.max(...[].concat(end === 'a' ? p.rA : p.rB));
  if (p.kind === 'loft') { const st = end === 'a' ? p.stations[0] : p.stations.at(-1); return Math.max(...[].concat(st.r)); }
  return 0.04;
}
const sideJoint = (plan, joints, n, S) => { const nm = S === 'R' ? n : `${n}__L`; if (!joints[nm]) joints[nm] = S === 'R' ? plan.joints[n].map(r3) : mir(plan.joints[n]); return nm; };
const lerp = (a, b, t) => a.map((v, i) => r3(v + (b[i] - v) * t));
// a torn edge: a collar of MEAT on the bone where the skin ends, from just inside the flesh's end out onto the bone, the
// meat narrower than the skin and running past it (skin → meat → bone, each its own layer)
function collar(plan, joints, name, S, at, toward, rSkin, bone, k) {
  const A = plan.joints[at], B = plan.joints[toward], d = Math.hypot(...B.map((v, i) => v - A[i]));
  const p0 = lerp(A, B, -0.012 * k / d), p1 = lerp(A, B, 0.045 * k / d);
  const j0 = `${name}${S}a`, j1 = `${name}${S}b`;
  joints[j0] = S === 'R' ? p0 : mir(p0); joints[j1] = S === 'R' ? p1 : mir(p1);
  return { name: `${name}${S}`, kind: 'segment', from: j0, to: j1, rA: r3(rSkin * 0.8), rB: r3(rSkin * 0.5), over: [0.05, 0.05], cap: [0.3, 0.25], slots: 'ring12', group: 'Meat', tint: BONE_TINT, mirror: null, bind: { bone: `${bone}${S}` } };
}
// a half-bone limb: its bone the whole length, a sleeve of its flesh left at one end, the torn edge layered (the skin
// ends, the meat under it runs on onto the bone)
function halfLimb(plan, part, side, k, joints, rand) {
  const [flesh, from, to, lib] = HALF[part], S = side, near = rand() < 0.5, reach = 0.42 + 0.16 * rand(), meatOn = 0.07 + 0.04 * rand();
  const A = sideJoint(plan, joints, from, S), B = sideJoint(plan, joints, to, S), out = [];
  const b = boneLimb({ name: lib, kind: 'segment', from: A, to: B }, { k, g: 1 });
  if (b.rMid === undefined) delete b.rMid;
  out.push({ ...b, name: `bone${flesh[0].toUpperCase()}${flesh.slice(1)}${S}`, group: 'Bone', tint: BONE_TINT, mirror: null, bind: { bone: `${flesh}${S}` } });
  const rA = fleshR(plan, flesh, 'a'), rB = fleshR(plan, flesh, 'b'), rAt = (t) => r3(rA + (rB - rA) * t);
  const pa = plan.joints[from], pb = plan.joints[to], P = (t) => (S === 'R' ? lerp(pa, pb, t) : mir(lerp(pa, pb, t)));
  // (the sleeve's span: from its whole end to the torn one; the meat a share further on)
  const [s0, s1] = near ? [-0.04, reach] : [1 - reach, 1.04], [m0, m1] = near ? [-0.02, reach + meatOn] : [1 - reach - meatOn, 1.02];
  const name = `sleeve${flesh[0].toUpperCase()}${flesh.slice(1)}`;
  for (const [layer, t0, t1, f, group, caps] of [['Skin', s0, s1, 1, 'Skin', near ? [0.4, 0.05] : [0.05, 0.4]], ['Meat', m0, m1, 0.84, 'Meat', near ? [0.3, 0.1] : [0.1, 0.3]]]) {
    const ja = `${name}${layer}${S}a`, jb = `${name}${layer}${S}b`;
    joints[ja] = P(t0); joints[jb] = P(t1);
    out.push({ name: `${name}${layer}${S}`, kind: 'segment', from: ja, to: jb, rA: r3(rAt(Math.max(0, t0)) * f), rB: r3(rAt(Math.min(1, t1)) * f), over: [0.05, 0.05], cap: caps, slots: 'ring12', group, tint: BONE_TINT, mirror: null, bind: { bone: `${flesh}${S}` } });
  }
  return out;
}
// one side's ribs broken through the chest, from the flank round to the front, on the torso's own section
function bareRibs(plan, side, k, rand) {
  const torso = plan.segments.find((s) => s.name === 'torso' && s.kind === 'trunk'), sx = side === 'R' ? 1 : -1, deg = Math.PI / 180;
  if (!torso) return [];
  const sh = plan.joints.shoulder[2], hip = plan.joints.hip[2], first = Math.floor(rand() * 2), count = 4 + Math.floor(rand() * 3);
  // (RIBS' heights, the creature template's, laid on the hero's span from the hips to the shoulders)
  const zOf = (z) => r3(hip + ((z - 0.92) / (1.56 - 0.92)) * (sh - hip));
  const pw = (v) => Math.sign(v) * Math.abs(v) ** (2 / 2.3);
  // (the wound they show through: a patch of MEAT down the flank under them, flush with the skin, wide front to back)
  const zs = RIBS.slice(first, first + count).map(({ z }) => zOf(z)), zTop = Math.max(...zs) + 0.03 * k, zBot = Math.min(...zs) - 0.06 * k;
  const wound = { name: `wound${side}`, kind: 'loft', slots: 'ring12', stations: [zTop, (zTop + zBot) / 2, zBot].map((z, i) => { const X = sectionAt(torso, z), w = [0.6, 1, 0.55][i];
    return { at: [r3(sx * X.rx * 0.97), r3(X.yc + X.ry * 0.15), r3(z)], r: [r3(0.018 * k), r3(X.ry * 0.62 * w)] }; }), group: 'Meat', tint: '#cccccc', mirror: null, bind: { bone: 'torso' } };
  return [wound, ...RIBS.slice(first, first + count).map(({ z }, i) => {
    const stations = [135, 108, 80, 52, 22].map((th) => { const zz = r3(zOf(z) - (0.05 * k * (135 - th)) / 113), X = sectionAt(torso, zz), a = th * deg;
      return { at: [r3(sx * X.rx * 1.03 * pw(Math.sin(a))), r3(X.yc + X.ry * 1.03 * pw(Math.cos(a))), zz], r: r3(0.014 * k) }; });
    return { name: `ribBare${i}${side}`, kind: 'loft', stations, group: 'Bone', tint: '#cccccc', mirror: null, bind: { bone: 'torso' } };
  })];
}

export function undeadLayers(plan, hero, { living = plan } = {}) {
  const card = undeadCard(hero), layers = hero?.undead?.layers ?? [];
  if (!card || !layers.length) return plan;
  if (layers.includes('decayed') && card.form !== 'bone') throw new Error(`undead: the decayed layer lies over bone (the ${hero.undead.form} keeps its own flesh)`);
  if (layers.includes('bared') && card.form !== 'flesh') throw new Error(`undead: the bared layer lies over flesh (the ${hero.undead.form} is already bone)`);
  const k = heroK(plan), seed = (hero.undead.seed ?? 1) >>> 0;
  let segments = [...plan.segments], joints = { ...plan.joints }, rig = plan.rig, include = plan.include, palette = { ...(plan.palette ?? {}) };
  const tone = palette.Skin ?? '#cccccc', bone = card.form === 'bone' ? tone : '#d6cfbd';
  // BARED (over flesh): the picked parts back to bone
  if (layers.includes('bared') && card.form === 'flesh') {
    const rand = mulberry32(seed ^ 0x9f3b5c11);
    for (const { part, side } of undeadPicks(hero).bared) {
      if (BARE_BONES[part]) {
        segments.push(...bareLimb(plan, part, side, k, joints));
        // (each edge where the bone leaves the flesh torn and layered: the skin, the meat on the bone past it)
        EDGES[part].forEach(([at, flesh, end, bone, toward], i) => segments.push(collar(plan, joints, `edge${part[0].toUpperCase()}${part.slice(1)}${i}`, side, at, toward, fleshR(plan, flesh, end), bone, k)));
      } else if (HALF[part]) segments.push(...halfLimb(plan, part, side, k, joints, rand));
      else if (part === 'ribs') segments.push(...bareRibs(plan, side, k, rand));
      else if (part === 'skull') {
        // the head gone to its skull, on a neck drawn in under it; the rig's head and jaw joints the skull's
        const skull = skullFrame(plan.joints.headBase, { k, s: 1 });
        Object.assign(joints, skull.joints); segments.push(...skull.segments);
        include = (include ?? []).filter((x) => x.name !== 'head');
        segments = segments.map((s) => (s.name === 'neck' && s.kind === 'loft' ? { ...s, stations: s.stations.map((st, i, a) => ({ ...st, r: scaleR(st.r, 0.85 - (0.3 * i) / (a.length - 1)) })) } : s));
        rig = { ...rig, joints: { ...rig.joints, headTop: { at: skull.rig.headTop }, jawHinge: { at: skull.rig.jawHinge, rides: 'head' }, jawTip: { at: skull.rig.jawTip, rides: 'head' } } };
        Object.assign(palette, { Skull: bone, Jaw: bone, Socket: '#1a1816', Teeth: bone });
        // (the neck torn under the skull: a collar of meat round the column at its top)
        const nk = plan.segments.find((x) => x.name === 'neck'), rN = nk?.kind === 'loft' ? Math.max(...[].concat(nk.stations.at(-1).r)) * 0.55 : 0.03;
        joints.neckMeata = lerp(plan.joints.neckHub, plan.joints.headBase, 0.78); joints.neckMeatb = lerp(plan.joints.neckHub, plan.joints.headBase, 1.06);
        segments.push({ name: 'neckMeat', kind: 'segment', from: 'neckMeata', to: 'neckMeatb', rA: r3(rN * 0.95), rB: r3(rN * 0.6), over: [0.05, 0.05], slots: 'ring12', group: 'Meat', tint: '#cccccc', mirror: 'plane', bind: { bone: 'neck' } });
      }
    }
    // (the open flesh's layers: the skin the body's own tone, the meat under it dark red, the bone)
    palette.Bone = bone; palette.Meat = palette.Meat ?? '#7a3530';
  }
  // DECAYED (over bone): gaunt flesh back on the hero's skeleton
  if (layers.includes('decayed') && card.form === 'bone') {
    const body = { segments, joints }, hasSkull = segments.some((s) => s.name === 'braincase');
    const D = decay(body, card.decay ?? { open: 0.5, limbs: 0.6, neck: 0.6, scalp: 0.5 }, { k, g: 1, s: card.bones?.shaft ?? 1, skull: hasSkull, lost: undeadPicks(hero).lost, rand: mulberry32(seed ^ 0x27d4eb2f), limbs: HERO_LIMBS });
    Object.assign(joints, D.joints); segments.push(...D.segments);
    palette.Flesh = palette.Flesh ?? shade(tone, -0.38);
  }
  // ADORNED: what is left of its armour, sized to the living body, on the body as it now is (before the rags, which
  // hang over it)
  if (layers.includes('adorned')) {
    const A = adorned({ ...plan, joints, segments }, living, card.adorned ?? { helm: 0.5, cuirass: 0.5, pauldron: 0.4, bracers: 0.3, greaves: 0.3 },
      { k, rand: mulberry32(seed ^ 0x51ed270b), lost: undeadPicks(hero).lost, skull: segments.some((s) => s.name === 'braincase') });
    Object.assign(joints, A.joints); segments.push(...A.segments);
    palette.Metal = palette.Metal ?? '#6f7275';
  }
  // SHREDS: its clothes in rags, clear of the body as it now is
  if (layers.includes('shreds')) {
    const W = shreds({ segments, joints }, card.shreds ?? { chest: 0.5, back: 0.5, hips: 0.6, arms: 0.4, length: 1 }, { k, rand: mulberry32(seed ^ 0x5bd1e995) });
    segments.push(...W.segments);
    palette.Cloth = palette.Cloth ?? shade(tone, -0.3);
  }
  const out = { ...plan, joints, segments, rig, palette };
  if (include !== plan.include) { if (include.length) out.include = include; else delete out.include; }
  // (the head's dial goes with the head, and every dial keeps only the parts the body still has)
  if (!out.include?.some((x) => x.name === 'head') && plan.include?.some((x) => x.name === 'head')) {
    const names = new Set([...segments.flatMap((x) => (x.mirror === 'name' ? [x.name, x.name.replace(/R$/, 'L')] : [x.name])), ...(out.include ?? []).flatMap((x) => Object.keys(x.parts ?? {}))]);
    out.dials = Object.fromEntries(Object.entries(plan.dials ?? {}).filter(([, d]) => !(d.op === 'include' && d.name === 'head'))
      .map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: d.parts.filter((n) => names.has(n.replace('$S', 'R'))) } : d]));
  }
  return out;
}

// the arm's parts a heavy arm swells (its bridges and its shoulder's ball, its hand and fingers with it)
const ARM_PARTS = ['upperArm', 'shoulderBall', 'shoulderCone', 'shoulderWeb', 'elbowBridge', 'foreArm', 'wristBridge', 'hand', ...FINGERS];
// a part's rings scaled about each ring's own centre, its caps with the ring beside them (a bridge and the limb end it
// meets share a ring, so they stay matched)
function swell(part, s) {
  const mean = (P) => [0, 1, 2].map((i) => P.reduce((t, p) => t + p[i], 0) / P.length), sc = (p, c) => p.map((v, i) => Math.round((c[i] + (v - c[i]) * s) * 1e6) / 1e6);
  const cs = part.stations.map((st) => mean(Object.values(st.points)));
  return { ...part, stations: part.stations.map((st, i) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, p]) => [sl, sc(p, cs[i])])) })),
    ...(part.caps ? { caps: { back: sc(part.caps.back, cs[0]), tip: sc(part.caps.tip, cs.at(-1)) } } : {}) };
}

export function undeadRecipe(recipe, hero) {
  const card = undeadCard(hero), { lost, bared } = undeadPicks(hero), picks = bared.filter((x) => BARE_CUTS[x.part]);
  if (!picks.length && !lost && !card?.heavy) return recipe;
  const parts = { ...recipe.parts }, gone = new Set();
  // HEAVY: one arm swollen (the card's side, its radii × k) and the other withered (× 1 / k), each its own side's
  if (card?.heavy) for (const [S, f] of [[card.heavy.side, card.heavy.k], [card.heavy.side === 'R' ? 'L' : 'R', 1 / card.heavy.k]]) for (const n of ARM_PARTS) if (parts[`${n}${S}`]?.stations) parts[`${n}${S}`] = swell(parts[`${n}${S}`], f);
  for (const { part, side } of picks) for (const n of BARE_CUTS[part]) if (parts[`${n}${side}`]) gone.add(`${n}${side}`);
  // (the loss after: a bared arm's bones go with a lost forearm too)
  if (lost) for (const n of LOSS_CUTS[lost.part] ?? []) if (parts[`${n}${lost.side}`]) gone.add(`${n}${lost.side}`);
  // (a part pinned to a gone one goes with it)
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!gone.has(n) && p.pin && gone.has(p.pin.parent)) { gone.add(n); grew = true; } }
  for (const n of gone) delete parts[n];
  const dials = {};
  for (const [id, d] of Object.entries(recipe.dials ?? {})) {
    if (Array.isArray(d.parts)) { const ps = d.parts.filter((n) => !gone.has(n)); if (ps.length) dials[id] = { ...d, parts: ps }; }
    else if (typeof d.part === 'string') { if (!gone.has(d.part)) dials[id] = d; }
    else dials[id] = d;
  }
  return { ...recipe, parts, dials };
}

// a tone a share lighter (+) or darker (−), as the creature door's palette shades
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, t >= 0 ? v + (255 - v) * t : v * (1 + t)))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

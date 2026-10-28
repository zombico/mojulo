/**
 * THE SKELETON ON THE TIERED BODY: a hero's flesh replaced by its bones, every bone laid from the hero's own landmarks
 * (its joints, its torso's sections, its rig's finger joints), so the skeleton stands in the hero's proportions and rides
 * the hero's rig: a skeleton's card (./cards.js) on the game body.
 *
 *   spine      a slim core up the hero's back line (the hip to the neck's hub to the head's base), its vertebrae on it
 *              (./passes.js vertebrae)
 *   ribs       each an arc round the torso's own section at its height, drawn in from the flesh's line, from the spine
 *              round to the breastbone, falling to the front; the low ones stop short (they float)
 *   sternum    down the chest's front; the collarbones from its top out to each shoulder
 *   pelvis     the sacrum at the back; each hip blade's rim over the crest from the sacrum round to the front, the
 *              arch below it to the midline and the seat behind, fit to the hip's section
 *   limbs      every limb its bone on the hero's joints (./passes.js boneLimb), the foot's and the hand's, and each
 *              finger's three phalanges on the rig's finger joints
 *   skull      on the head's base (./skull.js), the jaw its own bone: the rig's head and jaw joints are the skull's
 *
 *   heroSkeleton(plan, card)   → the plan with its flesh, its head include and the head's dial gone, its bones in their
 *                                place, their groups toned bone (the openings dark)
 *
 * Over the hero's plan before the tiered passes (a bone joint is its knob: no bridge, no shoulder ball). Pure. Metres.
 */
import { boneLimb, vertebrae } from './passes.js';
import { skullFrame } from './skull.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t)).map(r3);
const deg = Math.PI / 180;
const BONE_TINT = '#cccccc';

// the torso's (or the pelvis's) section at height z: its half width, half depth and centre forward
function sectionAt(trunk, z) {
  const S = trunk.stations, f = S.findIndex((st, j) => j < S.length - 1 && z <= S[j + 1].z), i = f < 0 ? S.length - 2 : f;
  const a = S[i], b = S[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z || 1))), rr = (r) => (Array.isArray(r) ? r : [r, r]);
  const [ax, ay] = rr(a.r), [bx, by] = rr(b.r);
  return { rx: ax + (bx - ax) * t, ry: ay + (by - ay) * t, yc: (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t };
}
// the hero's limbs as the bone library names them (./passes.js boneLimb reads the creature biped's names)
const LIMB_BONES = [
  ['thigh', 'hip', 'knee', 'thigh'], ['shank', 'knee', 'ankle', 'shin'], ['foot', 'ankle', 'toeBase', 'meta'], ['toes', 'toeBase', 'toeTip', 'toes'],
  ['upperArm', 'shoulder', 'elbow', 'upperArm'], ['foreArm', 'elbow', 'wrist', 'foreArm'], ['hand', 'wrist', 'knuckles', 'hand'],
];
const DIGITS = { thumb: ['Cmc', 'Mcp', 'Ip', 'Tip'], index: ['Mcp', 'Pip', 'Dip', 'Tip'], middle: ['Mcp', 'Pip', 'Dip', 'Tip'], ring: ['Mcp', 'Pip', 'Dip', 'Tip'], little: ['Mcp', 'Pip', 'Dip', 'Tip'] };
const GROUPS = { thigh: 'Legs', shank: 'Legs', foot: 'Feet', toes: 'Feet', upperArm: 'Arms', foreArm: 'Arms', hand: 'Hands' };

export function heroSkeleton(plan, card) {
  const J0 = plan.joints, RJ = plan.rig?.joints ?? {}, at = (n) => (Array.isArray(RJ[n]?.at) ? RJ[n].at : null);
  const torso = plan.segments.find((s) => s.name === 'torso' && s.kind === 'trunk'), pelvis = plan.segments.find((s) => s.name === 'pelvis' && s.kind === 'trunk');
  const Bw = card.bones ?? { shaft: 1, ends: 1, ribs: 1 };
  // the hero's scale against the bone library's 2 m template, from its head's top
  const top = at('headTop') ?? add(J0.headBase, [0, 0, 0.135]), k = r3((top[2] + 0.06) / 2), g = 1;
  const R = (v) => r3(v * k * g), H = J0.hip[2], Nk = J0.neckHub, Hb = J0.headBase, navel = at('navel') ?? [0, 0, (H + Nk[2]) / 2];
  const back = (z) => { const X = sectionAt(z > torso.stations[0].z ? torso : pelvis, z); return r3(X.yc - X.ry * 0.5); };
  const joints = { ...J0, spine0: [0, back(H + 0.1 * k), r3(H + 0.1 * k)], spine1: [0, back(navel[2]), r3(navel[2])], spine2: [0, back(r3((navel[2] + Nk[2]) / 2 + 0.04 * k)), r3((navel[2] + Nk[2]) / 2 + 0.04 * k)], neckBase: Nk, neckTop: Hb };
  const segments = [];
  const seg = (s) => segments.push({ tint: BONE_TINT, ...s });
  // the spine's core, slim (its discs between the vertebrae), named as the creature skeleton's so the dials and the
  // rig's lean read it; the neck's core under the cervical run
  seg({ name: 'spineLow', kind: 'segment', from: 'spine0', to: 'spine1', rA: R(0.016 * Bw.shaft), rB: R(0.013 * Bw.shaft), group: 'Torso', mirror: 'plane', bind: { bone: 'lumbar' } });
  seg({ name: 'torso', kind: 'segment', from: 'spine1', to: 'spine2', rA: R(0.012 * Bw.shaft), rB: R(0.011 * Bw.shaft), group: 'Torso', mirror: 'plane', bind: { bone: 'torso' } });
  seg({ name: 'spineHigh', kind: 'segment', from: 'spine2', to: 'neckBase', rA: R(0.011 * Bw.shaft), rB: R(0.01 * Bw.shaft), group: 'Torso', mirror: 'plane', bind: { bone: 'torso' } });
  seg({ name: 'neck', kind: 'segment', from: 'neckBase', to: 'neckTop', rA: R(0.009 * Bw.shaft), rB: R(0.008 * Bw.shaft), group: 'Neck', mirror: 'plane', bind: { bone: 'neck' } });
  for (const v of vertebrae(joints, { k, g, s: Bw.shaft })) segments.push(v.name.startsWith('lumbar') ? { ...v, bind: { bone: v.bind.bone === 'pelvis' ? 'pelvis' : 'lumbar' } } : v);
  // the ribs round the torso's sections, from the shoulders' line down to above the navel
  const sh = J0.shoulder, zTop = r3(sh[2] - 0.035 * k), zBot = r3(navel[2] + 0.07 * k), n = 7, ribR = R(0.011 * Bw.ribs);
  const ribZ = Array.from({ length: n }, (_, i) => r3(zTop - ((zTop - zBot) * i) / (n - 1)));
  ribZ.forEach((z, i) => {
    const float = i >= n - 2, ends = float ? 40 : 14;
    const stations = [172, 140, 105, 70, ends].map((th) => {
      const zz = r3(z - (0.055 * k * (172 - th)) / 158), X = sectionAt(torso, zz), a = th * deg, w = 0.86 - (i === 0 ? 0.1 : 0);
      return { at: [r3(X.rx * w * Math.sin(a) + (th > 160 ? 0.02 * k : 0)), r3(X.yc + X.ry * 0.9 * Math.cos(a)), zz], r: ribR };
    });
    seg({ name: `rib${i}R`, kind: 'loft', stations, group: 'Torso', mirror: 'name', bind: { bone: 'torso' } });
  });
  const front = (z) => { const X = sectionAt(torso, z); return r3(X.yc + X.ry * 0.9); };
  const sTop = r3(zTop - 0.015 * k), sLow = r3(ribZ[4] - 0.05 * k);
  joints.sternumTop = [0, front(sTop), sTop]; joints.sternumLow = [0, front(sLow), sLow];
  seg({ name: 'sternum', kind: 'segment', from: 'sternumTop', to: 'sternumLow', rA: R(0.022 * Bw.ribs), rB: R(0.016 * Bw.ribs), group: 'Torso', mirror: 'plane', bind: { bone: 'torso' } });
  const cl0 = [r3(0.03 * k), front(sTop), r3(sTop + 0.01 * k)], cl2 = sh.map(r3), cl1 = add(lerp(cl0, cl2, 0.5), [0, r3(0.01 * k), r3(0.015 * k)]).map(r3);
  seg({ name: 'clavR', kind: 'loft', stations: [{ at: cl0, r: R(0.013 * Bw.ribs) }, { at: cl1, r: R(0.012 * Bw.ribs) }, { at: cl2, r: R(0.015 * Bw.ribs) }], group: 'Torso', mirror: 'name', bind: { bone: 'clavicleR' } });
  // the pelvis, fit to the hip's section: the sacrum at the back, each blade's rim, the arch and the seat
  const P = sectionAt(pelvis, H), px = (u) => r3(u * P.rx), py = (v) => r3(P.yc + v * P.ry), pz = (dz) => r3(H + dz * k);
  seg({ name: 'pelvis', kind: 'trunk', stations: [{ z: pz(-0.07), r: [R(0.03), R(0.025)], yc: py(-0.7) }, { z: pz(0.01), r: [R(0.055), R(0.035)], yc: py(-0.75) }, { z: pz(0.08), r: [R(0.05), R(0.03)], yc: py(-0.7) }],
    caps: { back: [0, py(-0.7), pz(-0.09)], tip: [0, py(-0.7), pz(0.1)] }, group: 'Pelvis', mirror: 'plane', bind: { bone: 'pelvis' } });
  const rim = R(0.024 * Bw.ribs), arch = R(0.018 * Bw.ribs), lp = (pts, r) => pts.map(([u, v, dz]) => ({ at: [px(u), py(v), pz(dz)], r }));
  seg({ name: 'iliumR', kind: 'loft', stations: lp([[0.25, -0.75, 0.05], [0.65, -0.85, 0.1], [0.98, -0.3, 0.12], [1.0, 0.35, 0.07], [0.82, 0.65, 0.0]], rim), group: 'Pelvis', mirror: 'name', bind: { bone: 'pelvis' } });
  seg({ name: 'pubisR', kind: 'loft', stations: lp([[0.82, 0.65, 0.0], [0.7, 0.55, -0.06], [0.42, 0.75, -0.09], [0.09, 0.88, -0.11]], arch), group: 'Pelvis', mirror: 'name', bind: { bone: 'pelvis' } });
  seg({ name: 'ischiumR', kind: 'loft', stations: lp([[0.7, 0.55, -0.06], [0.64, -0.2, -0.1], [0.36, -0.5, -0.07], [0.2, -0.6, -0.04]], arch), group: 'Pelvis', mirror: 'name', bind: { bone: 'pelvis' } });
  // the limbs: each its bone on the hero's joints, the hand's on its own, each finger's phalanges on the rig's joints
  for (const [name, from, to, lib] of LIMB_BONES) {
    const b = boneLimb({ name: lib, kind: 'segment', from, to }, { k, g, Bw });
    if (b.rMid === undefined) delete b.rMid;
    seg({ ...b, name: `${name}R`, group: GROUPS[name], mirror: 'name', bind: { bone: `${name}R` } });
  }
  for (const [digit, names] of Object.entries(DIGITS)) for (let i = 0; i < 3; i++) {
    const a = at(`${digit}${names[i]}R`), b = at(`${digit}${names[i + 1]}R`);
    if (!a || !b) continue;
    joints[`${digit}${names[i]}`] = a.map(r3); joints[`${digit}${names[i + 1]}`] = b.map(r3);
    const f = boneLimb({ name: 'finger', kind: 'segment', from: `${digit}${names[i]}`, to: `${digit}${names[i + 1]}` }, { k, g, Bw });
    delete f.rMid;
    seg({ ...f, name: `${digit}${i + 1}R`, over: [0.5, 0.5], group: 'Hands', mirror: 'name', bind: { bone: `${digit}${i + 1}R` } });
  }
  // the skull on the head's base, its jaw on the rig's jaw bone
  const skull = skullFrame(Hb, { k, s: r3(1 + (Bw.ends - 1) * 0.35) });
  Object.assign(joints, skull.joints); segments.push(...skull.segments);
  const rig = plan.rig ? { ...plan.rig, joints: { ...RJ, headTop: { at: skull.rig.headTop }, jawHinge: { at: skull.rig.jawHinge, rides: 'head' }, jawTip: { at: skull.rig.jawTip, rides: 'head' } } } : plan.rig;
  // the dials over the parts the skeleton has (the head's include dial gone with the head)
  const names = new Set(segments.flatMap((s) => (s.mirror === 'name' ? [s.name, s.name.replace(/R$/, 'L')] : [s.name])));
  const dials = Object.fromEntries(Object.entries(plan.dials ?? {}).filter(([, d]) => !(d.op === 'include' && d.name === 'head')).map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: d.parts.filter((p) => names.has(p) || p.includes('$S')) } : d]));
  const tone = plan.palette?.Skin ?? '#d6cfbd';
  const palette = { ...(plan.palette ?? {}), Torso: tone, Pelvis: tone, Neck: tone, Legs: tone, Feet: tone, Arms: tone, Hands: tone, Skull: tone, Jaw: tone, Socket: '#1a1816', Teeth: tone };
  const { include, ...rest } = plan, kept = (include ?? []).filter((x) => x.name !== 'head');
  return { ...rest, ...(kept.length ? { include: kept } : {}), joints, segments, dials, rig, palette };
}

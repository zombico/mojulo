/**
 * BARED: a gaunt corpse with parts gone back to bone, the inverse of the decayed skeleton (./decay.js): the body is the
 * zombie's, drawn in further, and a few of its parts, seeded from the card's list, are the skeleton's. FORM ONLY: the
 * bare parts are their own groups (`Bone`, and the skull's), toned bone by the palette.
 *
 *   skull     the head gone to its skull (./skull.js), its jaw its own bone, on a neck drawn in under it
 *   arm       one arm bone from the shoulder: the humerus, the forearm's bones, the hand's and the fingers'
 *   foreArm   one forearm and its hand bone from the elbow, the upper arm still flesh
 *   thigh     one thigh to its femur, the shin below still flesh
 *   shin      one shin and its foot to the bone, from the knee
 *   ribs      one side's ribs broken through the chest, lying on the flesh over the cage
 *
 *   bared(body, spec, { k, g, rand, lost })   → { replaced: [{ part, side }], skull, joints, segments, lean }
 *   spec { count: [lo, hi], parts: [...] }    how many parts go to bone (each on its own side), from which
 *
 * A bare limb is authored on its own side (the twin its own part) and keeps its rig: its bones are the flesh limb's.
 * Over flesh only (a skeleton is already bone). Pure: the dice are the caller's (`rand`, its own stream). Template metres
 * at 2 m tall (× k).
 */
import { boneLimb, splitLimbs, RIBS } from './passes.js';
import { skullFrame } from './skull.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const scaleR = (r, s) => (Array.isArray(r) ? r.map((x) => r3(x * s)) : r3(r * s));
const ARM = /^(upperArm|foreArm|hand|finger)/, LEG = /^(thigh|shin|meta|toes)/;
/** the parts each word bares, and the limb it splits */
export const BARE_PARTS = Object.freeze({
  skull: null,
  arm: { re: ARM, limb: ARM },
  foreArm: { re: /^(foreArm|hand|finger)/, limb: ARM },
  thigh: { re: /^thigh/, limb: LEG },
  shin: { re: /^(shin|meta|toes)/, limb: LEG },
  ribs: null,
});
// the flesh left drawn in further: a corpse gone gaunt round the bone it shows
const GAUNT = { trunk: 0.9, limbs: 0.86 };

// the torso's section at height z: its half width, half depth and centre forward, between its stations
function sectionAt(torso, z) {
  const S = torso.stations, f = S.findIndex((st, j) => j < S.length - 1 && z <= S[j + 1].z), i = f < 0 ? S.length - 2 : f;
  const a = S[i], b = S[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), rr = (r) => (Array.isArray(r) ? r : [r, r]);
  const [ax, ay] = rr(a.r), [bx, by] = rr(b.r);
  return { rx: ax + (bx - ax) * t, ry: ay + (by - ay) * t, yc: (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t };
}

export function bared(body, spec, { k, g, rand, lost }) {
  const kg = k * g, J = body.joints, segments = [], joints = {}, lean = [], replaced = [];
  // the flesh drawn in (the trunk's sections, the limbs' radii, the neck's)
  for (const s of body.segments) {
    if (s.kind === 'trunk') s.stations = s.stations.map((st) => ({ ...st, r: scaleR(st.r, GAUNT.trunk) }));
    else if (LEG.test(s.name) || ARM.test(s.name)) { s.rA = scaleR(s.rA, GAUNT.limbs); s.rB = scaleR(s.rB, GAUNT.limbs); if (s.rMid) s.rMid = scaleR(s.rMid, GAUNT.limbs); }
    else if (s.name === 'neck') { s.rA = scaleR(s.rA, GAUNT.limbs); s.rB = scaleR(s.rB, GAUNT.limbs); }
  }
  // the parts: a seeded count, each word once, each a side of its own; a lost part's side stays as the loss left it
  const pool = [...spec.parts], [lo, hi] = spec.count ?? [1, 2], n = lo + Math.floor(rand() * (hi - lo + 1));
  // (an arm bares once, as the whole arm or its forearm; a lost forearm has no bone left to show)
  const taken = new Set(), keyOf = (part, side) => (part === 'arm' || part === 'foreArm' ? `arm${side}` : `${part}${side}`);
  while (replaced.length < n && pool.length) {
    const part = pool.splice(Math.floor(rand() * pool.length), 1)[0], side = part === 'skull' ? null : rand() < 0.5 ? 'R' : 'L';
    if (taken.has(keyOf(part, side)) || (part === 'foreArm' && lost?.part === 'foreArm' && lost.side === side)) continue;
    taken.add(keyOf(part, side)); replaced.push({ part, side });
  }
  let skull = null;
  for (const { part, side } of replaced) {
    const P = BARE_PARTS[part];
    if (P) {
      // (the limb authored on both sides, so one can be bone)
      if (body.segments.some((s) => P.limb.test(s.name) && s.mirror === 'name')) splitLimbs(body, P.limb);
      body.segments = body.segments.map((s) => {
        if (!P.re.test(s.name) || !s.name.endsWith(side)) return s;
        const b = boneLimb(s, { k, g }); if (b.rMid === undefined) delete b.rMid;
        return { ...b, group: 'Bone' };
      });
    } else if (part === 'ribs') {
      // one side's ribs through the chest, from the flank round to the front, lying on the flesh, falling forward
      const torso = body.segments.find((s) => s.name === 'torso' && s.kind === 'trunk'), sx = side === 'R' ? 1 : -1, deg = Math.PI / 180;
      if (!torso) continue;
      const first = Math.floor(rand() * 2), count = 4 + Math.floor(rand() * 3), E = 2.3;
      RIBS.slice(first, first + count).forEach(({ z }, i) => {
        const stations = [135, 108, 80, 52, 22].map((th) => { const zz = r3((z - (0.05 * (135 - th)) / 113) * k), X = sectionAt(torso, zz), a = th * deg;
          // (on the section's superellipse, the trunk's boxier than an ellipse at the diagonals, a rib's radius proud)
          const pw = (v) => Math.sign(v) * Math.abs(v) ** (2 / E), out = 1.03;
          return { at: [r3(sx * X.rx * out * pw(Math.sin(a))), r3(X.yc + X.ry * out * pw(Math.cos(a))), zz], r: r3(0.014 * kg) }; });
        const name = `ribBare${i}${side}`;
        segments.push({ name, kind: 'loft', stations, group: 'Bone', tint: '#cccccc', mirror: null, bind: { bone: 'torso' } });
        lean.push(name);
      });
    } else if (part === 'skull') {
      // the head gone to its skull, on a neck drawn in under it and a little longer (a skull is smaller than the face
      // that hid the neck's top, and a hunched corpse's shoulders would rise over it); moved in place, so the rig's
      // head bone and the skull read the same point
      const nt = J.neckTop.map((v, i) => r3(J.neckBase[i] + (v - J.neckBase[i]) * 1.15));
      for (let i = 0; i < 3; i++) J.neckTop[i] = nt[i];
      skull = skullFrame(J.neckTop, { k, s: 1 });
      Object.assign(joints, skull.joints); segments.push(...skull.segments); lean.push(...skull.headParts, ...skull.jawParts);
      const neck = body.segments.find((s) => s.name === 'neck');
      // (its tip ends under the skull's base, not past it)
      if (neck) { neck.rA = scaleR(neck.rA, 0.75); neck.rB = scaleR(neck.rB, 0.55); neck.over = [neck.over?.[0] ?? 0.3, 0.05]; }
    }
  }
  return { replaced, skull, joints, segments, lean };
}

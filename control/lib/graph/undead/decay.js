/**
 * DECAYED: gaunt, rotted flesh laid back over a skeleton, the dead between the zombie and the bare bone. FORM ONLY: the
 * flesh is its own group (`Flesh`), one tone, never a texture of rot.
 *
 *   torso    a sheet shrunk inside the rib cage's girth, so the ribs and the spine's processes stand through it; its
 *            front rotted open as far as the card says, the breastbone and the front ribs bare; the belly sunk under them
 *   limbs    wasted sinew over part of each long bone, seeded per limb and side (some stripped to the bone), thinner than
 *            the knobbed ends, so the joints show bare at either end
 *   neck     a withered throat in front of the vertebrae, the column showing behind it
 *   scalp    a cap of dried skin over the crown, pulled back off the brow
 *
 *   decay(body, spec, { k, g, s, skull, lost, rand, limbs })   → { segments, joints, lean: [names] } (the parts the lean
 *                       hinges); `limbs` the body's limbs by name (LIMBS, the creature biped's; the hero's its own)
 *   spec { open, limbs, neck, scalp }: how far the chest is rotted open (0 … 1), and the odds a limb, the throat and the
 *        scalp keep flesh
 *
 * Over bone only (a zombie keeps its own flesh). Pure: the dice are the caller's (`rand`, its own stream). Template
 * metres at 2 m tall (× k).
 */
import { trunkPoints, band } from './shreds.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t)).map(r3);
const mir = (p) => [r3(-p[0]) + 0, p[1], p[2]];
// each limb's flesh: its joints, its radii at its two ends [near, far] (template metres, × the bone weights)
export const LIMBS = [
  { limb: 'thigh', from: 'hip', to: 'knee', r: [0.042, 0.032] }, { limb: 'shin', from: 'knee', to: 'hock', r: [0.034, 0.024] },
  { limb: 'upperArm', from: 'shoulder', to: 'elbow', r: [0.03, 0.025] }, { limb: 'foreArm', from: 'elbow', to: 'wrist', r: [0.024, 0.019] },
];

export function decay(body, spec, { k, g, s = 1, skull, lost, rand, limbs = LIMBS }) {
  const segments = [], joints = {}, lean = [], J = body.joints, kg = k * g;
  const pts = trunkPoints(body), ribs = body.segments.filter((x) => /^rib\dR$/.test(x.name));
  const ribZ = ribs.flatMap((x) => x.stations.map((st) => st.at[2])), zLo = Math.min(...ribZ), zHi = Math.max(...ribZ);
  const ribR = Math.max(...ribs.map((x) => (Array.isArray(x.stations[0].r) ? Math.max(...x.stations[0].r) : x.stations[0].r)));
  const open = spec.open ?? 0.5;
  // the torso: at each rib's level the cage's band drawn in by about a rib's thickness, the front further by the rot
  const level = (z) => { const B = band(pts, z - 0.02 * k, z + 0.02 * k); const d = ribR * 1.1, front = B.front - d - open * 0.07 * k, back = B.back + d;
    return { z: r3(z), r: [r3(B.ax - d), r3((front - back) / 2)], yc: r3((front + back) / 2) }; };
  const cage = [0, 1, 2, 3, 4].map((i) => level(zLo + 0.01 * k + ((zHi - zLo - 0.01 * k) * i) / 4));
  const low = cage[0], hipZ = J.hip[2];
  // the belly sunk under the cage, narrower and drawn back to the spine
  const belly = [hipZ + 0.07 * k, (hipZ + 0.07 * k + low.z) / 2].map((z, i) => ({ z: r3(z), r: [r3(low.r[0] * (0.68 + 0.08 * i)), r3(low.r[1] * 0.72)], yc: r3(low.yc - low.r[1] * 0.2) }));
  const stations = [...belly, ...cage];
  segments.push({ name: 'fleshTorso', kind: 'trunk', stations, caps: { back: [0, stations[0].yc, r3(stations[0].z - 0.02 * k)], tip: [0, cage.at(-1).yc, r3(cage.at(-1).z + 0.03 * k)] },
    group: 'Flesh', tint: '#cccccc', mirror: 'plane', bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 } } } });
  lean.push('fleshTorso');
  // the limbs: each side its own roll (rot is never even), an end of bone bare at each joint
  const split = !!J['shoulder__L'];
  const at = (n, S) => (S === 'R' ? J[n] : split && J[`${n}__L`] ? J[`${n}__L`] : mir(J[n]));
  for (const S of ['R', 'L']) for (const { limb, from, to, r } of limbs) {
    const keep = rand() < (spec.limbs ?? 0.6), t0 = 0.1 + 0.12 * rand(), t1 = 0.55 + 0.35 * rand();
    if (!keep || (lost && lost.side === S && (lost.part === limb || (lost.part === 'foreArm' && limb === 'foreArm')))) continue;
    const A = at(from, S), B = at(to, S), name = `flesh${limb[0].toUpperCase()}${limb.slice(1)}${S}`, ja = `${name}a`, jb = `${name}b`;
    joints[ja] = lerp(A, B, t0); joints[jb] = lerp(A, B, t1);
    segments.push({ name, kind: 'segment', from: ja, to: jb, rA: r3(r[0] * kg * s), rB: r3(r[1] * kg * s), over: [0.5, 0.5], group: 'Flesh', tint: '#cccccc', mirror: null, bind: { bone: `${limb}${S}` } });
    if (/Arm/.test(limb)) lean.push(name);
  }
  // the throat, in front of the column
  if (rand() < (spec.neck ?? 0.6)) {
    const fw = [0, r3(0.02 * k), 0];
    joints.fleshNecka = add(lerp(J.neckBase, J.neckTop, 0.1), fw).map(r3); joints.fleshNeckb = add(lerp(J.neckBase, J.neckTop, 0.85), fw).map(r3);
    segments.push({ name: 'fleshNeck', kind: 'segment', from: 'fleshNecka', to: 'fleshNeckb', rA: r3(0.017 * kg), rB: r3(0.014 * kg), over: [0.4, 0.4], group: 'Flesh', tint: '#cccccc', mirror: 'plane', bind: { bone: 'neck' } });
    lean.push('fleshNeck');
  }
  // the scalp: the braincase's upper rows a little proud of the bone, pulled back off the brow
  const brain = skull && body.segments.find((x) => x.name === 'braincase');
  if (brain && rand() < (spec.scalp ?? 0.5)) {
    const z0 = brain.stations[0].z, top = brain.stations.at(-1).z, cut = z0 + (top - z0) * (0.4 + 0.15 * rand()), back = (0.008 + 0.012 * rand()) * k;
    const rows = brain.stations.filter((st) => st.z >= cut).map((st) => ({ z: st.z, r: st.r.map((v) => r3(v * 1.04)), yc: r3(st.yc - back) }));
    if (rows.length >= 2) {
      segments.push({ name: 'scalp', kind: 'trunk', stations: rows, caps: { back: [0, rows[0].yc, r3(rows[0].z - 0.004 * k)], tip: [brain.caps.tip[0], r3(brain.caps.tip[1] - back), r3(brain.caps.tip[2] + 0.004 * k)] }, group: 'Flesh', tint: '#cccccc', mirror: 'plane', bind: { bone: 'head' } });
      lean.push('scalp');
    }
  }
  return { segments, joints, lean };
}

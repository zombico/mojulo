/**
 * THE SERPENT'S COIL: a snake-kin's lower body (`beast.legs: 'serpent'`, the lamia's), a person's torso, arms and head on
 * the tiered body carried on a serpent's coil in place of the legs.
 *
 *   serpentCoil(plan, hero)  → after the tiered passes: the legs' parts gone (the thigh, the shank, the foot, the toes,
 *                              the knee's bridge; their bones and joints stay, so every clip still plays, moving nothing
 *                              seen); the pelvis cut at the hips, and the coil grown out of its own ring there, point for
 *                              point (one surface, as the nape grows out of the neck: no crossing to crease): down and a
 *                              little forward to the ground under the hips, then along the ground behind in an S,
 *                              tapering to a point. Its rings are the hip ring's slots carried along the path by a frame
 *                              that never twists (parallel transport), each at its half width and half height, so on the
 *                              ground its underside lies on the floor.
 *
 * Its first joints ride the pelvis (the hips carry the coil's top); the rest are planted (station-loft-rig.js `planted`:
 * they stand where they rest in every pose), so the length on the ground lies there whatever the hips do. Each link on the
 * ground is a chain (`coil<i>`, about the vertical, turning every joint after it), and the rig carries the wave they make
 * (`wave`: its chains, its amplitude in degrees, its wavelength in links), which every gait's clip plays at its phase,
 * travelling toward the tail: the slither (hero-motion.js locomotionClips). Absent, nothing. Pure.
 */
import { beastCard } from './tiered.js';
import { scaleOf } from './topology.js';
import { partRings } from '../polygonizer/tiered-form.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };
// v turned by the least rotation taking unit a onto unit b
const transport = (v, a, b) => { const k = cross(a, b), s = Math.hypot(...k), c = dot(a, b); if (s < 1e-9) return v; const n = mul(k, 1 / s);
  return add(add(mul(v, c), mul(cross(n, v), s)), mul(n, dot(n, v) * (1 - c))); };

/** the coil's path from the hip ring (metres at the biped's 2 m: x across, y forward, z down from the hip ring; `null` a
 * point on the ground, at its own half height), its half width and half height at each point (shares of the hip ring's
 * half width), the rings between two points, and the points the pelvis carries */
export const COIL = Object.freeze({
  path: Object.freeze([[0, 0, 0], [0, 0.08, 0.36], [0, 0.06, 0.6], [0.03, -0.18, null], [0.2, -0.5, null], [0.06, -0.86, null], [-0.16, -1.2, null], [-0.07, -1.56, null], [0.1, -1.9, null], [0.06, -2.22, null]]),
  r: Object.freeze([null, [0.86, 0.6], [0.76, 0.56], [0.7, 0.5], [0.64, 0.46], [0.55, 0.4], [0.45, 0.33], [0.34, 0.26], [0.22, 0.17], [0.09, 0.08]]),
  between: 3,
  ride: 1,
  ground: 3,
  wave: Object.freeze({ amp: 12, links: 4 }),
});
const LEG_PART = /^(thigh|shank|foot|toes|paw|hallux|toe\d|kneeBridge|hockBridge)(R|L|\$S)?$|^(hallux|toe\d)Claw(R|L|\$S)?$/;

export const coilOf = (hero) => beastCard(hero)?.legs === 'serpent';

export function serpentCoil(plan, hero) {
  if (!coilOf(hero)) return plan;
  const k = scaleOf(plan), RJ = { ...plan.rig.joints }, J = plan.joints;
  const pelvis = plan.segments.find((s) => s.name === 'pelvis' && s.kind === 'trunk');
  // THE HIP RING: the pelvis's station at the hip joint's height, its own points (the coil's first ring, point for point)
  const hipZ = J.hip[2], cut = pelvis.stations.reduce((b, st, i) => (Math.abs(st.z - hipZ) < Math.abs(pelvis.stations[b].z - hipZ) ? i : b), 0);
  // (its slots in the pelvis's own family's order, round the ring: the points object's keys are not)
  const fam = typeof pelvis.slots === 'string' ? pelvis.slots : null, ring0 = partRings(plan, pelvis).stations[cut].points, c0 = centre(ring0);
  const slots = fam ? (plan.slotFamilies?.[fam] ?? SLOT_FAMILIES[fam]) : Array.isArray(pelvis.slots) ? pelvis.slots : Object.keys(ring0);
  const w0 = Math.max(...slots.map((sl) => Math.abs(ring0[sl][0] - c0[0]))), h0 = Math.max(...slots.map((sl) => Math.abs(ring0[sl][1] - c0[1])));
  // each slot's place round the ring, as the ellipse's unit circle (so a ring of any size keeps it)
  const unitOf = Object.fromEntries(slots.map((sl) => { const q = sub(ring0[sl], c0); return [sl, [q[0] / w0, q[1] / h0]]; }));
  // THE PATH: its control points, then Catmull-Rom between them (rounded bends), each with its half width and height
  const ctrl = COIL.path.map(([x, y, z], i) => { const hh = i === 0 ? h0 : COIL.r[i][1] * w0; return [r6(c0[0] + x * k), r6(c0[1] + y * k), r6(z === null ? hh : c0[2] - z * k)]; });
  const half = COIL.r.map((r, i) => (i === 0 ? [w0, h0] : [r[0] * w0, r[1] * w0]));
  const cr = (p0, p1, p2, p3, t) => [0, 1, 2].map((q) => 0.5 * ((2 * p1[q]) + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t * t + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t * t * t));
  const n = ctrl.length - 1, S = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < COIL.between + (i === n - 1 ? 1 : 0); j++) {
    const t = j / COIL.between, p = cr(ctrl[Math.max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[Math.min(n, i + 2)], t);
    S.push({ at: p, half: half[i].map((x, q) => x + (half[i + 1][q] - x) * t), link: i, t });
  }
  // (a station on the ground stands at its own half height, its underside on the floor)
  for (const s of S) if (s.link >= COIL.ground - 1) s.at[2] = Math.max(s.at[2], s.half[1]);
  // THE RINGS: the hip ring first, then each station's ring in a frame carried down the path without twist
  const dir = (i) => unit(sub(S[Math.min(i + 1, S.length - 1)].at, S[Math.max(i - 1, 0)].at));
  let d = [0, 0, -1], a = [1, 0, 0], b = [0, 1, 0];
  const stations = S.map((s, i) => {
    if (i === 0) return { id: 'st0', points: Object.fromEntries(slots.map((sl) => [sl, ring0[sl].map(r6)])) };
    const di = dir(i); a = unit(transport(a, d, di)); b = unit(transport(b, d, di)); d = di;
    return { id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, add(s.at, add(mul(a, unitOf[sl][0] * s.half[0]), mul(b, unitOf[sl][1] * s.half[1]))).map(r6)])) };
  });
  // THE RIG: a joint at each control point, the first ones riding the pelvis; a bone between each; the ground's chains
  ctrl.forEach((p, i) => { RJ[`coil${i}`] = { at: p, ...(i < COIL.ride ? { rides: 'pelvis' } : {}) }; });
  const bones = [...plan.rig.bones, ...ctrl.slice(0, -1).map((_, i) => ({ id: `coil${i}`, head: `coil${i}`, tail: `coil${i + 1}` }))];
  const ground = ctrl.map((_, i) => i).filter((i) => i >= COIL.ground && i < n);
  const chains = { ...(plan.rig.chains ?? {}), ...Object.fromEntries(ground.map((i) => [`coil${i}`, { axis: 'z', links: [{ pivot: `coil${i}`, joints: ctrl.slice(i + 1).map((_, j) => `coil${i + 1 + j}`) }] }])) };
  // its skin: the hip ring the pelvis's, then each station shared between its link's bone and the next by where it lies
  const blend = { back: { pelvis: 1 }, st0: { pelvis: 1 } };
  S.forEach((s, i) => { if (i === 0) return; const lo = s.link === 0 ? 'pelvis' : `coil${s.link - 1}`, hi = `coil${Math.min(s.link, n - 1)}`, wHi = r6(0.5 + 0.5 * s.t);
    blend[`st${i}`] = lo === hi ? { [hi]: 1 } : { [lo]: r6(1 - wHi), [hi]: wHi }; });
  blend.tip = { [`coil${n - 1}`]: 1 };
  const last = S.at(-1), tip = add(last.at, mul(dir(S.length - 1), last.half[0] * 0.9)).map(r6);
  const coil = { name: 'coil', kind: 'rings', slots: fam ?? slots, group: 'Coil', stations, caps: { back: add(c0, [0, 0, 0.3 * h0]).map(r6), tip }, bind: { bone: 'coil0', blend } };
  // THE PELVIS cut at the hip ring: the stations below it gone, its cap held inside, over the ring
  const cutPelvis = { ...pelvis, stations: pelvis.stations.slice(cut), caps: { ...pelvis.caps, back: add(c0, [0, 0, 0.3 * h0]).map(r6) } };
  const segments = [...plan.segments.filter((g) => !LEG_PART.test(g.name)).map((g) => (g === pelvis ? cutPelvis : g)), coil];
  const dials = Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, dl]) => [id, Array.isArray(dl.parts) ? { ...dl, parts: [...dl.parts.filter((p) => !LEG_PART.test(p)), ...(dl.parts.includes('pelvis') ? ['coil'] : [])] } : dl]));
  const palette = { ...(plan.palette ?? {}), Coil: plan.palette?.Coil ?? plan.palette?.Skin ?? '#5d6b3e' };
  return { ...plan, segments, dials, palette, rig: { ...plan.rig, joints: RJ, bones, chains, planted: ctrl.map((_, i) => `coil${i}`).filter((_, i) => i >= COIL.ride),
    wave: { chains: ground.map((i) => `coil${i}`), ...COIL.wave } } };
}

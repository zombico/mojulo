/**
 * BODY-RELATIONAL ARMOUR — an armour kit (armor/expand.js, its pieces station-loft-adorn.js adornments) FITTED to the
 * realistic body: the style still names every piece, its window on its carrier (`s` its stations, `t` its ring) and its
 * ornament; the fit makes each plate a SHELL over the realistic skin it covers, sampled as densely as that skin (a
 * window of the torso's 48 slots and 49 rings is no longer drawn on the authored body's 6 × 4), and hollow (the kit's
 * own plate: a wall rolled at its edges and faired over the forms beneath, bridging the grooves between the muscles,
 * station-loft-adorn.js `hollowShell`), unless the style shapes the piece itself (`edge`).
 *
 *   fitPlates(kit, parts, { density }) → the kit, each plate's sampling raised to its carrier's (`density` of it)
 *   wornPieces(kit, wear)                → the kit without the OPTIONAL pieces the build's `wear` does not name
 *   fieldPlates(kit, recipe, R, build, map) → { kit, parts } | null: the CUIRASS (the kit's breast and back plates)
 *                                            and the FAULD made field shells round the trunk over their rings (a field
 *                                            garment at a plate's clearance, taut over the forms: body-relational-
 *                                            garment.js), the kit without them; a piece worn over them (a strap, a
 *                                            tasset) stacks over them; the PAULDRONS caps over the shoulders (`jointCap`)
 *   jointCap(pts, { at, axis, cone, … })   → a closed plate domed over a joint
 *
 * A strap, a signature or a piece that is not plate keeps its own. Pure data; deterministic.
 */

import { fieldGarment } from './body-relational-garment.js';
import { ringSlots } from './body-relational-resample.js';

/** the groups a plate is worn in (station-loft-adorn.js kits: the armour cards' metal and lacquer) */
const PLATE = /^(Plate|Iron|Steel|Silver|Lacquer|Metal|Helm)/;

/** the pieces the realistic fit leaves off unless the build's `wear` names them (armor/expand.js validates the word): the
 * gorget, a band flared from the neck over both shoulders */
export const OPTIONAL_PIECES = Object.freeze({ gorget: /^neck-gorget$/ });

/** The kit without the optional pieces its build does not `wear`. */
export function wornPieces(kit, wear = []) {
  if (!Array.isArray(kit)) return kit;
  const off = Object.entries(OPTIONAL_PIECES).filter(([w]) => !wear.includes(w)).map(([, re]) => re);
  return kit.filter((A) => !A || !off.some((re) => re.test(A.id)));
}

/** The kit fitted to the realistic body's `parts` (see the head of this file). */
export function fitPlates(kit, parts, { density = 0.75 } = {}) {
  if (!Array.isArray(kit)) return kit;
  return kit.map((A) => {
    if (!A || (A.mode !== 'shell' && A.mode !== 'band') || !PLATE.test(A.group ?? '') || !parts[A.part]) return A;
    const P = parts[A.part], U = P.stations.map((st, i) => st.u ?? i), half = P.slots.length / 2;
    const H = P.slotT ? Math.max(...Object.values(P.slotT)) : half, [s0, s1] = [Math.min(...A.s), Math.max(...A.s)];
    // (the carrier's rings within the window, and its slots across it: a wrap's are each half's)
    const rings = U.filter((u) => u >= s0 - 1e-9 && u <= s1 + 1e-9).length, across = A.t === 'wrap' ? half : (half * Math.abs(A.t[1] - A.t[0])) / H;
    const ns = Math.max(A.ns ?? 4, Math.ceil(rings * density)), nt = Math.max(A.nt ?? 12, Math.ceil(across * density));
    return { ...A, ns, nt, ...(A.mode === 'shell' && A.edge === undefined ? { edge: 'roll' } : {}) };
  });
}

/** the plates made as FIELD SHELLS (a field garment at a plate's clearance, taut over the forms: the chest one form, not
 * its muscles): the kit's pieces each replaces (`of`), its cloth, and its clearance over the kit's stand-off (`ease`;
 * `over` the shell it is worn outside of, a few millimetres out). The CUIRASS the breast and the back plates as one
 * closed shell over their rings; the FAULD the hoops from the cuirass's lower edge (tucked up under it) over the waist
 * and the hips, round the torso's and the pelvis's rings. */
const FIELD_PLATES = [
  { id: 'cuirass', of: /^torso-(breast|back)[RL]?$/, covers: ['collar', 'shoulderTop', 'chest', 'breast', 'armpit', 'flank', 'abdomen', 'upperBack', 'back', 'lowerBack'], on: ['torso'] },
  { id: 'fauld', of: /^(torso|pelvis)-fauld$/, covers: ['flank', 'abdomen', 'lowerBack', 'back', 'hip', 'seat', 'groin'], on: ['torso', 'pelvis'], over: 'cuirass', tuck: 0.12 },
];
const PLATE_CLOTH = { looser: 4, reach: 0.08, taut: true, span: 0.2, along: 2 };

/** The plates the kit names made as field shells (see the head of this file): → { kit (without them), parts } | null */
export function fieldPlates(kit, recipe, R, build, map) {
  if (!Array.isArray(kit)) return null;
  let rest = kit; const parts = {}, ease = {};
  for (const F of FIELD_PLATES) {
    const plates = rest.filter((A) => A && F.of.test(A.id) && Array.isArray(A.s) && F.on.includes(A.part));
    if (!plates.length) continue;
    // its window on each part it rides: the kit's own, the fauld's top tucked up under the cuirass's lower edge
    const window = {};
    for (const A of plates) { const w = window[A.part] ?? [Infinity, -Infinity]; window[A.part] = [Math.min(w[0], ...A.s), Math.max(w[1], ...A.s)]; }
    if (F.tuck && window.torso && ease[F.over] !== undefined) window.torso[1] += F.tuck;
    ease[F.id] = Math.max(0.008, ...plates.map((A) => A.mugen ?? 0), F.over && ease[F.over] !== undefined ? ease[F.over] + 0.004 : 0);
    Object.assign(parts, fieldGarment(recipe, R, build, map, { id: F.id, covers: F.covers, on: F.on, ...PLATE_CLOTH, ease: ease[F.id], group: plates[0].group ?? 'Plate', window }).parts);
    rest = rest.filter((A) => !plates.includes(A));
  }
  // THE PAULDRONS: each side's anchor (the kit's `torso-pauldron<S>` and its trim) a cap domed over the shoulder, over
  // the skin of the torso and the upper arm and the cuirass, carried by the clavicle (it rises as the shoulder does); the
  // kit's lames down the arm stay under it
  const pointsOf = (P) => (P ? [...P.stations.flatMap((st) => Object.values(st.points)), ...Object.values(P.caps || {}).filter(Array.isArray)] : []);
  for (const S of ['R', 'L']) {
    const anchors = rest.filter((A) => A && new RegExp(`^torso-pauldron${S}(-trim)?$`).test(A.id)), J = recipe.rig?.joints?.[`shoulder${S}`]?.at;
    if (!anchors.length || !J) continue;
    const beneath = [...pointsOf(recipe.parts.torso), ...pointsOf(recipe.parts[`upperArm${S}`]), ...Object.values(parts).flatMap(pointsOf)];
    parts[`adorn.pauldron${S}`] = jointCap(beneath, { at: J, axis: [S === 'R' ? 1 : -1, 0, 0.55], clearance: (ease.cuirass ?? 0.01) + 0.006, bone: `clavicle${S}`, group: anchors.find((A) => !/trim/.test(A.id))?.group ?? 'Plate' });
    rest = rest.filter((A) => !anchors.includes(A));
  }
  return Object.keys(parts).length ? { kit: rest, parts } : null;
}

/**
 * A JOINT CAP: a plate domed over a joint (a pauldron over the shoulder, a cop over the elbow or the knee) as a closed
 * layer-1 part. Directions in a cone about `axis` from a centre `depth` in from the joint `at` (`cone` degrees; rings over the angle from the
 * axis, slots round it); in each, the farthest point of what lies beneath (`pts`: the skin and what is worn on it)
 * within `tol` degrees of it, faired over its neighbours (a smith's dome, not the muscles under it) and never nearer the
 * joint than that point, then the `clearance` out: the plate's inner face, its outer face a `wall` further, the two
 * rolled into one another at the cone's edge. Carried rigidly by `bone`. Its rings run from the outer face's pole to
 * the edge and back along the inner face to its pole (the part's two caps). Pure; deterministic.
 */
export function jointCap(pts, { at: J, axis, depth = 0.09, cone = 48, clearance = 0.014, rings = 14, slots = 40, tol = 6, fair = 6, wall = 0.004, reach = 0.32, bone, group = 'Plate' }) {
  const unitv = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }, a = unitv(axis);
  // (the dome's centre `depth` in from the joint along the axis: the joint lies just under the shoulder's top, so from
  // it the cap would be a bowl, near at its pole and far at its rim; from deeper in it is a dome)
  const at = [0, 1, 2].map((k) => J[k] - a[k] * depth);
  const ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  // (e1, e2, a right-handed the other way round: the slots run so the outer face winds outward)
  const e1 = unitv(cr(a, ref)), e2 = cr(e1, a), rad = Math.PI / 180;
  const dir = (th, ph) => [0, 1, 2].map((k) => a[k] * Math.cos(th) + Math.sin(th) * (e1[k] * Math.cos(ph) + e2[k] * Math.sin(ph)));
  const near = pts.map((p) => [p[0] - at[0], p[1] - at[1], p[2] - at[2]]).filter((d) => Math.hypot(...d) < reach).map((d) => { const l = Math.hypot(...d); return { u: d.map((x) => x / l), l }; });
  const cosTol = Math.cos(tol * rad), th = Array.from({ length: rings + 1 }, (_, i) => (cone * rad * i) / rings), ph = Array.from({ length: slots }, (_, j) => (2 * Math.PI * j) / slots);
  // the farthest beneath along each direction (the pole's alone on the axis), a hole filled from its ring
  const far = (d) => { let r = -1; for (const q of near) if (q.l > r && q.u[0] * d[0] + q.u[1] * d[1] + q.u[2] * d[2] > cosTol) r = q.l; return r; };
  const raw = th.map((t, i) => (i === 0 ? [far(a)] : ph.map((p) => far(dir(t, p)))));
  for (let i = 0; i <= rings; i++) { const row = raw[i], ok = row.filter((r) => r > 0), m = ok.length ? ok.reduce((x, y) => x + y, 0) / ok.length : (raw[i - 1]?.[0] ?? 0.05); raw[i] = row.map((r) => (r > 0 ? r : m)); }
  // faired: each a mean of its neighbours (round the ring, and the rings either side), held clear of what it covers
  let R = raw.map((row) => row.slice());
  const at2 = (i, j) => (i === 0 ? R[0][0] : R[i][((j % slots) + slots) % slots]);
  for (let it = 0; it < fair; it++) R = R.map((row, i) => (i === 0 ? [Math.max(raw[0][0], (R[0][0] + R[1].reduce((x, y) => x + y, 0) / slots) / 2)] : row.map((_, j) => Math.max(raw[i][j], (at2(i, j) * 2 + at2(i, j - 1) + at2(i, j + 1) + at2(i - 1, j) + at2(Math.min(rings, i + 1), j)) / 6))));
  const r6 = (x) => Math.round(x * 1e6) / 1e6, P = (d, r) => [0, 1, 2].map((k) => r6(at[k] + d[k] * r));
  // (the body's ring slots, a midline slot, the right half, a midline slot, the left: the loft mirrors its faces by name)
  const names = ringSlots(slots);
  const ring = (i, off) => Object.fromEntries(ph.map((p, j) => [names[j], P(dir(th[i], p), R[i][j] + off)]));
  // outer face out to the edge, the roll (the edge's bead, half way between the faces and a little past the cone), the inner face back
  const roll = Object.fromEntries(ph.map((p, j) => [names[j], P(dir(th[rings] + 1.5 * rad, p), R[rings][j] + clearance + wall / 2)]));
  const stations = [
    ...th.slice(1).map((_, k) => ({ id: `st${k}`, u: k, points: ring(k + 1, clearance + wall) })),
    { id: `st${rings}`, u: rings, points: roll },
    ...th.slice(1).map((_, k) => rings - k).map((i, k) => ({ id: `st${rings + 1 + k}`, u: rings + 1 + k, points: ring(i, clearance) })),
  ];
  // (the inner face's pole a millimetre in from its last ring's centre, toward the dome's centre: the loft winds a cap
  // toward where its pole lies from its ring, and the inner face looks inward)
  const last = Object.values(stations[stations.length - 1].points), c = [0, 1, 2].map((k) => last.reduce((x, p) => x + p[k], 0) / last.length);
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: P(a, R[0][0] + clearance + wall), tip: c.map((x, k) => r6(x - a[k] * 0.001)) }, group, bind: { bone } };
}

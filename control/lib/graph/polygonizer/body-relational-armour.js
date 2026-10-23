/**
 * BODY-RELATIONAL ARMOUR — an armour kit (armor/expand.js, its pieces station-loft-adorn.js adornments) FITTED to the
 * realistic body: the style still names every piece, its window on its carrier (`s` its stations, `t` its ring) and its
 * ornament; the fit makes each plate a SHELL over the realistic skin it covers, sampled as densely as that skin (a
 * window of the torso's 48 slots and 49 rings is no longer drawn on the authored body's 6 × 4), and hollow (the kit's
 * own plate: a wall rolled at its edges and faired over the forms beneath, bridging the grooves between the muscles,
 * station-loft-adorn.js `hollowShell`), unless the style shapes the piece itself (`edge`).
 *
 *   fitPlates(kit, parts, { density }) → the kit, each plate's sampling raised to its carrier's (`density` of it)
 *   roleOf(piece)                        → its ROLE (head, neck, foot, hoop, shoulder, panel) read off its geometry
 *   wornPieces(kit, wear)                → the kit without the head's pieces and the OPTIONAL ones `wear` does not name
 *   fieldPlates(kit, recipe, R, build, map) → { kit, parts, tones } | null: by ROLE, the trunk's front and back panels
 *                                            one CUIRASS and its wraps HOOPS, field shells over their rings (a field
 *                                            garment at a plate's clearance, taut over the forms: body-relational-
 *                                            garment.js); a foot's wrap a BOOT (body-relational-footwear.js); a shoulder's
 *                                            anchor a CAP (`jointCap`); the kit without them, so a piece worn over them
 *                                            (a strap, a tasset) stacks over them
 *   jointCap(pts, { at, axis, cone, … })   → a closed plate domed over a joint
 *
 * A strap, a signature or a piece that is not plate keeps its own. Pure data; deterministic.
 */

import { fieldGarment } from './body-relational-garment.js';
import { ringSlots } from './body-relational-resample.js';
import { footwear } from './body-relational-footwear.js';

/** the groups a plate is worn in (station-loft-adorn.js kits: the armour cards' metal and lacquer) */
const PLATE = /^(Plate|Iron|Steel|Silver|Lacquer|Metal|Helm)/;

/** the roles the realistic fit leaves off unless the build's `wear` names them (armor/expand.js validates the word): the
 * gorget, a band flared from the neck over both shoulders (the role `neck`, a collar too) */
export const OPTIONAL_PIECES = Object.freeze({ gorget: 'neck' });

/** The kit without the pieces the realistic body does not wear: the head's (`roleOf`: not fitted to the relational head
 * yet, a strap or a signature hung from them with them) and the optional ones its build does not `wear`. */
export function wornPieces(kit, wear = []) {
  if (!Array.isArray(kit)) return kit;
  const off = new Set(['head', ...Object.entries(OPTIONAL_PIECES).filter(([w]) => !wear.includes(w)).map(([, role]) => role)]);
  // (a strap hung from a dropped piece: its trim `<id>-…`, a row's cords `<key>o<row>c<k>` of the rows `<key><row>`)
  const dropped = kit.filter((A) => A && off.has(roleOf(A))), on = (A) => A && (HEAD_PARTS.test(A.part) || dropped.some((D) => A.id.startsWith(`${D.id}-`) || A.id.startsWith(`${D.id.replace(/\d+$/, '')}o`)));
  return kit.filter((A) => !dropped.includes(A) && !on(A));
}

/** The kit fitted to the realistic body's `parts` (see the head of this file). */
export function fitPlates(kit, parts, { density = 0.75 } = {}) {
  if (!Array.isArray(kit)) return kit;
  return kit.map((A) => {
    // (a STRAP hugs what lies right under it: its lift read within 2 cm (the cuirass's spacing), not the authored body's few, which over
    // the realistic body's curves found the bulge beside it and stood the strap off)
    if (A?.mode === 'strap') return { ...A, rad: Math.min(A.rad ?? 0.05, 0.02) };
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
/**
 * A piece's ROLE on the realistic body, read from its geometry (its carrier, its window, whether it wraps, what it spans),
 * never its family's names, so a style the fit has never seen is fitted by what its pieces cover:
 *   head      on the head or pinned to it (a helm, a neck guard hung from it): not fitted to the relational head yet
 *   neck      a wrap round the neck (a gorget, a collar): optional
 *   foot      a wrap round the foot (a sabaton, an armoured boot): the footwear primitive's boot
 *   hoop      a wrap round the trunk (a fauld's lame, a belt, a lamellar row): a field hoop over its window
 *   shoulder  a trunk shell spanning the upper arm (a pauldron's anchor): a cap domed over the shoulder
 *   panel     a trunk shell on a window of the ring, not pinned (a breastplate, a backplate, an abdomen's plate): with
 *             panels both front and back, one closed CUIRASS over their rings; a lone side (a lamellar chest plate)
 *             fitted as it is; a pinned one hangs (a skirt's plate) and keeps its kit shape
 * Anything else (a limb's tube, a cop, a board, a strap, a signature) keeps its kit shape, fitted (`fitPlates`).
 */
export function roleOf(A) {
  if (!A || A.mode === 'strap') return null;
  const pin = Array.isArray(A.pin) ? A.pin[3] : A.pin?.parent, wrap = A.t === 'wrap';
  if (HEAD_PARTS.test(A.part) || HEAD_PARTS.test(pin ?? '')) return 'head';
  if (A.part === 'neck' && wrap) return 'neck';
  if (/^foot[RL]$/.test(A.part) && wrap) return 'foot';
  if ((A.part === 'torso' || A.part === 'pelvis') && wrap) return 'hoop';
  if (A.part === 'torso' && A.mode === 'shell' && (A.over || []).some((o) => /^upperArm/.test(o))) return 'shoulder';
  // (a PINNED panel hangs from its pin, a skirt's plate: not the trunk's shell)
  if (A.part === 'torso' && A.mode === 'shell' && Array.isArray(A.t) && !A.pin) return 'panel';
  return null;
}
const HEAD_PARTS = /^(cranium|jaw|visage|nose|eye[RL]|ear[RL]|head|headSkin|globe[RL]|mouth)$/;
/** a plate's cloth as a field shell: taut over every dip shorter than 20 cm (the chest one form, not its muscles) */
const PLATE_CLOTH = { looser: 4, reach: 0.08, taut: true, span: 0.2, along: 2 };
const CUIRASS_COVERS = ['collar', 'shoulderTop', 'chest', 'breast', 'armpit', 'flank', 'abdomen', 'upperBack', 'back', 'lowerBack'];

/** The trunk's plates, the feet and the shoulders made by their roles (see `roleOf` and the head of this file):
 * → { kit (without them), parts, tones } | null */
export function fieldPlates(kit, recipe, R, build, map) {
  if (!Array.isArray(kit)) return null;
  let rest = kit, tones = {}, cuirass = null; const parts = {}, gone = [];
  const take = (As) => { gone.push(...As); rest = rest.filter((A) => !As.includes(A)); };
  // THE CUIRASS: the trunk's panels, front and back, one closed shell over all their rings, at the kit's stand-off
  const T = recipe.parts.torso, H = T?.slotT ? Math.max(...Object.values(T.slotT)) : (T?.slots.length ?? 8) / 2;
  const panels = rest.filter((A) => roleOf(A) === 'panel'), mid = (A) => (A.t[0] + A.t[1]) / 2;
  if (panels.some((A) => mid(A) < H / 2) && panels.some((A) => mid(A) >= H / 2)) {
    const s0 = Math.min(...panels.map((A) => Math.min(...A.s))), s1 = Math.max(...panels.map((A) => Math.max(...A.s)));
    cuirass = { s0, ease: Math.max(0.008, ...panels.map((A) => A.mugen ?? 0)) };
    Object.assign(parts, fieldGarment(recipe, R, build, map, { id: 'cuirass', covers: CUIRASS_COVERS, on: ['torso'], ...PLATE_CLOTH, ease: cuirass.ease, group: panels[0].group ?? 'Plate', window: { torso: [s0, s1] } }).parts);
    take(panels);
  }
  // THE HOOPS, in the kit's order (its stacking: each one worn over the one before), outside the cuirass; a hoop that
  // meets the cuirass's lower edge tucked up under it, so it hangs from it
  // (and the trunk closed down to what hangs from it: with no cuirass, the lowest torso hoop carried down to the top of
  // the skirt's hanging plates, a little behind them, so no band of the belly shows between the two)
  let hoopEase = (cuirass?.ease ?? 0.008) + 0.004; const made = new Set();
  const hoops = rest.filter((x) => roleOf(x) === 'hoop'), torsoHoops = hoops.filter((A) => A.part === 'torso');
  const hang = rest.filter((A) => A && A.part === 'torso' && A.mode === 'shell' && Array.isArray(A.t) && A.pin && Array.isArray(A.s));
  const hangTop = hang.length ? Math.max(...hang.map((A) => Math.max(...A.s))) : null;
  const lowest = !cuirass && hangTop !== null && torsoHoops.length ? torsoHoops.reduce((a, b) => (Math.min(...b.s) < Math.min(...a.s) ? b : a)) : null;
  for (const A of hoops) {
    const w = [Math.min(...A.s), Math.max(...A.s)], key = `${A.part}:${w}`;
    if (lowest && Math.min(...A.s) === Math.min(...lowest.s) && A.part === 'torso' && w[0] > hangTop) w[0] = hangTop - 0.05;
    // (a hoop round the whole trunk is one: a side's copy of the same window goes with it)
    if (made.has(key)) { take([A]); continue; }
    made.add(key);
    if (cuirass && A.part === 'torso' && w[1] < cuirass.s0 + 0.12 && w[1] > cuirass.s0 - 0.3) w[1] = cuirass.s0 + 0.12;
    const id = A.id.split('-').slice(1).join('') || 'hoop', e = Math.max(A.mugen ?? 0, hoopEase);
    Object.assign(parts, fieldGarment(recipe, R, build, map, { id, covers: null, on: [A.part], ...PLATE_CLOTH, ease: e, group: A.group ?? 'Plate', window: { [A.part]: w } }).parts);
    hoopEase = e + 0.002;
    take([A]);
  }
  // THE FEET: a boot, the footwear primitive's (body-relational-footwear.js), once for both
  const feet = rest.filter((A) => roleOf(A) === 'foot');
  if (feet.length) { const W = footwear(recipe, R, build, map, 'boots', { id: 'boots' }); Object.assign(parts, W.parts); tones = { ...tones, ...W.tones }; take(feet); }
  // THE SHOULDERS: each side's a cap domed over the shoulder, over the skin of the torso and the upper arm and what the
  // trunk wears, carried by the clavicle (it rises as the shoulder does); the kit's lames down the arm stay under it
  const pointsOf = (P) => (P ? [...P.stations.flatMap((st) => Object.values(st.points)), ...Object.values(P.caps || {}).filter(Array.isArray)] : []);
  for (const S of ['R', 'L']) {
    const anchors = rest.filter((A) => roleOf(A) === 'shoulder' && (A.over || []).includes(`upperArm${S}`)), J = recipe.rig?.joints?.[`shoulder${S}`]?.at;
    if (!anchors.length || !J) continue;
    const beneath = [...pointsOf(recipe.parts.torso), ...pointsOf(recipe.parts[`upperArm${S}`]), ...Object.values(parts).flatMap(pointsOf)];
    parts[`adorn.pauldron${S}`] = jointCap(beneath, { at: J, axis: [S === 'R' ? 1 : -1, 0, 0.55], clearance: (cuirass?.ease ?? 0.01) + 0.006, bone: `clavicle${S}`, group: anchors[0].group ?? 'Plate' });
    take(anchors);
  }
  // (a strap trimming a piece made over, its edge's bead, goes with it)
  take(rest.filter((A) => A && A.mode === 'strap' && gone.some((G) => A.id.startsWith(`${G.id}-`))));
  return Object.keys(parts).length ? { kit: rest, parts, tones } : null;
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

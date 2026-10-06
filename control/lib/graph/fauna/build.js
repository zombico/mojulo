// The fauna BUILDER: one parameter object → a ring plan (layered-plan-v1) carrying its head plan (layered-head-v1),
// its body detail (`body`) and adornment (`adorn`). Pure data, deterministic, no I/O. Every table is a parameter
// (joints, trunk stations, leg rings, skull and jaw rows, ears, tail, extra ornaments / segments / tiles); a FAMILY
// (families.js) supplies the tables a body plan shares, a SPECIES (species.js) the numbers that make it that animal.
// Grown from the 0929 creature spike's builder; the bar it is judged against is anatomy and geometry at low poly
// (species read, proportion, stance, silhouette), not finish.
//
// Frame: metres, +z up, +y front, x = 0 the mirror plane, feet on z = 0. Tables are authored at the family's size
// and `scale` shrinks or grows the whole animal about the ground point.

import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, pinFrame } from '../polygonizer/station-loft.js';
import { surfaceLocalOffset } from '../polygonizer/surface-pin.js';
import { wearWings } from './wing.js';
import * as dmath from '../../util/dmath.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const mul = (r, m) => (Array.isArray(r) ? r.map((x) => x * m) : r * m);

/** Merge a species over its family: one level deep for the object tables, outright for arrays and scalars. */
export function mergeParams(base, over) {
  const out = clone(base);
  for (const [k, v] of Object.entries(over || {})) {
    const b = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b) ? { ...b, ...clone(v) } : clone(v);
  }
  return out;
}

export function buildFauna(params) {
  const P = clone(params);
  const C = P.colors;
  const joints = clone(P.joints);

  // ── the body: a level trunk loft, a neck, a tail (+ its tip), the legs ──
  // every trunk centre at ONE height: a near-horizontal loft's ring `front` is +y projected off its axis, so a chord
  // that rises or falls a little flips front between belly and back (a 180-degree twist); a level chord takes +z
  const torso = { name: 'torso', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: clone(P.torso), caps: clone(P.torsoCaps) };
  const neck = { name: 'neck', kind: 'segment', from: 'neckBase', to: 'neckTop', rA: P.neckRA, rB: P.neckRB, rMid: P.neckRMid, slots: 'ring12', over: [0.3, 0.4], group: P.neckGroup || 'Coat', mirror: 'plane' };
  const loft = (name, pts, group, caps) => ({ name, kind: 'loft', slots: 'ring12', group, mirror: 'plane', stations: pts.map(([x, y, z, r]) => ({ at: [x, y, z], r })), ...(caps ? { caps } : {}) });
  const tail = P.tail ? loft('tail', P.tail, 'Coat') : null;
  const tailTip = P.tail && P.tip ? loft('tailTip', P.tip, 'Tip', clone(P.tipCaps)) : null;
  // a leg row: [name, from, to, rA, rB, group, over?, rMid?] — mirrored by name (…R → …L)
  const legs = P.legs.map(([name, from, to, rA, rB, group, over, rMid]) => ({ name, kind: 'segment', from, to, rA, rB, slots: 'ring12', group, mirror: 'name', over: over || [0.5, 0.4], ...(rMid ? { rMid } : {}) }));
  const extra = clone(P.extraSegments || []);

  // the mass knobs: the trunk's rings, the legs' rings, the tail's rings
  for (const st of torso.stations) st.r = mul(st.r, P.bulk ?? 1);
  for (const g of legs) for (const f of ['rA', 'rB', 'rMid']) if (g[f] !== undefined) g[f] = mul(g[f], P.legBulk ?? 1);
  for (const g of [tail, tailTip]) if (g) for (const st of g.stations) st.r = mul(st.r, P.tailBush ?? 1);

  // ── the HEAD as plan data (layered-head-v1) in its own frame (+y front, +z up); its nape sits on neckTop ──
  const row = ([id, y, top, crown, brow, cheek, jowl, lip, palate]) => [id, y, { top, crown, brow, cheek, jowl, lip, palate }];
  const muzzleAt = P.muzzleFrom ?? 3;   // the first muzzle row: the snout bands and the muzzle knobs start here
  const cranium = {
    slots: ['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate', 'lipL', 'jowlL', 'cheekL', 'browL', 'crownL'],
    rows: P.craniumRows.map(row),
    caps: clone(P.craniumCaps), group: 'Skull',
    capGroups: { back: 'Skull', tip: 'Snout' },
  };
  cranium.bandGroups = Object.fromEntries(cranium.rows.slice(1).map(([id], i) => {
    const m = i + 1 > muzzleAt; return [`${cranium.rows[i][0]}-${id}`, [m ? 'Snout' : 'Skull', m ? 'Snout' : 'Skull', m ? 'Snout' : 'Skull', 'Cheek', 'Jowl', 'Palate']];
  }));
  // face patterns ride the skull bands: `craniumBandGroups` overrides a band's six slot groups by band id ('st4-st5')
  for (const [band, groups] of Object.entries(P.craniumBandGroups || {})) cranium.bandGroups[band] = clone(groups);
  const jaw = { slots: ['gum', 'gumR', 'jawR', 'bottom', 'jawL', 'gumL'], rows: clone(P.jawRows), caps: clone(P.jawCaps), group: 'Jaw', capGroups: { back: 'Jaw', tip: 'Jaw' } };
  // the muzzle: wider (x of every side slot, ramping in over two rows) and shorter (rows past the muzzle start pulled
  // toward it); the jaw follows past the same y
  if (P.muzzleW || P.muzzleLen) {
    const W = P.muzzleW ?? 1, Lm = P.muzzleLen ?? 1, y0 = cranium.rows[muzzleAt][1];
    const widen = (sl, f) => Object.fromEntries(Object.entries(sl).map(([k, v]) => [k, Array.isArray(v) ? [v[0] * f, v[1]] : v]));
    cranium.rows = cranium.rows.map(([id, y, sl], i) => (i < muzzleAt ? [id, y, sl] : [id, y0 + (y - y0) * Lm, widen(sl, 1 + (W - 1) * Math.min(1, (i - muzzleAt + 1) / 2))]));
    cranium.caps.tip = [0, y0 + (cranium.caps.tip[1] - y0) * Lm, cranium.caps.tip[2]];
    jaw.rows = jaw.rows.map(([id, y, sl]) => (y <= y0 ? [id, y, sl] : [id, y0 + (y - y0) * Lm, widen(sl, 1 + (W - 1) * Math.min(1, (y - y0) / 0.12))]));
    jaw.caps.tip = [0, y0 + (jaw.caps.tip[1] - y0) * Lm, jaw.caps.tip[2]];
  }
  const earSpine = P.earSpine.map(([x, y, z]) => [x, y, z * (P.earH ?? 1)]);
  const ears = P.ears === false ? [] : [
    // ears: sweeps along the crown's normal (pin-local z), flattened front to back; the inner ear just in front
    { kind: 'sweep', name: 'ear', at: P.earAt, space: 'local', spine: earSpine, radii: P.earR, m: 8, squash: P.earSquash, group: 'Ears' },
    { kind: 'sweep', name: 'earInner', at: P.earAt, space: 'local', spine: earSpine.map(([x, y, z], i) => [x + 0.012, y, i ? z - 0.014 : z + 0.012]), radii: P.earR.map((r) => r * 0.6), m: 8, squash: P.earSquash, group: 'EarInner' },
  ];
  const head = {
    schema: 'layered-head-v1', name: P.name || 'fauna',
    units: { scale: P.headScale, offset: [0, 0, 0] },
    parts: { cranium, jaw },
    dials: { jawOpen: { min: 0, max: 35, rest: 0, doc: 'degrees the jaw rotates about its hinge (front goes down)', op: 'hinge', part: 'jaw', pivot: 'jaw/st0.gum', axis: 'x', sign: -1 } },
    creases: {},
    refine: [
      { op: 'slot', part: 'jaw', a: 'jaw', b: 'bottom', name: 'chin', f: 0.5 },
      ...cranium.rows.slice(1, 4).map(([id], i) => ({ op: 'station', part: 'cranium', a: cranium.rows[i + 1][0], b: cranium.rows[i + 2]?.[0] ?? id })).filter((r) => r.a !== r.b),
      { op: 'slot', part: 'cranium', a: 'cheek', b: 'jowlR', name: 'flank' },
    ],
    // the expression skin (the head format requires it): the controls address skull rows by id
    skin: { slots: ['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate'], radius: 0.05, controls: clone(P.skinControls) },
    eye: { mode: 'iris', pupil: P.pupil || 'round', irisAngle: P.irisAngle ?? 40, catchlight: true },
    regions: {
      eye: { at: P.eyeAt, R: P.eyeR },
      orbit: { open: [0.45, 0.32], reach: [0.012, 0.014, 0.016], tuck: 0.003, bulk: [0.002, 0.004], thickness: 0.004, ...clone(P.orbit || {}) },
      brow: { strip: P.browStrip, w: 0.012, h: 0.009, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: P.nostrilAt, r: 0.007, squash: [1.3, 1], slide: 0.4 },
      fold: { strip: clone(P.foldStrip) },
      web: { cranium: P.webCranium, jaw: [0.35, 1.7, 0.97] },
      tiles: clone(P.headTiles || []),
    },
    landmarks: { nape: clone(P.nape) },
    ornaments: [
      ...ears,
      { kind: 'sweep', name: 'nose', at: P.noseAt, side: 'R', space: 'local', spine: [[0, 0, -0.008], [0, 0, 0.006], [0, 0, 0.012]], radii: P.noseR, m: 8, squash: [1.35, 1], group: 'NosePad' },
      ...clone(P.headOrnaments || []),
    ],
    palette: {
      Skull: C.coat, Snout: C.snout || C.coat, Cheek: C.ash, Jowl: C.ash, Jaw: C.ash, Palate: C.mouth,
      Brow: C.brow, Pad: C.coat, Lids: C.coat, LidRim: C.ink, Ears: C.ears || C.coat, EarInner: C.ash, Fur: C.ash, FurAlt: C.ashAlt,
      NosePad: C.nose, Teeth: C.teeth, Nostrils: C.ink, Folds: C.coat, Wrinkles: C.coat, Whiskers: C.ash, Mouth: C.mouth, Web: C.ash, Tongue: '#b0506a',
      Sclera: C.sclera, Iris: C.iris, Limbus: C.iris, Pupil: C.ink, Catchlight: '#ffffff', LidShadow: C.sclera,
      Horn: C.horn || '#d8cdb4', Mane: C.mane || C.coat,
    },
  };

  const plan = {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; ${P.name || 'an animal'}, feet on z = 0, facing +y; the head worn by its nape on neckTop` },
    joints, segments: [torso, neck, ...(tail ? [tail] : []), ...(tailTip ? [tailTip] : []), ...legs, ...extra],
    heads: [{ name: 'head', plan: head, expression: 'neutral', on: 'neckTop', ...(P.headPitch ? { pitch: P.headPitch } : {}) }],
    dials: { head: { op: 'include', name: 'head' } },
    palette: { Coat: C.coat, Sock: C.sock, Ash: C.ash, Fur: C.ash, FurAlt: C.ashAlt, Tip: C.tip, Hoof: C.hoof || C.sock, Mane: C.mane || C.coat, Horn: C.horn || '#d8cdb4', Belly: C.belly || C.ash },
  };
  const tiles = clone(P.bodyTiles || []);
  if (tiles.length) plan.body = { tiles };
  if ((P.adorn || []).length) plan.adorn = clone(P.adorn);

  // the whole animal scaled about the ground point (feet stay on z = 0): joints, ring radii, loft stations and caps, the head
  const k = P.scale ?? 1, sv = (v) => v.map((x) => x * k);
  for (const j of Object.keys(joints)) joints[j] = sv(joints[j]);
  for (const g of plan.segments) {
    for (const f of ['rA', 'rB', 'rMid']) if (g[f] !== undefined) g[f] = mul(g[f], k);
    for (const st of g.stations || []) { st.at = sv(st.at); st.r = mul(st.r, k); }
    if (g.caps) for (const c of Object.keys(g.caps)) g.caps[c] = sv(g.caps[c]);
  }
  head.units.scale *= k;
  if (P.torsoUp || P.torso.some((st) => st.top)) uprightTorso(torso);
  if (P.headMesh) wearHeadMesh(plan, { pitch: P.headPitch, ...P.headMesh });
  if (P.wings) wearWings(plan, { scale: k, ...P.wings });   // opt-in: feathered or membrane wings (wing.js), worn at a root joint
  return plan;
}

/** A HEAD MESH worn natively: an authored polygon head (vertices, faces, groups in its own +y front, +z up frame)
 * replaces the ring-built head. Its polygons are kept exactly: the mesh is scaled to `length` (metres, nape to nose)
 * and its anchor (the point `anchor` of the way from its back to its front, at mid height) seated on neckTop, then
 * worn as ONE layer-2 part pinned to a small hidden core loft, every vertex an offset in that pin's frame. */
function wearHeadMesh(plan, { mesh, length, anchor = 0.25, lift = 0, palette = {}, pitch = 0 }) {
  const V = mesh.vertices, axis = (a) => [Math.min(...V.map((v) => v[a])), Math.max(...V.map((v) => v[a]))];
  const [y0, y1] = axis(1), [z0, z1] = axis(2), k = length / (y1 - y0);
  const N = plan.joints.neckTop, at = [0, y0 + (y1 - y0) * anchor, (z0 + z1) / 2];
  // `pitch` (degrees about x through the anchor, + raises the nose) tilts the mesh as the ring head's `headPitch` does
  const ca = dmath.cos(pitch * Math.PI / 180), sa = dmath.sin(pitch * Math.PI / 180);
  const world = V.map((v) => { const y = (v[1] - at[1]) * k, z = (v[2] - at[2]) * k; return [v[0] * k, N[1] + y * ca - z * sa, N[2] + lift + y * sa + z * ca]; });
  // the core: a small level loft inside the head, the pin's parent (a detail part needs a layer-1 surface to ride)
  const r = 0.12 * length, cy = N[1], cz = N[2] + lift;
  plan.segments.push({ name: 'headCore', kind: 'loft', slots: 'ring12', group: 'Skull', mirror: 'plane',
    stations: [{ at: [0, cy - r, cz], r }, { at: [0, cy + r, cz], r }], caps: { back: [0, cy - 2 * r, cz], tip: [0, cy + 2 * r, cz] } });
  delete plan.heads; delete plan.dials.head;
  const built = compileLayered(expandPlan(plan), {}, { details: false, creases: false }).parts.headCore;
  const [faceId, face] = Object.entries(built.faces).sort(([a], [b]) => (a < b ? -1 : 1))[0];
  const pin = { parent: 'headCore', face: faceId, weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: [face[0], face[1]], handedness: 1 };
  const frame = pinFrame(built, pin), id = (i) => `v${String(i).padStart(3, '0')}`;
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const part = {
    layer: 2, pin,
    offsets: Object.fromEntries(world.map((p, i) => [id(i), surfaceLocalOffset(frame, p).map(r6)])),
    faces: Object.fromEntries(mesh.faces.map((f, i) => [`f${String(i).padStart(3, '0')}`, f.map(id)])),
    groups: Object.fromEntries(mesh.groups.map((g, i) => [`f${String(i).padStart(3, '0')}`, g])),
  };
  plan.include = [...(plan.include || []), { name: 'headMesh', parts: { headMesh: part }, shift: [0, 0, 0] }];
  plan.palette = { ...(plan.palette || {}), ...palette };
}

/** THE BACK RISE (opt-in: `torsoUp: true`, or any torso station with `top`). The trunk becomes explicit rings built
 * with a STABLE frame: every ring's `front` slot is world +z projected off the local axis (never +y, which flips
 * between belly and back as the chord rises or falls), so stations may sit at different heights (a sloping back) with
 * no twist. A station's `top` (m, after scale) then raises only the ring's upper half (weight cos of the slot angle
 * from the top, 0 below the side), so the back line climbs toward the rump while the belly keeps its tuck. */
function uprightTorso(torso) {
  const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mulv = (a, m) => a.map((x) => x * m);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => mulv(a, 1 / Math.sqrt(dot(a, a)));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const slots = ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'];
  const C = torso.stations.map((st) => st.at), n = C.length, e = 2;
  const stations = torso.stations.map((st, i) => {
    const d = unit(sub(C[Math.min(i + 1, n - 1)], C[Math.max(i - 1, 0)]));
    const f = unit(sub([0, 0, 1], mulv(d, d[2]))); let s = cross(f, d); if (s[0] < 0) s = mulv(s, -1);
    const [rs, rf] = Array.isArray(st.r) ? st.r : [st.r, st.r], pw = (x) => (x < 0 ? -1 : 1) * dmath.pow(Math.abs(x), 2 / e);
    const points = {};
    slots.forEach((sl, k) => { const t = 2 * Math.PI * k / slots.length, c = dmath.cos(t);
      const p = add(st.at, add(mulv(f, rf * pw(c)), mulv(s, rs * pw(dmath.sin(t)))));
      points[sl] = add(p, [0, 0, (st.top || 0) * Math.max(0, c)]); });
    for (let k = slots.length / 2 + 1; k < slots.length; k++) { const q = points[slots[slots.length - k]]; points[slots[k]] = [-q[0] + 0, q[1], q[2]]; }   // the left half: the right's exact mirror
    return { id: `st${i}`, points };
  });
  const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r), S = torso.stations;
  const caps = torso.caps || { back: add(C[0], mulv(unit(sub(C[0], C[1])), 0.45 * rad(S[0].r))), tip: add(C[n - 1], mulv(unit(sub(C[n - 1], C[n - 2])), 0.45 * rad(S[n - 1].r))) };
  for (const k of Object.keys(torso)) delete torso[k];
  Object.assign(torso, { name: 'torso', kind: 'rings', slots: 'ring12', group: 'Coat', mirror: null, stations, caps });
}

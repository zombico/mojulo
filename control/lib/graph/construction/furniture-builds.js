// construction/furniture-builds — a piece named by a few dials becomes its members and joints: the structure an agent
// does not reliably author by hand (where cams go, how deep a groove sits, how long a tenon may be before it meets
// the one coming the other way, how wide a drawer box is between its slides).
//
// A `frames` entry with `build: { type, …dials }` gets the members and joints below APPENDED to any it writes itself,
// and the report carries the expansion (`report.build.expanded`), so the agent can take it and edit it in place.
// Dials are in the frame's unit; the defaults are the usual millimetre sizes. Front is −y, the floor z = 0, the piece
// starts at x = 0.
//
//   carcass: { w, h, d, t? (18 mm), material? ('mfc'), joinery? ('kd' | 'confirmat' | 'dowel' | 'dado'),
//              plinth? (60 mm; 0 for none), back? ('groove' | 'nailed' | 'none'), backMaterial? ('hardboard'),
//              shelves? (adjustable, on pins), fixed? (fixed shelves), doors? (0 | 1 | 2), hinge? ('left' | 'right'),
//              drawers? (count), drawerHeight? (a front, 180 mm), partition? (a middle upright; default when the inside
//              is wider than 700 mm, past which an 18 mm board shelf of books sags visibly), finish?, edges? }
//   The top, bottom and divider carry 5 kg/m (what stands on a cabinet); shelves the frame's `shelfLoad` (books).
//   table:   { w, d, h, top? (25 mm), leg? (45 mm), apron? (90 mm), apronT? (20 mm), setback? (12 mm), overhang?
//              (30 mm), species? ('oak'), finish?, joinery? ('mortise-tenon' | 'dowel') }
//   chair:   { w? (440 mm), d? (420 mm), seat? (450 mm), back? (850 mm), leg? (36 mm), species? ('beech'), finish?,
//              seatMaterial? ('plywood') }
const FRAME_UNITS = { mm: 0.001, cm: 0.01, m: 1 };                 // frame.js's units (kept here: frame.js imports this)

export const BUILD_TYPES = Object.freeze(['carcass', 'table', 'chair']);
const SLIDES = [250, 300, 350, 400, 450, 500, 550];

const num = (v) => Number.isFinite(v) && v > 0;
/** Why a build is malformed → string[]. */
export function validateBuild(b, at) {
  if (b === undefined) return [];
  if (!b || typeof b !== 'object' || !BUILD_TYPES.includes(b.type)) return [`${at}: { type: ${BUILD_TYPES.map((t) => `'${t}'`).join(' | ')}, …dials }`];
  const e = [];
  const need = b.type === 'chair' ? [] : ['w', 'd', 'h'];
  for (const k of need) if (!num(b[k])) e.push(`${at}.${k}: a size in the frame's unit`);
  for (const k of ['t', 'plinth', 'top', 'leg', 'apron', 'apronT', 'setback', 'overhang', 'drawerHeight', 'seat', 'back', 'w', 'd'])
    if (b[k] !== undefined && typeof b[k] !== 'string' && !(Number.isFinite(b[k]) && b[k] >= 0)) e.push(`${at}.${k}: a size ≥ 0 in the frame's unit`);
  for (const k of ['shelves', 'fixed', 'doors', 'drawers'])
    if (b[k] !== undefined && !(Number.isInteger(b[k]) && b[k] >= 0 && b[k] <= (k === 'doors' ? 2 : 12))) e.push(`${at}.${k}: a whole number${k === 'doors' ? ' (0, 1 or 2)' : ''}`);
  if (b.joinery !== undefined && !(b.type === 'carcass' ? ['kd', 'confirmat', 'dowel', 'dado'] : ['mortise-tenon', 'dowel']).includes(b.joinery)) e.push(`${at}.joinery: ${b.type === 'carcass' ? "'kd', 'confirmat', 'dowel' or 'dado'" : "'mortise-tenon' or 'dowel'"}`);
  if (b.type === 'carcass' && b.back !== undefined && typeof b.back === 'string' && !['groove', 'nailed', 'none'].includes(b.back)) e.push(`${at}.back: 'groove', 'nailed' or 'none'`);
  return e;
}

/** A box member from mm corners, emitted in the frame's unit. */
const boxer = (k) => (id, lo, hi, extra = {}) => ({ id, box: { min: lo.map((v) => Math.round((v / k) * 1e4) / 1e4), max: hi.map((v) => Math.round((v / k) * 1e4) / 1e4) }, ...extra });

/** Expand a frame's `build` → { members, joints, dials } (members in the frame's unit), or null. */
export function expandBuild(spec) {
  const b = spec.build; if (!b) return null;
  const k = FRAME_UNITS[spec.unit || 'cm'] * 1000;                 // mm per unit
  const mmOf = (v, dflt) => (Number.isFinite(v) ? v * k : dflt);
  if (b.type === 'carcass') return carcass(b, k, mmOf);
  if (b.type === 'table') return table(b, k, mmOf);
  return chair(b, k, mmOf);
}

function carcass(b, k, mmOf) {
  const W = b.w * k, H = b.h * k, D = b.d * k;
  const t = mmOf(b.t, 18), pl = mmOf(b.plinth, 60), mat = b.material || 'mfc';
  const back = b.back || 'groove', backMat = b.backMaterial || 'hardboard', bt = 3;
  const joinery = b.joinery || 'kd';
  const nDrawers = b.drawers || 0, dh = mmOf(b.drawerHeight, 180), nDoors = b.doors || 0;
  const skin = { material: mat, ...(b.finish !== undefined ? { finish: b.finish } : {}), ...(b.edges ? { edges: b.edges } : {}) };
  const B = boxer(k);
  const members = [], joints = [];
  const bottomZ = pl;
  const shelfD = back === 'groove' ? D - 17 : D;
  members.push(B('side-l', [0, 0, 0], [t, D, H], skin), B('side-r', [W - t, 0, 0], [W, D, H], skin));
  const light = { shelfLoad: 5 };
  members.push(B('top', [t, 0, H - t], [W - t, D, H], { ...skin, ...light }), B('bottom', [t, 0, bottomZ], [W - t, D, bottomZ + t], { ...skin, ...light }));
  if (pl > 0) members.push(B('plinth', [t, 20, 0], [W - t, 20 + t, pl], skin));
  const fixedJoint = (a, side) => {
    if (joinery === 'kd') return { type: 'cam-lock', a, b: side };
    if (joinery === 'dado') return { type: 'dado', a, b: side, glue: true };
    if (joinery === 'dowel') return { type: 'dowel', a, b: side, glue: true };
    return { type: 'confirmat', a, b: side };
  };
  // the front: drawer fronts from the bottom up, doors above them, both overlaying the carcass edges
  const zf0 = bottomZ + 2, zf1 = H - 2;
  const zDoors = zf0 + nDrawers * dh;
  // inside: a divider over the drawers when anything sits above them; fixed and adjustable shelves in what is left
  const inner0 = nDrawers ? zDoors - 1.5 : bottomZ + t, inner1 = H - t;
  const fixedIds = [];
  if (nDrawers && (nDoors || (b.shelves || 0) || zf1 - zDoors > 200)) { members.push(B('divider', [t, 0, inner0 - t], [W - t, shelfD, inner0], { ...skin, ...light })); fixedIds.push('divider'); }
  // a wide carcass stands a partition in the middle of the shelved space, so no shelf spans the whole width
  // only where there is shelved space: above the divider when there are drawers, never through them
  const shelved = nDoors > 0 || n0Shelves(b, inner0, H - t) > 0;
  const part = (b.partition !== undefined ? !!b.partition : W - 2 * t > 700) && shelved && (!nDrawers || fixedIds.includes('divider'));
  const pz0 = fixedIds.includes('divider') ? inner0 : bottomZ + t, pz1 = H - t;
  const bays = part ? [[t, W / 2 - t / 2, 'side-l', 'partition'], [W / 2 + t / 2, W - t, 'partition', 'side-r']] : [[t, W - t, 'side-l', 'side-r']];
  if (part) members.push(B('partition', [W / 2 - t / 2, 0, pz0], [W / 2 + t / 2, shelfD, pz1], skin));
  const nAdj = b.shelves !== undefined ? b.shelves : Math.max(0, Math.round((inner1 - inner0) / 350) - 1);
  const nFixed = b.fixed !== undefined ? b.fixed : (H > 1200 && nAdj >= 2 ? 1 : 0);
  const n = nAdj + nFixed, gap = (inner1 - inner0) / (n + 1);
  const fixedAt = new Set(Array.from({ length: nFixed }, (_, i) => Math.round(((i + 1) * (n + 1)) / (nFixed + 1)) - 1));
  let si = 0, fi = 0; const bayFixed = [];
  for (let i = 0; i < n; i++) {
    const z = inner0 + gap * (i + 1);
    bays.forEach(([x0, x1, l, r], j) => {
      const tag = bays.length > 1 ? `${'lr'[j]}` : '';
      if (fixedAt.has(i)) { const id = `shelf-fixed${nFixed > 1 ? ++fi : ''}${tag}`; members.push(B(id, [x0, 0, z - t / 2], [x1, shelfD, z + t / 2], skin)); (part ? bayFixed : fixedIds).push(id); joints.push(fixedJoint(id, l), fixedJoint(id, r)); }
      else { const id = `shelf-${++si}`; members.push(B(id, [x0 + 1, 0, z - t / 2], [x1 - 1, shelfD - 2, z + t / 2], skin)); joints.push({ type: 'shelf-pin', a: id, b: l }, { type: 'shelf-pin', a: id, b: r }); }
    });
  }
  for (const id of ['top', 'bottom', ...(pl > 0 ? ['plinth'] : []), ...fixedIds]) joints.push(fixedJoint(id, 'side-l'), fixedJoint(id, 'side-r'));
  if (part) joints.push(fixedJoint('partition', 'top'), fixedJoint('partition', fixedIds.includes('divider') ? 'divider' : 'bottom'));
  if (back === 'groove') {
    members.push(B('back', [t - 6, D - 15, bottomZ + t - 6], [W - t + 6, D - 15 + bt, H - t + 6], { material: backMat, grain: 'z' }));
    for (const id of ['side-l', 'side-r', 'top', 'bottom']) joints.push({ type: 'groove', a: 'back', b: id });
  } else if (back === 'nailed') {
    members.push(B('back', [0, D, bottomZ], [W, D + bt, H], { material: backMat, grain: 'z' }));
    for (const id of ['side-l', 'side-r', 'top', 'bottom', ...fixedIds, ...(part ? ['partition'] : [])]) joints.push({ type: 'screwed', a: id, b: 'back' });
  }
  // doors: full overlay, 3 mm between them, hung on concealed hinges
  if (nDoors) {
    const doors = nDoors === 1 ? [['door', 1.5, W - 1.5, b.hinge === 'right' ? 'side-r' : 'side-l']] : [['door-l', 1.5, W / 2 - 1.5, 'side-l'], ['door-r', W / 2 + 1.5, W - 1.5, 'side-r']];
    for (const [id, x0, x1, side] of doors) { members.push(B(id, [x0, -1 - t, zDoors + 1.5], [x1, -1, zf1], skin)); joints.push({ type: 'hinge', a: id, b: side }); }
  }
  // drawers: a box between two slides, its bottom in grooves, a front screwed on from inside
  const bs = 16, gapS = 12.7;
  const slide = [...SLIDES].reverse().find((l) => l <= shelfD - 20) || 250;
  for (let i = 0; i < nDrawers; i++) {
    const g = `drawer-${i + 1}`; const p = `d${i + 1}-`;
    const fz0 = zf0 + i * dh, fz1 = fz0 + dh - 3;
    const z0 = i === 0 ? bottomZ + t + 8 : fz0 + 12, z1 = Math.min(fz1 - 12, z0 + Math.max(60, dh - 60));
    const x0 = t + gapS, x1 = W - t - gapS, y0 = -1, y1 = -1 + slide;
    members.push(
      B(`${p}front`, [1.5, -1 - t, fz0], [W - 1.5, -1, fz1], { ...skin, group: g }),
      B(`${p}side-l`, [x0, y0, z0], [x0 + bs, y1, z1], { material: mat, group: g }),
      B(`${p}side-r`, [x1 - bs, y0, z0], [x1, y1, z1], { material: mat, group: g }),
      B(`${p}box-front`, [x0 + bs, y0, z0], [x1 - bs, y0 + bs, z1], { material: mat, group: g }),
      B(`${p}box-back`, [x0 + bs, y1 - bs, z0], [x1 - bs, y1, z1], { material: mat, group: g }),
      B(`${p}bottom`, [x0 + bs - 6, y0 + bs - 6, z0 + 8], [x1 - bs + 6, y1 - bs + 6, z0 + 11], { material: 'hardboard', group: g }),
    );
    joints.push(
      { type: 'confirmat', a: `${p}box-front`, b: `${p}side-l` }, { type: 'confirmat', a: `${p}box-front`, b: `${p}side-r` },
      { type: 'confirmat', a: `${p}box-back`, b: `${p}side-l` }, { type: 'confirmat', a: `${p}box-back`, b: `${p}side-r` },
      ...[`${p}side-l`, `${p}side-r`, `${p}box-front`, `${p}box-back`].map((id) => ({ type: 'groove', a: `${p}bottom`, b: id })),
      { type: 'screwed', a: `${p}front`, b: `${p}box-front` },
      { type: 'slide', a: `${p}side-l`, b: 'side-l' }, { type: 'slide', a: `${p}side-r`, b: 'side-r' },
    );
  }
  return { members, joints, dials: { w: b.w, h: b.h, d: b.d, tMm: t, plinthMm: pl, material: mat, joinery, back, shelves: nAdj, fixed: nFixed, doors: nDoors, drawers: nDrawers, partition: part, ...(nDrawers ? { slide: `slide-${slide}` } : {}) } };
}

/** How many shelves a carcass gets between z0 and z1 (mm): the dial, or one per 350 mm less one. */
const n0Shelves = (b, z0, z1) => (b.shelves !== undefined ? b.shelves : Math.max(0, Math.round((z1 - z0) / 350) - 1)) + (b.fixed || 0);

/** The deepest a tenon may run into a square leg before it meets the one coming in square to it (mm). */
const tenonRoom = (leg, setback, railT) => Math.max(8, leg - setback - railT / 2 - Math.max(12, railT / 3) / 2 - 1);

function table(b, k, mmOf) {
  const W = b.w * k, D = b.d * k, H = b.h * k;
  const tt = mmOf(b.top, 25), L = mmOf(b.leg, 45), ah = mmOf(b.apron, 90), at = mmOf(b.apronT, 20), sb = mmOf(b.setback, 12), o = mmOf(b.overhang, 30);
  const wood = { ...(b.species ? { species: b.species } : {}), ...(b.finish !== undefined ? { finish: b.finish } : {}) };
  const B = boxer(k); const members = [], joints = [];
  const x0 = o, x1 = W - o, y0 = o, y1 = D - o, zt = H - tt;
  const legs = [['leg-fl', x0, y0], ['leg-fr', x1 - L, y0], ['leg-bl', x0, y1 - L], ['leg-br', x1 - L, y1 - L]];
  for (const [id, x, y] of legs) members.push(B(id, [x, y, 0], [x + L, y + L, zt], wood));
  members.push(
    B('apron-f', [x0 + L, y0 + sb, zt - ah], [x1 - L, y0 + sb + at, zt], wood), B('apron-b', [x0 + L, y1 - sb - at, zt - ah], [x1 - L, y1 - sb, zt], wood),
    B('apron-l', [x0 + sb, y0 + L, zt - ah], [x0 + sb + at, y1 - L, zt], wood), B('apron-r', [x1 - sb - at, y0 + L, zt - ah], [x1 - sb, y1 - L, zt], wood),
    B('top', [0, 0, zt], [W, D, H], { ...wood, cut: 'quarter' }),
  );
  const depth = Math.round(tenonRoom(L, sb, at));
  const pairs = [['apron-f', 'leg-fl'], ['apron-f', 'leg-fr'], ['apron-b', 'leg-bl'], ['apron-b', 'leg-br'], ['apron-l', 'leg-fl'], ['apron-l', 'leg-bl'], ['apron-r', 'leg-fr'], ['apron-r', 'leg-br']];
  for (const [a, l] of pairs) joints.push(b.joinery === 'dowel' ? { type: 'dowel', a, b: l, glue: true } : { type: 'mortise-tenon', a, b: l, pegs: 0, depth });
  joints.push({ type: 'bracket', a: 'apron-f', b: 'top' }, { type: 'bracket', a: 'apron-b', b: 'top', face: 'front' }, { type: 'bracket', a: 'apron-l', b: 'top', face: 'right' }, { type: 'bracket', a: 'apron-r', b: 'top', face: 'left' });
  return { members, joints, dials: { w: b.w, d: b.d, h: b.h, topMm: tt, legMm: L, apronMm: [ah, at], tenonDepthMm: depth, joinery: b.joinery || 'mortise-tenon' } };
}

function chair(b, k, mmOf) {
  const W = mmOf(b.w, 440), D = mmOf(b.d, 420), S = mmOf(b.seat, 450), BK = mmOf(b.back, 850), L = mmOf(b.leg, 36);
  const rh = 70, rt = 20, st = 15;
  const wood = { species: b.species || 'beech', ...(b.finish !== undefined ? { finish: b.finish } : {}) };
  const B = boxer(k); const members = [], joints = [];
  const zr = S - st;                                                  // the rails' top, under the seat
  members.push(
    B('leg-fl', [0, 0, 0], [L, L, zr], wood), B('leg-fr', [W - L, 0, 0], [W, L, zr], wood),
    B('leg-bl', [0, D - L, 0], [L, D, BK], wood), B('leg-br', [W - L, D - L, 0], [W, D, BK], wood),
    B('rail-f', [L, 0, zr - rh], [W - L, rt, zr], wood), B('rail-b', [L, D - rt, zr - rh], [W - L, D, zr], wood),
    B('rail-l', [0, L, zr - rh], [rt, D - L, zr], wood), B('rail-r', [W - rt, L, zr - rh], [W, D - L, zr], wood),
    B('stretcher-l', [0, L, 140], [rt, D - L, 170], wood), B('stretcher-r', [W - rt, L, 140], [W, D - L, 170], wood),
    B('back-top', [L, D - rt, BK - 70], [W - L, D, BK], wood), B('back-mid', [L, D - rt, S + 150], [W - L, D, S + 200], wood),
    B('seat', [0, 0, zr], [W, D, S], { material: b.seatMaterial || 'plywood' }),
  );
  const depth = Math.round(tenonRoom(L, 0, rt));
  const mt = (a, l) => ({ type: 'mortise-tenon', a, b: l, pegs: 0, depth });
  joints.push(
    mt('rail-f', 'leg-fl'), mt('rail-f', 'leg-fr'), mt('rail-b', 'leg-bl'), mt('rail-b', 'leg-br'),
    mt('rail-l', 'leg-fl'), mt('rail-l', 'leg-bl'), mt('rail-r', 'leg-fr'), mt('rail-r', 'leg-br'),
    mt('stretcher-l', 'leg-fl'), mt('stretcher-l', 'leg-bl'), mt('stretcher-r', 'leg-fr'), mt('stretcher-r', 'leg-br'),
    mt('back-top', 'leg-bl'), mt('back-top', 'leg-br'), mt('back-mid', 'leg-bl'), mt('back-mid', 'leg-br'),
    { type: 'bracket', a: 'rail-f', b: 'seat' }, { type: 'bracket', a: 'rail-b', b: 'seat', face: 'front' },
    { type: 'notch', a: 'seat', b: 'leg-bl' }, { type: 'notch', a: 'seat', b: 'leg-br' },           // the seat round the back legs
  );
  return { members, joints, dials: { wMm: W, dMm: D, seatMm: S, backMm: BK, legMm: L, tenonDepthMm: depth, species: wood.species } };
}

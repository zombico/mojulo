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
//   sofa:    { seats? (3; 1–4), seatW? (600 mm a sitter), seatH? (440, to the cushion's top), seatD? (560, the seat's
//              front to the back's face), backH? (820), arms? ('track' | 'rolled' | 'none'), armW? (150; rolled 180),
//              armH? (620), legH? (130), cushions? ('loose' | 'bench'), back? ('loose' | 'tight' | 'tufted'), pillows?
//              (0–4), fill? (the seat cushions' fill, 'foam-hr35'), fabric?, piping? (true), species? ('beech'),
//              joinery? ('kd': upholstered sections bolted together | 'glued') }
//   A sofa: a hardwood seat box with corner blocks and sinuous springs, legs on hanger bolts, plywood arms and back; its
//   padding and cushions (soft.js). Each seat rail carries its sitters: a 100 kg sitter a seat landing at twice their
//   weight, half to each rail. A `kd` sofa arrives as four upholstered sections (`supplied`) that bolt together.
import { FILLS } from './soft.js';
import { fabricError } from './fabric.js';
import * as dmath from '../../util/dmath.js';

const FRAME_UNITS = { mm: 0.001, cm: 0.01, m: 1 };                 // frame.js's units (kept here: frame.js imports this)

export const BUILD_TYPES = Object.freeze(['carcass', 'table', 'chair', 'sofa']);
const SLIDES = [250, 300, 350, 400, 450, 500, 550];

const num = (v) => Number.isFinite(v) && v > 0;
/** Why a build is malformed → string[]. */
export function validateBuild(b, at) {
  if (b === undefined) return [];
  if (!b || typeof b !== 'object' || !BUILD_TYPES.includes(b.type)) return [`${at}: { type: ${BUILD_TYPES.map((t) => `'${t}'`).join(' | ')}, …dials }`];
  const e = [];
  if (b.type === 'sofa') return validateSofa(b, at);
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
  if (b.type === 'sofa') return sofa(b, k, mmOf);
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

// ── the sofa ─────────────────────────────────────────────────────────────────────────────────────────────────────

const SOFA = { rt: 28, rh: 140, ply: 18, pad: 15, deck: 25, leg: 45, block: 50, seatKg: 100, dynamic: 2, backTilt: 12 };

function validateSofa(b, at) {
  const e = [];
  if (b.seats !== undefined && !(Number.isInteger(b.seats) && b.seats >= 1 && b.seats <= 4)) e.push(`${at}.seats: 1 to 4`);
  for (const k of ['seatW', 'seatH', 'seatD', 'backH', 'armW', 'armH', 'legH']) if (b[k] !== undefined && !(Number.isFinite(b[k]) && b[k] > 0)) e.push(`${at}.${k}: a size > 0 in the frame's unit`);
  if (b.arms !== undefined && !['track', 'rolled', 'none'].includes(b.arms)) e.push(`${at}.arms: 'track', 'rolled' or 'none'`);
  if (b.cushions !== undefined && !['loose', 'bench'].includes(b.cushions)) e.push(`${at}.cushions: 'loose' or 'bench'`);
  if (b.back !== undefined && !['loose', 'tight', 'tufted'].includes(b.back)) e.push(`${at}.back: 'loose', 'tight' or 'tufted'`);
  if (b.pillows !== undefined && !(Number.isInteger(b.pillows) && b.pillows >= 0 && b.pillows <= 4)) e.push(`${at}.pillows: 0 to 4`);
  if (b.fill !== undefined && !FILLS[b.fill]) e.push(`${at}.fill: one of ${Object.keys(FILLS).join(', ')}`);
  if (fabricError(b.fabric)) e.push(`${at}.${fabricError(b.fabric)}`);
  if (b.piping !== undefined && typeof b.piping !== 'boolean' && !/^#[0-9a-f]{6}$/i.test(b.piping)) e.push(`${at}.piping: true, false or '#rrggbb'`);
  if (b.joinery !== undefined && !['kd', 'glued'].includes(b.joinery)) e.push(`${at}.joinery: 'kd' (sections bolted together) or 'glued'`);
  return e;
}

function sofa(b, k, mmOf) {
  const S = SOFA;
  const n = b.seats || 3, sW = mmOf(b.seatW, 600), seatH = mmOf(b.seatH, 440), seatD = mmOf(b.seatD, 560);
  const backH = mmOf(b.backH, 820), legH = mmOf(b.legH, 130);
  const arms = b.arms || 'track', rolled = arms === 'rolled';
  const aW = arms === 'none' ? 0 : mmOf(b.armW, rolled ? 180 : 150), armH = mmOf(b.armH, 620);
  const backKind = b.back || 'loose', cushions = b.cushions || 'loose', kd = (b.joinery || 'kd') === 'kd';
  const wood = { species: b.species || 'beech' };
  const inner = n * sW, W = inner + 2 * aW;
  const deckTop = legH + S.rh + S.deck;
  if (seatH - deckTop < 60) throw new Error(`build: a seat ${seatH} mm high leaves ${Math.round(seatH - deckTop)} mm of cushion over a deck at ${Math.round(deckTop)} mm — raise seatH or lower legH`);
  if (aW && aW < 120) throw new Error(`build: arms ${aW} mm wide leave no room between their panels — 120 mm or more`);
  if (aW && armH < deckTop + 100) throw new Error(`build: arms ${armH} mm high barely clear the deck at ${Math.round(deckTop)} mm`);
  if (backH < seatH + 250) throw new Error(`build: a back ${backH} mm high stands only ${Math.round(backH - seatH)} mm over the seat — 250 mm or more`);
  const B = boxer(k);
  const Sft = (id, lo, hi, extra = {}) => ({ id, box: { min: lo.map((v) => Math.round((v / k) * 1e4) / 1e4), max: hi.map((v) => Math.round((v / k) * 1e4) / 1e4) }, ...extra });
  const members = [], joints = [], soft = [];
  const G = (g) => (kd ? { group: g } : {});
  // the back: where a loose back cushion's face (or a tight back's raked inside back) stands 100 mm over the seat, and
  // the pad behind it
  const tilt = S.backTilt * Math.PI / 180, T = backKind === 'loose' ? 180 : backKind === 'tight' ? 130 : 120;
  const z0b = seatH - 10, z1b = backH - 20, czb = (z0b + z1b) / 2;
  const cyb = seatD - 10 + (T / 2) * dmath.cos(tilt) - (seatH + 100 - czb) * dmath.tan(tilt);
  const ybp = Math.round(cyb + (T / 2) * dmath.cos(tilt) + (z1b - czb) * dmath.tan(tilt) - 15);
  const bp = 90;
  const D = ybp + bp, Db = D - S.pad - S.ply;                       // the base runs to the back panel's face
  const bx0 = aW ? aW - S.pad : S.pad, bx1 = W - bx0;
  // ── the base: rails, a centre rail on a long seat, corner blocks, legs, springs
  const zr0 = legH, zr1 = legH + S.rh;
  members.push(
    B('rail-f', [bx0, 0, zr0], [bx1, S.rt, zr1], { ...wood, ...G('base') }),
    B('rail-b', [bx0, Db - S.rt, zr0], [bx1, Db, zr1], { ...wood, ...G('base') }),
    B('rail-l', [bx0, S.rt, zr0], [bx0 + S.rt, Db - S.rt, zr1], { ...wood, ...G('base') }),
    B('rail-r', [bx1 - S.rt, S.rt, zr0], [bx1, Db - S.rt, zr1], { ...wood, ...G('base') }),
  );
  const centre = bx1 - bx0 > 1400;
  const xc = W / 2;
  if (centre) members.push(B('rail-c', [xc - S.rt / 2, S.rt, zr0], [xc + S.rt / 2, Db - S.rt, zr1], { ...wood, ...G('base') }));
  const ends = ['rail-l', 'rail-r', ...(centre ? ['rail-c'] : [])];
  for (const r of ends) joints.push({ type: 'dowel', a: r, b: 'rail-f', glue: true }, { type: 'dowel', a: r, b: 'rail-b', glue: true });
  // a seat rail carries its sitters: each seat a 100 kg sitter landing at twice their weight, half to each rail
  const railKNm = Math.round(((n * S.seatKg * S.dynamic * 9.81) / 2 / ((bx1 - bx0) / 1000)) / 10) / 100;
  members[0].load = railKNm; members[1].load = railKNm;
  const blocks = [['cb-fl', bx0 + S.rt, S.rt, 'rail-l', 'rail-f'], ['cb-fr', bx1 - S.rt - S.block, S.rt, 'rail-r', 'rail-f'], ['cb-bl', bx0 + S.rt, Db - S.rt - S.block, 'rail-l', 'rail-b'], ['cb-br', bx1 - S.rt - S.block, Db - S.rt - S.block, 'rail-r', 'rail-b']];
  for (const [id, x, y, r1, r2] of blocks) {
    members.push(B(id, [x, y, zr0], [x + S.block, y + S.block, zr1 - 20], { ...wood, ...G('base') }));
    joints.push({ type: 'screwed', a: id, b: r1, glue: true }, { type: 'screwed', a: id, b: r2, glue: true });
  }
  const lg = (S.block - S.leg) / 2;
  const legs = blocks.map(([id, x, y]) => [`leg-${id.slice(3)}`, x + lg, y + lg, id]);
  if (centre) legs.push(['leg-cf', xc - S.leg / 2, S.rt + lg, 'rail-c'], ['leg-cb', xc - S.leg / 2, Db - S.rt - lg - S.leg, 'rail-c']);
  for (const [id, x, y, under] of legs) { members.push(B(id, [x, y, 0], [x + S.leg, y + S.leg, legH], wood)); joints.push({ type: 'hanger-bolt', a: id, b: under }); }
  joints.push({ type: 'springs', a: 'rail-f', b: 'rail-b' });
  // ── the arms: two plywood panels, a top board, a front board and a post at the back
  const armIds = [];
  if (aW) {
    for (const [side, x0, sg] of [['l', 0, 1], ['r', W, -1]]) {
      const X = (a, b2) => (sg > 0 ? [x0 + a, x0 + b2] : [x0 - b2, x0 - a]);
      const g = `arm-${side}`; const p = `arm-${side}-`;
      const [o0, o1] = X(S.pad, S.pad + S.ply), [i0, i1] = X(aW - S.pad - S.ply, aW - S.pad), [m0, m1] = X(S.pad + S.ply, aW - S.pad - S.ply);
      const zt = armH - 25;
      members.push(
        B(`${p}out`, [o0, 0, legH], [o1, Db, zt], { material: 'plywood', grain: 'y', ...G(g) }),
        B(`${p}in`, [i0, 0, legH], [i1, Db, zt], { material: 'plywood', grain: 'y', ...G(g) }),
        B(`${p}top`, [m0, 0, zt - S.rt], [m1, Db, zt], { ...wood, ...G(g) }),
        B(`${p}front`, [m0, 0, legH], [m1, S.ply, zt - S.rt], { material: 'plywood', grain: 'z', ...G(g) }),
        B(`${p}post`, [m0, Db - 45, legH], [m1, Db, zt - S.rt], { ...wood, ...G(g) }),
      );
      for (const part of ['top', 'front', 'post']) joints.push({ type: 'screwed', a: `${p}${part}`, b: `${p}out`, glue: true }, { type: 'screwed', a: `${p}${part}`, b: `${p}in`, glue: true });
      joints.push(kd ? { type: 'insert-bolt', a: side === 'l' ? 'rail-l' : 'rail-r', b: `${p}in` } : { type: 'screwed', a: side === 'l' ? 'rail-l' : 'rail-r', b: `${p}in`, glue: true });
      soft.push(Sft(`arm-pad-${side}`, [sg > 0 ? 0 : W - aW, -S.pad, legH - 5], [sg > 0 ? aW : W, Db, armH], { kind: 'pad', ...(rolled ? { roll: side === 'l' ? 'left' : 'right' } : {}), on: `${p}top`, ...G(g) }));
      armIds.push(p);
    }
  }
  // ── the back: a plywood panel the width of the sofa, a hardwood rail across its top between the arms
  members.push(
    B('back-panel', [0, Db, legH], [W, Db + S.ply, backH - 25], { material: 'plywood', grain: 'x', ...G('back') }),
    B('back-rail', [aW ? bx0 : 0, Db - S.rt, backH - 130], [aW ? bx1 : W, Db, backH - 40], { ...wood, ...G('back') }),   // between the arms
  );
  joints.push({ type: 'screwed', a: 'back-rail', b: 'back-panel', glue: true });
  joints.push(kd ? { type: 'insert-bolt', a: 'back-panel', b: 'rail-b' } : { type: 'screwed', a: 'rail-b', b: 'back-panel', glue: true });
  for (const p of armIds) joints.push(kd ? { type: 'insert-bolt', a: 'back-panel', b: `${p}post` } : { type: 'screwed', a: `${p}post`, b: 'back-panel', glue: true });
  // ── the padding: the deck over the springs, the back
  const xa0 = aW, xa1 = W - aW;
  soft.push(Sft('deck', [xa0, -S.pad, legH - 5], [xa1, Db, deckTop], { kind: 'pad', crown: 0, on: 'rail-f', ...G('base') }));
  soft.push(Sft('back-pad', [0, ybp, legH - 5], [W, D, backH], { kind: 'pad', on: 'back-panel', ...G('back') }));
  // a tight back: the inside back, raked and fixed to the back (tufted in a diamond, buttoned, on a chesterfield)
  if (backKind !== 'loose') {
    const tuft = backKind === 'tufted' ? { tufting: { pattern: 'diamond', rows: 3, cols: Math.max(3, Math.round(inner / 180)) } } : {};
    soft.push(Sft('inside-back', [xa0, cyb - T / 2, z0b], [xa1, cyb + T / 2, z1b], { kind: 'cushion', fill: 'foam-30', tilt: S.backTilt, piping: false, on: 'back-pad', rest: 'back', ...tuft, ...G('back') }));
  }
  // ── the cushions: seats on the deck, backs leaning on the back pad, pillows in the corners
  const cover = { ...(b.fabric !== undefined ? { fabric: b.fabric } : {}) };
  const piping = b.piping !== undefined ? b.piping : true;
  const seatCount = cushions === 'bench' ? 1 : n, cw = inner / seatCount;
  for (let i = 0; i < seatCount; i++) soft.push(Sft(seatCount > 1 ? `seat-${i + 1}` : 'seat', [xa0 + i * cw, -10, deckTop], [xa0 + (i + 1) * cw, ybp, seatH], { kind: 'cushion', ...(cushions === 'bench' ? { style: 'bench' } : {}), fill: b.fill || 'foam-hr35', piping, on: 'deck', ...cover }));
  if (backKind === 'loose') for (let i = 0; i < n; i++) soft.push(Sft(`back-${i + 1}`, [xa0 + i * sW, cyb - T / 2, z0b], [xa0 + (i + 1) * sW, cyb + T / 2, z1b], { kind: 'cushion', fill: 'fibre', tilt: S.backTilt, piping, on: 'back-pad', rest: 'back', ...cover }));
  const face = backKind === 'loose' ? seatD - 10 : ybp;
  for (let i = 0; i < (b.pillows || 0); i++) {
    const left = i % 2 === 0, off = Math.floor(i / 2) * 380;
    const x0 = left ? xa0 + 30 + off : xa1 - 30 - off - 450;
    soft.push(Sft(`pillow-${i + 1}`, [x0, face - 170, seatH - 10], [x0 + 450, face - 20, seatH + 440], { kind: 'pillow', tilt: 16, on: backKind === 'loose' ? `back-${left ? 1 : n}` : 'inside-back', rest: 'back', ...cover }));
  }
  const supplied = kd ? ['base', ...armIds.map((p) => p.slice(0, -1)), 'back'] : null;
  const dials = {
    seats: n, seatWMm: sW, seatHMm: seatH, seatDMm: seatD, backHMm: backH, arms, ...(aW ? { armWMm: aW, armHMm: armH } : {}), legHMm: legH, cushions, back: backKind,
    pillows: b.pillows || 0, joinery: kd ? 'kd' : 'glued', deckTopMm: deckTop, sizeMm: [W, Math.round(D), backH], railLoadKNm: railKNm, backTiltDeg: S.backTilt, seatKg: S.seatKg,
  };
  return { members, joints, soft, ...(supplied ? { supplied } : {}), dials };
}

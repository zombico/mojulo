/**
 * THE FRAMES ON THE RANGE — the mecha shelf's frames (mecha-shelf/: the work frames, the walkers, the transforming walkers
 * and the big walkers) as the artillery range's bases: one turret (worlds/controllable/turret.js) on a frame's weapon
 * mounts, standing at a stance (no frame walks on a page yet: its gait is not built).
 *
 *   frameBase({ frame, stance?, palette? }, { mounts? }) → { id, archetype, stance, armed, figure, turret, rounds }
 *   FRAME_MOUNTS                                          the mount classes a frame's guns slew on
 *
 *   frame     a word the vehicle registry knows for a mecha shelf frame ('utility walker', 'rover walker', 'siege walker')
 *   stance    one of the frame's stances (its archetype's `stances`): absent, braced to fire where it braces, else standing;
 *             a transforming walker's `roll` its legs folded onto its wheels, its tank form
 *   palette   one of the shelf's palettes (mecha-common.js MECHA_PALETTES), absent the frame's own
 *
 * ARMED: a frame that carries a weapons backpack as built (the rover walker's autocannon and rocket pod, the siege
 * walkers' howitzer and missiles), or takes one (the field walker's weapons backpack, its rocket pod), fires from its own
 * mounts. FITTED: a frame with none (the work frames, the all-terrain walker, the brood walker) is fitted the shelf's own
 * traverse ring, cradle and autocannon on its roof, a field conversion. Each mount's ring is a bone (`turretR`, `turretL`)
 * and its cradle with its weapon another (`gunR`, `gunL`), turned by the one turret: both mounts follow the gunner's aim,
 * the loaded round's mount fires (each round its mount's trunnion, `at`, and its muzzle's reach, `barrel`). A weapon's
 * rounds are ordnance.js WEAPON_ROUNDS': a weapon with none (a minigun, a sensor) turns with the aim and fires nothing here.
 *
 * Vehicle space as the shelves' (+y forward, +x right, metres). Pure; a frame's assembly is the slow part (up to a second
 * and a half for the big walkers).
 */
import { MECHA_ARCHETYPES, assembleFrame, frameRow, posedFrame, massOf } from '../../mecha-shelf/index.js';
import { MECHA_BACKPACKS } from '../../mecha-shelf/mecha-backpacks.js';
import { MECHA_PALETTES } from '../../mecha-shelf/mecha-common.js';
import { lowerAssemblerBuild } from '../../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../../vehicle-designer/vehicle-rig.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { WEAPON_ROUNDS, ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';
import { gaitOf, gaitStances } from '../../mecha-shelf/mecha-gait.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// (the most and the least of a long list: a big frame's corners overflow a spread)
const most = (xs) => xs.reduce((a, b) => (b > a ? b : a), -Infinity), least = (xs) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
// the backpacks that carry guns (mecha-backpacks.js), and the one a frame that takes a backpack is given here
const GUN_PACKS = Object.freeze(Object.keys(MECHA_BACKPACKS).filter((k) => MECHA_BACKPACKS[k].takes.some((w) => WEAPON_ROUNDS[w])));
// the frame that lends its mount, cradle and autocannon to a frame fitted one, and its side
const DONOR = Object.freeze({ archetype: 'roverWalker', side: 'R' });
/** The mount classes a frame's guns slew on (mount.js's shape): a backpack's ring, quick for its size; the siege
 * backpack's, slow under a howitzer, high for the indirect arc. Unstabilized: a frame fires braced. */
export const FRAME_MOUNTS = Object.freeze({
  pack: Object.freeze({ mount: { traverse: { rate: 60, accel: 120, min: -120, max: 120 }, elevation: { rate: 40, accel: 90, min: -10, max: 60 }, stabilized: false, look: 0.07 }, gun: { barrel: 1 } }),
  siege: Object.freeze({ mount: { traverse: { rate: 15, accel: 25, min: -150, max: 150 }, elevation: { rate: 10, accel: 20, min: -5, max: 70 }, stabilized: false, look: 0.05 }, gun: { barrel: 3 } }),
});

/** A frame's word through the library (vehicle-registry/roster.js): its row and its archetype, or why not. */
export function frameOf(word) {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) return { why: `'${word}' is not a vehicle of the library` };
  const a = (handlesOf(hit.id).mecha ?? [])[0];
  return a && MECHA_ARCHETYPES[a] ? { id: hit.id, archetype: a } : { why: `the ${hit.id} is no frame of the mecha shelf` };
}

/** What is wrong with a frame base's words, by name; [] when it can stand on the range. */
export function validateFrame(base = {}) {
  const errs = [], F = frameOf(base.frame);
  if (!F.archetype) return [`base.frame: ${F.why}`];
  for (const k of Object.keys(base)) if (!['frame', 'stance', 'palette'].includes(k)) errs.push(`base.${k}: a frame base is { frame, stance?, palette? }`);
  const stances = Object.keys(MECHA_ARCHETYPES[F.archetype].stances ?? {});
  if (base.stance !== undefined && !stances.includes(base.stance)) errs.push(`base.stance: the ${F.id} stands ${stances.join(', ')}`);
  if (base.palette !== undefined && !MECHA_PALETTES[base.palette]) errs.push(`base.palette: one of ${Object.keys(MECHA_PALETTES).join(', ')}`);
  return errs;
}

// the frame as assembled for the range: its own gun backpack, or the one it takes, or none
function assembled(archetype, stance, palette) {
  const row = MECHA_ARCHETYPES[archetype], own = row.backpack && GUN_PACKS.includes(row.backpack);
  const takes = !own && (row.backpacks ?? []).find((b) => GUN_PACKS.includes(b));
  const words = { ...(palette ? { palette } : {}), ...(takes ? { backpack: takes } : {}) };
  return { ...assembleFrame(archetype, { ...words, pose: stance }), words, armed: !!(own || takes) };
}
// the donor's mount, cradle and weapon, each item's place off its mount ring's: what a fitted frame is given
let DONATED = null;
function donated() {
  if (DONATED) return DONATED;
  const { manifest } = assembleFrame(DONOR.archetype, {}), S = DONOR.side, by = (id) => manifest.items.find((i) => i.id === id);
  const ring = by(`mount${S}`);
  DONATED = ['mount', 'cradle', 'weapon'].map((k) => { const it = by(`${k}${S}`); return { ...it, id: `${k}R`, at: it.at.map((v, i) => r3(v - ring.at[i])) }; });
  return DONATED;
}
// the roof a fitted mount stands on: the highest top among the frame's bodies near its centreline
function roofOf(placements) {
  const mid = placements.filter((p) => p.bounds && Math.abs((p.bounds.min[0] + p.bounds.max[0]) / 2) < 0.6);
  const top = mid.reduce((a, p) => (p.bounds.max[2] > a.bounds.max[2] ? p : a), mid[0]);
  return { id: top.id, at: [0, r3((top.bounds.min[1] + top.bounds.max[1]) / 2), r3(top.bounds.max[2])] };
}

/** A frame of the mecha shelf as the range's base: its figure rigged on its mounts, its turret and its rounds. */
export function frameBase(base, { mounts = FRAME_MOUNTS } = {}) {
  const errs = validateFrame(base);
  if (errs.length) throw new Error(`artillery range: ${errs.join('; ')}`);
  const { id, archetype } = frameOf(base.frame), row = MECHA_ARCHETYPES[archetype];
  // (a frame that rolls has two forms: it walks, and it drives in its tank form, its legs folded onto its wheels; it is
  // baked standing as it walks, its tank form a pose of the same bodies, and starts in the form its stance names)
  const transforms = !!(row.wheels && row.stances?.roll), walkStance = row.stances?.brace ? 'brace' : 'stand';
  const stance = base.stance ?? walkStance, bakeAt = transforms && stance === 'roll' ? walkStance : stance;
  let { manifest, readout, armed, words } = assembled(archetype, bakeAt, base.palette);
  let weapons = armed ? readout.weapons ?? {} : null, roof = null;
  const fitted = new Set();
  // (a frame with no gun is fitted one on its roof: the donor's ring, cradle and autocannon)
  if (!armed) {
    roof = roofOf(lowerAssemblerBuild(manifest).placements);
    const given = donated().map((it) => ({ ...it, at: it.at.map((v, i) => r3(v + roof.at[i])) }));
    for (const it of given) fitted.add(it.id);
    manifest = { ...manifest, items: [...manifest.items, ...given] };
    weapons = { r: 'autocannon' };
  }
  const B = lowerAssemblerBuild(manifest), P = new Map(B.placements.map((p) => [p.id, p]));
  const facesOf = (p) => B.faces.slice(p.faceStart, p.faceStart + p.faceCount);
  // the bones: the root, and each mount side's ring (its head the ring's centre) and its cradle with its weapon (its head
  // the trunnion, the cradle's place)
  const sides = Object.keys(weapons).filter((s) => P.has(`mount${s.toUpperCase()}`) && P.has(`cradle${s.toUpperCase()}`));
  const owner = new Map();
  for (const s of sides) { const S = s.toUpperCase(); owner.set(`mount${S}`, `turret${S}`); owner.set(`cradle${S}`, `gun${S}`); owner.set(`weapon${S}`, `gun${S}`); }
  // (each body its own bone, so the walk moves it; a mount's ring and its cradle with its weapon the turret's and the gun's)
  const buckets = new Map([['root', []]]), boneOf = (id) => owner.get(id) ?? id;
  for (const p of B.placements) { const b = boneOf(p.id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(...facesOf(p)); }
  const bones = [{ id: 'root', head: [0, 0, 0] }];
  // (the body whose place a bone takes: its own, a gun's cradle, a fitted part's roof)
  const sourceOf = new Map();
  for (const it of manifest.items) { const b = boneOf(it.id); if (b === `gun${it.id.slice(-1)}` && !it.id.startsWith('cradle')) continue; if (!sourceOf.has(b)) sourceOf.set(b, it.id); }
  for (const it of manifest.items) { const b = boneOf(it.id); if (!/^(turret|gun)/.test(b) && sourceOf.get(b) === it.id) bones.push({ id: b, head: it.at.map(r3) }); }
  // (its tank form's bodies, where it has one: the mounts' places in it, and its drive)
  const rollItems = transforms ? itemsAt(archetype, words, 'roll') : null;
  const rounds = [], mountClass = Object.values(weapons).includes('howitzer') ? 'siege' : 'pack', M = mounts[mountClass];
  for (const s of sides) {
    const S = s.toUpperCase(), ring = P.get(`mount${S}`), cradle = P.get(`cradle${S}`), wf = facesOf(P.get(`weapon${S}`)).flatMap((f) => f.corners);
    const trunnion = cradle.translate.map(r3), muzzleY = most(wf.map((c) => c[1]));
    // (the bore's height: the weapon's middle at its front fifth)
    const fore = wf.filter((c) => c[1] > muzzleY - 0.2 * (muzzleY - least(wf.map((q) => q[1])))), bz = r3((least(fore.map((c) => c[2])) + most(fore.map((c) => c[2]))) / 2);
    bones.push({ id: `turret${S}`, head: ring.translate.map(r3) }, { id: `gun${S}`, head: trunnion });
    // (a mount's place is [forward, right, up]: vehicle +y, +x, +z)
    // (in its tank form, the trunnion where that form carries it, a fitted mount where its roof is carried)
    const placed = (form) => { const t = form.get(`cradle${S}`)?.t ?? carried(form, `cradle${S}`); return [r3(t[1]), r3(t[0]), r3(t[2] + bz - trunnion[2])]; };
    const carried = (form, id) => { const it = manifest.items.find((x) => x.id === id), A0 = { R: rotOf(manifest.items.find((x) => x.id === roof.id).rotate), t: manifest.items.find((x) => x.id === roof.id).at }, Ak = form.get(roof.id), D = mul(Ak.R, tr(A0.R)); return Ak.t.map((v, i) => v + app(D, it.at.map((u, j) => u - A0.t[j]))[i]); };
    for (const w of WEAPON_ROUNDS[weapons[s]] ?? []) rounds.push({ ...ordnanceWeapon(w), at: [trunnion[1], trunnion[0], bz], barrel: r3(muzzleY - trunnion[1]), mountSide: s, weapon: weapons[s], ...(rollItems ? { atForm: { tank: placed(rollItems) } } : {}) });
  }
  if (!rounds.length) throw new Error(`artillery range: the ${id}'s weapons (${Object.values(weapons).join(', ')}) fire nothing on this range`);
  // the walk (mecha-shelf/mecha-gait.js): its gait from its structure and size, each key's bodies placed by the IK at
  // that key's stance; a frame in its tank form stands
  const gait = stance === 'roll' && !transforms ? null : gaitOf(readout.archetype ?? archetype);
  let figure = packVehicleFigure(bones, buckets, { rolls: [] });
  const keyed = (items, spin) => poseKey(manifest, bones, sourceOf, fitted, roof, items, spin);
  const clips = gait ? { forward: { k: GK(gait), b: gaitStances(gait).flatMap((st) => keyed(itemsAt(archetype, words, st))) } } : {};
  // the tank form: standing on its wheels, driving with them turning, and the fold and the unfold between its forms
  const drive = transforms ? driveOf(readout.archetype ?? archetype, row, rollItems) : null;
  if (drive) {
    const spin = (th) => (b) => (drive.wheels.has(b) ? th : 0);
    clips['tank:idle'] = { k: 1, b: keyed(rollItems) };
    clips['tank:forward'] = { k: DRIVE_KEYS, b: Array.from({ length: DRIVE_KEYS }, (_, k) => keyed(rollItems, spin((-2 * Math.PI * k) / DRIVE_KEYS))).flat() };
    const fold = foldKeys(archetype, words, readout.archetype ?? archetype, bakeAt);
    clips['transform:tank'] = { k: fold.length, once: true, b: fold.flatMap((it) => keyed(it)) };
    clips['transform:walker'] = { k: fold.length, once: true, b: [...fold].reverse().flatMap((it) => keyed(it)) };
  }
  // (its steered wheels as the page turns them: each one's place off the fixed axles' line, the steering wheelbase)
  if (Object.keys(clips).length) figure = { ...figure, clips, ...(drive ? { forms: { base: 'walker' }, steer: { wheelbase: drive.steer.wheelbase, wheels: drive.steer.wheels } } : {}) };
  const T = mountOf('light-tank', { mount: M.mount, gun: M.gun });
  return { id, archetype, stance, ...(transforms ? { form: stance === 'roll' ? 'tank' : 'walker', walkStance: bakeAt } : {}), armed, weapons, mountClass, figure, rounds, ...(gait ? { gait } : {}), ...(drive ? { drive: { ...drive.out, steer: { wheelbase: drive.steer.wheelbase, max: drive.steer.max, rate: drive.steer.rate } } } : {}), turret: { ...T, mount: { ...T.mount, at: rounds[0].at }, gun: { ...T.gun, barrel: rounds[0].barrel } }, height: r3(B.faces.reduce((a, f) => f.corners.reduce((b, c) => (c[2] > b ? c[2] : b), a), 0)) };
}

// a body's orientation from its item's `rotate` (degrees, Rz·Ry·Rx: the assembler's)
function rotOf(r) {
  const [x, y, z] = (r ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180), cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return [[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx], [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx], [-sy, cy * sx, cy * cx]];
}
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const tr = (A) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[j][i]));
const app = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
function quatOf(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return q.map((v) => Math.round(v * 1e4) / 1e4 + 0);
}
const GK = (gait) => gaitStances(gait).length, DRIVE_KEYS = 12, FOLD_KEYS = 12;
// a pose's bodies (their orientation and place): a stance's name, a stance, or { joints, root }
function itemsAt(archetype, words, pose) {
  return new Map(assembleFrame(archetype, { ...words, pose, laws: false }).manifest.items.map((it) => [it.id, { R: rotOf(it.rotate), t: it.at }]));
}
/** One key of a clip: per bone, [qx, qy, qz, qw, hx, hy, hz], the bone turned from its baked place and its head where the
 * key's pose puts its body (the vehicle rig's packing, vehicle-designer/vehicle-rig.js); a fitted part rides the body it is
 * fitted on; `spin(bone)` a wheel's turn about its axle (the frame's +x through its hub) over its pose. */
function poseKey(rest, bones, sourceOf, fitted, roof, items, spin = null) {
  const at0 = new Map(rest.items.map((it) => [it.id, { R: rotOf(it.rotate), t: it.at }])), out = [];
  for (const b of bones) {
    if (b.id === 'root') { out.push(0, 0, 0, 1, 0, 0, 0); continue; }
    const src = sourceOf.get(b.id), r0 = at0.get(src);
    const by = fitted.has(src) ? roof.id : src, A0 = at0.get(by), Ak = items.get(by) ?? A0;
    let D = mul(Ak.R, tr(A0.R));
    const head = fitted.has(src) ? Ak.t.map((v, i) => v + app(D, r0.t.map((u, j) => u - A0.t[j]))[i]) : Ak.t;
    const th = spin ? spin(b.id) : 0;
    if (th) { const c = Math.cos(th), s = Math.sin(th); D = mul([[1, 0, 0], [0, c, -s], [0, s, c]], D); }
    out.push(...quatOf(D), ...head.map((v) => Math.round(v * 1e4) / 1e4 + 0));
  }
  return out;
}
// the fold between its forms: its joints and its pelvis carried from its standing stance to its tank form's in even
// steps, each step's bodies placed by the chain (never a body's own slerp: the legs stay joined as they fold)
function foldKeys(archetype, words, key, from) {
  const A = posedFrame(key, from), B = posedFrame(key, 'roll');
  return Array.from({ length: FOLD_KEYS }, (_, k) => {
    const u = k / (FOLD_KEYS - 1), e = u * u * (3 - 2 * u), joints = {};
    for (const j of Object.keys(A.joints)) joints[j] = Math.round((A.joints[j] + ((B.joints[j] ?? A.joints[j]) - A.joints[j]) * e) * 100) / 100;
    return itemsAt(archetype, words, { joints, root: A.root.t.map((v, i) => v + (B.root.t[i] - v) * e) });
  });
}
/**
 * A transforming walker's drive in its tank form, from its structure: its wheels (their hubs, their radius: the hub's
 * height on the ground), its wheelbase and track, its centre of mass rolled. Its pace by its size as a walker's is, a
 * wheeled machine's at Froude 4 on its wheelbase (an off-road pace); its turn as quick as keeps its lateral grip within
 * half of what would roll it over (g · half its track over its centre of mass's height); its front axle steered (Ackermann:
 * the circle's centre on its fixed axles' line). → { wheels, steer, out }
 */
function driveOf(key, row, roll) {
  const ids = row.wheels.map((w) => w.id), hubs = ids.map((id) => roll.get(id).t);
  const r = hubs.reduce((a, h) => a + h[2], 0) / hubs.length, ys = hubs.map((h) => h[1]), xs = hubs.map((h) => h[0]);
  const wheelbase = Math.max(...ys) - Math.min(...ys), track = Math.max(...xs) - Math.min(...xs);
  const P = posedFrame(key, 'roll'), hcg = massOf(key, P.joints, P.root).com[2];
  const speed = Math.sqrt(DRIVE.froude * 9.81 * Math.max(wheelbase, 2 * r)), grip = (0.5 * 9.81 * track) / 2 / hcg;
  // its steering: the front axle's wheels steered, the others fixed, the circle's centre on the fixed axles' line; the
  // steered axle's distance from that line the wheelbase its turn is set by; each steered wheel's place from it (its own
  // angle, the inner one more: Ackermann); its lock and how quickly it is steered, a bigger machine's slower
  const front = row.wheels.filter((w) => w.axle === 'front').map((w) => w.id), fixed = ids.filter((id) => !front.includes(id));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length, yc = mean(fixed.map((id) => roll.get(id).t[1]));
  const steerBase = mean(front.map((id) => roll.get(id).t[1])) - yc;
  const steer = { wheelbase: r3(steerBase), max: DRIVE.lock, rate: r3(DRIVE.steerRate / Math.sqrt(Math.max(1, steerBase))), wheels: front.map((id) => ({ id, x: r3(roll.get(id).t[0]), y: r3(roll.get(id).t[1] - yc) })) };
  const tightest = steerBase / Math.tan((DRIVE.lock * Math.PI) / 180);
  return { wheels: new Set(ids), steer, out: { wheels: ids.length, radius: r3(r), wheelbase: r3(wheelbase), track: r3(track), cg: r3(hcg), speed: r3(speed), stride: r3(2 * Math.PI * r), turn: r3(Math.min(0.8, grip / speed)), lateral: r3(grip), steered: front.length, steerBase: steer.wheelbase, lock: steer.max, steerRate: steer.rate, circle: r3(tightest) } };
}
/** A tank form's pace (Froude 4 on its wheelbase), its steered wheels' lock (°) and their steering rate (°/s at a metre
 * of steering wheelbase, slower as 1/√ of it). */
export const DRIVE = Object.freeze({ froude: 4, lock: 30, steerRate: 90 });

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
import { MECHA_ARCHETYPES, assembleFrame, frameRow } from '../../mecha-shelf/index.js';
import { MECHA_BACKPACKS } from '../../mecha-shelf/mecha-backpacks.js';
import { MECHA_PALETTES } from '../../mecha-shelf/mecha-common.js';
import { lowerAssemblerBuild } from '../../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../../vehicle-designer/vehicle-rig.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { WEAPON_ROUNDS, ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';

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
  const words = { pose: stance, ...(palette ? { palette } : {}), ...(takes ? { backpack: takes } : {}) };
  return { ...assembleFrame(archetype, words), armed: !!(own || takes) };
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
  return [0, r3((top.bounds.min[1] + top.bounds.max[1]) / 2), r3(top.bounds.max[2])];
}

/** A frame of the mecha shelf as the range's base: its figure rigged on its mounts, its turret and its rounds. */
export function frameBase(base, { mounts = FRAME_MOUNTS } = {}) {
  const errs = validateFrame(base);
  if (errs.length) throw new Error(`artillery range: ${errs.join('; ')}`);
  const { id, archetype } = frameOf(base.frame), row = MECHA_ARCHETYPES[archetype];
  const stance = base.stance ?? (row.stances?.brace ? 'brace' : 'stand');
  let { manifest, readout, armed } = assembled(archetype, stance, base.palette);
  let weapons = armed ? readout.weapons ?? {} : null;
  // (a frame with no gun is fitted one on its roof: the donor's ring, cradle and autocannon)
  if (!armed) {
    const roof = roofOf(lowerAssemblerBuild(manifest).placements);
    manifest = { ...manifest, items: [...manifest.items, ...donated().map((it) => ({ ...it, at: it.at.map((v, i) => r3(v + roof[i])) }))] };
    weapons = { r: 'autocannon' };
  }
  const B = lowerAssemblerBuild(manifest), P = new Map(B.placements.map((p) => [p.id, p]));
  const facesOf = (p) => B.faces.slice(p.faceStart, p.faceStart + p.faceCount);
  // the bones: the root, and each mount side's ring (its head the ring's centre) and its cradle with its weapon (its head
  // the trunnion, the cradle's place)
  const sides = Object.keys(weapons).filter((s) => P.has(`mount${s.toUpperCase()}`) && P.has(`cradle${s.toUpperCase()}`));
  const owner = new Map();
  for (const s of sides) { const S = s.toUpperCase(); owner.set(`mount${S}`, `turret${S}`); owner.set(`cradle${S}`, `gun${S}`); owner.set(`weapon${S}`, `gun${S}`); }
  const buckets = new Map([['root', []]]);
  for (const p of B.placements) { const b = owner.get(p.id) ?? 'root'; if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(...facesOf(p)); }
  const bones = [{ id: 'root', head: [0, 0, 0] }];
  const rounds = [], mountClass = Object.values(weapons).includes('howitzer') ? 'siege' : 'pack', M = mounts[mountClass];
  for (const s of sides) {
    const S = s.toUpperCase(), ring = P.get(`mount${S}`), cradle = P.get(`cradle${S}`), wf = facesOf(P.get(`weapon${S}`)).flatMap((f) => f.corners);
    const trunnion = cradle.translate.map(r3), muzzleY = most(wf.map((c) => c[1]));
    // (the bore's height: the weapon's middle at its front fifth)
    const fore = wf.filter((c) => c[1] > muzzleY - 0.2 * (muzzleY - least(wf.map((q) => q[1])))), bz = r3((least(fore.map((c) => c[2])) + most(fore.map((c) => c[2]))) / 2);
    bones.push({ id: `turret${S}`, head: ring.translate.map(r3) }, { id: `gun${S}`, head: trunnion });
    // (a mount's place is [forward, right, up]: vehicle +y, +x, +z)
    for (const w of WEAPON_ROUNDS[weapons[s]] ?? []) rounds.push({ ...ordnanceWeapon(w), at: [trunnion[1], trunnion[0], bz], barrel: r3(muzzleY - trunnion[1]), mountSide: s, weapon: weapons[s] });
  }
  if (!rounds.length) throw new Error(`artillery range: the ${id}'s weapons (${Object.values(weapons).join(', ')}) fire nothing on this range`);
  const figure = packVehicleFigure(bones, buckets, { rolls: [] });
  const T = mountOf('light-tank', { mount: M.mount, gun: M.gun });
  return { id, archetype, stance, armed, weapons, mountClass, figure, rounds, turret: { ...T, mount: { ...T.mount, at: rounds[0].at }, gun: { ...T.gun, barrel: rounds[0].barrel } }, height: r3(B.faces.reduce((a, f) => f.corners.reduce((b, c) => (c[2] > b ? c[2] : b), a), 0)) };
}

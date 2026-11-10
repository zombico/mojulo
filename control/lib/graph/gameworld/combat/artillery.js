/**
 * THE ARTILLERY RANGE — the firing range's sibling at a big gun's scale: one turret (worlds/controllable/turret.js) on its
 * base, its rounds (ordnance.js), fired by hand into stands of matter at the direct-fire bands and onto a far field, each
 * strike answered by the law the measures run (terminal.js: a hole, a breach, a spall, a crater), seen and not simulated.
 * A game's big guns tried before its levels: the gun it needs, its rounds, its mount, its base.
 *
 *   artilleryOf({ mount?, ordnance?, base?, reload?, sounds?, quiet?, name? })  → { minted, flight, terminal, laws, layout }
 *   artilleryHtml(spec)                                                        → the page
 *
 *   mount     a mount's class (mount.js MOUNTS: battle-tank, light-tank, field-gun, howitzer, tower), or { class, ...over }
 *             (its fields laid over the class's, mountOf); default the battle tank's
 *   ordnance  1 to 4 rounds the gun loads (ordnance.js ORDNANCE: apfsds, heat, he, indirect), keys 1 to 4; the indirect
 *             shell needs a mount that elevates past 45° (the field gun, the howitzer); default every round the mount fires
 *   base      'fixed' (a concrete plinth, the tower's tower, the field gun's carriage), 'hull' (a graybox tracked hull on
 *             the range's track: W / S drive, A / D turn, the turret's stabilizer, if it has one, holding the aim), or
 *             { vehicle, livery?, wear?, seed? }: a field vehicle of the library (vehicle-registry/, a word people say:
 *             'light tank', 'apc', 'cargo truck'), its turret, or a weapon station fitted where it has a ring for one, its realistic build drawn, driven on its own class's rule, its turret and gun bones
 *             turned by the mount (car-designer/military.js `gun`), the mount laid where its gun is (its class the
 *             light tank's unless `mount` names one); or { frame, stance?, palette? }: a frame of the mecha shelf (a
 *             word the library knows: 'utility walker', 'rover walker', 'siege walker'), standing at its stance, firing
 *             from its own backpack mounts or a gun mount fitted on its roof, its rounds its weapons' (frames.js;
 *             `ordnance` chooses among them); or { aircraft, palette? }: a fighter, a helicopter or a drone of the craft
 *             shelf, flown (aircraft.js, rotorcraft.js); or { boat, palette? }: a boat of the craft shelf, driven on the
 *             range laid at sea (boats.js)
 *   reload    the gun's seconds to load a round (6)
 *   sounds    { shot?, reload?, burst? }, each a word of the SFX shelf; absent, a cannon, a breech worked, a large blast
 *
 * THE RANGE: the gun at the origin facing +x along the firing line; a row of stands (terminal.js STANDS, each its matter
 * at its thickness, the sloped plate laid back at its angle) at each band (250, 500, 1000, 2000 m), the rows on their own
 * bearings so a near row never hides a far one; with the indirect shell, the far field (a bunker's roof and a ring of
 * sandbags at 3, 4 and 5 km); the floor a darker line every 250 m. The gunner's sight carries a range mark for each band
 * of the loaded round (where the target must sit under the bore's line for the round to drop onto it), from the round's
 * own flight measured on the runtime (measureOrdnance); the indirect shell's chart (its elevation for each range) is read
 * off the readout. Pure but for the measures' time (a second or two a round).
 */
import { emitThreeWorld } from '../../scene/scene-three.js';
import { MATTER } from '../../rupa/matter.js';
import { sfxSound } from '../../sfx-shelf/resolve.js';
import { resolveSoundId } from '../../sfx-shelf/roster.js';
import { MOUNTS, MOUNT_NAMES, mountOf } from './mount.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { MILITARY_CLASSES } from '../../car-designer/road-military.js';
import { rollVehicleSheet } from '../../car-designer/sheet.js';
import { compileMilitary } from '../../car-designer/military.js';
import { frameBase, validateFrame, donated, FRAME_MOUNTS } from './frames.js';
import { airBase, validateAircraft } from './aircraft.js';
import { boatBase, validateBoat } from './boats.js';
import { cycleBase, cycleReady } from './roadsters.js';
import { compileCar } from '../../car-shelf/car-figure.js';
import { compileRealistic } from '../../car-designer/realistic.js';
import { lowerAssemblerBuild } from '../../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../../vehicle-designer/vehicle-rig.js';
import { WEAPON_ROUNDS } from './ordnance.js';
import { VEHICLES as PHYSICS, envelope as envelopeOfClass } from '../../roads/vehicles.js';
import { ORDNANCE, ORDNANCE_NAMES, ordnanceWeapon, measureOrdnance, ordnanceLaws, DIRECT_BANDS, INDIRECT_BANDS, DROP_BANDS } from './ordnance.js';
import { STANDS, measureTerminal, terminalLaws } from './terminal.js';
import { box, CHROME } from './gym.js';

const MAX = 4, AIM = 1.2, MIL = 360 / 6400;
const r2 = (v) => Math.round(v * 100) / 100;
// each band's row on its own bearing (°, left of the firing line): the near rows to the left, so the line of sight to a
// far stand passes clear of every nearer row
const BEARING = Object.freeze({ 250: 17, 500: 4.5, 1000: -2, 2000: -6 });
// a stand: 3 m wide, 2.6 m tall, its thickness along the line; 5 m between stands
const STAND = Object.freeze({ width: 3, height: 2.6, pitch: 5 });
// the stands' colours by matter (values a gunner reads at 2 km)
const COLOR = Object.freeze({ 'armour-steel': '#5c636b', steel: '#7d868f', 'reinforced-concrete': '#9d9b95', concrete: '#b1aea6', brick: '#9a5c4c', stone: '#8f8a7e', timber: '#a07b4f', sand: '#c7b183', loam: '#6b5a44' });
const FLOOR = Object.freeze({ ground: ['#7d7a63', '#787560'], line: '#5f5d4c', track: '#6a665c', pad: '#a7a296', seabed: '#5d5a48', beach: '#b8a982' });
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group });

/** What is wrong with an artillery range's spec, by name; [] when it can be laid. */
export function validateArtillery({ mount = 'battle-tank', ordnance = null, base = 'fixed', reload = 6, sounds = {} } = {}) {
  const errs = [], cls = typeof mount === 'string' ? mount : mount?.class;
  if (!MOUNTS[cls]) errs.push(`mount: one of ${MOUNT_NAMES.join(', ')}, or { class, ...its fields }`);
  if (base !== 'fixed' && base !== 'hull' && !(base && typeof base === 'object')) errs.push(`base: 'fixed', 'hull', { vehicle, livery?, wear?, seed? } (a vehicle of the library with a turret), { frame, stance?, palette? } (a frame of the mecha shelf), { aircraft, palette? } or { boat, palette? } (the craft shelf's)`);
  else if (typeof base === 'object' && base.frame !== undefined) errs.push(...validateFrame(base));
  else if (typeof base === 'object' && base.aircraft !== undefined) errs.push(...validateAircraft(base));
  else if (typeof base === 'object' && base.boat !== undefined) errs.push(...validateBoat(base));
  else if (typeof base === 'object') {
    const v = vehicleClassOf(base.vehicle);
    if (!v.id) errs.push(`base.vehicle: ${v.why}`);
    for (const k of Object.keys(base)) if (!['vehicle', 'livery', 'wear', 'seed', ...(v.cycle ? ['rider'] : [])].includes(k)) errs.push(`base.${k}: a vehicle base is { vehicle, livery?, wear?, seed? }${v.cycle ? ' (a machine ridden astride: rider? false for none)' : ''}`);
    if (!v.class && !v.cycle && v.id) errs.push(`base.vehicle: the ${v.id} has no class the drive rule plays`);
  }
  if (ordnance !== null && (!Array.isArray(ordnance) || !ordnance.length || ordnance.length > MAX)) errs.push(`ordnance: 1 to ${MAX} of ${ORDNANCE_NAMES.join(', ')}`);
  else if (ordnance) {
    const seen = new Set();
    ordnance.forEach((w, i) => { if (!ORDNANCE[w]) errs.push(`ordnance[${i}]: '${w}' is not a round (${ORDNANCE_NAMES.join(', ')})`); if (seen.has(w)) errs.push(`ordnance[${i}]: '${w}' twice`); seen.add(w); });
  }
  if (!errs.length && ordnance?.includes('indirect') && turretOf(mount).mount.elevation.max < 45) errs.push(`ordnance: the indirect shell needs a mount that elevates past 45° (${cls} reaches ${turretOf(mount).mount.elevation.max}°: the field gun, the howitzer)`);
  if (!(reload > 0)) errs.push('reload: seconds, positive');
  for (const [k, w] of Object.entries(sounds ?? {})) {
    if (!['shot', 'reload', 'burst'].includes(k)) errs.push(`sounds.${k}: the gun's shot, reload or burst`);
    else if (!resolveSoundId(w)) errs.push(`sounds.${k}: '${w}' is not a sound on the SFX shelf`);
  }
  return errs;
}

const turretOf = (mount) => (typeof mount === 'string' ? mountOf(mount) : mountOf(mount.class, mount));
// a vehicle base's word through the library (vehicle-registry/roster.js): its row, and the build it is driven as: a
// field vehicle's class (car-designer/military.js), a machine ridden astride (the cycle shelf's), a car the car shelf
// composes (its card), or a road class's realistic loft (car-designer/realistic.js); or why not
function vehicleClassOf(word) {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) return { why: `'${word}' is not a vehicle of the library` };
  const H = handlesOf(hit.id), phys = H.physics ?? [];
  const cls = phys.find((k) => MILITARY_CLASSES[k]);
  if (cls) return { id: hit.id, class: cls };
  if (H.cycle?.length) return { id: hit.id, cycle: H.cycle[0], class: phys[0] };
  // (a road class: on wheels side by side, turned by its front ones, no site machine and no tracks)
  const road = phys.find((k) => PHYSICS[k] && PHYSICS[k].track > 0 && !PHYSICS[k].running && !PHYSICS[k].site && !PHYSICS[k].steer && !PHYSICS[k].layout);
  if (H.car?.length) return { id: hit.id, car: H.car[0], ...(road ? { class: road } : {}) };
  if (road) return { id: hit.id, class: road, loft: true };
  return { why: `the ${hit.id} is no vehicle the range drives (a field vehicle, a car, a machine ridden astride)` };
}

/** What a range asks to be built before it is laid: a machine ridden astride's rider (its hero, half a minute once a
 *  process). Await it before artilleryOf / artilleryHtml for such a base; nothing for any other. */
export async function artilleryReady(spec = {}) {
  const b = spec.base;
  if (b && typeof b === 'object' && b.vehicle !== undefined && b.rider !== false) {
    const v = vehicleClassOf(b.vehicle);
    if (v.cycle) await cycleReady(v.cycle);
  }
}
/**
 * A vehicle of the library as the gun's base: its realistic build drawn as itself, driven on its own class's rule. A
 * field vehicle with a turret (the light tank) has its gun on a bone of its own and the mount laid where its gun is over
 * the mount's class's rates; one without (a utility vehicle, a truck, a carrier, a launcher) is fitted a remote weapon
 * station (the shelf's ring, cradle and autocannon: frames.js `donated`) on the ring it has for one (its mount ring, its
 * roof's or its cab's hatch ring) or else on its roof, stabilized and all round, its rounds the autocannon's. A wheeled
 * vehicle's front axle steers (the front two of an eight-wheeler), drawn by the drive rule's own steering angle.
 * → { id, tracked, figure, rule, turret, rounds? }
 */
export function vehicleBase(base, mount = 'light-tank') {
  const v = vehicleClassOf(base.vehicle);
  if (!v.class) throw new Error(`artillery range: base.vehicle: ${v.why}`);
  // (a field vehicle compiled by its kit; a car the car shelf composes, at its card; a road class's realistic loft)
  const sheet = v.car ? null : rollVehicleSheet({ brief: '', facets: { pole: 'realistic', class: v.class }, seed: base.seed ?? 1 });
  const paint = { ...(base.livery !== undefined ? { livery: base.livery } : {}), ...(base.wear !== undefined ? { wear: base.wear } : {}) };
  const c = v.car ? compileCar({ preset: v.car, ...(v.class ? { class: v.class } : {}), ...(base.seed !== undefined ? { seed: base.seed } : {}) }, { form: true })
    : v.loft ? compileRealistic(sheet, { form: true, ...paint }) : compileMilitary(sheet, { form: true, gun: true, ...paint });
  const tracked = PHYSICS[v.class]?.running === 'track', steer = tracked ? null : steeringOf(c);
  // (its size for the views that watch it: its height, or a long vehicle's share of its length)
  const size = Math.round(Math.max(c.figure.figH, (PHYSICS[v.class]?.L ?? 4) / 2.6) * 100) / 100;
  if (c.gun) {
    // (vehicle space is +y forward, +x right; a mount's place is [forward, right, up])
    const T = turretOf(mount), [x, y, z] = c.gun.trunnion;
    return { id: v.id, tracked, size, figure: { ...c.figure, ...(steer ? { steer } : {}) }, rule: c.rule, turret: { ...T, mount: { ...T.mount, at: [y, x, z] }, gun: { ...T.gun, barrel: Math.round((c.gun.muzzle[1] - y) * 1000) / 1000 } } };
  }
  // the weapon station: on the ring the vehicle has for one, or its roof
  const at = stationAt(c), given = donated().map((it) => ({ ...it, at: it.at.map((q, i) => Math.round((q + at[i]) * 1000) / 1000) }));
  const B = lowerAssemblerBuild({ items: given }), P = new Map(B.placements.map((p) => [p.id, p])), faces = (id) => { const p = P.get(id); return B.faces.slice(p.faceStart, p.faceStart + p.faceCount); };
  const ring = P.get('mountR'), cradle = P.get('cradleR'), wf = faces('weaponR').flatMap((f) => f.corners);
  const muzzleY = wf.reduce((m, q) => Math.max(m, q[1]), -Infinity), fore = wf.filter((q) => q[1] > muzzleY - 0.3);
  const bz = (fore.reduce((m, q) => Math.min(m, q[2]), Infinity) + fore.reduce((m, q) => Math.max(m, q[2]), -Infinity)) / 2, tr = cradle.translate;
  const bones = [...c.figure.bones, { id: 'turret', head: ring.translate }, { id: 'gun', head: tr }];
  const rolls = c.figure.bones.map((b) => b.id).filter((id) => id !== 'root');
  const packed = packVehicleFigure(bones, new Map([['turret', faces('mountR')], ['gun', [...faces('cradleR'), ...faces('weaponR')]]]), { keys: c.figure.clips.roll.k, rolls, form: new Map(Object.entries(c.form)) });
  const figure = { ...c.figure, ...packed, ...(steer ? { steer } : {}) };
  // (a weapon station: stabilized, all round, quick: a backpack mount's rates without its stops)
  const R = FRAME_MOUNTS.pack.mount, T = mountOf('light-tank', { mount: { traverse: { rate: R.traverse.rate, accel: R.traverse.accel }, elevation: R.elevation, stabilized: true, look: R.look } });
  const r3 = (q) => Math.round(q * 1000) / 1000;
  return { id: v.id, tracked, size, station: true, figure, rule: c.rule, rounds: [...WEAPON_ROUNDS.autocannon], turret: { ...T, mount: { ...T.mount, at: [r3(tr[1]), r3(tr[0]), r3(bz)] }, gun: { ...T.gun, barrel: r3(muzzleY - tr[1]) } } };
}
// where a weapon station stands on a field vehicle: the centre of the ring it has for one (its mount ring, its roof's
// ring, its cab's hatch ring), on its top; else the top of its roof by its centreline (its aerials aside)
function stationAt(c) {
  const all = Object.values(c.form).flat();
  for (const part of ['mount.ring', 'roof.ring', 'hatch.ring']) {
    const fs = all.filter((f) => f.part === part);
    if (!fs.length) continue;
    const cs = fs.flatMap((f) => f.corners), mid = (k) => (cs.reduce((m, q) => Math.min(m, q[k]), Infinity) + cs.reduce((m, q) => Math.max(m, q[k]), -Infinity)) / 2;
    return [mid(0), mid(1), cs.reduce((m, q) => Math.max(m, q[2]), -Infinity)];
  }
  const roof = (c.form.root ?? []).filter((f) => !/^antenna/.test(f.part ?? '') && f.corners.every((q) => Math.abs(q[0]) < 0.7));
  const top = roof.reduce((m, f) => f.corners.reduce((n, q) => Math.max(n, q[2]), m), -Infinity), up = roof.filter((f) => f.corners.some((q) => q[2] > top - 0.05)).flatMap((f) => f.corners);
  return [0, up.reduce((a, q) => a + q[1], 0) / up.length, top];
}
// a wheeled field vehicle's steering as the page draws it: its front axle's wheels (an eight-wheeler's front two axles'),
// each one's place off the line of its fixed axles, the drive rule's wheelbase the circle's; null when it has no axles
function steeringOf(c) {
  const W = c.faces.wheels.filter((w) => /^wheel/.test(w.bone));
  if (W.length < 4) return null;
  const ys = [...new Set(W.map((w) => w.hub[1]))].sort((a, b) => b - a), steered = new Set(ys.slice(0, ys.length >= 4 ? 2 : 1));
  const fixed = W.filter((w) => !steered.has(w.hub[1])), yc = fixed.reduce((a, w) => a + w.hub[1], 0) / fixed.length;
  return { wheelbase: c.rule.wheelbase, wheels: W.filter((w) => steered.has(w.hub[1])).map((w) => ({ id: w.bone, x: w.hub[0], y: Math.round((w.hub[1] - yc) * 1000) / 1000 })) };
}
// the rounds a mount fires when none are named: the direct three, and the indirect shell where it elevates for it
const roundsFor = (T) => (T.mount.elevation.max >= 45 ? ['apfsds', 'heat', 'he', 'indirect'] : ['apfsds', 'heat', 'he']);

/** The range laid: its floor, its stands at their bands (and the far field), its colliders. Pure. */
export function layArtillery({ indirect = false, base = 'fixed', sea = null } = {}) {
  const faces = [], colliders = [], stands = [];
  // the floor: 250 m squares in two values, a darker line along each band; the range runs 250 m behind the gun to 5.75 km
  // ahead (2.25 km where no shell falls far), 750 m to each side
  // (a boat's range: the sea up to a shore short of the first band, its bottom 8 m down and a beach rising to the land;
  // the land's squares from the shore on)
  const far = indirect ? 5750 : 2250, step = 250, side = 750;
  if (sea) {
    const S = sea.shore, B = S - 100, W = 2500;
    faces.push(quad([-4000, -W, -8], [B, -W, -8], [B, W, -8], [-4000, W, -8], FLOOR.seabed, 'floor'), quad([B, -W, -8], [S, -W, 0], [S, W, 0], [B, W, -8], FLOOR.beach, 'floor'));
  }
  for (let x = sea ? sea.shore : -250; x < far; x += step) for (let y = -side; y < side; y += step) faces.push(quad([x, y, 0], [x + step, y, 0], [x + step, y + step, 0], [x, y + step, 0], FLOOR.ground[((x + y) / step) & 1 ? 1 : 0], 'floor'));
  for (let x = step; x < far; x += step) faces.push(quad([x - 1.5, -side, 0.02], [x + 1.5, -side, 0.02], [x + 1.5, side, 0.02], [x - 1.5, side, 0.02], FLOOR.line, 'floor'));
  // the firing line's pad, and a hull's track across it
  if (!sea) faces.push(quad([-12, -12, 0.03], [12, -12, 0.03], [12, 12, 0.03], [-12, 12, 0.03], FLOOR.pad, 'floor'));
  if (base === 'hull') faces.push(quad([-6, -300, 0.025], [6, -300, 0.025], [6, 300, 0.025], [-6, 300, 0.025], FLOOR.track, 'floor'));
  const put = (s, x0, y0, x1, y1, h, z0 = 0) => {
    const B = box(x0, y0, x1, y1, h, COLOR[s.matter] ?? '#999', 'stand', z0);
    faces.push(...B.faces); colliders.push(B.collider);
    return B.collider;
  };
  const rows = STANDS.filter((s) => s.thickness !== undefined);
  for (const d of DIRECT_BANDS) {
    const yc = d * Math.tan(BEARING[d] * Math.PI / 180), n = rows.length;
    rows.forEach((s, i) => {
      const y = yc + (i - (n - 1) / 2) * STAND.pitch, t = Math.max(0.05, s.thickness);
      const y0 = y - STAND.width / 2, y1 = y + STAND.width / 2;
      let c;
      if (s.angle) {
        // (the sloped plate laid back from its foot: its faces on the slope, its colliders a stair of slabs under them, so
        // a round bursts on the plate's face where it meets it)
        const ta = Math.tan(s.angle * Math.PI / 180), H = STAND.height, run = H * ta, th = t / Math.cos(s.angle * Math.PI / 180), col = COLOR[s.matter];
        faces.push(quad([d, y1, 0], [d, y0, 0], [d + run, y0, H], [d + run, y1, H], col, 'stand'), quad([d + th, y0, 0], [d + th, y1, 0], [d + th + run, y1, H], [d + th + run, y0, H], col, 'stand'),
          quad([d, y0, 0], [d + th, y0, 0], [d + th + run, y0, H], [d + run, y0, H], col, 'stand'), quad([d + th, y1, 0], [d, y1, 0], [d + run, y1, H], [d + th + run, y1, H], col, 'stand'));
        const n = 10;
        for (let k = 0; k < n; k++) colliders.push({ min: [d + run * k / n, y0, H * k / n], max: [d + th + run * (k + 1) / n, y1, H * (k + 1) / n] });
        c = { min: [d, y0, 0], max: [d + th + run, y1, H] };
      } else c = put(s, d, y0, d + t, y1, STAND.height);
      stands.push({ id: `${s.id}@${d}`, stand: s.id, band: d, min: c.min, max: c.max, matter: s.matter, thickness: s.thickness, ...(s.angle ? { angle: s.angle } : {}), face: 'front', color: COLOR[s.matter] });
    });
    // the band's posts at the row's two ends, white, a metre taller for each 250 m
    for (const e of [-1, 1]) { const y = yc + e * ((n - 1) / 2 * STAND.pitch + STAND.width + 2); const B = box(d, y - 0.3, d + 0.6, y + 0.3, 4 + d / 250, '#e8e6e0', 'post'); faces.push(...B.faces); }
  }
  // the far field: at each long range a bunker (a roof of reinforced concrete, struck from above) and a ring of sandbags
  if (indirect) {
    const rc = STANDS.find((s) => s.matter === 'reinforced-concrete' && s.thickness === 0.5), sb = STANDS.find((s) => s.matter === 'sand');
    for (const d of INDIRECT_BANDS.filter((x) => x > 2000)) {
      const c = put(rc, d - 6, -6, d + 6, 6, 2.8);
      stands.push({ id: `bunker@${d}`, stand: rc.id, band: d, min: c.min, max: c.max, matter: rc.matter, thickness: rc.thickness, face: 'top', color: COLOR[rc.matter] });
      for (const [x0, y0, x1, y1] of [[-16, -16, 16, -15], [-16, 15, 16, 16], [-16, -15, -15, 15], [15, -15, 16, 15]]) {
        const c2 = put(sb, d + x0, y0 + 40, d + x1, y1 + 40, 1.2);
        stands.push({ id: `sandbags@${d}`, stand: sb.id, band: d, min: c2.min, max: c2.max, matter: sb.matter, thickness: sb.thickness, face: 'top', color: COLOR[sb.matter] });
      }
    }
  }
  return { faces, colliders, stands };
}

// the sight's range marks for a direct round: at each band, how far below the bore's line the target's centre must sit
// (°) for the round laid on the bore to drop onto it, from the sight's height (its elevation at the band less the angle
// down to the target)
function marksOf(flight, sightZ) {
  return Object.entries(flight.bands).map(([d, b]) => [Number(d), r2((b.elev - Math.atan2(AIM - sightZ, Number(d)) * 180 / Math.PI) * 1000) / 1000]);
}

const cue = (word) => { const s = sfxSound(word); if (!s?.gestures) throw new Error(`artillery range: '${word}' is not a one-shot on the SFX shelf`); return s.gestures; };
const later = (g, t) => g.map((x) => ({ ...x, at: Math.round(((x.at ?? 0) + t) * 1000) / 1000 }));

/** The range's gun (its turret on its base, its rounds loaded by key, its range tables), its measures and its laws. */
export function artilleryOf(spec = {}) {
  const errs = validateArtillery(spec);
  if (errs.length) throw new Error(`artillery range: ${errs.join('; ')}`);
  const { mount = 'battle-tank', base = 'fixed', reload = 6, sounds = {}, quiet = false } = spec;
  // (a vehicle of the library as the base: its own figure and drive, the mount where its gun is; its class the light
  // tank's unless the spec names one)
  // (a frame of the mecha shelf as the base: standing at its stance, its own mounts or one fitted, its rounds its
  // weapons': frames.js)
  const F = typeof base === 'object' && base.frame !== undefined ? frameBase(base) : null;
  // (an aircraft of the craft shelf: flown on the fly rule at its class's envelope, its gun fixed along its nose: aircraft.js)
  const AIR = typeof base === 'object' && base.aircraft !== undefined ? airBase(base, { reload }) : null;
  // (a boat of the craft shelf: driven on the water on the boat rule at its class's figures, its own gun or one fitted:
  // boats.js)
  const BOAT = typeof base === 'object' && base.boat !== undefined ? boatBase(base, { reload }) : null;
  // (a machine ridden astride, the cycle shelf's: on its class's drive rule, its rider leaning it, aiming a gun fitted for
  // the range: roadsters.js; its rider built first, artilleryReady)
  const RV = typeof base === 'object' && base.vehicle !== undefined ? vehicleClassOf(base.vehicle) : null;
  const CY = RV?.cycle ? cycleBase(RV.id, RV.cycle, { rider: base.rider !== false, reload }) : null, OWN = AIR || BOAT || CY;
  const V = typeof base === 'object' && !F && !OWN ? vehicleBase(base, spec.mount ?? 'light-tank') : null, BV = V || OWN;
  const cls = F ? `${F.mountClass} mount` : OWN ? OWN.gun.label : V ? (typeof spec.mount === 'object' ? spec.mount.class : spec.mount ?? 'light-tank') : typeof mount === 'string' ? mount : mount.class;
  const T = F ? F.turret : BV ? BV.turret : turretOf(mount);
  // (a frame's rounds are its weapons'; `ordnance` chooses among them)
  const own = F ? F.rounds.filter((r) => !spec.ordnance || spec.ordnance.includes(r.ordnance)) : null;
  if (own && !own.length) throw new Error(`artillery range: ordnance: the ${F.id} fires ${F.rounds.map((r) => r.ordnance).join(', ')}`);
  const words = own ? own.map((r) => r.ordnance) : spec.ordnance ?? V?.rounds ?? OWN?.rounds.map((r) => r.ordnance) ?? roundsFor(T);
  // (each round from its own mount, as it stands: a twin-mount frame's on the side that fires it)
  // (and in a form of its own, a walker's tank form: its mount where that form carries it)
  const from = (w, form = null) => { const r = own && own.find((x) => x.ordnance === w); return r ? { ...T, mount: { ...T.mount, at: (form && r.atForm?.[form]) || r.at }, gun: { ...T.gun, barrel: r.barrel } } : T; };
  // the flight of each round from this mount as it stands (the indirect shell's high arc), and what it does to each
  // matter there
  const flight = {}, terminal = {};
  // (a fixed gun measured as a gun laid where it is: its place and its reach on a mount that elevates)
  // (a rotorcraft's, which fires from the air, as a gun stood at least 1.5 m up: a chin gun's place on its parked rig is
  // under a metre)
  const laid = AIR ? mountOf('light-tank', { mount: { at: AIR.rotor ? [T.mount.at[0], T.mount.at[1], Math.max(1.5, T.mount.at[2])] : T.mount.at }, gun: { barrel: T.gun.barrel } }) : null;
  // (a boat's gun measured as a gun of its mount at its height over the water: a boat underway carries its tables)
  const afloat = BOAT || CY ? { ...T, mount: { ...T.mount, at: [0, 0, T.mount.at[2]], traverse: { ...T.mount.traverse, min: undefined, max: undefined } } } : null;
  for (const w of words) { flight[w] = measureOrdnance(w, { mount: F || V ? from(w) : laid ?? afloat ?? cls }); terminal[w] = measureTerminal(w, flight[w]); }
  const laws = [...words.flatMap((w) => ordnanceLaws(flight[w], flight)), ...terminalLaws(terminal)];
  const indirect = words.includes('indirect');
  const rolling = base === 'hull' || !!V || !!CY, layout = layArtillery({ indirect, base: rolling ? 'hull' : 'fixed', ...(BOAT ? { sea: BOAT.sea } : {}) });
  // the sound: the gun's shot, the breech worked over the reload, the shell's burst far off (the mix heard to 6 km)
  const heard = quiet ? null : {
    shot: cue(sounds.shot ?? (AIR ? AIR.shot ?? 'machine gun' : (BOAT && /^(mg|ciws)$/.test(BOAT.gun.kind)) || CY ? 'machine gun' : 'cannon')),
    reload: sounds.reload ? cue(sounds.reload) : [...cue('mag out'), ...later(cue('mag in'), reload * 0.5), ...later(cue('rack'), reload * 0.85)],
    burst: cue(sounds.burst ?? 'big explosion'),
  };
  const rounds = words.map((w) => { const r = own && own.find((x) => x.ordnance === w); return { ...(OWN?.rounds.find((x) => x.ordnance === w) ?? ordnanceWeapon(w, { reload })), ...(r ? { at: r.at, barrel: r.barrel, ...(r.atForm ? { atForm: r.atForm } : {}) } : {}), ...(heard ? { sfx: { shot: AIR?.rounds.find((x) => x.ordnance === w)?.shotSound ? cue(AIR.rounds.find((x) => x.ordnance === w).shotSound) : heard.shot, reload: heard.reload } } : {}) }; });
  // (each round's marks from its own sight: its mount's height)
  const sightZ = (w, form) => (from(w, form).mount.at?.[2] ?? 0) + 0.35;
  const table = Object.fromEntries(words.filter((w) => !ORDNANCE[w].indirect && !ORDNANCE[w].drop).map((w) => [w, marksOf(flight[w], sightZ(w))]));
  // (a walker's tank form carries its gun lower: its own marks, from its own flights)
  const tableForm = F?.drive ? { tank: Object.fromEntries(words.filter((w) => !ORDNANCE[w].indirect && !ORDNANCE[w].drop).map((w) => [w, marksOf(measureOrdnance(w, { mount: from(w, 'tank'), bands: DIRECT_BANDS }), sightZ(w, 'tank'))])) } : null;
  const chart = Object.fromEntries(words.filter((w) => ORDNANCE[w].indirect).map((w) => [w, Object.entries(flight[w].bands).map(([d, b]) => [Number(d), b.mils, b.tof])]));
  const matter = Object.fromEntries([...new Set([...layout.stands.map((s) => s.matter), 'loam'])].map((k) => [k, MATTER[k]]));
  const turret = {
    ...T, rounds, look: { base: base === 'hull' ? 'hull' : cls === 'tower' ? 'tower' : cls === 'field-gun' ? 'field' : 'plinth', ...(F ? { back: Math.max(7, Math.round(F.height * 2.2)), up: Math.max(2, Math.round(F.height * 0.5)), size: F.height } : BV ? { size: BV.size, back: Math.max(18, Math.round(BV.size * 3.5)), up: Math.max(7, Math.round(BV.size * 1.4)), ...(AIR ? { view: 'chase', ...(AIR.drop ? { drop: true } : {}) } : {}), ...(BOAT ? { view: 'chase', ...(BOAT.bone ? { gunBone: BOAT.bone } : {}) } : {}), ...(CY || (V && RV && !MILITARY_CLASSES[RV.class]) ? { view: 'chase' } : {}) } : {}) },
    range: { stands: layout.stands, ordnance: Object.fromEntries(words.map((w) => [w, ORDNANCE[w]])), matter, table, ...(tableForm ? { tableForm } : {}), chart, ground: 'loam', ...(BOAT ? { sea: BOAT.sea } : {}) },
  };
  // (a vehicle drives on its own class's rule; the graybox hull walks; a fixed base stands)
  // (a frame walks at its gait's pace, its stride the clip's cycle: frames.js, mecha-shelf/mecha-gait.js; in its tank form
  // it stands)
  const walkRule = F?.gait ? { type: 'walk', speed: F.gait.speed, turn: F.gait.turn, stride: F.gait.stride, eye: 0, collideRadius: Math.max(1, F.gait.track || F.gait.L / 2), collideHeight: F.height } : null;
  // (a transforming walker's tank form: it drives on its wheels at its drive's pace, its clip's cycle a wheel's turn)
  // (steered: it turns about a point beside it by its front wheels' angle, never in place: worlds/controllable/steer.js)
  const driveRule = F?.drive ? { type: 'walk', speed: F.drive.speed, turn: F.drive.turn, stride: F.drive.stride, steer: F.drive.steer, eye: 0, collideRadius: Math.max(1, F.drive.track / 2 + 0.5), collideHeight: F.height } : null;
  const formsOf = driveRule ? { forms: { walker: { rule: walkRule }, tank: { rule: driveRule } }, form: F.form, transformDur: Math.round((1 + 0.25 * F.gait.L) * 10) / 10 } : {};
  const rule = F ? (driveRule ? (F.form === 'tank' ? driveRule : walkRule) : walkRule ?? { type: 'static' }) : BV ? BV.rule : base === 'hull' ? { type: 'walk', speed: 8, turn: 0.45, eye: 0, collideRadius: 3.5, collideHeight: 2.5 } : { type: 'static' };
  const pilot = { id: 'gun', pilotable: true, rule, ...formsOf, turret, weapon: rounds[0], body: BV || F ? { type: 'figure-rig', figure: 'base' } : { type: 'none' }, transform: OWN ? OWN.transform : { pos: [0, 0, 0], heading: 0, pitch: 0 } };
  const keys = OWN ? `${OWN.keys} · 1-${words.length}  load (${words.join(', ')}) · O  view` : `mouse  lay the gun · click  fire · 1-${words.length}  load (${words.join(', ')}) · right click  zoom · O  view${F ? (F.drive ? ' · W / S  walk or drive · A / D  turn or steer · B  transform' : F.gait ? ' · W / S  walk · A / D  turn' : ` · ${F.stance}`) : V ? ' · W / S  drive · A / D  steer' : base === 'hull' ? ' · W / S  drive · A / D  turn the hull' : ''}`;
  // the base heard (its own, from the shelf): a frame's footfalls by its weight at each foot's planting, its hydraulics by
  // its pace and its power pack; a tracked hull's engine and its tracks; a wheeled hull's diesel; a fixed gun nothing
  const held = (w) => sfxSound(w).sustain;
  const baseSound = !heard ? null : F ? { engine: held('diesel-engine'), ...(F.gait ? { hydraulics: held('walker-hydraulics'), step: cue(F.mass < 1500 ? 'heavy step' : F.mass < 12000 ? 'mech step' : 'giant step'), legs: Object.values(F.gait.phase), stepGain: r2(Math.min(1, 0.45 + F.mass / 40000)) } : {}) }
    : OWN ? (OWN.engine ? { engine: held(OWN.engine), ...(CY ? {} : { throttle: true }) } : null) : V ? { engine: held(V.tracked ? 'tank-engine' : RV && !MILITARY_CLASSES[RV.class] ? 'car-engine' : 'diesel-engine') } : base === 'hull' ? { engine: held('tank-engine') } : null;
  const audio = heard ? { mix: { space: 'open', voices: 12, distance: true, reach: 6000 }, cues: { shot: heard.shot, reload: heard.reload, burst: heard.burst, ...(baseSound?.step ? { 'base:step': baseSound.step } : {}) }, weapon: { shot: heard.shot, reload: heard.reload }, burst: heard.burst, ...(baseSound ? { base: baseSound, sustains: Object.fromEntries(['engine', 'hydraulics'].filter((k) => baseSound[k]).map((k) => [k, baseSound[k]])) } : {}) } : null;
  // (the camera is the turret view's: the sight, or outside; a base of its own figure is drawn, its turret hidden in the
  // sight by the view)
  const payload = { camera: { rule: 'eye', target: 'gun', height: 0, mouseLook: true, ...(BV || F ? {} : { hideTarget: true }) }, events: { hud: [{ text: keys }] }, ...(BV || F ? { figures: { base: (BV || F).figure } } : {}), ...(audio ? { audio } : {}) };
  return { minted: { pilot, payload }, mount: cls, base: F ? F.id : BV ? BV.id : base, ...(AIR ? { air: { archetype: AIR.archetype, ...(AIR.rotor ? { rotor: AIR.rotor } : { craft: AIR.craft }), envelope: AIR.envelope, gun: AIR.gun } } : {}), ...(BOAT ? { boat: { archetype: BOAT.archetype, drive: BOAT.drive, gun: BOAT.gun, fitted: BOAT.fitted } } : {}), ...(RV?.class && (V || CY) ? { road: { class: RV.class, words: PHYSICS[RV.class].words, envelope: envelopeOfClass(RV.class), ...(RV.car ? { car: RV.car } : {}), ...(CY ? { cycle: CY.archetype, rider: base.rider !== false } : {}) } } : {}), ...(F ? { frame: { archetype: F.archetype, stance: F.stance, armed: F.armed, weapons: F.weapons, height: F.height, ...(F.gait ? { gait: F.gait } : {}), ...(F.drive ? { drive: F.drive, form: F.form } : {}) } } : {}), ordnance: words, flight, terminal, laws, layout, name: spec.name ?? 'the artillery range' };
}

/** The readout's lines (short: a sign's width): each round's elevation (mils) at its bands, the indirect shell's flight to
 * the farthest, the laws. */
export function artilleryReadout(A) {
  const lines = [A.road && !MILITARY_CLASSES[A.road.class] ? `the ${A.base}, ${A.road.cycle ? `its rider${A.road.rider ? '' : ' (none aboard)'} aiming a 12.7 mm light gun` : 'a weapon station fitted on its roof'}` : A.boat ? `the ${A.base}, its ${A.boat.gun.label}${A.boat.fitted ? ', fitted' : ''}` : A.air ? `the ${A.base}, ${A.air.envelope.label}` : A.base === 'hull' ? `${A.mount}, on a hull` : A.base === 'fixed' ? `${A.mount}, fixed` : A.frame ? `the ${A.base}, ${A.frame.stance}${A.frame.armed ? '' : ', fitted'}` : `the ${A.base}'s gun`];
  // (a walking frame's gait: its pace and its stride, what set them)
  const g = A.frame?.gait;
  if (g) lines.push(`walks ${g.speed} m/s, ${g.stride} m a stride, ${g.stepsPerMinute} steps/min (${g.limitedBy === 'reach' ? 'its reach' : g.limitedBy === 'feet' ? 'its feet' : 'its size'})`);
  const ae = A.air?.envelope;
  if (ae) lines.push(A.air.rotor ? `hovers; ${ae.max} m/s top, climbs ${ae.climb} m/s, its disc to ${ae.tilt}°` : `flies ${ae.stall} / ${ae.cruise} / ${ae.max} m/s: stall, cruise, top`);
  const rd = A.road;
  if (rd) lines.push(`drives as ${rd.words}: ${Math.round(rd.envelope.top * 3.6)} km/h top, ${rd.envelope.leans ? 'leaning into its turns' : `${(rd.envelope.corner / 9.81).toFixed(2)} g in a turn`}`);
  const bd = A.boat?.drive;
  if (bd) lines.push(`${(bd.top / 0.514444).toFixed(0)} knots top, ${bd.planing ? 'onto the plane' : 'displacing'}, a ${Math.round(bd.circle)} m turning circle`);
  const dv = A.frame?.drive;
  if (dv) lines.push(`drives ${dv.speed} m/s on ${dv.wheels} wheels, ${dv.steered} steered, ${dv.circle} m at full lock`);
  const direct = A.ordnance.filter((w) => !ORDNANCE[w].indirect && !ORDNANCE[w].drop), high = A.ordnance.filter((w) => ORDNANCE[w].indirect), dropped = A.ordnance.filter((w) => ORDNANCE[w].drop);
  // (a released round: how long it falls from each height)
  if (dropped.length) lines.push(`falls from ${DROP_BANDS.join(' ')} m`);
  for (const w of dropped) { const B = A.flight[w].bands; lines.push(`${w} ${DROP_BANDS.map((d) => B[d].tof.toFixed(1)).join(' ')} s`); }
  if (direct.length) lines.push(`mils at ${DIRECT_BANDS.join(' ')} m`);
  for (const w of direct) { const B = A.flight[w].bands; lines.push(`${w} ${DIRECT_BANDS.map((d) => (Math.abs(B[d].mils) < 0.05 ? 0 : B[d].mils).toFixed(1)).join(' ')}`); }
  for (const w of high) { const B = A.flight[w].bands; lines.push(`${w}, mils at ${INDIRECT_BANDS.map((d) => d / 1000).join(' ')} km`, `${INDIRECT_BANDS.map((d) => Math.round(B[d].mils)).join(' ')} (${B[INDIRECT_BANDS.at(-1)].tof} s)`); }
  const fails = A.laws.filter((l) => !l.ok).map((l) => l.name);
  lines.push(`laws: ${A.laws.length - fails.length} of ${A.laws.length} hold${fails.length ? ` (failing: ${fails.slice(0, 2).join('; ')})` : ''}`);
  return lines;
}

/** The range's page: the gun on its base, played from its sight. */
export function artilleryHtml(spec = {}) {
  const A = artilleryOf(spec), { pilot, payload } = A.minted;
  return emitThreeWorld({
    faces: A.layout.faces, colliders: A.layout.colliders, entities: [pilot], camera: payload.camera, ...(payload.figures ? { figures: payload.figures } : {}),
    events: { hud: payload.events.hud.map((h) => ({ ...h, ttl: 30 })) },
    signs: [{ id: 'readout', variant: 'popup', anchor: { kind: 'slot', slot: 'top-right' }, text: `${A.name} · ${A.mount}`, body: artilleryReadout(A), pageLines: 8, chrome: { ...CHROME, fontSize: 11, padding: '6px 8px' } }],
    sky: { zenith: [118, 142, 176], horizon: [204, 208, 212], day: 1, stars: 0, seed: 3 }, bg: '#a9b0b8', haze: { color: '#bfc5cb', density: 0.00011 },
    ...(payload.audio ? { audio: payload.audio } : {}),
    viewBox: { width: 1120, height: 700 }, title: `${A.name} · ${A.mount}`, inline: true,
  });
}

export const ARTILLERY_MAX = MAX;
export { BEARING as ARTILLERY_BEARINGS };

/**
 * THE ORDNANCE — what a turret's gun fires, by what it does, and its flight measured on the runtime. Magnitudes by class
 * (a tank gun's long rod, its shaped charge, its high-explosive shell; a mortar's or a howitzer's low charge for the high
 * arc), never one maker's tables. Pure but for the measures' time.
 *
 *   ORDNANCE                    the rounds: `apfsds` (a kinetic long rod), `heat` (a shaped charge), `he` (a blast
 *                               shell), `indirect` (a shell fired high to fall on what the gun cannot see); a walker's:
 *                               `apds30` and `he30` (an autocannon's), `rocket` (a pod's), `missile` (a launcher's, unguided);
 *                               an aircraft's guns' (`ap127`, `api20`, `he20`, `api30`), a helicopter's chain gun's
 *                               `hedp30`; and the rounds a drone RELEASES (`drop`: let go at its own
 *                               velocity and falling, or carried into what it strikes): `grenade30`, `mortar60`, `bomblet`,
 *                               `warhead`
 *   WEAPON_ROUNDS               a mecha shelf weapon's rounds
 *   ordnanceWeapon(word, over?) → the runtime's weapon row: a travelling round at its muzzle velocity, on gravity and its
 *                               drag, its gun's dispersion as a seeded cone, a magazine of one reloaded at the gun's rate
 *   measureOrdnance(word, { mount, bands }) → (`mount` a class, or a turret as it stands: mountOf's shape) its flight at each band: the elevation to hit (° and mils), the time of
 *                               flight, the speed it arrives at and its share kept, the drop below the bore's line; an
 *                               indirect round's high arc to land at each band, its apex; a released round's fall from
 *                               each height (DROP_BANDS), its time and the speed it lands at; the spread of a dozen rounds
 *   ordnanceLaws(m)             → [{ name, ok, info }]
 *
 * Each round's numbers: `caliber` (mm), `mass` (kg, the flying body), `v0` (m/s at the muzzle), `drag` (the quadratic
 * constant, 1/m: ½ρ·Cd·A / m, so a round sheds speed as v·e^(−k·x) on a flat path), `dispersion` (mils, the gun's and
 * the round's), `fuse` (s, the longest flight), `filler` (kg of explosive, TNT-equivalent), and what bites: a kinetic
 * round's `rod` (its length, diameter and density, m and kg/m³), a shaped charge's `jet` (the armour it cuts, m of RHA).
 */
import { composeLive } from '../../worlds/controllable/compose.js';
import { mountOf } from './mount.js';

export const ORDNANCE = Object.freeze({
  // a fin-stabilized long rod: very fast, very thin, hardly slowed (about 55 m/s a kilometre)
  apfsds: Object.freeze({ label: 'armour-piercing fin-stabilized discarding sabot', kind: 'kinetic', caliber: 120, mass: 4.6, v0: 1650, drag: 3.4e-5, dispersion: 0.2, fuse: 10, filler: 0,
    rod: Object.freeze({ length: 0.57, diameter: 0.025, density: 17600 }), calib: Object.freeze({ muzzle: 0.65, far: 0.6 }) }),
  // a shaped charge: its jet does the work, so it need not be fast; fatter, so slowed more
  heat: Object.freeze({ label: 'high-explosive anti-tank (a shaped charge)', kind: 'shaped', caliber: 120, mass: 11.4, v0: 1140, drag: 1.1e-4, dispersion: 0.3, fuse: 10, filler: 1.6,
    jet: Object.freeze({ rha: 0.5 }) }),
  // a blast shell: the fattest and the slowest of the direct rounds
  he: Object.freeze({ label: 'high explosive', kind: 'blast', caliber: 120, mass: 15, v0: 900, drag: 1.0e-4, dispersion: 0.4, fuse: 10, filler: 2.2 }),
  // a low charge fired high (a mortar's bomb, a howitzer's least charge): slow, subsonic, a long flight onto a far hill
  indirect: Object.freeze({ label: 'an indirect-fire shell (a high arc)', kind: 'blast', caliber: 120, mass: 15, v0: 260, drag: 3.0e-5, dispersion: 1.5, fuse: 60, filler: 2.5, indirect: true }),
  // an autocannon's rounds (a walker's backpack gun, 30 mm): a sub-calibre tungsten core, about 110 mm of rolled armour
  // at a kilometre; and its small high-explosive shell, slowed hard by its blunt nose
  apds30: Object.freeze({ label: '30 mm armour-piercing discarding sabot', kind: 'kinetic', caliber: 30, mass: 0.24, v0: 1385, drag: 6e-5, dispersion: 0.5, fuse: 8, filler: 0,
    rod: Object.freeze({ length: 0.145, diameter: 0.016, density: 17600 }) }),
  he30: Object.freeze({ label: '30 mm high explosive', kind: 'blast', caliber: 30, mass: 0.36, v0: 1080, drag: 4e-4, dispersion: 0.6, fuse: 8, filler: 0.05 }),
  // an unguided rocket (a pod's, 70 mm): its motor burnt out near the launcher, flown on as a shell; wide in its scatter
  rocket: Object.freeze({ label: '70 mm unguided rocket', kind: 'blast', caliber: 70, mass: 6, v0: 700, drag: 1.5e-4, dispersion: 6, fuse: 15, filler: 1.0 }),
  // a launcher's missile fired without its guidance (a 150 mm body, a heavy warhead): slower, steadier than a rocket
  missile: Object.freeze({ label: 'a launcher\'s missile, fired unguided', kind: 'blast', caliber: 150, mass: 40, v0: 500, drag: 6e-5, dispersion: 3, fuse: 30, filler: 8 }),
  // an aircraft's guns (the craft shelf's): a heavy machine gun's armour-piercing bullet (12.7 mm, a hard core), a rotary
  // or revolver cannon's 20 mm armour-piercing incendiary (its hard core) and high-explosive incendiary shell, and a
  // tank-busting rotary cannon's 30 mm armour-piercing incendiary (a depleted-uranium core)
  ap127: Object.freeze({ label: '12.7 mm armour-piercing', kind: 'kinetic', caliber: 12.7, mass: 0.046, v0: 890, drag: 1.5e-4, dispersion: 3, fuse: 6, filler: 0,
    rod: Object.freeze({ length: 0.06, diameter: 0.0108, density: 17600 }) }),
  api20: Object.freeze({ label: '20 mm armour-piercing incendiary', kind: 'kinetic', caliber: 20, mass: 0.1, v0: 1030, drag: 3e-4, dispersion: 1, fuse: 6, filler: 0,
    rod: Object.freeze({ length: 0.06, diameter: 0.012, density: 17600 }) }),
  he20: Object.freeze({ label: '20 mm high-explosive incendiary', kind: 'blast', caliber: 20, mass: 0.1, v0: 1030, drag: 5e-4, dispersion: 1, fuse: 6, filler: 0.011 }),
  api30: Object.freeze({ label: '30 mm armour-piercing incendiary (a depleted-uranium core)', kind: 'kinetic', caliber: 30, mass: 0.425, v0: 1010, drag: 1.2e-4, dispersion: 1, fuse: 8, filler: 0,
    rod: Object.freeze({ length: 0.1, diameter: 0.02, density: 18600 }) }),
  // a helicopter's chain gun's 30 mm dual-purpose round (a small shaped charge in a fragmenting body: about 50 mm of
  // rolled armour)
  hedp30: Object.freeze({ label: '30 mm high-explosive dual-purpose', kind: 'shaped', caliber: 30, mass: 0.23, v0: 805, drag: 3.5e-4, dispersion: 5, fuse: 8, filler: 0.022,
    jet: Object.freeze({ rha: 0.05 }) }),
  // what a drone lets go (`drop`): released at its own velocity, the round's own speed hardly any; it falls on its drag
  // (its speed at most √(g/k)): a 30 mm grenade with its fuze set to strike, a 60 mm mortar bomb, a shaped-charge bomblet
  // slowed by its drogue so it falls nose down, and the RPG warhead a racing quad carries into what it strikes
  grenade30: Object.freeze({ label: '30 mm grenade, dropped', kind: 'blast', caliber: 30, mass: 0.35, v0: 0.5, drag: 4e-3, dispersion: 3, fuse: 30, filler: 0.036, drop: true }),
  mortar60: Object.freeze({ label: '60 mm mortar bomb, dropped', kind: 'blast', caliber: 60, mass: 1.7, v0: 0.5, drag: 7e-4, dispersion: 3, fuse: 30, filler: 0.36, drop: true }),
  bomblet: Object.freeze({ label: 'a shaped-charge bomblet, dropped on its drogue', kind: 'shaped', caliber: 70, mass: 1.07, v0: 0.5, drag: 1.6e-2, dispersion: 3, fuse: 30, filler: 0.57, drop: true,
    jet: Object.freeze({ rha: 0.2 }) }),
  warhead: Object.freeze({ label: 'an RPG warhead, carried in', kind: 'shaped', caliber: 93, mass: 2.6, v0: 0.5, drag: 1e-3, dispersion: 3, fuse: 30, filler: 0.7, drop: true,
    jet: Object.freeze({ rha: 0.5 }) }),
});
/** An aircraft's gun (the craft shelf's gun parts, craft-shelf/craft-odm.js): its rounds, its rate (rounds a second, as
 *  the range fires it: a rotary's own is far more, held here so a page keeps up) and the rounds it carries a gun. */
export const AIR_GUNS = Object.freeze({
  'gun-heavy-mg': Object.freeze({ label: 'heavy machine gun', rounds: Object.freeze(['ap127']), rof: 13, load: 400 }),
  'gun-rotary-20': Object.freeze({ label: '20 mm rotary cannon', rounds: Object.freeze(['api20', 'he20']), rof: 25, load: 511 }),
  'gun-revolver-30': Object.freeze({ label: '30 mm revolver cannon', rounds: Object.freeze(['apds30', 'he30']), rof: 20, load: 125 }),
  'gun-rotary-30': Object.freeze({ label: '30 mm rotary cannon', rounds: Object.freeze(['api30', 'he30']), rof: 25, load: 1174 }),
  // a helicopter's: an attack helicopter's chin chain gun, and the heavy machine gun a door gunner fires (a GAU-21's)
  'gun-heli-chin': Object.freeze({ label: '30 mm chain gun', rounds: Object.freeze(['hedp30']), rof: 10, load: 1200 }),
  'door-gun': Object.freeze({ label: '12.7 mm door gun', rounds: Object.freeze(['ap127']), rof: 18, load: 600 }),
});
/** The rounds a mecha shelf weapon fires on the range (mecha-shelf/mecha-backpacks.js MECHA_WEAPONS): an autocannon its
 * two, a pod its rocket, a howitzer its shells, a launcher its missile unguided; a small arm, a sensor or a crate none
 * (the minigun is the firing range's) */
export const WEAPON_ROUNDS = Object.freeze({ autocannon: Object.freeze(['apds30', 'he30']), rocketPod: Object.freeze(['rocket']), howitzer: Object.freeze(['he', 'indirect']), missiles: Object.freeze(['missile']) });
export const ORDNANCE_NAMES = Object.freeze(Object.keys(ORDNANCE));
/** The heights a released round is measured falling from (m). */
export const DROP_BANDS = Object.freeze([10, 25, 50, 100]);
const G = 9.81, MIL = 360 / 6400;   // a NATO mil, in degrees

/** The runtime's weapon row for a round (`over`: its fields, and `reload`: the gun's seconds to load the next). */
export function ordnanceWeapon(word, over = {}) {
  const O = ORDNANCE[word];
  if (!O) throw new Error(`ordnance: one of ${ORDNANCE_NAMES.join(', ')}`);
  const R = { ...O, ...over }, disp = R.dispersion * MIL;
  return {
    fireClass: 'lob', auto: false, cooldown: 0.2, magazine: 1, reserve: 40, reload: over.reload ?? 6,
    projectileSpeed: R.v0, projectileGravity: G, projectileDrag: R.drag, lobAngle: 0, fuse: R.fuse,
    projRadius: Math.max(0.05, R.caliber / 2000), armTime: 0.02, splashRadius: R.filler > 0 ? 1 + 2 * Math.cbrt(R.filler) : 0,
    damage: 1, impact: 1, range: R.indirect ? 8000 : 4000, fxScale: Math.max(0.3, R.caliber / 200),
    spread: { base: disp, move: 0, bloom: 0, recover: 0, max: disp },
    ordnance: word,
  };
}

const E = composeLive(), FPS = 60, DT = 1 / FPS, hooks = { ground: () => 0 };
const r2 = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 100) / 100), r3 = (v) => Math.round(v * 1000) / 1000;
// a gun on a standing mount, laid at `elev`° (the mount's own slew aside: the ballistics are the round's), firing one
// round along +x; → its path sampled every step, until it bursts
function shoot(word, elev, mount, { seed = 'g', shots = 1, z0 = 0 } = {}) {
  const turret = typeof mount === 'string' ? mountOf(mount) : mount, weapon = ordnanceWeapon(word);
  const w = E.createWorld({ entities: [{ id: seed, pilotable: true, rule: { type: 'static' }, body: { type: 'none' }, turret, weapon, transform: { pos: [0, 0, z0], heading: 0, pitch: 0 } }] });
  E.stepWorld(w, {}, DT, hooks);
  const g = w.byId[seed], T = g.turret;
  T.yaw = 0; T.vy = 0; T.pitch = elev; T.vp = 0; T.want = turret.mount.stabilized ? { yaw: 0, pitch: elev } : { yaw: 0, pitch: elev }; T.ty0 = 0; T.tp0 = elev;
  // (the elevation is laid directly: past the mount's own stops, a ballistic table's question, not the mount's)
  const paths = [];
  for (let s = 0; s < shots; s++) {
    g.weapon.ammo = 1; g.weapon.reloading = false; g.weapon.cooldownT = 0;
    T.pitch = elev; T.tp0 = elev; T.want.pitch = elev;
    const n0 = w.projSeq || 0;
    E.stepWorld(w, { fire: 1 }, DT, hooks);
    const p = (w.projectiles || []).find((x) => x.id === `proj-${n0}`);
    if (!p) { paths.push(null); continue; }
    const path = [{ t: 0, pos: p.pos.slice(), vel: p.vel.slice() }];
    for (let f = 1; f < 90 * FPS && w.projectiles.includes(p); f++) { E.stepWorld(w, {}, DT, hooks); path.push({ t: f * DT, pos: p.pos.slice(), vel: p.vel.slice() }); }
    paths.push(path);
    E.stepWorld(w, {}, DT, hooks);
  }
  return { paths, muzzle: T.muzzle.slice() };
}
// where a path crosses the plane x = d: its height, its time, its speed (interpolated between two steps); null short
function at(path, d) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.pos[0] < d && b.pos[0] >= d) {
      const u = (d - a.pos[0]) / (b.pos[0] - a.pos[0]), L = (k) => a.pos[k] + (b.pos[k] - a.pos[k]) * u;
      const v = Math.hypot(...a.vel.map((x, k) => x + (b.vel[k] - x) * u));
      return { y: L(1), z: L(2), t: a.t + (b.t - a.t) * u, v };
    }
  }
  return null;
}
// where a path comes down onto the ground: its range and its time
function landing(path) { const last = path[path.length - 1]; return { x: last.pos[0], t: last.t, apex: Math.max(...path.map((q) => q.pos[2])) }; }
// a bisection on the elevation (lo..hi) for f(elev) to cross 0 (f rising with elev)
function solve(f, lo, hi, n = 40) {
  let a = lo, b = hi, fa = f(a);
  if (fa === null) return null;
  for (let i = 0; i < n; i++) { const m = (a + b) / 2, fm = f(m); if (fm === null || (fm > 0) === (fa > 0)) { a = m; fa = fm ?? fa; } else b = m; }
  return (a + b) / 2;
}

export const DIRECT_BANDS = Object.freeze([250, 500, 1000, 2000]);
export const INDIRECT_BANDS = Object.freeze([2000, 3000, 4000, 5000]);
const AIM = 1.2;   // a target's centre over the ground (m)

export function measureOrdnance(word, { mount = 'battle-tank', bands = null } = {}) {
  const O = ORDNANCE[word], out = { ordnance: word, kind: O.kind, v0: O.v0, drag: O.drag, mount: typeof mount === 'string' ? mount : 'its own', bands: {} };
  if (O.drop) return measureDrop(word, bands, out);
  if (!O.indirect) {
    for (const d of bands ?? DIRECT_BANDS) {
      // the elevation to put the round through the target's centre at d
      const height = (e) => { const c = at(shoot(word, e, mount).paths[0], d); return c ? c.z - AIM : -1e3; };
      const e = solve(height, -3, 20);
      const hit = at(shoot(word, e, mount).paths[0], d);
      // the drop: the gun laid level, where the round passes below its bore's line at d (stood high, so no ground meets
      // it first)
      const S = shoot(word, 0, mount, { z0: 1000 }), flat = at(S.paths[0], d);
      out.bands[d] = { elev: r3(e), mils: r2(e / MIL), tof: r3(hit.t), v: Math.round(hit.v), kept: r3(hit.v / O.v0), drop: r2(flat ? S.muzzle[2] - flat.z : null) };
    }
  } else {
    for (const d of bands ?? INDIRECT_BANDS) {
      // the high arc: above 45°, a steeper gun lands shorter
      const reach = (e) => { const L = landing(shoot(word, e, mount).paths[0]); return d - L.x; };
      const e = solve(reach, 45, 85);
      const L = landing(shoot(word, e, mount).paths[0]);
      const P = shoot(word, e, mount).paths[0], q = P[P.length - 1], vh = Math.hypot(q.vel[0], q.vel[1]);
      out.bands[d] = { elev: r3(e), mils: r2(e / MIL), tof: r2(L.t), landed: Math.round(L.x), apex: Math.round(L.apex), v: Math.round(Math.hypot(vh, q.vel[2])), fall: r2(Math.atan2(-q.vel[2], vh) * 180 / Math.PI) };
    }
  }
  // the spread: a dozen rounds at the middle band, their impacts' scatter (m, and as mils of the range)
  const D = O.indirect ? (bands ?? INDIRECT_BANDS)[2] : (bands ?? DIRECT_BANDS)[2], e = out.bands[D].elev;
  // (a direct gun stood high, as for its drop: a wide cone's low rounds would meet the ground short of the band and leave
  // the sample, its scatter read narrower than it is)
  const { paths } = shoot(word, e, mount, { shots: 12, ...(O.indirect ? {} : { z0: 1000 }) });
  const hits = paths.filter(Boolean).map((p) => (O.indirect ? { y: landing(p).x, z: p[p.length - 1].pos[1] } : at(p, D))).filter(Boolean);
  const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  const across = sd(hits.map((h) => (O.indirect ? h.z : h.y))), along = sd(hits.map((h) => (O.indirect ? h.y : h.z)));
  out.spread = { at: D, rounds: hits.length, across: r2(across), along: r2(along), mils: r2(Math.max(across, O.indirect ? 0 : along) / D * 1000 * 6400 / (2 * Math.PI * 1000)) };
  return out;
}

// a released round let go from each height (a mount at the ground's own point, no barrel: the round from where it is
// let go), straight down at its own small speed: its fall's time, the speed and the angle it lands at; a dozen let go
// from the middle height, where they land
const DROPPER = mountOf('light-tank', { mount: { at: [0, 0, 0] }, gun: { barrel: 0 } });
function measureDrop(word, bands, out) {
  const O = ORDNANCE[word];
  out.mount = 'let go';
  for (const h of bands ?? DROP_BANDS) {
    const P = shoot(word, -90, DROPPER, { z0: h }).paths[0], q = P[P.length - 1], vh = Math.hypot(q.vel[0], q.vel[1]);
    out.bands[h] = { tof: r3(q.t), v: r2(Math.hypot(vh, q.vel[2])), fall: r2(Math.atan2(-q.vel[2], vh) * 180 / Math.PI) };
  }
  const H = (bands ?? DROP_BANDS)[2], { paths } = shoot(word, -90, DROPPER, { z0: H, shots: 12 });
  const hits = paths.filter(Boolean).map((p) => p[p.length - 1].pos);
  const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  const across = sd(hits.map((p) => p[1])), along = sd(hits.map((p) => p[0]));
  out.spread = { at: H, rounds: hits.length, across: r2(across), along: r2(along), mils: r2(Math.max(across, along) / H * 6400 / (2 * Math.PI)) };
  out.terminal = r2(Math.sqrt(G / O.drag));
  return out;
}

/** The ordnance's laws on its measures (`all`: { <word>: measure } for the laws between rounds). */
export function ordnanceLaws(m, all = {}) {
  const L = [], law = (name, ok, info) => L.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
  const O = ORDNANCE[m.ordnance], ds = Object.keys(m.bands).map(Number), B = (d) => m.bands[d];
  const rising = (k) => ds.every((d, i) => i === 0 || B(d)[k] > B(ds[i - 1])[k]);
  if (O.drop) {
    // (a released round: the higher, the longer it falls and the faster it lands, never faster than its drag lets it,
    // never sooner than a free fall from its height; and it lands about where it was let go)
    const tFree = (h) => (-O.v0 + Math.sqrt(O.v0 * O.v0 + 2 * G * h)) / G;
    law(`${m.ordnance}: the higher it is let go, the longer it falls and the faster it lands`, rising('tof') && rising('v'), Object.fromEntries(ds.map((d) => [d, [B(d).tof, B(d).v]])));
    law(`${m.ordnance}: it lands no faster than its drag lets it (${m.terminal} m/s) and no sooner than a free fall`, ds.every((d) => B(d).v <= m.terminal * 1.001 && B(d).tof >= tFree(d) - 0.02), Object.fromEntries(ds.map((d) => [d, [B(d).tof, r3(tFree(d)), B(d).v]])));
    law(`${m.ordnance}: it lands within its dispersion of where it was let go`, m.spread.mils <= O.dispersion * 2, { mils: m.spread.mils, asked: O.dispersion });
    return L;
  }
  if (!O.indirect) {
    law(`${m.ordnance}: the farther, the longer its flight and the higher the gun is laid`, rising('tof') && rising('elev'), Object.fromEntries(ds.map((d) => [d, [B(d).tof, B(d).elev]])));
    law(`${m.ordnance}: the farther, the more it drops below its bore's line`, rising('drop'), Object.fromEntries(ds.map((d) => [d, B(d).drop])));
    // (on a near-flat path the speed kept is the drag's own: e^(−k·x) along the path)
    law(`${m.ordnance}: it keeps its speed as its drag says (within 2%)`, ds.every((d) => Math.abs(B(d).kept - Math.exp(-O.drag * d)) <= 0.02), Object.fromEntries(ds.map((d) => [d, [B(d).kept, r3(Math.exp(-O.drag * d))]])));
  } else {
    law(`${m.ordnance}: it reaches every band on its high arc (between 45° and 85°), inside its fuse`, ds.every((d) => B(d).elev > 45 && B(d).elev < 85 && Math.abs(B(d).landed - d) < 5 && B(d).tof < O.fuse), Object.fromEntries(ds.map((d) => [d, [B(d).elev, B(d).landed, B(d).tof]])));
    law(`${m.ordnance}: the farther, the lower the gun is laid on the high arc and the shorter its flight`, ds.every((d, i) => i === 0 || (B(d).elev < B(ds[i - 1]).elev && B(d).tof < B(ds[i - 1]).tof)), Object.fromEntries(ds.map((d) => [d, [B(d).elev, B(d).tof]])));
  }
  // (a dozen rounds scatter as the gun's dispersion says, within a factor of two)
  law(`${m.ordnance}: its rounds scatter as its dispersion says`, m.spread.mils > O.dispersion * 0.4 && m.spread.mils < O.dispersion * 2, { mils: m.spread.mils, asked: O.dispersion });
  // (between the direct rounds: at the far band, the round that arrives sooner is laid lower, its drop its flight's; by
  // its arrival, not its muzzle velocity: a blunt small shell leaves faster than a big one and arrives later)
  const direct = Object.values(all).filter((x) => !ORDNANCE[x.ordnance].indirect && !ORDNANCE[x.ordnance].drop);
  if (direct.length > 1 && m === direct[0]) {
    const far = Math.max(...Object.keys(direct[0].bands).map(Number)), by = [...direct].sort((a, b) => a.bands[far].tof - b.bands[far].tof);
    // (of two that arrive apart, a tenth of the flight or more: near together, a draggy round's drag slows its fall too)
    const apart = (a, b) => b.bands[far].tof > 1.1 * a.bands[far].tof;
    law('at the far band, the round that arrives sooner is laid lower', by.every((x, i) => by.slice(0, i).every((y) => !apart(y, x) || x.bands[far].elev > y.bands[far].elev)), Object.fromEntries(by.map((x) => [x.ordnance, [x.bands[far].elev, x.bands[far].tof]])));
  }
  return L;
}

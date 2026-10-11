/**
 * Fixtures at true size: the bathroom's water closet, basin on a vanity, bathtub, shower, mirror and towel rail.
 *
 * Each fixture is a catalogue row (its size in mm, where it mounts, the clearance it needs in front and to each side)
 * and a pure builder that writes a workbench manifest in the house's own unit, in the room-asset `local` frame:
 * centred on x and y, z up from the floor, its front toward +y (into the room) and its back on the wall at −y. The
 * house places it on a footprint of exactly its catalogue size, so nothing is stretched (room-assets.js maps a local
 * piece onto its footprint without scaling).
 *
 * Pure: no clock, no dice. Same id and unit, same manifest (memoized).
 *
 *   FIXTURES                 id → { label, mark, size: { w, d, h } mm, front, side, mount?: mm, wall?: true }
 *   fixtureManifest(id, mm)  the workbench manifest in a unit of `mm` millimetres (304.8 for a house in feet)
 *   fixtureSize(id, mm)      { w, d, h } in that unit
 */

// The clearances are the north-american residential ones (IRC R307): a water closet 15 in from its centre to a side
// wall or fixture and 21 in clear in front; a basin 21 in clear in front; a tub 21 in clear beside it over a 30 in
// stretch to step in by (`access`, at the end into the room); a shower 24 in clear before its opening.
const IN = 25.4;
export const FIXTURES = Object.freeze({
  wc: { label: 'water closet', mark: 'WC', size: { w: 380, d: 710, h: 790 }, front: 21 * IN, side: 15 * IN, zone: 30 * IN },
  vanity: { label: 'basin on a vanity', mark: 'LAV', size: { w: 610, d: 530, h: 860 }, front: 21 * IN, side: 4 * IN },
  'double-vanity': { label: 'double basin vanity', mark: 'LAV', size: { w: 1520, d: 560, h: 860 }, front: 21 * IN, side: 4 * IN },
  bathtub: { label: 'bathtub', mark: 'TUB', size: { w: 1525, d: 760, h: 510 }, front: 21 * IN, side: 0, access: 30 * IN },
  shower: { label: 'shower', mark: 'SHR', size: { w: 915, d: 915, h: 2000 }, front: 24 * IN, side: 0 },
  mirror: { label: 'mirror', mark: 'MIR', size: { w: 600, d: 25, h: 1800 }, mount: 1000, wall: true, front: 0, side: 0 },
  'towel-rail': { label: 'towel rail', mark: 'TR', size: { w: 610, d: 100, h: 1150 }, mount: 1050, wall: true, front: 0, side: 0 },
});

const TINT = {
  china: '#f2f1ec', chinaShade: '#d9d8d2', chrome: '#c3c8cc', chromeDk: '#8c9296', glass: '#cfe0e4',
  carcass: '#dcd6c8', door: '#d2ccbd', top: '#ece9e3', kick: '#2a2620', water: '#9fb8c0', mirror: '#b9c9cf', frame: '#7b6a58',
};

const box = (x0, y0, z0, x1, y1, z1, w, h, tint, r) => ({ axisFrom: { x: x0, y: y0, z: z0 }, axisTo: { x: x1, y: y1, z: z1 }, profile: { rect: r ? { w, h, r } : { w, h } }, tint, ...(r ? { cornerSamples: 3 } : {}) });
const slab = (cx, cy, z0, z1, w, d, tint, r) => box(cx, cy, z0, cx, cy, z1, w, d, tint, r);   // a vertical extrude: w along x, d along y
// a turned part at the resolution a fixture reads at: a pan's six rings of twenty sides, a tap's two of eight
const turn = (cx, cy, z0, z1, profile, tint, { rings = profile.length > 2 ? 6 : 2, sides = profile.length > 2 ? 20 : 8 } = {}) => ({ axisFrom: { x: cx, y: cy, z: z0 }, axisTo: { x: cx, y: cy, z: z1 }, profile, tint, crossSections: rings, samples: sides });

// Each builder takes the size in the house's unit and `u`, one millimetre in that unit, and writes the parts.
const BUILD = {
  wc(s, u) {
    const { w, d, h } = s, back = -d / 2;
    const tankD = 180 * u, tankW = w * 0.95, tankZ0 = 420 * u;
    const bowlY = back + tankD + (d - tankD) * 0.48, rimZ = 400 * u;
    return {
      extrudes: [
        slab(0, back + tankD / 2, tankZ0, h - 30 * u, tankW, tankD, TINT.china, 20 * u),             // cistern
        slab(0, back + tankD / 2, h - 30 * u, h, tankW + 10 * u, tankD + 10 * u, TINT.chinaShade, 20 * u), // cistern lid
        slab(0, back + tankD + 30 * u, 0, tankZ0, 200 * u, 100 * u, TINT.china, 30 * u),                 // the pan's neck to the wall
        slab(0, bowlY, rimZ, rimZ + 22 * u, w * 0.98, (d - tankD) * 0.86, TINT.chinaShade, 160 * u),    // seat
      ],
      lathes: [
        turn(0, bowlY, 0, rimZ, [{ t: 0, radius: 120 * u }, { t: 0.35, radius: 135 * u }, { t: 0.75, radius: 175 * u }, { t: 1, radius: w * 0.48 }], TINT.china), // pan
        turn(w * 0.32, back + tankD * 0.6, h - 6 * u, h + 12 * u, [{ t: 0, radius: 18 * u }, { t: 1, radius: 18 * u }], TINT.chrome), // flush button
      ],
    };
  },
  vanity(s, u, { double = false } = {}) {
    const { w, d, h } = s, fy = d / 2, kick = 100 * u, top = 30 * u;
    const bowls = double ? [-w / 4, w / 4] : [0];
    const doors = double ? 4 : 2, dw = (w - 30 * u) / doors;
    return {
      extrudes: [
        slab(0, -10 * u, 0, kick, w - 60 * u, d - 80 * u, TINT.kick),                                   // toe kick
        slab(0, 0, kick, h - top, w, d, TINT.carcass),                                                   // carcass
        ...Array.from({ length: doors }, (_, i) => box(-w / 2 + 15 * u + dw * (i + 0.5), fy, (kick + h - top) / 2, -w / 2 + 15 * u + dw * (i + 0.5), fy + 18 * u, (kick + h - top) / 2, dw - 6 * u, h - top - kick - 40 * u, TINT.door)), // doors
        slab(0, 0, h - top, h, w + 20 * u, d + 20 * u, TINT.top, 8 * u),                                // top
        ...bowls.map((bx) => ({ ...slab(bx, 30 * u, h - 150 * u, h + 2 * u, 420 * u, 330 * u, TINT.china, 120 * u), wallThickness: 12 * u, openFace: 'to', innerTint: TINT.chinaShade })), // basins
      ],
      sweeps: bowls.map((bx) => ({ path: [[bx, -d / 2 + 70 * u, h], [bx, -d / 2 + 70 * u, h + 230 * u], [bx, -d / 2 + 150 * u, h + 270 * u], [bx, -d / 2 + 220 * u, h + 220 * u]], radius: 14 * u, sides: 8, tint: TINT.chrome })), // taps
    };
  },
  bathtub(s, u) {
    const { w, d, h } = s, rim = 70 * u;
    return {
      extrudes: [
        { ...slab(0, 0, 0, h, w, d, TINT.china, 60 * u), wallThickness: rim, openFace: 'to', innerTint: TINT.chinaShade }, // shell
        slab(0, 0, 60 * u, 60 * u + 4 * u, w - 2 * rim - 40 * u, d - 2 * rim - 40 * u, TINT.water, 200 * u),               // the floor of the tub, a shade darker
      ],
      lathes: [
        turn(w / 2 - 120 * u, -d / 2 + rim / 2, h, h + 180 * u, [{ t: 0, radius: 16 * u }, { t: 1, radius: 16 * u }], TINT.chrome), // filler
      ],
      sweeps: [{ path: [[w / 2 - 120 * u, -d / 2 + rim / 2, h + 180 * u], [w / 2 - 120 * u, -d / 2 + rim / 2 + 120 * u, h + 160 * u]], radius: 14 * u, sides: 8, tint: TINT.chrome }],   // at the end on the wet wall
    };
  },
  shower(s, u) {
    const { w, d, h } = s, tray = 60 * u, glass = 10 * u;
    return {
      extrudes: [
        slab(0, 0, 0, tray, w, d, TINT.china, 10 * u),                                                   // tray
        slab(0, 0, tray, tray + 3 * u, w - 80 * u, d - 80 * u, TINT.chinaShade),                          // tray floor
        box(0, d / 2 - glass / 2, tray, 0, d / 2 - glass / 2, h, w, glass, TINT.glass),                   // front screen
        box(w / 2 - glass / 2, 0, tray, w / 2 - glass / 2, 0, h, glass, d, TINT.glass),                   // side screen
        box(0, -d / 2 + 8 * u, 1700 * u, 0, -d / 2 + 260 * u, 1700 * u, 30 * u, 30 * u, TINT.chrome),     // arm
      ],
      lathes: [
        turn(0, -d / 2 + 260 * u, 1660 * u, 1700 * u, [{ t: 0, radius: 100 * u }, { t: 1, radius: 110 * u }], TINT.chrome), // head
        turn(0, -d / 2 + 25 * u, 1000 * u, 1080 * u, [{ t: 0, radius: 35 * u }, { t: 1, radius: 35 * u }], TINT.chrome),   // valve
      ],
    };
  },
  mirror(s, u, spec) {
    const { w, d, h } = s, z0 = spec.mount * u;
    return {
      extrudes: [
        box(0, -d / 2, (z0 + h) / 2, 0, d / 2, (z0 + h) / 2, w, h - z0, TINT.frame),                       // frame
        box(0, d / 2, (z0 + h) / 2, 0, d / 2 + 3 * u, (z0 + h) / 2, w - 40 * u, h - z0 - 40 * u, TINT.mirror), // glass
      ],
    };
  },
  'towel-rail'(s, u, spec) {
    const { w, d } = s, z = spec.mount * u, y = d / 2 - 15 * u;
    return {
      extrudes: [
        box(-w / 2 + 20 * u, -d / 2, z, -w / 2 + 20 * u, y, z, 30 * u, 30 * u, TINT.chrome),                // brackets
        box(w / 2 - 20 * u, -d / 2, z, w / 2 - 20 * u, y, z, 30 * u, 30 * u, TINT.chrome),
        slab(0, y, z - 380 * u, z + 10 * u, w - 120 * u, 24 * u, '#e7e2d6'),                                // a towel folded over the rail
      ],
      sweeps: [{ path: [[-w / 2 + 20 * u, y, z], [w / 2 - 20 * u, y, z]], radius: 12 * u, sides: 8, tint: TINT.chrome }],         // the rail
    };
  },
};
BUILD['double-vanity'] = (s, u) => BUILD.vanity(s, u, { double: true });

/** The catalogue size in a unit of `mm` millimetres. */
export function fixtureSize(id, mm = 304.8) {
  const f = FIXTURES[id];
  if (!f) throw new Error(`fixture: unknown '${id}' (one of ${Object.keys(FIXTURES).join(', ')})`);
  return { w: f.size.w / mm, d: f.size.d / mm, h: f.size.h / mm };
}

const memo = new Map();
/** The fixture's workbench manifest, in the local frame, at true size in a unit of `mm` millimetres. */
export function fixtureManifest(id, mm = 304.8) {
  const key = `${id}@${mm}`;
  if (memo.has(key)) return memo.get(key);
  const f = FIXTURES[id];
  const s = fixtureSize(id, mm);
  const out = { kind: 'workbench', units: 'ft', ...BUILD[id](s, 1 / mm, f) };
  memo.set(key, out);
  return out;
}

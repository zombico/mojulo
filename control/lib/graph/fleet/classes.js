/**
 * THE FLEET'S CLASSES — capital ships and stations as rows (fleet/build.js lays any of them out; a new one is a row).
 * A row with a `form` (wedge | concept | globform) is read as one shape by fleet/forms.js; the rest are modular.
 * `breach`: the holes through its reactor's casing that kill it (rupa-space: a steel casing is holed, not worn down).
 * A ship is its SECTIONS from aft to bow (the drive, the reactor, the hull, a spine, a hangar, the bow), each its length
 * (m) and its section's width and height, and what is fixed onto it (a tower, radiator wings, armour belts, turrets). A
 * station is its kind's own plan. Sizes are a navy's, from a corvette a fighter can strafe end to end in a few seconds to
 * a carrier half a kilometre long.
 *
 *   section   { kind: drive | core | hull | spine | hangar | bow, len, w, h, …: bells [across, up] (a drive's nozzles),
 *               windows (a hull's lit decks), belt (armour plates along its sides), tanks (a spine's), bay ('ventral' |
 *               'fore': a hangar's opening), steps (a bow's taper) }
 *   tower     { at: share of the length from the stern, len, w, h, levels }   command, high, to see
 *   radiators { at: the section they hang off (index), span, chord, pairs }   the reactor's heat out of fins
 *   turrets   [{ at: share of the length from the stern, on: top | bottom | port | starboard }]
 */

const S = (o) => Object.freeze(o);

export const CAPITAL_CLASSES = Object.freeze({
  corvette: S({ label: 'a corvette', length: 140, breach: 3, look: 'navy', module: 20,
    sections: [
      S({ kind: 'drive', len: 22, w: 20, h: 14, bells: [2, 1] }),
      S({ kind: 'core', len: 16, w: 22, h: 16 }),
      S({ kind: 'hull', len: 70, w: 24, h: 18, windows: true }),
      S({ kind: 'bow', len: 32, w: 22, h: 16, steps: 3 }),
    ],
    tower: S({ at: 0.42, len: 16, w: 10, h: 10, levels: 2 }),
    radiators: S({ at: 0, span: 16, chord: 14, pairs: 1 }),
    turrets: [S({ at: 0.6, on: 'top' }), S({ at: 0.75, on: 'top' }), S({ at: 0.55, on: 'bottom' })] }),
  frigate: S({ label: 'a frigate', length: 280, breach: 4, look: 'navy', module: 24,
    sections: [
      S({ kind: 'drive', len: 40, w: 34, h: 26, bells: [2, 2] }),
      S({ kind: 'core', len: 24, w: 36, h: 30 }),
      S({ kind: 'spine', len: 60, w: 14, h: 14, tanks: true }),
      S({ kind: 'hull', len: 110, w: 40, h: 32, windows: true, belt: true }),
      S({ kind: 'bow', len: 46, w: 36, h: 28, steps: 3 }),
    ],
    tower: S({ at: 0.66, len: 24, w: 14, h: 14, levels: 3 }),
    radiators: S({ at: 0, span: 34, chord: 30, pairs: 1 }),
    turrets: [S({ at: 0.55, on: 'top' }), S({ at: 0.82, on: 'top' }), S({ at: 0.6, on: 'port' }), S({ at: 0.6, on: 'starboard' }), S({ at: 0.75, on: 'bottom' })] }),
  cruiser: S({ label: 'a cruiser', length: 480, breach: 6, look: 'navy', module: 28,
    sections: [
      S({ kind: 'drive', len: 60, w: 56, h: 40, bells: [3, 2] }),
      S({ kind: 'core', len: 34, w: 60, h: 46 }),
      S({ kind: 'hangar', len: 84, w: 70, h: 50, bay: 'ventral', windows: true }),
      S({ kind: 'hull', len: 170, w: 64, h: 44, windows: true, belt: true }),
      S({ kind: 'bow', len: 90, w: 56, h: 38, steps: 4 }),
    ],
    tower: S({ at: 0.36, len: 42, w: 24, h: 26, levels: 3 }),
    radiators: S({ at: 0, span: 54, chord: 44, pairs: 1 }),
    turrets: [S({ at: 0.5, on: 'top' }), S({ at: 0.6, on: 'top' }), S({ at: 0.72, on: 'top' }), S({ at: 0.82, on: 'top' }),
      S({ at: 0.55, on: 'port' }), S({ at: 0.55, on: 'starboard' }), S({ at: 0.7, on: 'port' }), S({ at: 0.7, on: 'starboard' }), S({ at: 0.65, on: 'bottom' })] }),
  carrier: S({ label: 'a carrier', length: 560, breach: 6, look: 'navy', module: 30,
    sections: [
      S({ kind: 'drive', len: 64, w: 60, h: 44, bells: [3, 2] }),
      S({ kind: 'core', len: 36, w: 64, h: 48 }),
      S({ kind: 'hangar', len: 300, w: 120, h: 44, bay: 'fore', windows: true }),
      S({ kind: 'bow', len: 60, w: 96, h: 34, steps: 3 }),
    ],
    tower: S({ at: 0.3, len: 46, w: 22, h: 30, levels: 4 }),
    radiators: S({ at: 0, span: 56, chord: 46, pairs: 1 }),
    turrets: [S({ at: 0.45, on: 'top' }), S({ at: 0.62, on: 'top' }), S({ at: 0.8, on: 'top' }), S({ at: 0.5, on: 'port' }), S({ at: 0.5, on: 'starboard' }), S({ at: 0.75, on: 'port' }), S({ at: 0.75, on: 'starboard' })] }),

  // ── FORMS (fleet/forms.js): a ship read as one shape, its detail the shader's kibble ──
  // A WEDGE: the plan an isosceles triangle (the bow its point, the stern its short side), `beam` across the stern,
  // `deck` the ridge's height there and `keel` the depth below, a `rim` band round the edge; `tiers` the superstructure
  // stepping up aft (from / to shares of the length from the stern, `w` a share of the beam, `h` over the ridge), the
  // `tower` a bridge across a neck on the top tier; `bells` [across, up] the drive's; `guns` on the rim (port |
  // starboard, `at` a share of the length, `y` a share of the half-beam there) or on the tiers (`on: 'tier'`).
  destroyer: S({ label: 'a wedge destroyer', form: 'wedge', length: 900, beam: 500, deck: 70, keel: 46, rim: 16, cell: 60, breach: 5, look: 'navy', coreAt: 0.2,
    tiers: [S({ from: 0.02, to: 0.4, w: 0.36, h: 18 }), S({ from: 0.04, to: 0.27, w: 0.24, h: 44 }), S({ from: 0.06, to: 0.17, w: 0.15, h: 66 })],
    tower: S({ at: 0.1, len: 30, w: 120, h: 30, neck: 22 }), bells: [3, 1],
    guns: [S({ at: 0.3, on: 'port', y: 0.85 }), S({ at: 0.3, on: 'starboard', y: 0.85 }), S({ at: 0.5, on: 'port', y: 0.8 }), S({ at: 0.5, on: 'starboard', y: 0.8 }), S({ at: 0.68, on: 'port', y: 0.7 }), S({ at: 0.68, on: 'starboard', y: 0.7 }), S({ at: 0.32, on: 'tier', y: 0.25 }), S({ at: 0.32, on: 'tier', y: -0.25 })],
    kibble: S({ hull: 0.75, deck: 1, tower: 1, drive: 0.85, core: 0.8 }) }),
  lancer: S({ label: 'a lancer', form: 'wedge', length: 380, beam: 130, deck: 30, keel: 22, rim: 7, cell: 30, breach: 3, look: 'navy', coreAt: 0.24,
    tiers: [S({ from: 0.02, to: 0.32, w: 0.4, h: 10 }), S({ from: 0.05, to: 0.18, w: 0.24, h: 22 })],
    tower: S({ at: 0.1, len: 14, w: 46, h: 12, neck: 9 }), bells: [2, 1],
    guns: [S({ at: 0.35, on: 'port', y: 0.8 }), S({ at: 0.35, on: 'starboard', y: 0.8 }), S({ at: 0.55, on: 'tier', y: 0 })],
    kibble: S({ hull: 0.7, deck: 1, tower: 1, drive: 0.85, core: 0.8 }) }),
  // A CONCEPT SHAPE: a pure solid (`shape` cube | sphere | octahedron), `size` across; a cube's `slabs` of machinery
  // proud of each face, a sphere's equatorial `trench` and its `dish`; the kibble at full all over.
  monolith: S({ label: 'a monolith', form: 'concept', shape: 'cube', size: 420, cell: 70, breach: 5, look: 'shadow', slabs: 4, guns: 6, coreCells: 4,
    kibble: S({ hull: 1, deck: 1, core: 1 }) }),
  orb: S({ label: 'an orb', form: 'concept', shape: 'sphere', size: 380, cell: 63, breach: 5, look: 'navy', trench: true, dish: true, guns: 6, coreCells: 4,
    kibble: S({ hull: 0.95, core: 1 }) }),
  prism: S({ label: 'a prism', form: 'concept', shape: 'octahedron', size: 340, cell: 57, breach: 4, look: 'raider', guns: 6, coreCells: 4,
    kibble: S({ hull: 1, core: 1 }) }),
  // A GLOBFORM: `globs` along its length (`at` a share from the stern, radii `r` [along, across, up], `y`/`z` off the
  // axis), joined by a smooth union `blend` m wide; an `anchor` (an angular prism under or across them: its `plan`
  // [[share of length, share of the half-beam]], at `z`, `h` thick) giving the soft masses a line; `pods` on the
  // flanks; the reactor in the glob `coreGlob`.
  consular: S({ label: 'a consular cruiser', form: 'globform', length: 300, beam: 120, cell: 32, breach: 4, look: 'civil', blend: 24, coreGlob: 1, skin: 46,
    globs: [S({ at: 0.16, r: [44, 34, 28] }), S({ at: 0.42, r: [70, 46, 36] }), S({ at: 0.68, r: [52, 36, 30] })],
    anchor: S({ plan: [[0.5, 0.9], [0.9, 0.95], [1.02, 0.55], [1.02, -0.55], [0.9, -0.95], [0.5, -0.9]], z: 0, h: 10 }),
    pods: [S({ at: 0.04, len: 0.26, y: 60, r: 12 })],
    guns: [S({ at: 0.42, on: 'top' }), S({ at: 0.68, on: 'top' }), S({ at: 0.42, on: 'bottom' })],
    kibble: S({ hull: 0.3, deck: 0.95, drive: 0.7, core: 0.4, truss: 0 }) }),
  courier: S({ label: 'a courier', form: 'globform', length: 200, beam: 70, cell: 24, breach: 3, look: 'civil', blend: 18, coreGlob: 0, skin: 42,
    globs: [S({ at: 0.3, r: [46, 30, 24] }), S({ at: 0.62, r: [34, 24, 20] }), S({ at: 0.85, r: [20, 14, 12], z: 4 })],
    pods: [S({ at: 0.06, len: 0.3, y: 34, r: 8 })],
    guns: [S({ at: 0.3, on: 'top' }), S({ at: 0.62, on: 'bottom' })],
    kibble: S({ hull: 0.25, drive: 0.7, core: 0.35, truss: 0 }) }),
  // A RING SHIP (fleet/structures.js): a wheel round a drive spine, `spine` its radius, the wheel's `radius` and `tube`
  // `ringAt` along it; dressed by its `use` (civil | military), a sortie's group may ask the other.
  ringship: S({ label: 'a ring ship', form: 'ringship', use: 'military', length: 700, spine: 34, radius: 220, tube: 30, ringAt: 0.55, cell: 55,
    systems: S({ civil: [S({ kind: 'dock', on: 'fore', at: [0.5, 0] }), S({ kind: 'shield', on: 'top', at: [0.55, 0] }), S({ kind: 'reactor', on: 'aft', at: [0.5, 0] })],
      military: [S({ kind: 'shield', on: 'top', at: [0.55, 0] }), S({ kind: 'shield', on: 'bottom', at: [0.55, 0] }), S({ kind: 'bridge', on: 'top', at: [0.95, 0] }), S({ kind: 'reactor', on: 'aft', at: [0.5, 0] })] }),
    kibble: S({ civil: S({ hull: 0.4, hab: 0.3, deck: 0.6, tower: 0.7, drive: 0.7, core: 0.5, truss: 0 }), military: S({ hull: 0.9, hab: 0.85, deck: 0.9, tower: 1, drive: 0.85, core: 0.8, armour: 0.25, truss: 0 }) }) }),
});

/** Stations: each kind its plan (fleet/build.js stationPieces). Sizes in m. */
export const STATION_KINDS = Object.freeze({
  // a spindle: a column, a ring of habitats on spokes at its waist, docking arms, solar and radiator arrays on masts
  outpost: S({ label: 'an outpost', breach: 5, look: 'civil', column: S({ w: 28, h: 140 }), ring: S({ r: 70, n: 8, w: 22, h: 18 }), arms: 4, arm: 50, arrays: 2 }),
  // a yard: an open frame of trusses round a berth, cranes on its top chords, a frigate's hull half built in it
  shipyard: S({ label: 'a shipyard', breach: 4, look: 'civil', frame: S({ l: 380, w: 130, h: 100, beam: 8 }), cranes: 3, berth: 'frigate' }),
  // a battle platform: an armoured core in tiers of decks, turrets thick on every rim, shield masts on top
  platform: S({ label: 'a battle platform', breach: 8, look: 'navy', core: S({ w: 60, h: 90 }), tiers: 3, tierR: 80, tierH: 22, turretsPerRim: 8 }),
  // ── STRUCTURES (fleet/structures.js): read as one shape, dressed by their `use` (civil | military) ──
  // A HABITAT CYLINDER (an O'Neill cylinder), its axis x: civil, its land and window strips, mirrors, a farm wheel and
  // a dock ahead; military, armour belts, guns, slits, a drive and its number on its bow.
  cylinder: S({ label: 'a habitat cylinder', form: 'cylinder', use: 'civil', length: 1400, radius: 240, cell: 120, coreCells: 2,
    systems: S({ civil: [S({ kind: 'dock', on: 'fore', at: [0.5, 0] }), S({ kind: 'shield', on: 'top', at: [0.3, 0] }), S({ kind: 'reactor', on: 'aft', at: [0.5, 0] })],
      military: [S({ kind: 'shield', on: 'top', at: [0.3, 0] }), S({ kind: 'shield', on: 'bottom', at: [0.3, 0] }), S({ kind: 'bridge', on: 'top', at: [0.75, 0] }), S({ kind: 'reactor', on: 'aft', at: [0.5, 0] })] }),
    kibble: S({ civil: S({ hull: 0.35, hab: 0.3, deck: 0.6, drive: 0.7, core: 0.5, truss: 0 }), military: S({ hull: 0.9, deck: 0.9, drive: 0.85, core: 0.8, armour: 0.25, truss: 0 }) }) }),
  // A TORUS STATION (a wheel), its axis z: a ring of habitat bays on four spokes, its hub, its dock above; civil, its
  // inner band glazed, windows round its rim, solar arrays below; military, armour collars, guns, slits, masts, a number.
  torus: S({ label: 'a torus station', form: 'torus', use: 'civil', radius: 420, tube: 48, hub: S({ r: 70, h: 120 }), cell: 64,
    systems: S({ civil: [S({ kind: 'dock', on: 'top', at: [0.5, 0] }), S({ kind: 'shield', on: 'top', at: [0.95, 0] }), S({ kind: 'reactor', on: 'bottom', at: [0.5, 0] })],
      military: [S({ kind: 'shield', on: 'top', at: [0.95, 0] }), S({ kind: 'shield', on: 'top', at: [0.05, 0] }), S({ kind: 'comms', on: 'top', at: [0.5, 0.95] }), S({ kind: 'reactor', on: 'bottom', at: [0.5, 0] })] }),
    kibble: S({ civil: S({ hab: 0.3, deck: 0.6, core: 0.5, truss: 0 }), military: S({ hab: 0.85, deck: 0.9, core: 0.8, armour: 0.25, truss: 0 }) }) }),
});

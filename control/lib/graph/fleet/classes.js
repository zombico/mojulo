/**
 * THE FLEET'S CLASSES — capital ships and stations as rows (fleet/build.js lays any of them out; a new one is a row).
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
  corvette: S({ label: 'a corvette', length: 140, look: 'navy', module: 20,
    sections: [
      S({ kind: 'drive', len: 22, w: 20, h: 14, bells: [2, 1] }),
      S({ kind: 'core', len: 16, w: 22, h: 16 }),
      S({ kind: 'hull', len: 70, w: 24, h: 18, windows: true }),
      S({ kind: 'bow', len: 32, w: 22, h: 16, steps: 3 }),
    ],
    tower: S({ at: 0.42, len: 16, w: 10, h: 10, levels: 2 }),
    radiators: S({ at: 0, span: 16, chord: 14, pairs: 1 }),
    turrets: [S({ at: 0.6, on: 'top' }), S({ at: 0.75, on: 'top' }), S({ at: 0.55, on: 'bottom' })] }),
  frigate: S({ label: 'a frigate', length: 280, look: 'navy', module: 24,
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
  cruiser: S({ label: 'a cruiser', length: 480, look: 'navy', module: 28,
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
  carrier: S({ label: 'a carrier', length: 560, look: 'navy', module: 30,
    sections: [
      S({ kind: 'drive', len: 64, w: 60, h: 44, bells: [3, 2] }),
      S({ kind: 'core', len: 36, w: 64, h: 48 }),
      S({ kind: 'hangar', len: 300, w: 120, h: 44, bay: 'fore', windows: true }),
      S({ kind: 'bow', len: 60, w: 96, h: 34, steps: 3 }),
    ],
    tower: S({ at: 0.3, len: 46, w: 22, h: 30, levels: 4 }),
    radiators: S({ at: 0, span: 56, chord: 46, pairs: 1 }),
    turrets: [S({ at: 0.45, on: 'top' }), S({ at: 0.62, on: 'top' }), S({ at: 0.8, on: 'top' }), S({ at: 0.5, on: 'port' }), S({ at: 0.5, on: 'starboard' }), S({ at: 0.75, on: 'port' }), S({ at: 0.75, on: 'starboard' })] }),
});

/** Stations: each kind its plan (fleet/build.js stationPieces). Sizes in m. */
export const STATION_KINDS = Object.freeze({
  // a spindle: a column, a ring of habitats on spokes at its waist, docking arms, solar and radiator arrays on masts
  outpost: S({ label: 'an outpost', look: 'civil', column: S({ w: 28, h: 140 }), ring: S({ r: 70, n: 8, w: 22, h: 18 }), arms: 4, arm: 50, arrays: 2 }),
  // a yard: an open frame of trusses round a berth, cranes on its top chords, a frigate's hull half built in it
  shipyard: S({ label: 'a shipyard', look: 'civil', frame: S({ l: 380, w: 130, h: 100, beam: 8 }), cranes: 3, berth: 'frigate' }),
  // a battle platform: an armoured core in tiers of decks, turrets thick on every rim, shield masts on top
  platform: S({ label: 'a battle platform', look: 'navy', core: S({ w: 60, h: 90 }), tiers: 3, tierR: 80, tierH: 22, turretsPerRim: 8 }),
});

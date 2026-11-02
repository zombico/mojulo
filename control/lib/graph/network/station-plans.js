/**
 * THE STATION PLANS — a subway station's floor plan as a card (network/station.js builds whatever a card says): its
 * hall's width and height over its tracks, its platforms across it, its tracks (each its line across and the side its
 * third rail is on, away from its platform), the way out (a mezzanine across one end over the tracks, reached by a stair
 * from the island; or a doorway through each side platform's wall), which ends its tracks run on through (each a portal,
 * a tunnel's way in) and which end closes on buffer stops, and the running tunnel that meets it (network/sections.js:
 * `tube` a tube to each track, `rail` one box over both). A new floor plan is a card, not code.
 *
 *   island    one platform between two tracks; a mezzanine across its -y end, a stair up to it from the island; a tube
 *             to each track at both ends (the deep lines' station)
 *   side      a platform either side of two tracks, a column line between the tracks; a way out through each
 *             platform's wall; one twin box at each end (the cut-and-cover station)
 *   terminus  the island at the end of the line: its tracks end at buffer stops under the mezzanine at its +y end; tubes
 *             out of its -y end
 *
 * Metres, the hall's frame: x across its middle, y along it from its -y end, z up from its track bed.
 */
const T = (x, third) => Object.freeze({ x, third });

export const STATION_PLANS = Object.freeze({
  island: Object.freeze({
    reads: 'one platform between two tracks, a mezzanine across one end reached by a stair from the island, tubes to each track',
    width: 16, height: 8.4, platforms: [[-4, 4]], tracks: [T(-5.65, -1), T(5.65, 1)], columns: [-3, 3],
    exit: 'mezzanine', mezzanine: '-y', ends: ['-y', '+y'], tunnel: 'tube',
  }),
  side: Object.freeze({
    reads: 'a platform either side of two tracks, a column line between them, a way out through each platform\'s wall, one twin box',
    width: 16.6, height: 6.2, platforms: [[-8.3, -4.3], [4.3, 8.3]], tracks: [T(-2.15, 1), T(2.15, -1)], columns: [0],
    exit: 'sides', ends: ['-y', '+y'], tunnel: 'rail',
  }),
  terminus: Object.freeze({
    reads: 'an island at the end of the line, its tracks ending at buffer stops under the mezzanine at its head',
    width: 16, height: 8.4, platforms: [[-4, 4]], tracks: [T(-5.65, -1), T(5.65, 1)], columns: [-3, 3],
    exit: 'mezzanine', mezzanine: '+y', ends: ['-y'], tunnel: 'tube',
  }),
});
export const STATION_PLAN_IDS = Object.freeze(Object.keys(STATION_PLANS));

/** The colours of a line: its band, its frieze, its roundel's ring (after the original station's line themes). */
export const LINES = Object.freeze({
  blue: Object.freeze({ band: '#2f6fb0', frieze: '#244a6b', roundel: '#d2362f' }),
  red: Object.freeze({ band: '#c0392b', frieze: '#5a2420', roundel: '#f0c419' }),
  green: Object.freeze({ band: '#2e8b57', frieze: '#1f4d36', roundel: '#e0e0e0' }),
  orange: Object.freeze({ band: '#d97a2b', frieze: '#5e3a17', roundel: '#1c5fa8' }),
});
export const LINE_IDS = Object.freeze(Object.keys(LINES));

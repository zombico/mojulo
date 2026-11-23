/**
 * THE HOLO BRIEFING'S DATA — a mission's design (mission.js) as the briefing page draws it (briefing-page.js): the place
 * and its orrery, the theatre at its metres, everything in it stood up as a miniature (holo-minis.js), and the steps in
 * order: the place's opening (the system, the cluster, the station over its moon) and then the design's own.
 *
 *   briefingData(M) → {
 *     id, name, status, place: { line, parts }, orrery,
 *     theatre: { field, moon, rocks: [[x, y, z, r]…], nav: [{ id, name, at }] },
 *     things:  [{ id, name, side, kind: 'group' | 'capital' | 'station', label, at, heading, count?, pilot?, arrives?,
 *                 mini }]   at the sortie's metres (x across, y ahead, z up), heading ° clockwise from ahead
 *     steps:   [{ id, stage: 'orrery' | 'theatre', focus?, part, title, say, show, routes }]   part: the place's part
 *              the step is on (the opening zooms the system 0, the cluster 1, the moon 3; the fight round the station 2)
 *     roster:  [{ id, name, craft, count, side }]
 *     goals:   [{ text }]
 *   }
 *   BRIEFING      the opening's words and the rocks' counts on the table
 *
 * Pure: the same design, the same data (the page's bytes are a function of it).
 */
import { mulberry32, strHash } from '../city/plan/dice.js';
import { placeParts, placeLine, orrery, roman, STAR_KINDS } from './theatre.js';
import { craftMini, capitalMini, stationMini } from './holo-minis.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { SORTIE } from '../gameworld/flight-sortie.js';

const r1 = (v) => Math.round(v * 10) / 10;
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
/** The rocks drawn on the table by the cluster's density; how near the start none lies (m). */
export const BRIEFING = Object.freeze({ rocks: Object.freeze({ none: 0, sparse: 26, field: 60, dense: 120 }), clear: 450 });

const posOf = (M, c) => (typeof c.at === 'string' ? M.theatre.nav[c.at].at : c.at);
// where a flight group stands when its design says nothing: as the sortie lays it (flight-sortie.js SORTIE.at)
function groupAt(M, c) {
  if (c.at) return posOf(M, c);
  if (c.pilot) return [0, 0, 0];
  const A = !c.arrive || c.arrive === 'start' ? SORTIE.at[c.side] : SORTIE.at.arrive;
  return [A.side, A.ahead, A.up];
}
const bearingTo = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
const craftWords = (archetype) => {
  const A = CRAFT_ARCHETYPES[archetype], s = (A && (A.label || A.name)) || archetype;
  return s.replace(/^\w/, (c) => c.toUpperCase());
};

/** A goal as the briefing says it. */
function goalText(M, g) {
  const names = (ids) => [ids].flat().map((id) => { const c = M.cast.find((x) => x.id === id); return c ? `${c.name}${c.count > 1 ? ` ×${c.count}` : ''}` : id; }).join(', ');
  if (g.destroy) return `Destroy: ${names(g.destroy)}`;
  if (g.protect) return `Protect: ${names(g.protect)}`;
  return `Hold for ${g.survive} seconds`;
}

export function briefingData(M) {
  const parts = placeParts(M.place), T = M.theatre;
  const O = orrery(M.place, { moonKind: T.moon.kind });
  const station = M.cast.find((c) => c.station);
  // the rocks of the cluster, round the fight and clear of the start
  const rnd = mulberry32(strHash(`briefing-rocks|${M.id}|${M.place.seed}`)), half = T.field / 2, rocks = [];
  for (let k = 0, tries = 0; k < BRIEFING.rocks[T.rocks] && tries < 2000; tries++) {
    const p = [(rnd() * 2 - 1) * half, (rnd() * 2 - 1) * half, (rnd() * 2 - 1) * half * 0.25];
    if (Math.hypot(p[0], p[1]) < BRIEFING.clear) continue;
    rocks.push([r1(p[0]), r1(p[1]), r1(p[2]), r1(18 + rnd() * rnd() * 140)]);
    k += 1;
  }
  const things = M.cast.map((c) => {
    if (c.station) return { id: c.id, name: c.name, side: c.side, kind: 'station', label: stationMini(c.station).label, at: c.at, heading: c.heading ?? 0, mini: stationMini(c.station) };
    if (c.capital) return { id: c.id, name: c.name, side: c.side, kind: 'capital', label: capitalMini(c.capital).label, at: posOf(M, c), heading: c.heading ?? 0, mini: capitalMini(c.capital) };
    const at = groupAt(M, c);
    // (a friend flies the start's heading; a foe comes in facing the start, as the sortie lays it)
    const heading = c.side === 'foe' ? r1(bearingTo(at, [0, 0, 0])) : 0;
    return { id: c.id, name: c.name, side: c.side, kind: 'group', label: craftWords(c.craft), at, heading, count: c.count, ...(c.pilot ? { pilot: true } : {}), ...(c.arrive && c.arrive !== 'start' ? { arrives: true } : {}), mini: craftMini(c.craft) };
  });
  const H = O.planets[O.home], star = STAR_KINDS[O.star.kind].label;
  const opening = [
    { id: 'system', stage: 'orrery', focus: 'system', part: 0, title: parts[0].name, say: `${star.replace(/^\w/, (c) => c.toUpperCase())} and ${O.planets.length} worlds. The fight is among the moons of the ${ORD[O.home]} world.`, show: [], routes: [] },
    { id: 'cluster', stage: 'orrery', focus: 'cluster', part: 1, title: parts[1].name, say: `The ${parts[1].name} rides the ${ORD[O.home]} world's orbit ahead of it: rock enough to hide a fleet in.`, show: [], routes: [] },
    { id: 'moon', stage: 'orrery', focus: 'moon', part: 3, title: parts[3].name, say: `${parts[2].name} holds orbit over Moon ${roman(M.place.moon)}${station && station.side === 'friend' ? ', ours' : station && station.side === 'foe' ? ', theirs' : ''}. This is where we fight.`, show: [], routes: [] },
  ];
  const steps = [...opening, ...M.steps.map((s, k) => ({ id: `step-${k + 1}`, stage: 'theatre', part: 2, title: s.title, say: s.say, show: s.show, routes: s.routes }))];
  return {
    id: M.id, name: M.name, status: M.status,
    place: { line: placeLine(M.place), parts: parts.map((p) => p.name) },
    orrery: { ...O, homeMoons: H.moons.length },
    theatre: { field: T.field, moon: T.moon, rocks, nav: Object.entries(T.nav).map(([id, N]) => ({ id, name: N.name, at: N.at })) },
    things,
    steps,
    roster: M.cast.map((c) => ({ id: c.id, name: c.name, craft: c.craft ? craftWords(c.craft) : c.capital ? capitalMini(c.capital).label.replace(/^an? /, '').replace(/^\w/, (x) => x.toUpperCase()) : 'Station', count: c.count ?? 1, side: c.side })),
    goals: M.goals.map((g) => ({ text: goalText(M, g) })),
  };
}

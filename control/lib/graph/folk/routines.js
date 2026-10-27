/**
 * THE FOLK'S DAY: where a town's people go, hour by hour, on the level's clock (playscape/ui/routines.js `play.routines`:
 * at each hour of their plan they walk to its place and stay). Asked with `folk.day` (true, or { start, rate }: the
 * clock mechanic's, game/mechanics.js), since a clock is the level's: its hour on the HUD, its sky dark at night.
 *
 *   readDay(v)                                   → { start, rate } or throws, teaching
 *   folkDay(folk, { seed, stood, doors, keep })  → { walkers, spots, routines, posts }
 *     stood     path → { id, at, heading, house }  where each stands (folk-cast.js), their home place
 *     doors     house id → { at, N }                the town's doors (levels.js stageEnds `townDoors`)
 *     keep      paths that keep their place: the people the player comes looking for (a service's first person, one
 *               met in every town, anyone in a sidequest), so they are where the player expects them
 *   walkers   [path]                                 who keeps a day
 *   spots     [{ id, at, face }]                     the places their days use (play.spots)
 *   routines  [{ who, plan: [{ hour, to }] }]        each walker's day
 *   posts     { <entity id>: [spot id, …] }          the places each one stops at, home first: where they are talked to
 *
 * THE DAYS. A grown person of a house goes out mid-morning and is home by evening: to a counter when their house seeks
 * what a counter sells (a townie seeks provisions: roles.js), else to a neighbour's door. A child plays out on the street
 * before their house through the day. The watch walks its round, three houses through the day, back to the tower at
 * night. The places out are on the street before a house (a walk is a straight line: on the street it keeps to the
 * street), side by side when several stop at one house. Every hour and every choice is on the person's own die. Pure.
 */
import { mulberry32 } from '../vegetation/grow.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const DAY = Object.freeze({ start: 8, rate: 2 });
// out on the street before a house (m), and the step between two who stop there
const STREET = 3.2, SIDE = 1.2;

export function readDay(v) {
  if (v === true) return { ...DAY };
  if (!isObj(v)) throw new Error('folk: day is true, or { start?, rate? }: the level\'s clock the folk keep their day on');
  for (const k of Object.keys(v)) if (k !== 'start' && k !== 'rate') throw new Error(`folk: day.${k} is not a day word (start, rate)`);
  if (v.start !== undefined && !(Number.isFinite(v.start) && v.start >= 0 && v.start < 24)) throw new Error('folk: day.start is the hour the level starts at, 0 to 23');
  if (v.rate !== undefined && !(Number.isFinite(v.rate) && v.rate > 0 && v.rate <= 60)) throw new Error('folk: day.rate is game minutes a second (2: a day in twelve minutes), up to 60');
  return { start: v.start ?? DAY.start, rate: v.rate ?? DAY.rate };
}

export function folkDay(folk, { seed = folk.seed, stood, doors, keep = new Set() }) {
  const spots = [], routines = [], posts = {}, walkers = [];
  const visits = new Map();
  const people = folk.people.filter((p) => stood.has(p.path));
  const keepers = people.filter((p) => p.role === 'keeper' && !p.parent).map((p) => stood.get(p.path).house);
  const houses = [...new Set(people.map((p) => stood.get(p.path).house))].filter((h) => doors.has(h));
  // the place out on the street before a house: the next free one there
  const out = (house, owner) => {
    const d = doors.get(house), k = visits.get(house) ?? 0;
    visits.set(house, k + 1);
    const [nx, ny] = d.N, along = (k % 2 ? -1 : 1) * SIDE * Math.ceil(k / 2);
    const id = `${owner}-at-${house}`;
    spots.push({ id, at: [r3(d.at[0] + nx * STREET - ny * along), r3(d.at[1] + ny * STREET + nx * along)], face: r3(Math.atan2(-ny, -nx) * 180 / Math.PI) });
    return id;
  };
  for (const p of people) {
    if (keep.has(p.path)) continue;
    const S = stood.get(p.path), rand = mulberry32(hash(`${seed}::day::${p.path}`)), home = `${S.id}-home`;
    const child = p.sheet.facets.age === 'child', watch = p.service === 'watch';
    if (!child && !watch && p.role !== 'townie') continue;   // an apprentice keeps the bench, a hand the barn
    const others = houses.filter((h) => h !== S.house);
    let plan;
    if (watch) {
      // the round: three houses through the day, the tower at night
      if (!others.length) continue;
      const k0 = Math.floor(rand() * others.length);
      plan = [8, 12, 16].map((hour, k) => ({ hour, to: out(others[(k0 + k) % others.length], S.id) }));
      plan.push({ hour: 20, to: home });
    } else if (child) {
      // play out on the street before the house
      plan = [{ hour: 9 + Math.floor(rand() * 2), to: out(S.house, S.id) }, { hour: 17, to: home }];
    } else {
      // a grown person: out mid-morning, home by evening; to a counter when their house buys there, else a neighbour
      if (!others.length) continue;
      const shops = keepers.filter((h) => h !== S.house), shop = rand() < 0.6, k = rand();
      const to = shops.length && shop ? shops[Math.floor(k * shops.length)] : others[Math.floor(k * others.length)];
      plan = [{ hour: 9 + Math.floor(rand() * 3), to: out(to, S.id) }, { hour: 16 + Math.floor(rand() * 3), to: home }];
    }
    spots.push({ id: home, at: [S.at[0], S.at[1]], face: r3(S.heading * 180 / Math.PI) });
    walkers.push(p.path);
    routines.push({ who: S.id, plan });
    posts[S.id] = [home, ...new Set(plan.map((s) => s.to).filter((t) => t !== home))];
  }
  return { walkers, spots, routines, posts };
}

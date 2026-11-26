/**
 * A DISTRICT'S CROWD, IN SIXES — who walks a played district's pavements, in groups of six: a SIX is six different
 * people (each a rolled person of its own, gameworld/people.js), walking one area together and apart (two pairs side by
 * side, two on their own, each their own pace and each pair its own way round). An area asks for as many sixes as it is
 * busy (its walk's length by what it is: a square's or a shopping street's more than a quiet block's), and the district
 * stacks sixes where they are asked, nearest first, up to its crowd's most. Its people are rolled a six at a time
 * (`sets`): a quiet district one six of people, a busy one two, a packed one three, every six on its pavements six of
 * one set, so no two of a six are alike.
 *
 *   CROWDS            { quiet, busy, packed }: { sets (sixes of people rolled), most (sixes walking), per (m of walk a
 *                     six is asked for) }
 *   SIX               6
 *   KIND_WEIGHT       how much a block's kind asks of its walk (a square, shops, offices, homes)
 *   crowdOf(spec)     → the district's crowd word: its own (`crowd`), else a busy one in the core and the frame, a quiet
 *                       one in the outskirts
 *   crowdSets(spec)   → the sixes of people its level rolls
 *   PEOPLE_WORDS, peopleOf(spec) → who its people are: 'quick' (the hero door's quick figures, the crowd grade) or
 *                       'realistic' (gameworld/street-cast.js streetSix: the realistic body and face, the realistic crowd
 *                       grade, a near figure and a far one); its own (`people`), else 'quick'
 *   sixesOf(areas, { crowd, seed, rand }) → [{ area, set, members: [{ person, reverse, speed, start }] }]: each area
 *                       { id, length, kind, rank (nearest first) } asked its sixes; `person` an index into the rolled
 *                       people (set × 6 + its place in the six)
 *
 * Pure: the area's own dice (`rand(id)`, a seeded stream), so one area's sixes move no other's.
 */
export const SIX = 6;
/** a district's walking pace (m/s): a group of a six walks it times its own pace (0.82 … 1.18) */
export const SIX_WALK = 1.35;
export const CROWDS = Object.freeze({
  quiet: Object.freeze({ sets: 1, most: 4, per: 220 }),
  busy: Object.freeze({ sets: 2, most: 8, per: 150 }),
  packed: Object.freeze({ sets: 3, most: 12, per: 100 }),
});
export const CROWD_WORDS = Object.freeze(Object.keys(CROWDS));
export const KIND_WEIGHT = Object.freeze({ square: 2, tower: 1.6, podium: 1.5, 'main-street': 1.5, worship: 1.2, park: 1.1, midrise: 1, lowrise: 0.9, apartments: 0.8, slab: 0.7, houses: 0.5, edge: 0.7, school: 0.8 });
// (a six's members: two pairs walking side by side, two on their own; each pair its pace, each single its own)
const SHAPE = Object.freeze([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0]]);

export function crowdOf(spec = {}) {
  if (spec.crowd !== undefined) return spec.crowd;
  return spec.at === 'outskirts' ? 'quiet' : 'busy';
}
export const crowdSets = (spec = {}) => CROWDS[crowdOf(spec)].sets;
export const PEOPLE_WORDS = Object.freeze(['quick', 'realistic']);
export const peopleOf = (spec = {}) => spec.people ?? 'quick';

export function sixesOf(areas, { crowd = 'busy', rand }) {
  const C = CROWDS[crowd], out = [];
  // (each area its asking: its walk by its kind, in sixes, the part past a whole six by its own dice)
  const asked = areas.map((a) => {
    const R = rand(a.id), want = (a.length * (KIND_WEIGHT[a.kind] ?? 1)) / C.per;
    return { a, R, n: Math.floor(want) + (R() < want - Math.floor(want) ? 1 : 0) };
  }).sort((p, q) => p.a.rank - q.a.rank);
  // (stacked where they are asked, nearest first, a six to each area in turn until the district holds its most)
  let placed = 0;
  for (let round = 0; placed < C.most; round++) {
    let any = false;
    for (const q of asked) {
      if (placed >= C.most) break;
      if (round >= q.n) continue;
      any = true;
      const set = placed % C.sets, base = q.R(), members = [];
      for (let i = 0; i < SIX; i++) {
        const [g, k] = SHAPE[i];
        // (its four groups a quarter round apart from the six's own place, a pair's two a step apart at one pace; each
        // group its own way round, by turns)
        const pace = 0.82 + 0.36 * ((g * 0.37 + base * 7.1) % 1);
        members.push({ person: set * SIX + i, reverse: g % 2 === 1, speed: Math.round(pace * 1000) / 1000, start: Math.round(((base + g / 4 + k * 0.006) % 1) * 1e5) / 1e5 });
      }
      out.push({ area: q.a.id, set, members });
      placed++;
    }
    if (!any) break;
  }
  return out;
}

/**
 * brawl play — HOW A SIDEWAYS MAP IS PLAYED: the play types. One map (a belt, its bends, its dress, its scenes, its
 * place in a game's turn), played by one of these; the map does not change, the idioms do. A row per type, so a new way
 * to play a sideways map is a row and its idioms, never a second map:
 *
 *   PLAY_TYPES[id]
 *     says     what it is, in a line
 *     kit      the player's kit (its buttons' reader): brawl-moves.js the brawler's, brawl-gunner.js the gunner's
 *     asks     what its turn asks before a map loads (game/turn.js picks), after how hard it fights
 *     hud      what its screen shows (brawl-street.js streetSpec)
 *     stands   what stands in the band when a map names nothing
 *     waves    how a map is held when it names no waves
 *     result   what its end reads back
 *
 *   playWaves(play, belt, types?)            → a run & gun's waves for a map that names none (a brawl's: quick.js defaultWaves)
 *   playThings(play, belt, { boxes?, cover? }) → what stands on it: cover to fight from (the dress's own, a list a
 *                                              screen: brawl-dress.js dressCover), a gun to take up, food
 *
 * Pure: no clock, no dice.
 */
import { CROWD_TYPES } from './brawl-crowd.js';
import { THINGS } from './brawl-things.js';

const row = (o) => Object.freeze(o);
export const PLAY_TYPES = Object.freeze({
  brawl: row({
    says: 'a beat \'em up: fists, grabs and throws, a crowd a held screen',
    kit: 'the brawler\'s: the chain, the strong blows, grabs and throws, the running blow',
    asks: Object.freeze(['fighter']),
    hud: 'health, the held screens as pips, the crowd left, the boss\'s bar',
    stands: 'breakables against the far side, every other one holding food',
    waves: 'a crowd a held screen, each a body more than the last; a boss on the last with two beside it',
    result: Object.freeze(['time', 'health', 'rank']),
  }),
  gun: row({
    says: 'a run & gun: a gun in the hands, rounds that fly and can be stepped off, shooters behind cover',
    kit: 'the gunner\'s: fire (held), aim eight ways, plant, roll, jump, grenade; what it walks over it takes',
    asks: Object.freeze(['fighter', 'gun']),
    hud: 'health, the gun held and its rounds, the grenades, the held screens as pips, the crowd left, the boss\'s bar',
    stands: 'cover on every screen (the setting\'s own), a crate holding a gun on the held ones, food before the boss',
    waves: 'shooters on every screen with a rush between them: on an open screen fought on the move, on a held one until beaten; the last screen its boss, a rocket with its shooters',
    result: Object.freeze(['time', 'health', 'accuracy', 'rank']),
  }),
});
export const PLAY_IDS = Object.freeze(Object.keys(PLAY_TYPES));

const COVER = Object.freeze(['sandbags', 'crates']);
/** the guns a crate holds, in turn (brawl-things.js THINGS.gun) */
export const CRATE_GUNS = Object.freeze(['spread', 'machine-gun', 'rocket', 'flame']);

const SHOOTS = (t) => !!CROWD_TYPES[t]?.gun;
/**
 * A RUN & GUN'S WAVES when a map names none. Every screen has one: an open screen's is fought on the move (two
 * shooters, then a third), a held one's until it is beaten (two shooters and one of the crew's own rushing in, a
 * shooter more each); the boss's screen its BOSS, the crowd's rocket with a boss's health and bar, its shooters beside it. Counts measured against the
 * fight laws (brawl-measure.js). `types`: how the crew fights (its crowd
 * types): its shooters shoot, its others rush; a crew with no gun gets riflemen and a gunner.
 */
export function playWaves(play, belt, types = null) {
  if (play !== 'gun') throw new Error(`brawl: playWaves lays a run & gun's waves (play 'gun'); a brawl's are its own`);
  const T = types?.length ? types : [], guns = T.filter(SHOOTS), rush = T.filter((t) => !SHOOTS(t));
  const G = guns.length ? guns : ['rifleman', 'gunner'], R = rush.length ? rush : ['thug'];
  const tally = (list) => { const m = new Map(); for (const t of list) m.set(t, (m.get(t) ?? 0) + 1); return [...m].map(([type, n]) => ({ type, n })); };
  const out = [];
  let open = 0, held = 0;
  belt.screens.forEach((sc, screen) => {
    const shooters = (n, from) => Array.from({ length: n }, (_, i) => G[(i + from) % G.length]);
    // (THE BOSS, a shooter: the crowd's own rocket as the boss (brawl-crowd.js, a boss of a crowd type), its bar on the
    // screen, its shooters beside it; at half its health it throws the rocket down for a burst gun and calls two more. Never a brawler: a gunner has no answer to a boss that fights at arm's length,
    // measured (brawl-measure.js); a map's own waves may still name one)
    if (sc.boss) out.push({ screen, crowd: tally(shooters(2, held)), boss: { type: 'bazooka', name: 'The Boss', hp: 640, phases: [{ at: 0.5, type: 'gunner', volley: 4, calls: [{ type: G[held % G.length], n: 2 }], says: 'Reinforcements' }] } });
    else if (sc.gate) { out.push({ screen, crowd: tally([...shooters(2 + held, held), R[held % R.length]]) }); held++; }
    else { out.push({ screen, crowd: tally(shooters(Math.min(3, 2 + open), open)) }); open++; }
  });
  return out;
}
/**
 * WHAT STANDS ON A RUN & GUN'S MAP when it names nothing: on every screen two pieces of COVER across the band (the
 * place's own: `cover`, a list of cover a screen, what that screen's set stands on its floor, or one list for the
 * whole map; sandbags and crates with none said), a third and two thirds along, on alternate sides of the
 * band's middle, so a line of fire is always broken somewhere; on a held screen a crate (`boxes`: the setting's) at
 * its far side holding a GUN, a different one each; on the boss's, one holding a roast chicken.
 */
export function playThings(play, belt, { boxes = null, cover = null } = {}) {
  if (play !== 'gun') throw new Error(`brawl: playThings lays a run & gun's things (play 'gun'); a brawl's are its own`);
  const each = Array.isArray(cover?.[0]), ofScreen = (i) => { const L = ((each ? cover[i] : cover) ?? []).filter((c) => THINGS.cover[c]); return L.length ? L : COVER; };
  const BOX = boxes?.length ? boxes : ['crate'];
  const [n0, n1] = belt.depth, mid = (n0 + n1) / 2, r2 = (v) => Math.round(v * 100) / 100, out = [];
  let k = 0, g = 0;
  belt.screens.forEach((sc, i) => {
    // (the first screen's cover stands clear of where the players start)
    const C = ofScreen(i);
    // (each piece stood clear of the band's edges, whatever its depth)
    for (const f of i === 0 ? [0.72] : [0.36, 0.72]) { const what = C[k % C.length], half = THINGS.cover[what].d / 2 + 0.3; out.push({ kind: 'cover', what, at: r2(sc.from + f * sc.length), n: r2(Math.max(n0 + half, Math.min(n1 - half, mid + (k % 2 ? 0.9 : -0.9)))) }); k++; }
    if (sc.gate && !sc.boss) { out.push({ kind: 'box', what: BOX[g % BOX.length], at: r2(sc.from + 0.2 * sc.length), n: r2(n1 - 0.6), holds: { kind: 'gun', what: CRATE_GUNS[g % CRATE_GUNS.length] } }); g++; }
    // (food where a fight has been: a roast chicken after the first held screen, a joint before the last stand)
    if (sc.gate && !sc.boss && g > 1) out.push({ kind: 'box', what: BOX[g % BOX.length], at: r2(sc.from + 0.1 * sc.length), n: r2(n0 + 0.6), holds: { kind: 'food', what: 'chicken' } });
    if (sc.boss) out.push({ kind: 'box', what: BOX[g % BOX.length], at: r2(sc.from + 0.15 * sc.length), n: r2(n1 - 0.6), holds: { kind: 'food', what: 'meat' } });
  });
  return out;
}

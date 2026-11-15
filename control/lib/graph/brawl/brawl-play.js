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
 *   playThings(play, belt, { boxes?, cover? }) → what stands on it: cover to fight from, a gun to take up, food
 *   SETTING_COVER                            the cover a setting's places have (brawl-dress.js settings), by setting
 *
 * Pure: no clock, no dice.
 */
import { CROWD_TYPES } from './brawl-crowd.js';
import { THINGS } from './brawl-things.js';
import { solveFighter } from '../versus/versus-solver.js';
import { CPU_LEVELS } from '../versus/versus-cpu.js';

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
    waves: 'shooters on every screen with a rush between them: on an open screen fought on the move, on a held one until beaten; a boss on the last with shooters beside it',
    result: Object.freeze(['time', 'health', 'accuracy', 'rank']),
  }),
});
export const PLAY_IDS = Object.freeze(Object.keys(PLAY_TYPES));

/** the cover a setting's places have, in turn along the map (brawl-things.js THINGS.cover) */
export const SETTING_COVER = Object.freeze({
  street: Object.freeze(['crates', 'wall']),
  facility: Object.freeze(['crates', 'wall']),
  base: Object.freeze(['sandbags', 'wall']),
  office: Object.freeze(['crates']),
});
const COVER = Object.freeze(['sandbags', 'crates']);
/** the guns a crate holds, in turn (brawl-things.js THINGS.gun) */
export const CRATE_GUNS = Object.freeze(['spread', 'machine-gun', 'rocket', 'flame']);

const SHOOTS = (t) => !!CROWD_TYPES[t]?.gun;
/**
 * A RUN & GUN'S WAVES when a map names none. Every screen has one: an open screen's is fought on the move (two
 * shooters, then one more a screen), a held one's until it is beaten (three shooters and a rush of the crew's own, a
 * body more each); the boss's screen its boss with two shooters beside it. `types`: how the crew fights (its crowd
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
    if (sc.boss) out.push({ screen, crowd: tally(shooters(2, held)), boss: { recipe: { ...solveFighter({ id: 'boss', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'The Boss' }, plays: ['chain', 'strong'], cpu: Object.keys(CPU_LEVELS)[0], hp: 600 } });
    else if (sc.gate) { out.push({ screen, crowd: tally([...shooters(3 + held, held), ...Array.from({ length: 1 + held }, (_, i) => R[(i + held) % R.length])]) }); held++; }
    else { out.push({ screen, crowd: tally(shooters(Math.min(4, 2 + open), open)) }); open++; }
  });
  return out;
}
/**
 * WHAT STANDS ON A RUN & GUN'S MAP when it names nothing: on every screen two pieces of COVER across the band (the
 * setting's own, `cover`; sandbags and crates with none said), a third and two thirds along, on alternate sides of the
 * band's middle, so a line of fire is always broken somewhere; on a held screen a crate (`boxes`: the setting's) at
 * its far side holding a GUN, a different one each; on the boss's, one holding a roast chicken.
 */
export function playThings(play, belt, { boxes = null, cover = null } = {}) {
  if (play !== 'gun') throw new Error(`brawl: playThings lays a run & gun's things (play 'gun'); a brawl's are its own`);
  const C = (cover?.length ? cover : COVER).filter((c) => THINGS.cover[c]), BOX = boxes?.length ? boxes : ['crate'];
  const [n0, n1] = belt.depth, mid = (n0 + n1) / 2, r2 = (v) => Math.round(v * 100) / 100, out = [];
  let k = 0, g = 0;
  belt.screens.forEach((sc, i) => {
    // (the first screen's cover stands clear of where the players start)
    for (const f of i === 0 ? [0.72] : [0.36, 0.72]) { out.push({ kind: 'cover', what: C[k % C.length], at: r2(sc.from + f * sc.length), n: r2(mid + (k % 2 ? 0.9 : -0.9)) }); k++; }
    if (sc.gate && !sc.boss) { out.push({ kind: 'box', what: BOX[g % BOX.length], at: r2(sc.from + 0.2 * sc.length), n: r2(n1 - 0.6), holds: { kind: 'gun', what: CRATE_GUNS[g % CRATE_GUNS.length] } }); g++; }
    if (sc.boss) out.push({ kind: 'box', what: BOX[g % BOX.length], at: r2(sc.from + 0.15 * sc.length), n: r2(n1 - 0.6), holds: { kind: 'food', what: 'chicken' } });
  });
  return out;
}

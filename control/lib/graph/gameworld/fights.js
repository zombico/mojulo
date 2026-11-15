/**
 * A GAME'S FIGHTS — a fight composed in the room (gameroom/fight.js) given its foes and played: who comes in each wave,
 * where each stands, and the wave gauntlet (game/wave-gauntlet.js) that wakes them, seals the ways and lets the hero on.
 * The practice door's game room plays one (game-room.js `fight`); a level lays the same.
 *
 * A wave is written by ROLE or by the bestiary's own id: `{ grunt: 3, shooter: 1 }`, `{ walker: 2 }`.
 *   FIGHT_ROLES            grunt · shooter · elite · boss, each read off the world's bestiary (the stand-in's where it
 *                          writes none): what it is, the entry that plays it
 *   castRoles(G)           → { <role>: '<bestiary id>' }
 *   fightCast(G, kind, waves?)  → [[{ eid, n, role }]]: the kind's own waves (gameroom/fight.js FIGHT_KINDS), or the ones
 *                          written, each role or id read against the bestiary; throws naming what a wave takes
 *   fightWaves(G, kind, waves?) → [{ <bestiary id>: n }]: the same, by id alone (what a page says)
 *   fightPlacements(G, room, waves) → [[{ id, eid, at, heading, rank? }]]: a boss on the dais, shooters on the perches while
 *                          there are perches, the rest at the rifts' spots in turn (the foe spots where there is no rift),
 *                          a wave larger than its spots ringed round the ring; each facing the ring. `rank`: the rank a
 *                          role stands its entry at where the entry's own is lower (a bestiary with no boss: its elite
 *                          stood as one), so a boss fight is a boss's whatever the bestiary holds
 *   fightMechanic(room, placed, { id? }) → the wave-gauntlet's params: one arena entered at the ring, the way on its
 *                          sealed way out, every other way sealed, a death begun again at the spawn; a hit costs
 *                          FIGHT_HIT of the hero's hundred (a shooter's rounds land often: ten to a life)
 *
 * A GAME'S OWN FIGHTS (`gameworld.fights`): the ones settled in the room, kept on the world by name, to be laid in its
 * levels by the same rules. The kind and the seed are the composition, so nothing rendered is stored.
 *   fights: { <name>: { kind, seed?, waves? } }   kind: gameroom/fight.js FIGHT_KINDS; seed: its composition's (the
 *                          world's unsaid); waves: its own, by role or foe id (the kind's unsaid)
 *   readFights(v, G)       → the fights as written, checked (throws, teaching); G: the world, for its bestiary
 *   fightOf(G, name)       → { name, kind, seed, waves? } one of the world's, or null
 *   (composed and read out: fights-readout.js, which reads the brief; this module is the world's read, kept light)
 *
 * Pure.
 */
import { FIGHT_KINDS, FIGHT_KIND_IDS } from '../gameroom/fight.js';
import { bestiaryOf } from './foes.js';
import { resolveFoe } from '../foes/resolve.js';
import { FOE_CLASSES } from '../foes/index.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const specOf = ({ vanish, states, summons, pair, becomes, ...spec }) => spec;

export const FIGHT_HIT = 10;
const RANK_ORDER = ['minion', 'elite', 'miniboss', 'boss'];
export const FIGHT_ROLES = Object.freeze({
  grunt: 'the foe a string fells: the bestiary\'s first of the lowest rank that fights hand to hand',
  shooter: 'one that shoots from out of reach: the first that carries a ranged weapon (a grunt where none does)',
  elite: 'one that takes several strings: the first of rank elite (else another kind of grunt)',
  boss: 'one that does not fall to a string: the first of rank boss, else miniboss (else the elite)',
});

/** Each role's entry in the world's bestiary: read off what each entry IS (its class's attack and toll, its rank). */
export function castRoles(G) {
  const B = bestiaryOf(G ?? {}), ids = Object.keys(B);
  const read = ids.map((id) => {
    const c = FOE_CLASSES[B[id].class];
    let ok = !!c; try { resolveFoe(specOf(B[id])); } catch { ok = false; /* an entry the shelf cannot stand plays no role */ }
    return { id, ok, rank: B[id].rank ?? 'minion', shoots: ['shot', 'lob'].includes(c?.attack?.kind), calls: c?.attack?.kind === 'call', downs: c?.toll?.downs ?? 1, counters: c?.mind?.aggressiveness === 'opportunist' };
  }).filter((x) => x.ok);
  const melee = read.filter((x) => !x.shoots && !x.calls), low = melee.filter((x) => x.rank === 'minion');
  const grunt = ((low.length ? low : melee).slice().sort((a, b) => a.downs - b.downs)[0] ?? read[0])?.id ?? ids[0];
  const shooter = read.find((x) => x.shoots)?.id ?? grunt;
  // (the toughest that is cut by a string: the counter that stuffs every swing is left to the casting call)
  const tough = melee.filter((x) => x.id !== grunt && !x.counters).sort((a, b) => b.downs - a.downs)[0]?.id;
  const elite = read.find((x) => x.rank === 'elite')?.id ?? tough ?? grunt;
  const boss = read.find((x) => x.rank === 'boss')?.id ?? read.find((x) => x.rank === 'miniboss')?.id ?? elite;
  return { grunt, shooter, elite, boss };
}
// the rank a role stands an entry at, where the entry's own is lower
const ROLE_RANK = Object.freeze({ elite: 'elite', boss: 'boss' });

/** A fight's waves as cast: each wave's foes, by bestiary id, with the role each was written by (null: by its id). */
export function fightCast(G, kind, waves = null) {
  const K = FIGHT_KINDS[kind];
  if (!K) throw new Error(`fight: no kind '${kind}' (${Object.keys(FIGHT_KINDS).join(', ')})`);
  const B = bestiaryOf(G ?? {}), R = castRoles(G), W = waves ?? K.waves;
  if (!Array.isArray(W) || !W.length) throw new Error('fight: waves is [{ <role or foe id>: <count> }], at least one');
  return W.map((w, k) => {
    if (!isObj(w) || !Object.keys(w).length) throw new Error(`fight: waves[${k}] is { <role or foe id>: <count> } (roles: ${Object.keys(FIGHT_ROLES).join(', ')}; foes: ${Object.keys(B).join(', ')})`);
    return Object.entries(w).map(([key, n]) => {
      const eid = B[key] ? key : R[key];
      if (!eid) throw new Error(`fight: waves[${k}].${key} is no role (${Object.keys(FIGHT_ROLES).join(', ')}) and no foe of the bestiary (${Object.keys(B).join(', ')})`);
      if (!(Number.isInteger(n) && n >= 1 && n <= 12)) throw new Error(`fight: waves[${k}].${key} is a count, 1 to 12`);
      return { eid, n, role: B[key] ? null : key };
    });
  });
}
/** A fight's waves, by bestiary id (see the header). */
export const fightWaves = (G, kind, waves = null) => fightCast(G, kind, waves).map((w) => w.reduce((o, x) => ({ ...o, [x.eid]: (o[x.eid] ?? 0) + x.n }), {}));

/** Where each foe of each wave stands (see the header). `waves`: the cast (fightCast), or waves by id. */
export function fightPlacements(G, room, waves) {
  const A = room.anchors, c = A.ring?.at ?? [0, 0, 0], counts = {}, B = bestiaryOf(G ?? {}), R = castRoles(G);
  const cast = waves.map((w) => (Array.isArray(w) ? w : Object.entries(w).map(([eid, n]) => ({ eid, n, role: eid === R.shooter && eid !== R.grunt ? 'shooter' : null }))));
  const perches = A.foes.filter((s) => (s[2] ?? 0) > 0.5 && !(A.boss && s[0] === A.boss[0] && s[1] === A.boss[1]));
  const rifts = A.rifts ?? [], ground = rifts.length ? [] : A.foes.filter((s) => (s[2] ?? 0) <= 0.5);
  // the rifts' spots in turn: the first of each, then the second of each
  const riftSpots = [];
  for (let k = 0; rifts.some((q) => q.spots[k]); k++) for (const q of rifts) if (q.spots[k]) riftSpots.push(q.spots[k]);
  const floor = [...riftSpots, ...ground];
  return cast.map((W, w) => {
    const list = W.flatMap((x) => Array.from({ length: x.n }, () => x)), free = perches.slice();
    let f = 0, ringed = 0;
    return list.map(({ eid, role }) => {
      counts[eid] = (counts[eid] ?? 0) + 1;
      let at;
      if (role === 'boss' && A.boss) at = A.boss;
      else if (role === 'shooter' && free.length) at = free.shift();
      else if (f < floor.length) at = floor[f++];
      else { const a = (2 * Math.PI * ringed++) / list.length + w * 0.7, d = (A.ring?.r ?? 3) + 1; at = [r3(c[0] + d * Math.cos(a)), r3(c[1] + d * Math.sin(a)), 0]; }
      // (the rank its role stands it at, where the entry's own is lower)
      const as = ROLE_RANK[role], rank = as && RANK_ORDER.indexOf(as) > RANK_ORDER.indexOf(B[eid]?.rank ?? 'minion') ? as : null;
      return { id: `foe-${eid}-f${counts[eid]}`, eid, at: at.slice(), heading: r3(Math.atan2(c[1] - at[1], c[0] - at[0])), ...(rank ? { rank } : {}) };
    });
  });
}

/** The fight as a wave gauntlet: entered at the ring, the way on its way out, every other way sealed. */
export function fightMechanic(room, placed, { id = 'fight' } = {}) {
  const A = room.anchors, on = A.ways.find((w) => w.id === 'on') ?? A.ways[A.ways.length - 1], others = A.ways.filter((w) => w !== on);
  return {
    kind: 'wave-gauntlet', id,
    arenas: [{ waves: placed.map((wave) => ({ foes: wave.map((f) => ({ id: f.id, at: f.at })) })), enter: { at: A.ring.at.slice(), radius: A.ring.r } }],
    at: A.goal.slice(), radius: 1.6, back: on.back.slice(), start: A.spawn.slice(), hits: FIGHT_HIT,
    seals: others.map((w) => ({ at: w.at.slice(), radius: 1.6, back: w.back.slice() })),
  };
}

const NAME = /^[a-z][a-z0-9-]{0,31}$/;
/** A world's fights, read (see the header). */
export function readFights(v, G) {
  const no = (m) => { throw new Error(`gameworld: fights${m}`); };
  if (!isObj(v)) no(` is { <name>: { kind, seed?, waves? } } (kind: ${FIGHT_KIND_IDS.join(', ')}): the fights settled in the practice door's game room`);
  for (const [name, F] of Object.entries(v)) {
    if (!NAME.test(name)) no(`: '${name}' is no name (lower-case, a letter first)`);
    if (!isObj(F) || !FIGHT_KINDS[F.kind]) no(`.${name} is { kind, seed?, waves? } (kind: ${FIGHT_KIND_IDS.join(', ')})`);
    for (const k of Object.keys(F)) if (!['kind', 'seed', 'waves'].includes(k)) no(`.${name} has no '${k}' (kind, seed, waves)`);
    if (F.seed !== undefined && !(Number.isInteger(F.seed) && F.seed > 0)) no(`.${name}.seed is a whole number, from 1: its composition's`);
    if (F.waves !== undefined) { try { fightCast(G, F.kind, F.waves); } catch (e) { no(`.${name}: ${e.message.replace(/^fight: /, '')}`); } }
  }
  return v;
}
export const fightOf = (G, name) => (isObj(G?.fights) && isObj(G.fights[name]) ? { name, seed: Number.isInteger(G.seed) ? G.seed : 1, ...G.fights[name] } : null);

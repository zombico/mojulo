/**
 * ATTACK LOOKS — what a boss's attack looks like, in the gothic anime register (scene/juice-style.js `anime`: a white-hot
 * core into saturated colour, hard bands, glints, dust tinted by the floor), drawn over the read every attack already has
 * (its mark, boss-view.js: where it lands and how high). A look is told and then lands:
 *
 *   TELL   what the boss shows as it winds up, from the hazard's mark to its landing, brightening as the landing nears:
 *            glint   a star of light where it strikes from (`at`: 'weapon' its striking side at shoulder height, 'eyes'
 *                    its head, 'feet' the floor under it), turning and swelling
 *            cracks  the floor's cracks glowing along the stretch it will cross
 *            shimmer rings of air round the boss, gathering in
 *            falling the thrown thing in the air over its mark, coming down on it (`thing`: 'weight' | 'bell' | 'swarm')
 *   HIT    what lands, drawn from the hazard's own numbers as it lands:
 *            crescent  a crescent swept down through its reach, its edge white-hot, sparks thrown off it
 *            dust      a wall of dust at the front, as high as it reaches, stone chips thrown up ahead of it
 *            sound     ripple lines standing at the front, as high as it reaches, rolling out
 *            impact    a star where it lands, a dust ring and chips
 *            streak    speed lines along the stretch at its height, afterimages of the boss as it is carried
 *
 * Its colours are the boss's (`rule.boss.look`: `tell` the wind-up's, `hazard` the blow's) and the floor's dust; a look
 * names none of its own but `core` (the white-hot centre) and `dust`.
 *
 *   ATTACK_LOOKS            { <pattern>: { tell, hit, reads } }   the shelf, by the pattern it draws (a new look is a row)
 *   ATTACK_TELLS, ATTACK_HITS  the kinds
 *   readAttackLook(v)       → a look checked (a pattern's name, or one of the same shape); throws naming the fault
 *   lookOfMove(move)        → the look a boss's move wears (its pattern's), or null
 *
 * Pure data and a reader.
 */
import { PATTERNS } from './patterns.js';

export const ATTACK_TELLS = Object.freeze(['glint', 'cracks', 'shimmer', 'falling']);
export const ATTACK_HITS = Object.freeze(['crescent', 'dust', 'sound', 'impact', 'streak']);
const THINGS = ['weight', 'bell', 'swarm'], AT = ['weapon', 'eyes', 'feet'];
const no = (m) => { throw new Error(`attack look: ${m}`); };

export const ATTACK_LOOKS = Object.freeze({
  cleave: Object.freeze({ tell: Object.freeze({ glint: 'weapon' }), hit: 'crescent', reads: 'a glint on the blade, then a crescent swept down through its reach' }),
  quake: Object.freeze({ tell: Object.freeze({ cracks: true, glint: 'weapon' }), hit: 'dust', reads: 'the floor\'s cracks glowing, then a wall of dust rolling out both ways as high as it reaches' }),
  toll: Object.freeze({ tell: Object.freeze({ shimmer: true }), hit: 'sound', reads: 'the air shimmering round it, then a wall of ripples rolling out as high as it reaches' }),
  toss: Object.freeze({ tell: Object.freeze({ falling: 'weight' }), hit: 'impact', reads: 'the thing thrown coming down on its mark, then a star, a dust ring and chips' }),
  lunge: Object.freeze({ tell: Object.freeze({ glint: 'feet' }), hit: 'streak', reads: 'a glow at its feet as it crouches, then streaks and afterimages along the low stretch' }),
});
/** the white-hot core every hit burns to, and the dust a floor throws up */
export const LOOK_CORE = '#fff4e0', LOOK_DUST = '#8a7a66';

/** Read a look (see the header). */
export function readAttackLook(v, where = 'look') {
  if (typeof v === 'string') { if (!ATTACK_LOOKS[v]) no(`${where}: '${v}' is one of ${Object.keys(ATTACK_LOOKS).join(', ')}`); return ATTACK_LOOKS[v]; }
  if (!v || typeof v !== 'object' || !v.tell || typeof v.tell !== 'object') no(`${where}: { tell: { glint? | cracks? | shimmer? | falling? }, hit }`);
  for (const k of Object.keys(v.tell)) if (!ATTACK_TELLS.includes(k)) no(`${where}.tell: ${k} is one of ${ATTACK_TELLS.join(', ')}`);
  if (v.tell.glint !== undefined && !AT.includes(v.tell.glint)) no(`${where}.tell.glint is one of ${AT.join(', ')}`);
  if (v.tell.falling !== undefined && !THINGS.includes(v.tell.falling)) no(`${where}.tell.falling is one of ${THINGS.join(', ')}`);
  if (!ATTACK_HITS.includes(v.hit)) no(`${where}.hit is one of ${ATTACK_HITS.join(', ')}`);
  return v;
}

/** The look a boss's move wears: its own `look` (a move's words may name a thing thrown), else its pattern's. */
export function lookOfMove(move) {
  const base = move?.pattern && ATTACK_LOOKS[move.pattern];
  if (!base) return null;
  const L = move.look ? { ...base, ...move.look, tell: { ...base.tell, ...(move.look.tell ?? {}) } } : base;
  readAttackLook(L, `move ${move.id ?? move.pattern}`);
  if (!PATTERNS[move.pattern]) no(`move ${move.id}: no pattern '${move.pattern}'`);
  return { tell: { ...L.tell }, hit: L.hit };
}

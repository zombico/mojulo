/**
 * A FOE'S DEATH AND DISPOSAL: how a downed foe dies and leaves its level, read off the game's style guide. Fades only:
 * no carcass stays (worlds/controllable/vanish.js lays it down for `linger` s, then the page plays the fade on a ghost).
 *
 *   VANISHES      the ways it goes, each a fade the page plays (scene/channels/status-channel.js transits):
 *                   fade    it fades where it lies
 *                   sink    it sinks into its own ground as it fades
 *                   motes   it dissolves from the ground up into glints that drift up, in a colour
 *                   blink   it blinks out, faster and faster (an arcade foe's going)
 *                   smoke   it goes in a puff of smoke (a cartoon platformer's poof)
 *                   squash  flattened onto its feet with a bounce, held a beat, then a little puff (a platformer's boop)
 *                   pop     swollen and stretched up, flashing white, then burst into streaks (a pinball's)
 *
 * The style guide is the game's JUICE (juice.js: its register and look, its game type's flavor), the world's word or
 * what `juice: 'auto'` would lay; a world with `juice: false` falls and fades plainly. The game type (FLAVOR, the
 * animation register: juice-style.js JUICE_FLAVORS) says how it DIES and how long it lies; a platformer and a pinball
 * table also say how it goes, in their own register:
 *
 *   realistic    falls on its own fall clip, at its own pace, and lies a beat and a half: then the look's fade
 *   action       the blow is the verb: thrown back along it, off the ground (`die: 'launch'`), lies a beat: the look's fade
 *   platformer   a boop: squashed flat with a bounce, then a puff, at once (`squash`)
 *   pinball      speed: swollen, flashed and burst into streaks, at once (`pop`)
 *
 * and the LOOK says how the others fade:
 *
 *   isekai       motes    the anime RPG's dissolve into light, in the world palette's accent (else its element's, else
 *                         its power colour; none, the page's gold)
 *   cel          blink    the anime fighter's knocked-out flicker
 *   material     sink in a realistic game, else fade: the western register's quiet going
 *
 * DESTRUCTION is a way to die too (`die`): `dismantle`, it comes apart at its joints (`sever`: SEVERS), and `cleave`, it is
 * cut through by the blow (a slash through its trunk, its cut showing `inside`); the page's wreck plays its pieces
 * falling and fades them as it goes, after at least
 * WRECK_LINGER s. `destroy` lets the killing blow choose, by a DEFAULT table (BLOW_DESTRUCTION: a strike cleaves it, a
 * round knocks some of it off at its joints, a burst tears it apart at every joint) a foe maps over with its own `by`. The UNDEAD are
 * destroyed so by default (UNDEAD_DESTRUCTION, by their people's form, its own way when no blow says: a skeleton
 * apart at every joint, a corpse cut in two), wherever the world lets a foe fall or be thrown. Only layer 0, the
 * skeleton under every foe, is destroyed: a mode above it is defeated.
 *
 * A bestiary entry may name its own (`vanish: <kind>`, or `{ is?, linger?, die?, sever?, inside?, by? }`).
 *
 *   readVanish(v, at)        → the entry's word read (throws teaching the kinds)
 *   vanishOfGame(G)          → { is, linger, die, rgb?, from, why }: the world's own death and disposal
 *   vanishOf(G, entry)       → the body's `vanish` ({ is, linger, die, sever?, rgb? }) for a bestiary entry: its own word over
 *                              the world's
 *
 * Pure.
 */
import { juiceOfGame, juiceSuggestion, trailContext } from './juice.js';
import { resolveTrailColor } from '../scene/juice-style.js';
import { LINEAGES } from '../egocube/ancestry.js';

export const VANISHES = Object.freeze({
  fade: 'it fades where it lies',
  sink: 'it sinks into its own ground as it fades',
  motes: 'it dissolves from the ground up into glints that drift up, in a colour',
  blink: 'it blinks out, faster and faster',
  smoke: 'it goes in a puff of smoke',
  squash: 'it is squashed flat with a bounce, then goes in a puff',
  pop: 'it swells, flashes white and bursts into streaks',
});
/** Each game type's death: how it dies, how long it lies, and (a platformer's, a pinball's) how it goes. */
export const DEATHS = Object.freeze({
  realistic: { die: 'fall', linger: 1.4 },
  action: { die: 'launch', linger: 0.7 },
  platformer: { die: 'fall', linger: 0, is: 'squash' },
  pinball: { die: 'fall', linger: 0, is: 'pop' },
});
export const DIES = Object.freeze(['fall', 'launch', 'dismantle', 'cleave', 'destroy']);
/** A DESTRUCTION's joints cut (a `dismantle`'s `sever`, the page's wreck: scene/channels/wreck-channel.js): every one, the
 * head and the limbs, the head alone, or a few of the head and the limbs, on the body's dice */
export const SEVERS = Object.freeze({
  all: 'it comes apart at every joint (the small bones ride their hand or foot)',
  limbs: 'its head and its limbs come off at their joints, the trunk falling as one',
  head: 'its head comes off',
  some: 'two or three of its head and limbs come off, on its dice',
});
/** A destruction lies at least this long: its pieces fall and settle before they fade */
export const WRECK_LINGER = 2.4;
/** The blows the runtime tells a death by (worlds/controllable/vanish.js: whatever struck last): a melee strike, a round, a
 * burst, a crush (a stomp, a tackle) */
export const BLOWS = Object.freeze(['swing', 'round', 'burst', 'crush']);
/** `destroy`'s DEFAULT: how each blow destroys a body (a foe maps its own with `vanish.by`, blow by blow, over this) */
export const BLOW_DESTRUCTION = Object.freeze({
  swing: Object.freeze({ die: 'cleave' }),
  round: Object.freeze({ die: 'dismantle', sever: 'some' }),
  burst: Object.freeze({ die: 'dismantle', sever: 'all', kick: 1.6 }),
  crush: Object.freeze({ die: 'dismantle', sever: 'all' }),
});
/** The undead's own destruction (a lineage's form: egocube/ancestry.js): `destroy`, the killing blow choosing how its bones,
 * layer 0 under every foe, are destroyed (BLOW_DESTRUCTION), and its form's way when no blow says (a death by a fall, a
 * timer): a skeleton, nothing holding its bones, comes apart at every joint (by relation); a corpse is cut through (by
 * part). The inside a cut shows: a corpse's meat, a bone's marrow */
export const UNDEAD_DESTRUCTION = Object.freeze({
  skeleton: { die: 'destroy', else: { die: 'dismantle', sever: 'all' }, inside: '#8a5a40' },
  zombie: { die: 'destroy', else: { die: 'cleave' }, inside: '#a8402f' },
});
const isWreck = (die) => die === 'dismantle' || die === 'cleave' || die === 'destroy';
export const LINGER = Object.freeze(Object.fromEntries(Object.entries(DEATHS).map(([k, D]) => [k, D.linger])));
const MAX_LINGER = 10;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readVanish(v, at) {
  const kinds = Object.keys(VANISHES).join(' | ');
  if (typeof v === 'string') { if (!VANISHES[v]) throw new Error(`${at}: no vanish '${v}' (${kinds})`); return v; }
  if (!isObj(v)) throw new Error(`${at} is how a downed foe dies and goes: ${kinds}, or { is?, linger?, die?, sever? }`);
  for (const k of Object.keys(v)) if (!['is', 'linger', 'die', 'sever', 'inside', 'by'].includes(k)) throw new Error(`${at}.${k} is not a vanish setting (is, linger, die, sever, inside, by)`);
  if (v.is !== undefined && !VANISHES[v.is]) throw new Error(`${at}.is: no vanish '${v.is}' (${kinds})`);
  if (v.linger !== undefined && !(Number.isFinite(v.linger) && v.linger >= 0 && v.linger <= MAX_LINGER)) throw new Error(`${at}.linger is the seconds it lies first, 0 to ${MAX_LINGER}`);
  if (v.die !== undefined && !DIES.includes(v.die)) throw new Error(`${at}.die is how it dies: ${DIES.join(' | ')}`);
  if (v.sever !== undefined && !SEVERS[v.sever]) throw new Error(`${at}.sever is which joints a dismantle cuts: ${Object.keys(SEVERS).join(' | ')}`);
  if (v.sever !== undefined && v.die !== 'dismantle' && v.die !== 'destroy') throw new Error(`${at}.sever goes with die: 'dismantle' or 'destroy' (the joints it cuts)`);
  if (v.inside !== undefined && !(typeof v.inside === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.inside))) throw new Error(`${at}.inside is the colour a cleave's cut shows, a '#rrggbb'`);
  if (v.inside !== undefined && v.die !== 'cleave' && v.die !== 'destroy') throw new Error(`${at}.inside goes with die: 'cleave' or 'destroy' (the colour its cut shows)`);
  if (v.by !== undefined) {
    if (v.die !== 'destroy') throw new Error(`${at}.by goes with die: 'destroy' (how each blow destroys it)`);
    if (!isObj(v.by)) throw new Error(`${at}.by maps a blow (${BLOWS.join(', ')}, else) to { die: dismantle | cleave, sever? }`);
    for (const [b, D] of Object.entries(v.by)) {
      if (![...BLOWS, 'else'].includes(b)) throw new Error(`${at}.by.${b} is not a blow (${BLOWS.join(', ')}, else)`);
      if (!isObj(D) || !['dismantle', 'cleave'].includes(D.die)) throw new Error(`${at}.by.${b} is { die: dismantle | cleave, sever? }`);
      if (D.sever !== undefined && !SEVERS[D.sever]) throw new Error(`${at}.by.${b}.sever: ${Object.keys(SEVERS).join(' | ')}`);
    }
  }
  return { ...(v.by !== undefined ? { by: v.by } : {}), ...(v.is !== undefined ? { is: v.is } : {}), ...(v.linger !== undefined ? { linger: v.linger } : {}), ...(v.die !== undefined ? { die: v.die } : {}), ...(v.sever !== undefined ? { sever: v.sever } : {}), ...(v.inside !== undefined ? { inside: v.inside } : {}) };
}

export function vanishOfGame(G) {
  const J = juiceOfGame(G) ?? juiceSuggestion(G);
  if (!J) return { is: 'fade', linger: LINGER.action, die: 'fall', from: 'plain', why: 'the world draws its effects plainly (juice: false): it falls and fades' };
  const { look, flavor } = J.fxStyle, D = DEATHS[flavor] ?? DEATHS.action;
  let is = D.is, why;
  if (is === 'squash') why = 'a platformer\'s boop: squashed flat, then a puff';
  else if (is === 'pop') why = 'a pinball table\'s: swollen, flashed and burst';
  else {
    const dies = D.die === 'launch' ? 'thrown back along the blow' : 'falls where it was struck';
    if (look === 'isekai') { is = 'motes'; why = `${dies}, then the anime RPG's dissolve into light`; }
    else if (look === 'cel') { is = 'blink'; why = `${dies}, then the anime fighter's flicker`; }
    else { is = flavor === 'realistic' ? 'sink' : 'fade'; why = `${dies}, then the western register's ${is === 'sink' ? 'sink' : 'fade'}`; }
  }
  const rgb = is === 'motes' ? resolveTrailColor('palette', trailContext(G)) : null;
  return { is, linger: D.linger, die: D.die, ...(rgb ? { rgb } : {}), from: `${look}, ${flavor}`, why };
}

export function vanishOf(G, entry) {
  const W = vanishOfGame(G), own = entry?.vanish === undefined ? {} : typeof entry.vanish === 'string' ? { is: entry.vanish } : entry.vanish;
  const is = own.is ?? W.is;
  const rgb = is === 'motes' ? (W.rgb ?? resolveTrailColor('palette', trailContext(G))) : null;
  // (a squash and a pop are the death beat itself: named alone, they play at once, as in their own game types)
  const beat = own.is !== undefined && own.is !== W.is && Object.values(DEATHS).find((D) => D.is === own.is);
  // the undead's destruction (by its people's form) where the world lets a foe fall or be thrown; a platformer's squash
  // and a pinball's pop are the death beat itself, and an entry's own `die` wins
  const form = entry?.skin?.people ? LINEAGES[entry.skin.people]?.form : null, U = form && !beat ? UNDEAD_DESTRUCTION[form] : null;
  const die = own.die ?? (beat ? beat.die : U && ['fall', 'launch'].includes(W.die) && !['squash', 'pop'].includes(is) ? U.die : W.die);
  const sever = die === 'dismantle' ? own.sever ?? (U && U.die === die ? U.sever : 'all') : die === 'destroy' ? own.sever ?? null : null;
  // (a cleave's inside: the colour its cut shows, the entry's own, else its form's)
  const inside = die === 'cleave' || die === 'destroy' ? own.inside ?? (U ? U.inside : null) : null;
  // (a destroy carries its table: each blow's destruction, an entry's sever over a dismantle's; and its way with no blow)
  const over = (D) => (sever && D.die === 'dismantle' ? { ...D, sever } : D);
  const by = die === 'destroy' ? { ...Object.fromEntries(BLOWS.map((b) => [b, over(BLOW_DESTRUCTION[b])])), else: over(U && U.else ? U.else : { die: 'dismantle', sever: 'all' }), ...(own.by ?? {}) } : null;
  const linger = own.linger ?? (beat ? beat.linger : isWreck(die) ? Math.max(W.linger, WRECK_LINGER) : W.linger);
  return { is, linger, die, ...(sever && die === 'dismantle' ? { sever } : {}), ...(by ? { by } : {}), ...(inside ? { inside } : {}), ...(rgb ? { rgb } : {}) };
}

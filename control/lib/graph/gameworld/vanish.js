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
 * A bestiary entry may name its own (`vanish: <kind>`, or `{ is?, linger?, die? }`).
 *
 *   readVanish(v, at)        → the entry's word read (throws teaching the kinds)
 *   vanishOfGame(G)          → { is, linger, die, rgb?, from, why }: the world's own death and disposal
 *   vanishOf(G, entry)       → the body's `vanish` ({ is, linger, die, rgb? }) for a bestiary entry: its own word over
 *                              the world's
 *
 * Pure.
 */
import { juiceOfGame, juiceSuggestion, trailContext } from './juice.js';
import { resolveTrailColor } from '../scene/juice-style.js';

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
export const DIES = Object.freeze(['fall', 'launch']);
export const LINGER = Object.freeze(Object.fromEntries(Object.entries(DEATHS).map(([k, D]) => [k, D.linger])));
const MAX_LINGER = 10;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readVanish(v, at) {
  const kinds = Object.keys(VANISHES).join(' | ');
  if (typeof v === 'string') { if (!VANISHES[v]) throw new Error(`${at}: no vanish '${v}' (${kinds})`); return v; }
  if (!isObj(v)) throw new Error(`${at} is how a downed foe dies and goes: ${kinds}, or { is?, linger?, die? }`);
  for (const k of Object.keys(v)) if (!['is', 'linger', 'die'].includes(k)) throw new Error(`${at}.${k} is not a vanish setting (is, linger, die)`);
  if (v.is !== undefined && !VANISHES[v.is]) throw new Error(`${at}.is: no vanish '${v.is}' (${kinds})`);
  if (v.linger !== undefined && !(Number.isFinite(v.linger) && v.linger >= 0 && v.linger <= MAX_LINGER)) throw new Error(`${at}.linger is the seconds it lies first, 0 to ${MAX_LINGER}`);
  if (v.die !== undefined && !DIES.includes(v.die)) throw new Error(`${at}.die is how it dies: ${DIES.join(' | ')}`);
  return { ...(v.is !== undefined ? { is: v.is } : {}), ...(v.linger !== undefined ? { linger: v.linger } : {}), ...(v.die !== undefined ? { die: v.die } : {}) };
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
  return { is, linger: own.linger ?? (beat ? beat.linger : W.linger), die: own.die ?? (beat ? beat.die : W.die), ...(rgb ? { rgb } : {}) };
}

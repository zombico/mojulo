/**
 * A FOE'S DISPOSAL: how a downed foe leaves its level, read off the game's style guide. Fades only: no carcass stays
 * (worlds/controllable/vanish.js lays it down for `linger` s, then the page plays the fade on a ghost of it).
 *
 *   VANISHES      the ways it goes, each a fade the page plays (scene/channels/status-channel.js transits):
 *                   fade    it fades where it lies
 *                   sink    it sinks into its own ground as it fades
 *                   motes   it dissolves from the ground up into glints that drift up, in a colour
 *                   blink   it blinks out, faster and faster (an arcade foe's going)
 *                   smoke   it goes in a puff of smoke (a cartoon platformer's poof)
 *
 * The style guide is the game's JUICE (juice.js: its register and look, its game type's flavor), the world's word or
 * what `juice: 'auto'` would lay; a world with `juice: false` fades plainly:
 *
 *   flavor platformer   smoke    the poof, at once
 *   flavor pinball      blink    the arcade's blink, at once
 *   look isekai         motes    the anime RPG's dissolve into light, in the world palette's accent (else its element's,
 *                                else its power colour; none, the page's gold)
 *   look cel            blink    the anime fighter's knocked-out flicker
 *   look material       sink in a realistic game, else fade: the western register's quiet going
 *
 * How long it lies first (`linger`) is the game type's: at once in a platformer or a pinball table, a beat in an action
 * game, a beat and a half in a realistic one. A bestiary entry may name its own (`vanish: <kind>`, or
 * `{ is?, linger? }`).
 *
 *   readVanish(v, at)        → the entry's word read (throws teaching the kinds)
 *   vanishOfGame(G)          → { is, linger, rgb?, from, why }: the world's own disposal
 *   vanishOf(G, entry)       → the body's `vanish` ({ is, linger, rgb? }) for a bestiary entry: its own word over the world's
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
});
export const LINGER = Object.freeze({ platformer: 0.15, pinball: 0, action: 0.7, realistic: 1.4 });
const MAX_LINGER = 10;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readVanish(v, at) {
  const kinds = Object.keys(VANISHES).join(' | ');
  if (typeof v === 'string') { if (!VANISHES[v]) throw new Error(`${at}: no vanish '${v}' (${kinds})`); return v; }
  if (!isObj(v)) throw new Error(`${at} is how a downed foe goes: ${kinds}, or { is?, linger? }`);
  for (const k of Object.keys(v)) if (!['is', 'linger'].includes(k)) throw new Error(`${at}.${k} is not a vanish setting (is, linger)`);
  if (v.is !== undefined && !VANISHES[v.is]) throw new Error(`${at}.is: no vanish '${v.is}' (${kinds})`);
  if (v.linger !== undefined && !(Number.isFinite(v.linger) && v.linger >= 0 && v.linger <= MAX_LINGER)) throw new Error(`${at}.linger is the seconds it lies first, 0 to ${MAX_LINGER}`);
  return { ...(v.is !== undefined ? { is: v.is } : {}), ...(v.linger !== undefined ? { linger: v.linger } : {}) };
}

export function vanishOfGame(G) {
  const J = juiceOfGame(G) ?? juiceSuggestion(G);
  if (!J) return { is: 'fade', linger: LINGER.action, from: 'plain', why: 'the world draws its effects plainly (juice: false): it fades' };
  const { look, flavor } = J.fxStyle, linger = LINGER[flavor] ?? LINGER.action;
  let is, why;
  if (flavor === 'platformer') { is = 'smoke'; why = 'a platformer\'s foe goes in a puff'; }
  else if (flavor === 'pinball') { is = 'blink'; why = 'a pinball table\'s blinks out'; }
  else if (look === 'isekai') { is = 'motes'; why = 'the anime RPG\'s dissolves into light'; }
  else if (look === 'cel') { is = 'blink'; why = 'the anime fighter\'s flickers out'; }
  else { is = flavor === 'realistic' ? 'sink' : 'fade'; why = flavor === 'realistic' ? 'a realistic western game\'s sinks away' : 'the western register\'s fades'; }
  const rgb = is === 'motes' ? resolveTrailColor('palette', trailContext(G)) : null;
  return { is, linger, ...(rgb ? { rgb } : {}), from: `${look}, ${flavor}`, why };
}

export function vanishOf(G, entry) {
  const W = vanishOfGame(G), own = entry?.vanish === undefined ? {} : typeof entry.vanish === 'string' ? { is: entry.vanish } : entry.vanish;
  const is = own.is ?? W.is;
  const rgb = is === 'motes' ? (W.rgb ?? resolveTrailColor('palette', trailContext(G))) : null;
  return { is, linger: own.linger ?? W.linger, ...(rgb ? { rgb } : {}) };
}

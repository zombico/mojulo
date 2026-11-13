/**
 * THE COURSE'S DRESS — how a rolled course (roll-course.js) is coloured and marked, and the laws that keep a dress from
 * costing the course its fairness. On a course a colour is information before it is a look: a player must read WHAT TO
 * DO from far off and at speed, so the dress is laid by ROLE, never thing by thing.
 *
 *   THE ROLES
 *     the way      ground, ground2 (its two tones by turns), sleeper, rail (a lane's lines), kerb, wall, sky (behind all)
 *     the walls    flank, flank2 (a slice's two tones), trim (its detail): course-scenery.js
 *     the backdrop land (beyond the way), far (the skyline), horizon (the sky's foot; `sky` is its zenith)
 *     the asks     jump (a hurdle), jump2 (a block): one hue family, "go over"; steer (posts): another, "go round"
 *     the tells    tell-jump, tell-steer: paint on the way that says an ask is coming and what it wants (below)
 *     the end      exit
 *
 *   THE TELLS (decoration that carries what the course was measured by, rolled with its ask so it is there only when
 *   the ask is):
 *     a jump's     a strip across the way, from the earliest place a jump still clears the thing to the latest: the
 *                  window itself, painted. Jump while on the strip.
 *     posts'       arrows in the lanes the posts stand in, pointing at the open one, from where a two-lane change
 *                  must begin
 *
 *   THEMES        a theme is a card: a palette by role, and what its lanes are drawn as (a new look is a row)
 *     rail-yard   ballast, sleepers and steel rails; amber barriers and orange crates to jump, blue wagons to go round
 *     greybox     the course before any look: greys only (it loses the laws below, and says so)
 *
 *   dressOf(theme?, seed?)  → { theme, name, seed, palette: { <role>: '#rrggbb' }, lanes: { rails, sleepers }, laws }
 *                             the theme's palette, its asks' hues turned a little by the seed (a game's own shade of it)
 *   dressLaws(palette)      → [{ law, holds, says }] the machine gate (measured in OKLab, color-theorist/oklab.js):
 *     readable   every ask stands out from everything it is seen against (the way, the kerb, the walls, the backdrop)
 *     distinct   "go over" and "go round" are different hues, far enough apart to tell at a glance
 *     quiet      nothing that is not an ask or a tell is as vivid as an ask: the way, the walls and the sky never shout
 *     told       a tell is in its ask's hue, and is itself seen on the way
 *   readDress(v)            a dress as written (a theme's name, or every layer written out) → resolved; it teaches
 *   DRESS_THEMES, DRESS_ROLES, ASK_ROLE (a primitive's role)
 *
 * WHERE THE EYE IS (docs/course-dress-principles.md, measured by course-view.js): the figure's back, then the
 * vanishing point where what is coming is read, then the screen's middle third where it is acted on and the only place
 * it is seen large. A dress is made for them in that order; the laws here are the far read's.
 *
 * The eyes gate (does it read as a rail yard, is it handsome) is the operator's. Pure and deterministic.
 */
import { hexToRgb, rgbToHex, lchOf, oklch, deltaE, hueGap } from '../color-theorist/oklab.js';
import { readWalls, readBackdrop } from './course-scenery.js';

export const DRESS_ROLES = Object.freeze(['ground', 'ground2', 'sleeper', 'rail', 'kerb', 'wall', 'sky', 'flank', 'flank2', 'trim', 'land', 'far', 'horizon', 'jump', 'jump2', 'steer', 'tell-jump', 'tell-steer', 'exit']);
export const ASK_ROLE = Object.freeze({ hurdle: 'jump', block: 'jump2', 'posts-left': 'steer', 'posts-right': 'steer' });
const WAY = ['ground', 'ground2', 'sleeper', 'rail', 'kerb', 'wall', 'sky', 'flank', 'flank2', 'trim', 'land', 'far', 'horizon'], ASKS = ['jump', 'jump2', 'steer'];

export const DRESS_THEMES = Object.freeze({
  'rail-yard': Object.freeze({
    name: 'Rail yard', says: 'ballast, sleepers and steel rails; amber barriers and orange crates to jump, blue wagons to go round',
    lanes: Object.freeze({ rails: true, sleepers: true }), walls: Object.freeze({ a: 'shed', b: 'fence' }), backdrop: 'yard',
    palette: Object.freeze({ ground: '#4d4a46', ground2: '#56524c', sleeper: '#3a3029', rail: '#52565c', kerb: '#5a5854', wall: '#3a3e45', sky: '#1c2430',
      flank: '#44372f', flank2: '#2d2622', trim: '#5f5b53', land: '#2c2f35', far: '#4c464f', horizon: '#5c545b',
      jump: '#f2a31b', jump2: '#e2701c', steer: '#3b8fe6', 'tell-jump': '#f6d08a', 'tell-steer': '#9fd0ff', exit: '#5fd08a' }),
  }),
  greybox: Object.freeze({
    name: 'Greybox', says: 'the course before any look: greys only',
    lanes: Object.freeze({ rails: false, sleepers: false }), walls: Object.freeze({ a: 'shed', b: 'bank' }), backdrop: 'open',
    palette: Object.freeze({ ground: '#6a6c72', ground2: '#74767c', sleeper: '#6a6c72', rail: '#8a8c92', kerb: '#7c7e84', wall: '#5c5e64', sky: '#1b1d22',
      flank: '#63656b', flank2: '#525459', trim: '#7b7d83', land: '#3a3c42', far: '#2c2e34', horizon: '#33353c',
      jump: '#9a9a9a', jump2: '#9a9a9a', steer: '#6b6b6b', 'tell-jump': '#8a8a8a', 'tell-steer': '#8a8a8a', exit: '#b0b0b0' }),
  }),
});

const rgb = (hex) => hexToRgb(hex), r2 = (v) => Math.round(v * 100) / 100;

export function dressLaws(palette) {
  const P = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, rgb(v)])), L = Object.fromEntries(Object.entries(P).map(([k, c]) => [k, lchOf(c)]));
  // readable: each ask against everything it is seen against
  const lows = ASKS.map((a) => { const worst = WAY.map((w) => [w, deltaE(P[a], P[w])]).sort((x, y) => x[1] - y[1])[0]; return { ask: a, against: worst[0], by: worst[1] }; });
  const dim = lows.filter((x) => x.by < 0.22);
  // distinct: the two families
  const gap = Math.min(hueGap(L.jump[2], L.steer[2]), hueGap(L.jump2[2], L.steer[2])), apart = Math.min(deltaE(P.jump, P.steer), deltaE(P.jump2, P.steer));
  const grey = Math.min(L.jump[1], L.jump2[1], L.steer[1]) < 0.04;
  // quiet: the way's chroma against the dullest ask's
  const askC = Math.min(...ASKS.map((a) => L[a][1])), loud = WAY.filter((w) => L[w][1] > 0.5 * askC);
  // told: a tell in its ask's hue, seen on the way
  const tells = [['tell-jump', 'jump'], ['tell-steer', 'steer']].map(([t, a]) => ({ t, a, hue: hueGap(L[t][2], L[a][2]), on: Math.min(deltaE(P[t], P.ground), deltaE(P[t], P.ground2)), grey: L[t][1] < 0.03 }));
  const untold = tells.filter((x) => x.grey || x.hue > 35 || x.on < 0.2);
  return [
    { law: 'readable', holds: !dim.length, says: dim.length ? dim.map((x) => `${x.ask} is too like the ${x.against} (${r2(x.by)}, wants 0.22)`).join('; ') : `every ask stands out from the way (the nearest: ${lows.sort((a, b) => a.by - b.by)[0].ask} from the ${lows[0].against}, ${r2(lows[0].by)})` },
    { law: 'distinct', holds: !grey && gap >= 90 && apart >= 0.25, says: grey ? 'an ask has no hue: go over and go round cannot be told by colour' : gap >= 90 && apart >= 0.25 ? `go over and go round are ${Math.round(gap)}° of hue apart` : `go over and go round are too alike (${Math.round(gap)}° of hue, ${r2(apart)} apart; wants 90° and 0.25)` },
    { law: 'quiet', holds: !loud.length, says: loud.length ? `the ${loud.join(', ')} ${loud.length === 1 ? 'is' : 'are'} as vivid as an ask` : 'nothing on the way is as vivid as an ask' },
    { law: 'told', holds: !untold.length, says: untold.length ? untold.map((x) => (x.grey || x.hue > 35 ? `${x.t} is not in its ask's hue` : `${x.t} is not seen on the way (${r2(x.on)}, wants 0.2)`)).join('; ') : 'each tell is in its ask\'s hue and is seen on the way' },
  ];
}

// a game's own shade of a theme: the asks' hues turned a few degrees and the way a touch lighter or darker, by the seed
const dice = (seed) => { let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0; return (n) => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) % n; }; };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/**
 * A DRESS AS WRITTEN: a theme's name, or the dress written out, every layer in one place so they are designed as one:
 *   { theme?, palette?: { <role>: '#rrggbb' }, walls?: { a?, b?, order? }, backdrop?: '<name>' | { bands?, skyline? } }
 * Each part left out is the theme's (the rail yard unsaid). → { theme, palette (overrides), walls, backdrop, own }
 */
export function readDress(v = 'rail-yard') {
  const teach = `course: dress is one of ${Object.keys(DRESS_THEMES).join(', ')}, or { theme?, palette?, walls?, backdrop? } (course-dress.js)`;
  if (typeof v === 'string') v = { theme: v }; else if (!isObj(v)) throw new Error(teach);
  for (const k of Object.keys(v)) if (!['theme', 'palette', 'walls', 'backdrop'].includes(k)) throw new Error(`course: dress.${k} is not a dress's word (theme, palette, walls, backdrop)`);
  const theme = v.theme ?? 'rail-yard', T = DRESS_THEMES[theme];
  if (!T) throw new Error(teach);
  if (v.palette !== undefined) {
    if (!isObj(v.palette)) throw new Error('course: dress.palette is { <role>: \'#rrggbb\' }');
    for (const [role, hex] of Object.entries(v.palette)) {
      if (!DRESS_ROLES.includes(role)) throw new Error(`course: dress.palette.${role} is not a role (${DRESS_ROLES.join(', ')})`);
      if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`course: dress.palette.${role} is a colour, '#rrggbb'`);
    }
  }
  return { theme, palette: { ...(v.palette ?? {}) }, walls: readWalls(v.walls, T.walls), backdrop: readBackdrop(v.backdrop, T.backdrop), own: Object.keys(v).some((k) => k !== 'theme') };
}

export function dressOf(dress = 'rail-yard', seed = 1) {
  const R = readDress(dress), T = DRESS_THEMES[R.theme];
  const below = dice(seed), turn = below(17) - 8, lift = (below(7) - 3) / 100, palette = {};
  for (const role of DRESS_ROLES) {
    // (a colour the dress writes is kept as written: the creator's own word, never shaded)
    if (R.palette[role]) { palette[role] = R.palette[role].toLowerCase(); continue; }
    const [L, C, h] = lchOf(rgb(T.palette[role]));
    // (seed 1 is the card as written; a grey has no hue to turn)
    const ask = ASKS.includes(role) || role.startsWith('tell-');
    palette[role] = seed === 1 || C < 0.02 ? T.palette[role] : rgbToHex(oklch(ask ? L : L + lift, C, ask ? h + turn : h));
  }
  return { theme: R.theme, name: T.name, seed, palette, lanes: T.lanes, walls: R.walls, backdrop: R.backdrop, own: R.own, laws: dressLaws(palette) };
}

/**
 * THE COURSE'S DRESS — how a rolled course (roll-course.js) is coloured and marked, and the laws that keep a dress from
 * costing the course its fairness. On a course a colour is information before it is a look: a player must read WHAT TO
 * DO from far off and at speed, so the dress is laid by ROLE, never thing by thing.
 *
 *   THE ROLES
 *     the way      ground, ground2 (its two tones by turns), sleeper, rail (a lane's lines), kerb, wall, sky (behind all)
 *     the walls    flank, flank2 (a slice's two tones), trim (its detail), iron (what stands on the ground), lamp
 *                  (the one light): course-scenery.js
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
 *   THEMES        a theme is a card: a PREMISE (one sentence every thing on the screen answers to) and what each
 *                 thing is in it, a palette by role, what its lanes, asks, tells and end are drawn as, its walls and
 *                 its backdrop (a new look is a row)
 *     last-train  a kid late for the last train runs down the tracks into the terminus at dusk (the default)
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
 *     premise    one sentence says who runs here and toward what, and every thing has a name in it
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

export const DRESS_ROLES = Object.freeze(['ground', 'ground2', 'sleeper', 'rail', 'kerb', 'wall', 'sky', 'flank', 'flank2', 'trim', 'iron', 'lamp', 'land', 'far', 'horizon', 'jump', 'jump2', 'steer', 'tell-jump', 'tell-steer', 'exit']);
export const ASK_ROLE = Object.freeze({ hurdle: 'jump', block: 'jump2', 'posts-left': 'steer', 'posts-right': 'steer' });
// (a lamp is a point of light, not a ground an ask is seen against: it is held to `quiet` and not to `readable`)
const WAY = ['ground', 'ground2', 'sleeper', 'rail', 'kerb', 'wall', 'sky', 'flank', 'flank2', 'trim', 'iron', 'land', 'far', 'horizon'], LIGHTS = ['lamp'], ASKS = ['jump', 'jump2', 'steer'];

export const DRESS_THEMES = Object.freeze({
  'last-train': Object.freeze({
    name: 'Last train', says: 'the tracks into the terminus at dusk: barriers and crates left on the line, wagons stabled on two tracks of three, platforms and the cutting beside, the train waiting at the end',
    // THE PREMISE: one sentence every thing on the screen answers to, and what each is in it
    premise: 'A kid is late for the last train home. It leaves from the terminus at the end of the line, and the only way to make it is down the tracks.',
    things: Object.freeze({ lanes: 'three running tracks: why there are three places to be', hurdle: 'a crossing barrier left down across the line', block: 'crates being loaded across the tracks',
      posts: 'wagons stabled on two tracks; the clear track is the open lane', 'tell-jump': 'hazard hatching before the barrier: jump while on it', 'tell-steer': 'the lit indicator and the arrows: which track is set clear',
      overhead: 'the overhead line: a portal a segment, a wire over the outer tracks', a: 'a station passing by', b: 'the cutting between stations', backdrop: 'the city, and the terminus where the tracks meet the horizon', end: 'the signals showing clear, and the train with its doors open' }),
    asks: Object.freeze({ hurdle: 'barrier', block: 'crates', 'posts-left': 'wagon', 'posts-right': 'wagon' }), tells: Object.freeze({ jump: 'hatching', steer: 'indicator' }), end: 'terminus', overhead: 'line',
    // (its interface: the theme the game's HUD and screens wear, a mana-ui preset or a card of playscape/ui/theme-cards.
    // A look is chosen by the game's STYLE (a mascot's light, round, bright game), never by an object of its setting:
    // the toy family's toybox)
    ui: 'toybox',
    // (a wagon is as long as it is drawn: the posts' box is this deep, and met all along it)
    lens: Object.freeze({ 'posts-left': 3.2, 'posts-right': 3.2 }),
    lanes: Object.freeze({ rails: true, sleepers: true }), walls: Object.freeze({ a: 'platform', b: 'cutting' }), backdrop: 'terminus',
    palette: Object.freeze({ ground: '#3e3b3a', ground2: '#444140', sleeper: '#2c2521', rail: '#54565b', kerb: '#59544f', wall: '#392e29', sky: '#151a29',
      flank: '#46342c', flank2: '#30241e', trim: '#565249', iron: '#22252a', lamp: '#e6dcc6', land: '#25262c', far: '#463e49', horizon: '#5d5159',
      jump: '#f2a31b', jump2: '#d9681a', steer: '#3b8fe6', 'tell-jump': '#f6d08a', 'tell-steer': '#9fd0ff', exit: '#5fd08a' }),
  }),
  'rail-yard': Object.freeze({
    name: 'Rail yard', says: 'ballast, sleepers and steel rails; amber barriers and orange crates to jump, blue wagons to go round',
    lanes: Object.freeze({ rails: true, sleepers: true }), walls: Object.freeze({ a: 'shed', b: 'fence' }), backdrop: 'yard',
    palette: Object.freeze({ ground: '#4d4a46', ground2: '#56524c', sleeper: '#3a3029', rail: '#52565c', kerb: '#5a5854', wall: '#3a3e45', sky: '#1c2430',
      flank: '#44372f', flank2: '#2d2622', trim: '#5f5b53', iron: '#2a2d32', lamp: '#d8d2c2', land: '#2c2f35', far: '#4c464f', horizon: '#5c545b',
      jump: '#f2a31b', jump2: '#e2701c', steer: '#3b8fe6', 'tell-jump': '#f6d08a', 'tell-steer': '#9fd0ff', exit: '#5fd08a' }),
  }),
  greybox: Object.freeze({
    name: 'Greybox', says: 'the course before any look: greys only',
    lanes: Object.freeze({ rails: false, sleepers: false }), walls: Object.freeze({ a: 'shed', b: 'bank' }), backdrop: 'open',
    palette: Object.freeze({ ground: '#6a6c72', ground2: '#74767c', sleeper: '#6a6c72', rail: '#8a8c92', kerb: '#7c7e84', wall: '#5c5e64', sky: '#1b1d22',
      flank: '#63656b', flank2: '#525459', trim: '#7b7d83', iron: '#44464c', lamp: '#b4b6bc', land: '#3a3c42', far: '#2c2e34', horizon: '#33353c',
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
  const askC = Math.min(...ASKS.map((a) => L[a][1])), loud = [...WAY, ...LIGHTS].filter((w) => L[w] && L[w][1] > 0.5 * askC);
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
export const DEFAULT_DRESS = 'last-train';
export function readDress(v = DEFAULT_DRESS) {
  const teach = `course: dress is one of ${Object.keys(DRESS_THEMES).join(', ')}, or { theme?, palette?, walls?, backdrop? } (course-dress.js)`;
  if (typeof v === 'string') v = { theme: v }; else if (!isObj(v)) throw new Error(teach);
  for (const k of Object.keys(v)) if (!['theme', 'palette', 'walls', 'backdrop'].includes(k)) throw new Error(`course: dress.${k} is not a dress's word (theme, palette, walls, backdrop)`);
  const theme = v.theme ?? DEFAULT_DRESS, T = DRESS_THEMES[theme];
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

/** THE PREMISE's law: a dress coheres when one sentence says who runs here and toward what, and every thing on the
 * screen has a name in it. A theme of parts with no premise does not hold it, and says so. */
export function premiseLaw(T, R) {
  if (!T.premise) return { law: 'premise', holds: false, says: `${T.name} is parts with no premise: nothing says who runs here or toward what, so its asks, its walls and its backdrop answer to nothing in common` };
  const unnamed = [...['lanes', 'hurdle', 'block', 'posts', 'tell-jump', 'tell-steer', 'end', ...(T.overhead ? ['overhead'] : [])].filter((k) => !T.things?.[k]),
    ...(R.walls.a.id === 'own' && R.walls.a.name === 'Its own' ? ['walls.a (name what it is in the premise)'] : []), ...(R.walls.b.id === 'own' && R.walls.b.name === 'Its own' ? ['walls.b (name what it is in the premise)'] : []),
    ...(R.backdrop.id === 'own' && R.backdrop.name === 'Its own' ? ['backdrop (name what it is in the premise)'] : [])];
  return { law: 'premise', holds: !unnamed.length, says: unnamed.length ? `the premise names no ${unnamed.join(', ')}` : `every thing on the screen is the line, something left on it, something beside it or where it goes: ${T.premise}` };
}

export function dressOf(dress = DEFAULT_DRESS, seed = 1) {
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
  return { theme: R.theme, name: T.name, seed, palette, lanes: T.lanes, ...(T.premise ? { premise: T.premise, things: T.things } : {}), asks: T.asks ?? {}, tells: T.tells ?? {}, end: T.end ?? null, overhead: T.overhead ?? null, ui: T.ui ?? null, lens: T.lens ?? {}, walls: R.walls, backdrop: R.backdrop, own: R.own, laws: [...dressLaws(palette), premiseLaw(T, R)] };
}

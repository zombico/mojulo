/**
 * THE BROADCAST PACKAGE — the TV graphics a contest is shown in: what a network's graphics department would hand the
 * director, as data. The contest pages (contest/*-arena.client.js) draw the game; the package draws the broadcast over
 * it (broadcast/broadcast.client.js): the score bug, the referee's call slammed on a plate, the lower third that names
 * a player on a closeup, the info tab, the meter, the results board with its medals, the open's title card, and the
 * director's cut to a closeup in the dead ball. Every sport the contest kernel referees speaks the same calls, so a
 * new sport (a book entry, a distilled rulebook, a new shape whose page feeds the client) is broadcast with no code.
 *
 *   PACKAGES        the looks, a card each (BROADCAST_PACKAGES):
 *                     network   primetime: smoked navy glass, chrome rims, gold for the decisive call; long exponential
 *                               eases, a sheen across the metal on each reveal, closeups in the dead ball
 *                     stadium   the big screen: slanted slabs in the side's colour, heavy rims, a slam with overshoot
 *                     arcade    the cartoon register: rounded, saturated, inked, cel metal in hard bands, a bounce
 *                     clean     the world feed's minimum: flat glass, no metal, fades, no cuts
 *                     table     the game's own furniture, not a broadcast's: plates of the game's wood or felt (the page
 *                               hands its materials in, `look`), scores on its light inlay, brass fittings, a book face
 *                               in mixed case, quiet eases, no sheen and no cuts (the board games' default)
 *                   the register picks one when the recipe does not (realistic → network, action → stadium, the
 *                   platformer and pinball → arcade: the feel cards' axis)
 *   COLOUR          the side colours separated in OKLab, and again as a deutan and a protan sees them (a clash wears
 *                   its alternate, as an away kit does); the ink on a colour by WCAG contrast; each colour a ramp in
 *                   OKLCH (lightness moves, the hue holds, the chroma clamped into gamut: no muddy darks); lanes and
 *                   seats from the Okabe–Ito set, the colour-blind-safe categorical
 *   METAL           a rim, an accent and the medals as gradient stops: a bevel reflecting a studio sweep (a softbox
 *                   above, the dark horizon, the floor's bounce), weighted by the metal's measured reflectance at that
 *                   angle (materials/metal-surface.js metalRgb): a metal is what it reflects; cel metal is the same
 *                   sweep in hard bands
 *   CUES            every call the contest kernel makes, the plate it raises (or none, by name), its tone and hold, and
 *                   the words a referee's reason is shown in (CALL_CUES, WHY_WORDS)
 *
 *   readBroadcast(v, where) → { package?, sides?, names?, closeups?, accent? } checked (teaches on a bad word)
 *   broadcastData(v, { register, count, kind, look? }) → the page's data: the card, the colours, the metals, the cues;
 *                   look { glass: [top, bottom], inlay? } is the page's own material laid over the package's (a table
 *                   built of the board's wood), the kits keylined and the type inked against it
 *   oklab, deltaE, simulateCvd, contrast, inkOn, colorRamp, separateColors, metalStops   the arithmetic, for tests
 *
 * Pure data and arithmetic on dmath: the same bytes on every host. No dice.
 */
import { metalRgb, METAL_NAMES } from '../materials/metal-surface.js';
import * as dmath from '../../util/dmath.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ── the packages ─────────────────────────────────────────────────────────────────────────────────────────────

// frames at 60 Hz. in / out: a plate's reveal and exit; hold: a call's time on screen; sheen: the light's sweep;
// ease: the reveal's curve (expo | back | elastic | sine); slant: a plate's lean (a parallelogram's shear); radius: its
// corner; rim: the metal edge in px; ink: an outline round the type (arcade's); cel: metal in hard bands; letterbox: the
// closeup's bars as a share of the height; safe: the title-safe margin as a share of the frame
export const BROADCAST_PACKAGES = Object.freeze({
  network: Object.freeze({
    words: 'primetime network: smoked navy glass, chrome rims, gold for the decisive call; long exponential eases, a sheen across the metal on each reveal, closeups in the dead ball',
    face: '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
    weight: 800, track: 0.08, glass: ['#1f2b45', '#0a101c'], glassAlpha: 0.9, rimMetal: 'chrome', accent: 'gold',
    ease: 'expo', in: 18, out: 14, hold: 96, sheen: 42, slant: 0, radius: 2, rim: 2, ink: 0, cel: false,
    letterbox: 0.085, safe: 0.05, closeups: true,
  }),
  stadium: Object.freeze({
    words: 'the big screen: slanted slabs in the side\'s colour, heavy chrome rims, the call slammed in with an overshoot and a flash',
    face: '"Impact", "Haettenschweiler", "Arial Narrow Bold", "Roboto Condensed", Arial, sans-serif',
    weight: 900, track: 0.04, glass: ['#14161c', '#050608'], glassAlpha: 0.92, rimMetal: 'chrome', accent: 'gold',
    ease: 'back', in: 12, out: 10, hold: 84, sheen: 30, slant: 0.22, radius: 0, rim: 3, ink: 0, cel: false,
    letterbox: 0.07, safe: 0.04, closeups: true,
  }),
  arcade: Object.freeze({
    words: 'the cartoon register: rounded plates, saturated colour, inked type, cel metal in hard bands, a bounce on every entrance',
    face: '"Arial Rounded MT Bold", "Nunito", "Trebuchet MS", "Verdana", sans-serif',
    weight: 900, track: 0.03, glass: ['#3a2a7a', '#1a1240'], glassAlpha: 0.94, rimMetal: 'gold', accent: 'gold',
    ease: 'elastic', in: 26, out: 12, hold: 84, sheen: 36, slant: 0, radius: 14, rim: 3, ink: 4, cel: true,
    letterbox: 0, safe: 0.04, closeups: true,
  }),
  table: Object.freeze({
    words: 'the game\'s own table: plates of its wood or felt, scores on its light inlay, brass fittings, a book face in mixed case; quiet eases, no sheen, no cuts',
    face: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    weight: 700, track: 0.01, glass: ['#7c6855', '#3a2715'], glassAlpha: 1, rimMetal: 'brass', accent: 'brass',
    ease: 'sine', in: 16, out: 14, hold: 96, sheen: 0, slant: 0, radius: 6, rim: 2, ink: 0, cel: false,
    letterbox: 0, safe: 0.04, closeups: false, caps: false, grain: true, inlay: '#e8d9b8',
    tones: Object.freeze({ warn: '#b0402a', go: '#3a7d50' }),   // the board's own marker red and its green, not a referee's amber
  }),
  clean: Object.freeze({
    words: 'the world feed: flat glass, no metal, fades, no cuts; the score and the calls, nothing else',
    face: '"Helvetica Neue", "Segoe UI", Arial, system-ui, sans-serif',
    weight: 700, track: 0.04, glass: ['#101318', '#101318'], glassAlpha: 0.78, rimMetal: null, accent: null,
    ease: 'sine', in: 10, out: 10, hold: 80, sheen: 0, slant: 0, radius: 3, rim: 0, ink: 0, cel: false,
    letterbox: 0, safe: 0.04, closeups: false,
  }),
});
export const BROADCAST_PACKAGE_IDS = Object.freeze(Object.keys(BROADCAST_PACKAGES));
/** The package a register is shown in when the recipe names none (the feel cards' names). */
export const REGISTER_PACKAGE = Object.freeze({ realistic: 'network', action: 'stadium', platformer: 'arcade', pinball: 'arcade' });

// the sides' kits when the recipe names none: a crimson home and a royal away, apart for every eye; lanes and seats
// the Okabe–Ito set (its black lifted to a grey: the glass is dark), ordered so neighbours differ most
export const SIDE_KITS = Object.freeze(['#d7263d', '#1f6fe0']);
export const LANE_KITS = Object.freeze(['#d55e00', '#56b4e9', '#e69f00', '#009e73', '#cc79a7', '#f0e442', '#0072b2', '#b8bec8']);
export const MEDALS = Object.freeze(['gold', 'silver', 'bronze']);
// the referee's amber (a card's, not a side's red) and the starter's green
export const TONE_KITS = Object.freeze({ warn: '#f2a900', go: '#1fae5b' });

// ── colour ───────────────────────────────────────────────────────────────────────────────────────────────────

export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const rgbHex = (c) => `#${c.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')}`;
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : dmath.pow((c + 0.055) / 1.055, 2.4));
const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * dmath.pow(c, 1 / 2.4) - 0.055);
const linOf = (h) => hexRgb(h).map(toLin);
const hexOfLin = (l) => rgbHex(l.map((v) => toGam(clamp01(v))));

function linToOklab([r, g, b]) {
  const l = dmath.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = dmath.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = dmath.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToLin([L, a, b]) {
  const cube = (x) => x * x * x;
  const l = cube(L + 0.3963377774 * a + 0.2158037573 * b), m = cube(L - 0.1055613458 * a - 0.0638541728 * b), s = cube(L - 0.0894841775 * a - 1.291485548 * b);
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** A colour in OKLab (perceptual: equal distances look equal). */
export const oklab = (h) => linToOklab(linOf(h));
/** The perceptual distance of two colours (ΔE in OKLab; about 0.02 is a just-noticeable step). */
export function deltaE(h1, h2) { const p = oklab(h1), q = oklab(h2); return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); }
// dichromat simulation in linear RGB (Viénot, Brettel & Mollon 1999)
const CVD = Object.freeze({
  deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]],
  protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],
});
/** A colour as a deutan or a protan sees it. */
export function simulateCvd(h, kind = 'deutan') {
  const M = CVD[kind], l = linOf(h);
  return hexOfLin(M.map((row) => row[0] * l[0] + row[1] * l[1] + row[2] * l[2]));
}
const lum = (h) => { const l = linOf(h); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
/** WCAG contrast ratio of two colours (1 to 21; 4.5 the floor for text). */
export function contrast(h1, h2) { const a = lum(h1), b = lum(h2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
export const INK_LIGHT = '#ffffff', INK_DARK = '#0b0f17';
/** The type on a colour: white or the near-black, whichever reads further. */
export const inkOn = (h) => (contrast(h, INK_LIGHT) >= contrast(h, INK_DARK) ? INK_LIGHT : INK_DARK);

const lchOf = (h) => { const [L, a, b] = oklab(h); return [L, Math.sqrt(a * a + b * b), dmath.atan2(b, a)]; };
const inGamut = (l) => l.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** A colour at OKLCH (L, C, hue in radians), its chroma reduced until it is in sRGB's gamut. */
function lchHex(L, C, H) {
  let c = C;
  for (let i = 0; i < 24; i++) {
    const lin = oklabToLin([L, c * dmath.cos(H), c * dmath.sin(H)]);
    if (inGamut(lin)) return hexOfLin(lin);
    c *= 0.9;
  }
  return hexOfLin(oklabToLin([L, 0, 0]));
}
/** A colour's ramp for a plate's gradient: lighter and darker at its own hue, the chroma eased off at the ends. */
export function colorRamp(h, ground = null) {
  const [L, C, H] = lchOf(h);
  const ramp = { hi: lchHex(Math.min(0.96, L + 0.12), C * 0.92, H), base: h.toLowerCase(), lo: lchHex(Math.max(0.12, L - 0.12), C * 0.95, H), deep: lchHex(Math.max(0.08, L - 0.26), C * 0.7, H), ink: inkOn(h) };
  // a kit that sinks into the ground it sits on (a black side on the dark glass) is drawn with a keyline, as TV does
  return ground && deltaE(h, ground) < KEYLINE_DE ? { ...ramp, key: true } : ramp;
}
const KEYLINE_DE = 0.12;
const apart = (h1, h2, min) => deltaE(h1, h2) >= min && deltaE(simulateCvd(h1, 'deutan'), simulateCvd(h2, 'deutan')) >= min * 0.6 && deltaE(simulateCvd(h1, 'protan'), simulateCvd(h2, 'protan')) >= min * 0.6;
/**
 * The colours, each apart from every one before it, for every eye: a colour too near an earlier one (in OKLab, or as a
 * deutan or a protan sees it) wears its alternate, its lightness thrown to the other end (an away kit), then its hue
 * turned until it is apart. { colors, clash: the indices that changed }.
 */
export function separateColors(list, min = 0.14) {
  const out = [], clash = [];
  list.forEach((h, i) => {
    let c = h.toLowerCase();
    if (!out.every((o) => apart(o, c, min))) {
      const [L, C, H] = lchOf(c);
      const tries = [lchHex(L > 0.6 ? 0.34 : 0.88, C * 0.55, H)];
      for (let k = 1; k <= 11; k++) tries.push(lchHex(L, Math.max(C, 0.1), H + (k * Math.PI) / 6));
      c = tries.find((t) => out.every((o) => apart(o, t, min))) ?? tries[0];
      clash.push(i);
    }
    out.push(c);
  });
  return { colors: out, clash };
}

// ── metal ────────────────────────────────────────────────────────────────────────────────────────────────────

// a bevelled bar seen head-on: its rows tilt from facing the sky to facing the floor, so the top reflects the softbox
// and the bottom the floor, the horizon a dark line just under the middle (the chrome look). The sweep's radiance by
// the reflected ray's elevation e (radians, + up), the sky a touch cool and the floor a touch warm, as a set's are:
const SKY = [0.93, 0.97, 1.06], FLOOR = [1.06, 0.97, 0.86];
function studio(e) {
  if (e > 0.06) { const k = 0.42 + 0.9 * dmath.exp(-((e - 0.55) / 0.32) * ((e - 0.55) / 0.32)); return SKY.map((t) => t * k); }   // the softbox
  if (e > -0.06) return [0.05, 0.05, 0.05];                                                                                        // the horizon
  const k = 0.1 + 0.22 * Math.min(1, -e / 1.2); return FLOOR.map((t) => t * k);                                                   // the bounce
}
// the light meets the metal more than once in a bevel's relief (a struck medal's, a plate's chamfer): its colour
// deepens as F^n, which is why worn gold reads gold and a flat sheet of it reads cream
const BOUNCE = 1.6;
const SWEEP = Object.freeze([0, 0.16, 0.34, 0.47, 0.53, 0.66, 0.84, 1]);
const CEL = Object.freeze([[0, 0.3], [0.5, 0.55], [0.5, 0.85]]);   // cel metal: a lit band, a mid band, a shadow band
/**
 * A metal's gradient across a bar, top to bottom: [[offset, '#rrggbb'], …]. Each row is the metal's measured
 * reflectance at the bevel's angle (metalRgb) times the studio sweep it reflects, exposed and soft-clipped. `cel`
 * samples three rows and stops them hard (the cartoon's banded metal).
 */
export function metalStops(metal, { exposure = 2, cel = false } = {}) {
  const at = (u) => {
    const tilt = (u - 0.5) * 1.1, e = -2 * tilt, cos = dmath.cos(Math.abs(tilt));
    const F = metalRgb(metal, { cos }), E = studio(e), x = F.map((f, i) => dmath.pow(f, BOUNCE) * E[i] * exposure);
    // tone-mapped on its luminance, so a bright gold stays gold rather than bleaching to cream
    const Y = 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2], k = Y > 0 ? (1 - dmath.exp(-Y * 1.25)) / Y : 0;
    return hexOfLin(x.map((v) => v * k * 1.12));
  };
  if (cel) {
    const [a, b, c] = CEL.map(([, u]) => at(u));
    return [[0, a], [0.42, a], [0.42, b], [0.7, b], [0.7, c], [1, c]];
  }
  return SWEEP.map((u) => [u, at(u)]);
}
/** The light's sweep across a metal: its reflectance near grazing, over-exposed (a near-white tinted by the metal). */
const sheenOf = (metal) => hexOfLin(metalRgb(metal, { cos: 0.2 }).map((f) => 1 - dmath.exp(-f * 3.5)));

// ── the cues ─────────────────────────────────────────────────────────────────────────────────────────────────

// every call the contest kernel makes (contest-kernel.js, `calls.push`), the plate it raises: tone the plate's colour
// (side: the side's; gold: the accent metal, the decisive; warn: the referee's amber; go: the green; neutral: glass);
// hold its time as a share of the package's; cut: a closeup in the dead ball after it (winner: on the side or the
// player it names; ball: on the ball's rest); strap: the player named on a lower third without a cut (a pin deck after
// the roll is an empty pit: the strike is the bowler's); board: the results. null is a call the broadcast shows no plate for, by
// name (the serve, the ball live, a lie: the bug and the tab carry those). `unit` stands for the scoring ladder's own
// units (a game, a set, a match), named by the sport.
export const CALL_CUES = Object.freeze({
  point: Object.freeze({ tone: 'side', hold: 1, cut: 'winner' }),
  fault: Object.freeze({ tone: 'warn', hold: 0.75 }),
  let: Object.freeze({ tone: 'neutral', hold: 0.7 }),
  unit: Object.freeze({ tone: 'gold', hold: 1.1, cut: 'winner' }),
  over: Object.freeze({ tone: 'gold', hold: 1.6, cut: 'winner', board: true }),
  period: Object.freeze({ tone: 'neutral', hold: 1.4 }),
  overtime: Object.freeze({ tone: 'warn', hold: 1.4 }),
  score: Object.freeze({ tone: 'side', hold: 1.5, cut: 'winner' }),
  out: Object.freeze({ tone: 'neutral', hold: 0.9 }),
  foul: Object.freeze({ tone: 'warn', hold: 1.1 }),
  set: Object.freeze({ tone: 'neutral', hold: 1.6 }),
  gun: Object.freeze({ tone: 'go', hold: 0.6 }),
  'false-start': Object.freeze({ tone: 'warn', hold: 1.5, cut: 'winner' }),
  finish: Object.freeze({ tone: 'side', hold: 1.2, cut: 'winner' }),
  mark: Object.freeze({ tone: 'side', hold: 1.1, cut: 'winner' }),
  turn: Object.freeze({ tone: 'neutral', hold: 0.9 }),
  holed: Object.freeze({ tone: 'gold', hold: 1.3, cut: 'ball' }),
  penalty: Object.freeze({ tone: 'warn', hold: 1.3 }),
  roll: Object.freeze({ tone: 'side', hold: 1.1, strap: true }),
  // a carry game's: the ball turned over, a first down, a dropped ball, the conversion (a tackle and its count are the
  // tab's, no plate)
  turnover: Object.freeze({ tone: 'side', hold: 1.1 }),
  down: Object.freeze({ tone: 'side', hold: 0.9 }),
  incomplete: Object.freeze({ tone: 'warn', hold: 0.9 }),
  conversion: Object.freeze({ tone: 'gold', hold: 1.2 }),
  // an innings game's: a strike, a hit and its bases, the runs and the boundary, the side retired, the over (a dot ball
  // is the tab's); an out is the shared `out` above, read by its reason
  strike: Object.freeze({ tone: 'neutral', hold: 0.8 }),
  'base-hit': Object.freeze({ tone: 'side', hold: 1.2, cut: 'winner' }),
  runs: Object.freeze({ tone: 'side', hold: 1.1 }),
  side: Object.freeze({ tone: 'neutral', hold: 1.4 }),
  'end-over': Object.freeze({ tone: 'neutral', hold: 0.9 }),
  serve: null, live: null, shot: null, lie: null, tackle: null, tackled: null, dot: null,
});
/** The referee's reasons and the sports' own words, as the broadcast shows them. */
export const WHY_WORDS = Object.freeze({
  out: 'OUT', 'double-bounce': 'NOT UP', 'own-side': 'INTO THE NET', net: 'NET', 'reach-over': 'OVER THE NET', touches: 'FOUR TOUCHES',
  'double-touch': 'DOUBLE TOUCH', 'volleyed-serve': 'VOLLEYED', 'touched-own-serve': 'OWN SERVE', 'net-touch': 'NET TOUCH',
  'foot-fault': 'FOOT FAULT', 'double-fault': 'DOUBLE FAULT', winner: 'WINNER', ace: 'ACE', offside: 'OFFSIDE', charge: 'CHARGE',
  'throw-in': 'THROW-IN', corner: 'CORNER', 'goal-kick': 'GOAL KICK', free: 'FREE KICK', kickoff: 'KICK-OFF',
  water: 'IN THE WATER', 'picked-up': 'PICKED UP', down: 'IN', 'volley-before-bounce': 'TWO-BOUNCE RULE', 'no-own-bounce': 'NO BOUNCE ON THE SERVE', kitchen: 'KITCHEN',
  '-3': 'ALBATROSS', '-2': 'EAGLE', '-1': 'BIRDIE', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY', 3: 'TRIPLE BOGEY',
});

// ── the recipe's word ────────────────────────────────────────────────────────────────────────────────────────

const fail = (where, m) => { throw new Error(`${where}: broadcast ${m}`); };
const KEYS = ['package', 'sides', 'names', 'closeups', 'accent', 'stats'];
/**
 * What each contest's coverage counts and when (contest/contest-stats.js rows; a row the sport has not is skipped):
 * `panel` the rows of the stats panel at a break (`at`: changeover | period | round), `strap` the rows a lower third's
 * line shows at the closeup the stats speak to (the match's end, a goal, a holed ball, a strike), `board` the rows the
 * results board notes. A book sport's own lean (contest/sport-presets.js) is laid over its shape's.
 */
export const STAT_COVERAGE = Object.freeze({
  court: Object.freeze({ at: 'changeover', panel: ['points', 'aces', 'doubles', 'firstIn', 'winners', 'errors', 'serve'], strap: ['aces', 'winners'], board: ['aces'] }),
  pitch: Object.freeze({ at: 'period', panel: ['possession', 'shots', 'onTarget', 'passes', 'corners', 'fouls', 'saves'], strap: ['shots', 'onTarget'], board: ['shots'] }),
  turns: Object.freeze({ at: 'round', panel: ['toPar', 'putts', 'fairways', 'greens', 'penalties', 'pinfall', 'strikes', 'spares', 'opens', 'speed'], strap: ['putts', 'greens', 'strikes', 'spares'], board: ['putts', 'strikes'] }),
  meet: Object.freeze({ at: 'over', panel: [], strap: ['runup'], board: ['clips', 'fouls', 'runup'] }),
  innings: Object.freeze({ at: 'side', panel: ['runs', 'hits', 'homers', 'strikeouts', 'fours', 'sixes', 'outs'], strap: ['hits', 'fours', 'sixes'], board: ['hits', 'sixes'] }),
});
const STAT_WORDS = ['at', 'panel', 'strap', 'board'];
/**
 * The `broadcast` key, checked: a package's name, or { package?, sides?: ['#rrggbb', …] (the sides', lanes' or seats'
 * colours, in order), names?: [string, …] (the players as the straps name them), closeups?: boolean, accent?: a metal,
 * stats?: false (no stats graphics) | { panel?, strap?, board?: [row ids], at? } over the contest's STAT_COVERAGE }.
 */
export function readBroadcast(v, where = 'contest') {
  if (v === undefined || v === true) return {};
  if (typeof v === 'string') v = { package: v };
  if (!isObj(v)) fail(where, `is a package (${BROADCAST_PACKAGE_IDS.join(', ')}) or { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) fail(where, `has no '${k}' (${KEYS.join(', ')})`);
  if (v.package !== undefined && !BROADCAST_PACKAGES[v.package]) fail(where, `package '${v.package}' is one of ${BROADCAST_PACKAGE_IDS.join(', ')}`);
  if (v.sides !== undefined && !(Array.isArray(v.sides) && v.sides.length >= 1 && v.sides.length <= 8 && v.sides.every((c) => typeof c === 'string' && HEX.test(c)))) fail(where, 'sides is 1 to 8 colours, each \'#rrggbb\' (the sides, lanes or seats in order)');
  if (v.names !== undefined && !(Array.isArray(v.names) && v.names.length <= 8 && v.names.every((n) => typeof n === 'string' && n.length >= 1 && n.length <= 18))) fail(where, 'names is up to 8 names, each 1 to 18 characters (the players in order)');
  if (v.closeups !== undefined && typeof v.closeups !== 'boolean') fail(where, 'closeups is true or false (the director\'s cut to a player in the dead ball)');
  if (v.accent !== undefined && !METAL_NAMES.includes(v.accent)) fail(where, `accent '${v.accent}' is a metal: ${METAL_NAMES.join(', ')}`);
  if (v.stats !== undefined && v.stats !== false) {
    if (!isObj(v.stats)) fail(where, 'stats is false or { panel?, strap?, board?: [the stats\' row ids], at?: changeover | period | round | over }');
    for (const k of Object.keys(v.stats)) {
      if (!STAT_WORDS.includes(k)) fail(where, `stats has no '${k}' (${STAT_WORDS.join(', ')})`);
      if (k === 'at' ? !['changeover', 'period', 'round', 'over'].includes(v.stats.at) : !(Array.isArray(v.stats[k]) && v.stats[k].length <= 10 && v.stats[k].every((r) => typeof r === 'string' && /^[a-zA-Z]{1,20}$/.test(r)))) fail(where, `stats.${k} is ${k === 'at' ? 'changeover, period, round or over' : 'a list of up to 10 row ids (contest-stats.js STAT_ROWS)'}`);
    }
  }
  return { ...v, ...(v.sides ? { sides: v.sides.map((c) => c.toLowerCase()) } : {}) };
}

/**
 * The page's data: the package's card, the colours (the recipe's or the kits', separated, each its ramp and ink), the
 * metals as gradient stops (the rim, the accent, the medals, the sheen), the cues and the words, and a contest's stats
 * coverage (STAT_COVERAGE under `statLean`, a sport's own, under the recipe's `stats`). `kind` is how the contest is
 * divided (sides: two; lanes or seats: up to eight), `count` how many.
 */
export function broadcastData(v, { register = 'realistic', count = 2, kind = 'sides', where = 'contest', look = null, fallback = null, statLean = null } = {}) {
  const B = readBroadcast(v, where);
  const id = B.package ?? fallback ?? REGISTER_PACKAGE[register] ?? 'network', base = BROADCAST_PACKAGES[id];
  const P = look && id === 'table' ? { ...base, ...(look.glass ? { glass: look.glass } : {}), ...(look.inlay ? { inlay: look.inlay } : {}) } : base;
  const kit = kind === 'sides' ? SIDE_KITS : LANE_KITS;
  const asked = Array.from({ length: count }, (_, i) => (B.sides && B.sides[i]) || kit[i % kit.length]);
  const { colors, clash } = separateColors(asked, kind === 'sides' ? 0.14 : 0.12);
  const accent = B.accent ?? P.accent;
  const stops = (m) => (m ? metalStops(m, { cel: P.cel }) : null);
  const card = Object.fromEntries(Object.entries(P).filter(([k]) => k !== 'words'));
  return {
    package: id,
    card: { ...card, closeups: B.closeups ?? P.closeups },
    colors: colors.map((c) => colorRamp(c, P.glass[1])),
    clash,
    metal: { rim: stops(P.rimMetal), accent: stops(accent), medals: MEDALS.map((m) => metalStops(m, { cel: P.cel })), sheen: accent ? sheenOf(accent) : '#ffffff' },
    tones: { warn: colorRamp((P.tones || TONE_KITS).warn), go: colorRamp((P.tones || TONE_KITS).go) },
    // on a material with an inlay the type is the inlay's (ivory on the wood), when it reads
    glassInk: P.inlay && contrast(P.inlay, P.glass[1]) >= 4.5 ? P.inlay : inkOn(P.glass[1]),
    names: B.names ?? null,
    cues: CALL_CUES,
    why: WHY_WORDS,
    // the stats graphics a contest's coverage shows (absent on a page without coverage: the board games')
    ...(STAT_COVERAGE[where] ? { stats: B.stats === false ? null : { ...STAT_COVERAGE[where], ...(statLean ?? {}), ...(B.stats ?? {}) } } : {}),
  };
}
/** The contrast each colour's ink reads at (for the tests and the report: never under 4.5). */
export const inkContrasts = (data) => data.colors.map((c) => r3(contrast(c.base, c.ink)));

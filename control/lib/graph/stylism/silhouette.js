/**
 * silhouette.js — THE SILHOUETTE SOLVER: the super-simplified form, the first thing a character designer draws. A target
 * OUTLINE (the front outline's character: where it is widest against its height) is made with a genre's big masses,
 * scaled by the register, and then READ back off the dressed figure.
 *
 *   OUTLINES            the fashion letters: 'wedge' (T/V: widest high, the shoulders) | 'bell' (A: widest low) | 'column'
 *                       (H: even) | 'needle' (I: narrow for its height) | 'barrel' (O: widest in the middle) | 'hourglass'
 *                       (X: the shoulders and the hem both wider than a cinched middle)
 *   silhouetteMoves(genre, target, r, cast)   the moves that make `target` in `genre` at register r: [{ technique,
 *                       language?, pieces?, note }] (each lowered by TECHNIQUES)
 *   readSilhouette(mesh)   the dressed figure's outline, the arms left out (a hand at the hip is not the hip): its
 *                       character and the widest row of each third against the height, and the BLOCKOUT (the front, side
 *                       and three-quarter masks, the thumbnail a designer draws first)
 *   blockoutSvg(read)   the blockout as flat shapes on one sheet (SVG)
 * Pure and deterministic.
 */
import { figureMask, heightFrame } from '../polygonizer/silhouette-gates.js';
import { GENRES } from './genres.js';
import { NAMED } from './silhouettes.js';

export const OUTLINES = Object.freeze(['wedge', 'bell', 'column', 'needle', 'barrel', 'hourglass']);
const r3 = (x) => Math.round(x * 1000) / 1000;
const lerp = (a, b, t) => a + (b - a) * t;

/** each technique: how it lowers (the register r, 0 grounded … 1 mythic), and the principle it serves */
export const TECHNIQUES = Object.freeze({
  // the shoulders broadened: a cape of cloth over them (grounded), armour standing off them (heightened)
  mantle: (r) => ({ pieces: [{ kind: 'mantle' }], note: 'a mantle over the shoulders: the line broadens without armour' }),
  pauldrons: (r) => ({ pieces: [{ kind: 'pauldron', pair: true, shoulder: r3(lerp(1.15, 1.75, r)) }], note: `pauldrons standing out to ${r3(lerp(1.15, 1.75, r))} × the arm line: the shoulders carry the shape` }),
  shoulderPlates: (r) => ({ pieces: [{ kind: 'pauldron', pair: true, shoulder: r3(lerp(1.1, 1.6, r)) }], note: `shoulder plates out to ${r3(lerp(1.1, 1.6, r))} × the arm line` }),
  shoulderPads: (r) => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'base', shoulder: r3(lerp(1.05, 1.45, r)) }], note: `padded shoulders out to ${r3(lerp(1.05, 1.45, r))} × the arm line, in the jacket's own cloth` }),
  boxyJacket: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: r < 0.5 ? 'hip' : 'waist', fit: 'loose', open: true } }, note: 'a boxy jacket, loose and short: width at the shoulders, none below' }),
  // the legs kept close, so the shoulders read against them
  closeLegs: () => ({ language: { bottom: { kind: 'trousers', cut: 'skinny' } }, note: 'the legs cut skinny: a narrow base under a broad top' }),
  closeFit: () => ({ language: { top: { fit: 'skin' }, bottom: { kind: 'trousers', fit: 'fitted', cut: 'skinny' } }, note: 'everything close: the body\'s own line, narrow for its height' }),
  // the weight low: cloth that falls and spreads
  robe: (r) => ({ pieces: [{ kind: r >= 0.6 ? 'wizardRobe' : 'robe', flare: r3(lerp(0.12, 0.3, r)) }], note: `a ${r >= 0.6 ? 'wizard\'s robe' : 'robe'} to the ankle, flaring ${r3(lerp(0.12, 0.3, r))} m per m: the weight sits low` }),
  straightRobe: () => ({ pieces: [{ kind: 'robe', flare: 0.02 }], note: 'a robe falling straight: one even mass from shoulder to hem' }),
  straightCloak: () => ({ pieces: [{ kind: 'cloak', flare: 0, wrap: 0.55 }], note: 'a cloak falling straight from the shoulders: their width carried to the hem' }),
  cloak: (r) => ({ pieces: [{ kind: 'cloak', flare: r3(lerp(0.08, 0.24, r)) }], note: 'a cloak over it, spreading as it falls' }),
  hoodedCloak: (r) => ({ pieces: [{ kind: 'cloak', hood: true, wrap: 0.5, flare: 0 }], note: 'a narrow hooded cloak hanging straight: the hood lifts the top, the hem stays close' }),
  longCoat: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'maxi', cut: r >= 0.5 ? 'full' : 'aline', open: true } }, note: `a long coat to the shin, cut ${r >= 0.5 ? 'full' : 'a-line'}: it spreads as it falls` }),
  straightCoat: () => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'midi', cut: 'pencil', fit: 'loose', open: true } }, note: 'a long straight coat, loose from the chest: one even mass from the shoulders to the hem' }),
  // the middle widened: a band of weight at the waist, plates or panels at the hips
  sash: () => ({ pieces: [{ kind: 'sash' }], note: 'a sash at the waist: a horizontal band where the eye lands' }),
  tassets: (r) => ({ language: { panels: [{ at: 'sides', length: 'mini', width: r3(lerp(0.45, 0.65, r)), cut: 'full', rigidity: 'stiff' }] }, note: 'short full panels at the hips: the middle stands out, the legs below stay narrow' }),
  gambeson: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'tunic', fit: 'loose', cut: 'full' } }, note: 'a padded coat to the thigh, loose: the mass in the middle' }),
  parka: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'tunic', fit: 'loose', cut: 'full' } }, note: 'a loose parka to the thigh: the mass in the middle' }),
  oversizedTop: () => ({ language: { top: { fit: 'loose', hem: 'tunic' } }, note: 'an oversized top to the hip: the mass in the middle' }),
  harness: () => ({ pieces: [{ kind: 'harness' }], note: 'a harness over the chest: the middle crossed and weighted' }),
  // ── the named silhouettes' signatures (silhouettes.js); ◐ marks a stand-in until its own technique lands
  secondSkin: () => ({ language: { top: { family: 'knit', sleeve: 'long', hem: 'hip', fit: 'skin' }, bottom: { kind: 'trousers', family: 'knit', leg: 'long', fit: 'skin' } }, note: 'a second-skin suit: the body\'s own line, nothing to catch on' }),
  fittedCoat: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: r >= 0.5 ? 'midi' : 'knee', cut: 'pencil', fit: 'fitted', open: true, collar: true } }, note: 'a fitted long coat, open: one clean vertical over the suit' }),
  utilityBelt: () => ({ language: { focal: 'belt' }, pieces: [{ kind: 'satchel' }], note: 'a belt with a holster at the hip: the one functional break in the line' }),
  tallBoots: () => ({ language: { feet: 'boots' }, note: 'tall boots: the leg finished in one dark mass' }),
  highCollar: (r) => ({ pieces: [{ kind: 'collar', rise: r3(lerp(0.06, 0.12, r)), flare: 1.6 }], note: '◐ a high collar (a standing collar behind the neck until the collar shapes)', approx: 'high collar' }),
  shortFullSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'mini', cut: 'full' } }, note: 'a short full skirt: the bell made small and lively' }),
  shortFullDress: (r) => ({ pieces: [{ kind: 'gown', hem: 'thigh', flare: r3(lerp(0.4, 0.65, r)) }], note: 'a short dress flaring hard from the waist: the width at the hips, the legs bare below' }),
  spaulder: (r) => ({ pieces: [{ kind: 'pauldron', shoulder: r3(lerp(1.2, 1.7, r)) }], note: 'one armoured shoulder: the line broken on one side, the fighter\'s lead' }),
  kneeFullSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'knee', cut: 'full' } }, note: 'a full skirt to the knee, with volume under it' }),
  fullLongSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'maxi', cut: 'full' } }, note: 'a full skirt to the ankle: the low half of the X' }),
  pleatedSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'knee', cut: 'full' } }, note: '◐ a pleated skirt (a full skirt to the knee until pleats: pleats spread it the same way)', approx: 'pleats' }),
  bows: (r, d) => { const at = d >= 0.7 ? ['back', 'collar', 'wrists'] : d >= 0.35 ? ['back', 'collar'] : ['back'];
    return { pieces: at.map((a) => ({ kind: 'bow', at: a, tails: r3(a === 'wrists' ? lerp(0.08, 0.16, r) : lerp(0.18, 0.45, r)), width: r3(lerp(0.028, 0.045, r)) })), note: `bows at the ${at.join(', the ')}, their tails flowing: ${at.length} by the detail, their length by the register` }; },
  neckerchief: () => ({ pieces: [{ kind: 'bow', at: 'collar', tails: 0.14 }], note: 'a neckerchief bow at the collar: the focal under the face' }),
  sailorCollar: () => ({ pieces: [{ kind: 'mantle', clasp: false }], language: { top: { family: 'woven', collar: true } }, note: '◐ a sailor collar (a mantle over the shoulders until the square flap)', approx: 'sailor collar' }),
  cinchedBodice: () => ({ language: { top: { family: 'woven', fit: 'fitted' }, focal: 'belt' }, pieces: [{ kind: 'sash' }], note: 'a fitted bodice cinched at the waist: the narrow middle of the X' }),
  puffShoulders: (r) => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'base', shoulder: r3(lerp(1.0, 1.3, r)) }], note: '◐ puffed shoulders (soft shoulder caps until puff sleeves)', approx: 'puff sleeves' }),
  gown: (r) => ({ pieces: [{ kind: 'gown', hem: 'ankle', flare: r3(lerp(0.2, 0.45, r)) }], note: 'a gown: a fitted bodice over a skirt full to the ankle' }),
  hakama: () => ({ language: { bottom: { kind: 'skirt', family: 'woven', leg: 'maxi', cut: 'aline' } }, note: '◐ a hakama (a full skirt to the ankle until divided, pleated trousers)', approx: 'hakama' }),
  wideTrousers: () => ({ language: { bottom: { kind: 'trousers', family: 'woven', leg: 'long', cut: 'wide' } }, note: 'wide trousers falling from the hip (◐ hakama pleats later)', approx: 'hakama pleats' }),
  wideSleevedTop: () => ({ pieces: [{ kind: 'tunic', sleeve: 'bell', bell: 0.1, hem: 'thigh', flare: 0.04 }], note: 'an over-robe with wide sleeves, to the thigh' }),
  ankleDress: () => ({ language: { top: { family: 'woven', fit: 'fitted' }, bottom: { kind: 'skirt', leg: 'maxi', cut: 'pencil' }, dress: true }, note: 'a fitted dress to the ankle, one cloth: the line unbroken (◐ side slits later)', approx: 'side slits' }),
  mandarinCollar: () => ({ pieces: [{ kind: 'collar', rise: 0.05, flare: 1.4 }], note: '◐ a mandarin collar (a low standing collar until the collar shapes)', approx: 'mandarin collar' }),
  sidePanels: () => ({ language: { panels: [{ at: 'sides', length: 'mini', width: 0.3, rigidity: 'soft' }] }, note: 'short panels at the hips, swinging' }),
  scarf: (r) => ({ pieces: [{ kind: 'bow', id: 'scarf', at: 'collar', loops: false, tails: r3(lerp(0.4, 0.8, r)), colour: 'accent' }], note: 'a scarf at the throat, its tails long and flowing: the motion line' }),
  tabard: () => ({ language: { panels: [{ at: 'front', length: 'knee', width: 0.4 }, { at: 'back', length: 'knee', width: 0.4 }] }, note: 'a tabard front and back: the vertical of a knight' }),
  chestPlate: () => ({ pieces: [{ kind: 'chestPlate' }], note: 'a breastplate: the chest a hard plane' }),
  duster: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'maxi', cut: 'aline', open: true, collar: true } }, note: 'a duster to the shin, open: it swings behind the stride' }),
  sleeveless: () => ({ language: { top: { sleeve: 'none' } }, note: 'the arms bare: the shoulders are the body\'s own' }),
  wraps: () => ({ pieces: [{ kind: 'wraps' }], note: 'wraps at the wrists: the hands made the tools' }),
  collarRing: (r) => ({ pieces: [{ kind: 'collar', rise: r3(lerp(0.08, 0.18, r)) }], note: 'a standing collar ring: the top of the column finished' }),
});

/** the moves that make `target` in `genre` at register `r` */
export function silhouetteMoves(genre, target, r, d = 0.35) {
  const N = NAMED[target]; if (N) return N.moves.filter((m) => (m.from === undefined || r >= m.from) && (m.until === undefined || r < m.until)).map((m) => ({ technique: m.technique, ...TECHNIQUES[m.technique](r, d) }));
  const G = GENRES[genre]; if (!G || !G.moves[target]) return [];
  return G.moves[target].filter((m) => (m.from === undefined || r >= m.from) && (m.until === undefined || r < m.until)).map((m) => ({ technique: m.technique, ...TECHNIQUES[m.technique](r, d) }));
}
/** the outline a target reads as: an outline word itself, or a named silhouette's */
export const outlineOf = (target) => (NAMED[target] ? NAMED[target].outline : target);

// ─── the read ───
// the arms and what is worn on them are left out: a hand hanging at the hip would read as the hip
const ARM = /^(upperArm|foreArm|hand|thumb\d?|index\d?|middle\d?|ring\d?|little\d?|elbow\w*|wrist\w*|knuckle\w*|finger\w*)[RL]?$|_(upperArm|foreArm|hand)[RL]$/;
const VIEWS = Object.freeze({ front: 180, three: 150, side: 90 });
// an hourglass: its two ends alike (the lesser at least ENDS of the greater) and the waist under both by WAIST of the lesser
const NEEDLE = 0.28, COLUMN = 0.2, WAIST = 0.15, ENDS = 0.68;
/** the figure's outline, the arms left out: { outline, widths: { low, mid, high } (the widest row of each third, as a
 * share of the height), masks: { view: { res, rows } } } */
export function readSilhouette(mesh, { res = 96 } = {}) {
  // (an adornment carried by an arm, a wrap or a bracelet, is the arm's: its anchor names the carrier)
  const armOf = (v) => { const P = mesh.provenance[v]; return ARM.test(P.part) || ARM.test(String(P.anchor ?? '').split('/')[0]); };
  const keep = mesh.faces.filter((f) => !armOf(f[0]));
  const M = { ...mesh, faces: keep };
  const masks = {}; let rowsFront = null, span = 0;
  for (const [name, az] of Object.entries(VIEWS)) {
    const frame = heightFrame(M, az), m = figureMask(M, az, { res, frame });
    const rows = Array.from({ length: res }, (_, j) => { let s = ''; for (let i = 0; i < res; i++) s += m[j * res + i] ? '1' : '0'; return s; });
    masks[name] = { res, rows };
    if (name === 'front') { rowsFront = rows.map((s) => [...s].filter((c) => c === '1').length); span = Math.round(res / 1.1); }
  }
  const third = (k) => Math.max(...rowsFront.slice(Math.floor(k * span / 3), Math.floor((k + 1) * span / 3)));
  const [low, mid, high] = [third(0), third(1), third(2)], widest = Math.max(low, mid, high);
  // the X: the narrowest row of the waist's band against the widest of the shoulders' band and of the hem's third (the
  // thirds alone cannot see a waist: it sits near their boundary, under the hips' or a skirt's width)
  const band = (a, b, f) => f(...rowsFront.slice(Math.floor(a * span), Math.max(Math.floor(a * span) + 1, Math.floor(b * span))));
  const waist = band(0.5, 0.66, Math.min), shoulders = band(0.66, 0.9, Math.max), ends = Math.min(shoulders, low);
  const x = ends >= NEEDLE * span && ends >= ENDS * Math.max(shoulders, low) && waist < (1 - WAIST) * ends;
  // (read without the arms: narrow for its height under NEEDLE of it, even within COLUMN of its widest)
  const outline = widest / span < NEEDLE ? 'needle' : x ? 'hourglass' : widest - Math.min(low, mid, high) < COLUMN * widest ? 'column' : widest === mid ? 'barrel' : widest === low ? 'bell' : 'wedge';
  return { outline, widths: { low: r3(low / span), mid: r3(mid / span), high: r3(high / span), waist: r3(waist / span) }, masks };
}

/** what to do when the outline read misses its target: the third that leads, and what moves it (advice, never applied) */
export function silhouetteAdvice(target, read) {
  if (!target || read.outline === target) return null;
  const w = read.widths, lead = w.high >= w.mid && w.high >= w.low ? 'the shoulders' : w.mid >= w.low ? 'the middle' : 'the hem';
  const MOVE = { wedge: 'more at the shoulders (a breaker, a raised register) or less below them (a closer fit)', bell: 'more at the hem (a fuller cut, a longer skirt or coat)',
    column: 'the widest third brought to the others (a straight cloak or coat carries the shoulders down)', needle: 'everything closer (fit skin or fitted, no breakers)',
    hourglass: 'the shoulders and the hem both out past a cinched middle (a breaker above, a full skirt below, a fitted bodice and a belt between)',
    barrel: 'more in the middle (a padded coat, panels at the hips, a sash) or less at the shoulders and the hem' };
  return `reads ${read.outline} (low ${w.low}, mid ${w.mid}, high ${w.high} of the height): ${lead} lead${lead === 'the hem' ? 's' : ''}; for a ${target}, ${MOVE[target]}`;
}

/** the BLOCKOUT as one SVG sheet: each view's outline as flat runs, side by side, the ground line under them */
export function blockoutSvg(read, { cell = 4, fill = '#2b2f3a', title = 'blockout' } = {}) {
  const views = Object.entries(read.masks), res = views[0][1].res, w = res * cell, gap = cell * 6, W = views.length * (w + gap) - gap, H = res * cell;
  const body = views.map(([name, { rows }], vi) => {
    const x0 = vi * (w + gap); let d = '';
    // each row's filled runs as one rectangle each; the mask's row 0 is the bottom (v up)
    rows.forEach((s, j) => { const y = H - (j + 1) * cell; let i = 0; while (i < res) { if (s[i] !== '1') { i++; continue; } let k = i; while (k < res && s[k] === '1') k++; d += `M${x0 + i * cell} ${y}h${(k - i) * cell}v${cell}h${-(k - i) * cell}z`; i = k; } });
    return `<path d="${d}" fill="${fill}"/><text x="${x0 + w / 2}" y="${H + cell * 5}" text-anchor="middle" font-family="sans-serif" font-size="${cell * 3}">${name}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + cell * 7}" width="${W}" height="${H + cell * 7}"><title>${title}</title>${body}</svg>`;
}

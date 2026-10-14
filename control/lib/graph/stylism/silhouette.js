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

/** each technique: how it lowers, and the principle it serves. The register (r, 0 grounded … 1 mythic) only CHOOSES
 * among them (a mantle at grounded, pauldrons above): every size here is the believable BASELINE, and heightening is
 * the WARP stage's (index.js), after the design, within its caps */
export const TECHNIQUES = Object.freeze({
  // the shoulders broadened: a cape of cloth over them (grounded), armour standing off them (heightened)
  mantle: (r) => ({ pieces: [{ kind: 'mantle' }], note: 'a mantle over the shoulders: the line broadens without armour' }),
  pauldrons: () => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'metal', shoulder: 1.12 }], note: 'pauldrons out past the arm line (1.12 ×): the shoulders carry the shape' }),
  shoulderPlates: () => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'metal', shoulder: 1.1 }], note: 'shoulder plates just past the arm line (1.1 ×)' }),
  shoulderPads: () => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'base', shoulder: 1.06 }], note: 'padded shoulders (1.06 × the arm line), in the jacket\'s own cloth' }),
  boxyJacket: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: r < 0.5 ? 'hip' : 'waist', fit: 'loose', open: true } }, note: 'a boxy jacket, loose and short: width at the shoulders, none below' }),
  // the legs kept close, so the shoulders read against them
  closeLegs: () => ({ language: { bottom: { kind: 'trousers', cut: 'skinny' } }, note: 'the legs cut skinny: a narrow base under a broad top' }),
  closeFit: () => ({ language: { top: { fit: 'skin' }, bottom: { kind: 'trousers', fit: 'fitted', cut: 'skinny' } }, note: 'everything close: the body\'s own line, narrow for its height' }),
  // the weight low: cloth that falls and spreads
  robe: (r) => ({ pieces: [{ kind: r >= 0.6 ? 'wizardRobe' : 'robe', flare: 0.18 }], note: `a ${r >= 0.6 ? 'wizard\'s robe' : 'robe'} to the ankle, flaring as it falls: the weight sits low` }),
  straightRobe: () => ({ pieces: [{ kind: 'robe', flare: 0.02 }], note: 'a robe falling straight: one even mass from shoulder to hem' }),
  straightCloak: () => ({ pieces: [{ kind: 'cloak', flare: 0, wrap: 0.55 }], note: 'a cloak falling straight from the shoulders: their width carried to the hem' }),
  cloak: () => ({ pieces: [{ kind: 'cloak', flare: 0.14 }], note: 'a cloak over it, spreading as it falls' }),
  hoodedCloak: (r) => ({ pieces: [{ kind: 'cloak', hood: true, wrap: 0.5, flare: 0 }], note: 'a narrow hooded cloak hanging straight: the hood lifts the top, the hem stays close' }),
  longCoat: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'maxi', cut: r >= 0.5 ? 'full' : 'aline', open: true } }, note: `a long coat to the shin, cut ${r >= 0.5 ? 'full' : 'a-line'}: it spreads as it falls` }),
  straightCoat: () => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'midi', cut: 'pencil', fit: 'loose', open: true } }, note: 'a long straight coat, loose from the chest: one even mass from the shoulders to the hem' }),
  // the middle widened: a band of weight at the waist, plates or panels at the hips
  sash: () => ({ pieces: [{ kind: 'sash' }], note: 'a sash at the waist: a horizontal band where the eye lands' }),
  tassets: () => ({ language: { panels: [{ at: 'sides', length: 'mini', width: 0.55, cut: 'full', rigidity: 'stiff' }] }, note: 'short full panels at the hips: the middle stands out, the legs below stay narrow' }),
  gambeson: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'tunic', fit: 'loose', cut: 'full' } }, note: 'a padded coat to the thigh, loose: the mass in the middle' }),
  parka: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'tunic', fit: 'loose', cut: 'full' } }, note: 'a loose parka to the thigh: the mass in the middle' }),
  oversizedTop: () => ({ language: { top: { fit: 'loose', hem: 'tunic' } }, note: 'an oversized top to the hip: the mass in the middle' }),
  harness: () => ({ pieces: [{ kind: 'harness' }], note: 'a harness over the chest: the middle crossed and weighted' }),
  // ── the named silhouettes' signatures (silhouettes.js); ◐ marks a stand-in until its own technique lands
  secondSkin: () => ({ language: { top: { family: 'knit', sleeve: 'long', hem: 'hip', fit: 'skin' }, bottom: { kind: 'trousers', family: 'knit', leg: 'long', fit: 'skin' } }, note: 'a second-skin suit: the body\'s own line, nothing to catch on' }),
  fittedCoat: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: r >= 0.5 ? 'midi' : 'knee', cut: 'pencil', fit: 'fitted', open: true, collar: true } }, note: 'a fitted long coat, open: one clean vertical over the suit' }),
  utilityBelt: () => ({ language: { focal: 'belt' }, pieces: [{ kind: 'satchel' }], note: 'a belt with a holster at the hip: the one functional break in the line' }),
  tallBoots: () => ({ language: { feet: 'boots' }, note: 'tall boots: the leg finished in one dark mass' }),
  highCollar: () => ({ pieces: [{ kind: 'collar', rise: 0.09, flare: 1.6 }], note: '◐ a high collar (a standing collar behind the neck until the collar shapes)', approx: 'high collar' }),
  shortFullSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'mini', cut: 'full' } }, note: 'a short full skirt: the bell made small and lively' }),
  shortFullDress: () => ({ pieces: [{ kind: 'gown', hem: 'thigh', flare: 0.5 }], note: 'a short dress flaring hard from the waist: the width at the hips, the legs bare below' }),
  spaulder: () => ({ pieces: [{ kind: 'pauldron', colour: 'metal', shoulder: 1.14 }], note: 'one armoured shoulder: the line broken on one side, the fighter\'s lead' }),
  kneeFullSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'knee', cut: 'full' } }, note: 'a full skirt to the knee, with volume under it' }),
  fullLongSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'maxi', cut: 'full' } }, note: 'a full skirt to the ankle: the low half of the X' }),
  longSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'maxi', cut: 'aline' } }, note: 'an a-line skirt to the ankle: the low half of the X, as wide as the shoulders above it' }),
  pleatedSkirt: () => ({ language: { bottom: { kind: 'skirt', leg: 'knee', cut: 'full' } }, note: '◐ a pleated skirt (a full skirt to the knee until pleats: pleats spread it the same way)', approx: 'pleats' }),
  bows: (r, d) => { const at = d >= 0.7 ? ['back', 'collar', 'wrists'] : d >= 0.35 ? ['back', 'collar'] : ['back'];
    return { pieces: at.map((a) => ({ kind: 'bow', at: a, tails: a === 'wrists' ? 0.11 : 0.28, width: 0.034 })), note: `bows at the ${at.join(', the ')}, their tails flowing: ${at.length} by the detail` }; },
  neckerchief: () => ({ pieces: [{ kind: 'bow', at: 'collar', tails: 0.14 }], note: 'a neckerchief bow at the collar: the focal under the face' }),
  sailorCollar: () => ({ pieces: [{ kind: 'mantle', clasp: false }], language: { top: { family: 'woven', collar: true } }, note: '◐ a sailor collar (a mantle over the shoulders until the square flap)', approx: 'sailor collar' }),
  cinchedBodice: () => ({ language: { top: { family: 'woven', fit: 'fitted' }, focal: 'belt' }, pieces: [{ kind: 'sash' }], note: 'a fitted bodice cinched at the waist: the narrow middle of the X' }),
  puffShoulders: () => ({ pieces: [{ kind: 'pauldron', pair: true, colour: 'base', shoulder: 1.15 }], note: '◐ puffed shoulders (soft shoulder caps until puff sleeves)', approx: 'puff sleeves' }),
  gown: () => ({ pieces: [{ kind: 'gown', hem: 'ankle', flare: 0.3 }], note: 'a gown: a fitted bodice over a skirt full to the ankle' }),
  hakama: () => ({ language: { bottom: { kind: 'skirt', family: 'woven', leg: 'maxi', cut: 'aline' } }, note: '◐ a hakama (a full skirt to the ankle until divided, pleated trousers)', approx: 'hakama' }),
  wideTrousers: () => ({ language: { bottom: { kind: 'trousers', family: 'woven', leg: 'long', cut: 'wide' } }, note: 'wide trousers falling from the hip (◐ hakama pleats later)', approx: 'hakama pleats' }),
  wideSleevedTop: () => ({ pieces: [{ kind: 'tunic', sleeve: 'bell', bell: 0.1, hem: 'thigh', flare: 0.04 }], note: 'an over-robe with wide sleeves, to the thigh' }),
  ankleDress: () => ({ language: { top: { family: 'woven', fit: 'fitted' }, bottom: { kind: 'skirt', leg: 'maxi', cut: 'pencil' }, dress: true }, note: 'a fitted dress to the ankle, one cloth: the line unbroken (◐ side slits later)', approx: 'side slits' }),
  mandarinCollar: () => ({ pieces: [{ kind: 'collar', rise: 0.05, flare: 1.4 }], note: '◐ a mandarin collar (a low standing collar until the collar shapes)', approx: 'mandarin collar' }),
  sidePanels: () => ({ language: { panels: [{ at: 'sides', length: 'mini', width: 0.3, rigidity: 'soft' }] }, note: 'short panels at the hips, swinging' }),
  scarf: () => ({ pieces: [{ kind: 'bow', id: 'scarf', at: 'collar', loops: false, tails: 0.55, colour: 'accent' }], note: 'a scarf at the throat, its tails long and flowing: the motion line' }),
  tabard: () => ({ language: { panels: [{ at: 'front', length: 'knee', width: 0.4 }, { at: 'back', length: 'knee', width: 0.4 }] }, note: 'a tabard front and back: the vertical of a knight' }),
  chestPlate: () => ({ pieces: [{ kind: 'chestPlate', cut: 'cuirass', colour: 'metal' }], note: 'a breastplate from the collarbone to the waist: the chest a hard plane' }),
  duster: (r) => ({ language: { outer: { family: 'woven', sleeve: 'long', hem: 'maxi', cut: 'aline', open: true, collar: true } }, note: 'a duster to the shin, open: it swings behind the stride' }),
  sleeveless: () => ({ language: { top: { sleeve: 'none' } }, note: 'the arms bare: the shoulders are the body\'s own' }),
  wraps: () => ({ pieces: [{ kind: 'wraps' }], note: 'wraps at the wrists: the hands made the tools' }),
  collarRing: () => ({ pieces: [{ kind: 'collar', rise: 0.11 }], note: 'a standing collar ring: the top of the column finished' }),
});

/** the moves that make `target` in `genre` at register `r` */
export function silhouetteMoves(genre, target, r, d = 0.35) {
  // each piece carries its technique's note as its reason (outfit-plan.js `outfitLaws`: every piece has a reason)
  const lower = (m) => { const T = TECHNIQUES[m.technique](r, d); return { technique: m.technique, ...T, ...(T.pieces ? { pieces: T.pieces.map((p) => ({ ...p, why: T.note })) } : {}) }; };
  const N = NAMED[target]; if (N) return N.moves.filter((m) => (m.from === undefined || r >= m.from) && (m.until === undefined || r < m.until)).map(lower);
  const G = GENRES[genre]; if (!G || !G.moves[target]) return [];
  return G.moves[target].filter((m) => (m.from === undefined || r >= m.from) && (m.until === undefined || r < m.until)).map(lower);
}
/** the outline a target reads as: an outline word itself, or a named silhouette's */
export const outlineOf = (target) => (NAMED[target] ? NAMED[target].outline : target);

// ─── the read ───
// the arms and what is worn on them are left out: a hand hanging at the hip would read as the hip
const ARM = /^(upperArm|foreArm|hand|thumb\d?|index\d?|middle\d?|ring\d?|little\d?|elbow\w*|wrist\w*|knuckle\w*|finger\w*)[RL]?$|_(upperArm|foreArm|hand)[RL]$/;
const VIEWS = Object.freeze({ front: 180, three: 150, side: 90 });
// an hourglass: its two ends alike (the lesser at least ENDS of the greater) and the waist under both by WAIST of the lesser
const NEEDLE = 0.28, COLUMN = 0.2, WAIST = 0.15, ENDS = 0.68;
// a GAP: a mass of the outline standing apart from the figure by more than two pixels of the mask (a belted panel
// hanging a finger's width off the leg is one shape), at least ISLAND of the figure's own area (a speck under it is a thin
// tail broken by the mask's resolution, not a shape)
const ISLAND = 0.015;
/** the masses of one mask apart from the largest, as shares of it (8-connected over the mask grown by a pixel, so a seam of two closes;
 * specks under ISLAND left out) */
export function islandsOf(rows) {
  const H = rows.length, W = rows[0].length, seen = new Uint8Array(H * W), sizes = [];
  const on = new Uint8Array(H * W);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (rows[j][i] === '1') for (let a = Math.max(0, j - 1); a <= Math.min(H - 1, j + 1); a++) for (let b = Math.max(0, i - 1); b <= Math.min(W - 1, i + 1); b++) on[a * W + b] = 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!on[j * W + i] || seen[j * W + i]) continue;
    let n = 0; const st = [j * W + i]; seen[j * W + i] = 1;
    while (st.length) { const q = st.pop(), a = (q / W) | 0, b = q % W; n++;
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const c = a + da, d = b + db;
        if (c >= 0 && c < H && d >= 0 && d < W && on[c * W + d] && !seen[c * W + d]) { seen[c * W + d] = 1; st.push(c * W + d); } } }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return sizes.slice(1).filter((n) => n >= ISLAND * sizes[0]).map((n) => r3(n / sizes[0]));
}
// a FLOATING piece: a worn adornment (layer 3) no point of which comes within FLOAT (× the figure's scale) of the body,
// its cloth or another worn piece: it hovers, a gap all round it (a plate seated on the shoulder stands a cloth's
// clearance off it, never this). Hair and the face (layer 2) hold nothing up.
const FLOAT = 0.03;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** the distance from p to the triangle abc */
function triDist(p, a, b, c) {
  const ab = sub3(b, a), ac = sub3(c, a), ap = sub3(p, a), d1 = dot3(ab, ap), d2 = dot3(ac, ap);
  const at = (q) => Math.hypot(...sub3(p, q)), on = (o, e, t) => at([o[0] + e[0] * t, o[1] + e[1] * t, o[2] + e[2] * t]);
  if (d1 <= 0 && d2 <= 0) return at(a);
  const bp = sub3(p, b), d3 = dot3(ab, bp), d4 = dot3(ac, bp); if (d3 >= 0 && d4 <= d3) return at(b);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return on(a, ab, d1 / (d1 - d3));
  const cp = sub3(p, c), d5 = dot3(ab, cp), d6 = dot3(ac, cp); if (d6 >= 0 && d5 <= d6) return at(c);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return on(a, ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return on(b, sub3(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return at([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}
/** the worn pieces that hover: [{ piece, gap }] (gap: its nearest approach to what could hold it, metres) */
export function floatingOf(mesh) {
  const V = mesh.vertices, P = mesh.provenance;
  let lo = Infinity, hi = -Infinity; for (const v of V) { if (v[2] < lo) lo = v[2]; if (v[2] > hi) hi = v[2]; }
  const lim = FLOAT * Math.max(0.5, (hi - lo) / 1.75);
  // a piece is an adornment and what rides on it (`adorn.<id>`, its signatures `adorn.<id>.sig…`)
  const pieceOf = (i) => { const m = /^adorn\.([^.]+)/.exec(P[i].part ?? ''); return m ? m[1] : null; };
  const holds = (i) => P[i].layer !== 2;
  const own = {}; V.forEach((_, i) => { const q = pieceOf(i); if (q) (own[q] ??= []).push(i); });
  // the triangles that could hold a piece, with their boxes
  const tris = []; for (const f of mesh.faces) { if (!holds(f[0])) continue; for (let t = 1; t + 1 < f.length; t++) { const T = [V[f[0]], V[f[t]], V[f[t + 1]]];
    tris.push({ T, q: pieceOf(f[0]), min: [0, 1, 2].map((k) => Math.min(T[0][k], T[1][k], T[2][k])), max: [0, 1, 2].map((k) => Math.max(T[0][k], T[1][k], T[2][k])) }); } }
  const out = [];
  for (const [q, idx] of Object.entries(own)) {
    let best = Infinity;
    for (const i of idx) { const p = V[i];
      for (const t of tris) { if (t.q === q || [0, 1, 2].some((k) => p[k] < t.min[k] - lim || p[k] > t.max[k] + lim)) continue;
        const d = triDist(p, ...t.T); if (d < best) best = d; if (best <= lim) break; }
      if (best <= lim) break; }
    // a hovering piece: how far it stands off (every triangle, no box)
    if (best > lim) { for (const i of idx) for (const t of tris) if (t.q !== q) best = Math.min(best, triDist(V[i], ...t.T)); out.push({ piece: q, gap: r3(best) }); }
  }
  return out;
}
/** the figure's outline, the arms left out: { outline, widths: { low, mid, high } (the widest row of each third, as a
 * share of the height), islands: { view: [share…] } (the masses standing apart in the outline), floating: [{ piece,
 * gap }] (the worn pieces that hover), cohesive (neither: the figure is one shape), masks: { view: { res, rows } } } */
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
  const islands = Object.fromEntries(Object.entries(masks).map(([v, m]) => [v, islandsOf(m.rows)])), floating = floatingOf(mesh);
  return { outline, widths: { low: r3(low / span), mid: r3(mid / span), high: r3(high / span), waist: r3(waist / span) }, islands, floating,
    cohesive: Object.values(islands).every((x) => !x.length) && !floating.length, masks };
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

/** what to do when the outline breaks into islands: where they stand apart, and what bridges them (advice, never applied) */
export function cohesionAdvice(read) {
  const at = Object.entries(read.islands).filter(([, x]) => x.length), fl = read.floating || [];
  const said = [...fl.map((f) => `${f.piece} hovers ${f.gap === null ? 'apart' : `${Math.round(f.gap * 100)} cm off the figure`}`),
    ...at.map(([v, x]) => `the ${v} outline has ${x.length} mass${x.length > 1 ? 'es' : ''} apart (${x.map((n) => `${Math.round(n * 100)}%`).join(', ')} of the figure)`)];
  return { where: [...fl.map((f) => f.piece), ...at.map(([v]) => `${v} outline`)].join(', '), why: `the figure is not one shape: ${said.join('; ')} — seat what floats on the body or bridge it (a mantle under plates, a belt over a panel), or name a detached genre (alien) for whom the gap is the point` };
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

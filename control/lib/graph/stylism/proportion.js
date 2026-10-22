/**
 * proportion.js — THE PROPORTION STAGE and THE BALANCE: the principles of docs/garment-principles.md that a stylism can
 * apply with its words alone, before the outfit is made. Opt in by naming the CANON the outfit is designed to
 * (`stylism.canon: 'western' | 'anime'`, the bands dress-outline.js reads in); absent, the stylism is as it was.
 *
 *   the PROPORTION stage   each length word the stylism chose (never the hero's own) judged by where it lands on the
 *                          figure, a share of the stature down from the crown (LANDINGS on the realistic body,
 *                          GAME_LANDINGS on the authored game body, each measured on its body), and moved to the
 *                          nearest word of its slot that lands well when it does not:
 *                          - the trunk's hem (the outer layer's, else a top worn out): never at halves, and over
 *                            mid-thigh only if the leg still reads long (the canon's leg line)
 *                          - a hem down the leg (a skirt's, a coat's, a trouser leg's): never on the thigh's top or the
 *                            calf's belly
 *   the BALANCE            `stylism.silhouette: 'balance'`: the target outline picked for the figure (its cast and its
 *                          physique) by the canon's dressing rules (BALANCE), each with why
 *
 *   proportionMoves(language, own, canon, body?) → { language, notes }   own: the hero's own language (what it says
 *                          stands); body 'realistic' (the default) or 'game', whose landings it judges by
 *   balanceOf(hero, canon) → { target, why }
 * Pure; words in, words out. The outline read (dress-outline.js) checks the made figure.
 */
import { OUTLINE_BANDS } from '../polygonizer/dress-outline.js';

export const CANONS = Object.freeze(Object.keys(OUTLINE_BANDS));

/** where each length word's hem lands on the realistic body, a share of the stature down from the crown, by slot: the
 * top's `hem`, the outer layer's (`coat`), a skirt's and a trouser leg's (`leg`). Measured: each word minted on the
 * realistic male and female and its garment's lowest point read (the two within a hundredth; their mean). On this body
 * the top's pieces end where the pelvis does, so a top's `hip` lands above the hip joint and its `tunic` just under it */
export const LANDINGS = Object.freeze({
  hem: Object.freeze({ crop: 0.3, waist: 0.375, hip: 0.394, tunic: 0.481 }),
  coat: Object.freeze({ waist: 0.36, hip: 0.394, tunic: 0.481, knee: 0.724, midi: 0.807, maxi: 0.944 }),
  skirt: Object.freeze({ micro: 0.488, mini: 0.547, knee: 0.724, midi: 0.807, maxi: 0.944 }),
  leg: Object.freeze({ brief: 0.525, short: 0.555, knee: 0.733, capri: 0.829, long: 0.952 }),
});
/** the same on the authored GAME body (the hero without `form`), measured the same way (a cropped woven top once its
 * buttons stayed on it; briefs by their seat): its trunk is longer for its height, so a top's and a coat's hems from the
 * waist to the tunic land 4 to 5 hundredths lower than on the realistic body, which under the anime canon's leg line
 * moves a waist or hip hem the realistic body keeps; down the leg the two bodies agree within about two hundredths */
export const GAME_LANDINGS = Object.freeze({
  hem: Object.freeze({ crop: 0.334, waist: 0.418, hip: 0.44, tunic: 0.518 }),
  coat: Object.freeze({ waist: 0.339, hip: 0.444, tunic: 0.522, knee: 0.732, midi: 0.813, maxi: 0.946 }),
  skirt: Object.freeze({ micro: 0.504, mini: 0.562, knee: 0.732, midi: 0.813, maxi: 0.946 }),
  leg: Object.freeze({ brief: 0.539, short: 0.578, knee: 0.743, capri: 0.84, long: 0.966 }),
});
/** the figure's levels the rules read, the same way, off the bare realistic body (the game body's within a hundredth:
 * its mid-thigh 0.587 too, its crotch 0.52, its calf's belly 0.80): mid-thigh; the thigh's top (from the
 * crotch while the thigh is at its widest); the calf's belly (where the bare shank is within a fifth of its widest below
 * the knee, the knee itself not counted: a hem just under the knee slims) */
export const LEVELS = Object.freeze({ midThigh: 0.587, thigh: [0.515, 0.575], calf: [0.75, 0.865] });

/** THE BALANCE: the outline a figure is dressed toward, per canon, cast and physique, and why (the dressing rules) */
export const BALANCE = Object.freeze({
  western: Object.freeze({
    male: Object.freeze({
      athletic: ['wedge', 'the body is already a V in band: the outfit carries it, a natural shoulder'],
      skinny: ['wedge', 'a lithe figure takes width by structure and layers at the shoulder'],
      jacked: ['column', 'broad shoulders over a narrow waist: no padding, the cloth follows the drop and the volume goes below'],
      heavyset: ['column', 'a heavy figure wants one long vertical run, medium-stiff cloth standing a little off, never a balloon'],
    }),
    female: Object.freeze({
      athletic: ['hourglass', 'shoulders and hips near equal: mark the waist between them'],
      skinny: ['hourglass', 'a lithe figure takes width by structure at the shoulder and a marked waist'],
      jacked: ['hourglass', 'a strong figure: shoulders balanced by a skirt from the hip, the waist marked'],
      heavyset: ['column', 'a heavy figure wants one long vertical run, never cling and never a balloon'],
    }),
  }),
  anime: Object.freeze({
    male: Object.freeze({
      athletic: ['wedge', 'the drawn male is a V: the canon'],
      skinny: ['wedge', 'the drawn male is a V: width at the shoulder'],
      jacked: ['wedge', 'the drawn male is a V, and this one carries it already'],
      heavyset: ['column', 'a heavy figure wants one long vertical run'],
    }),
    female: Object.freeze({
      athletic: ['hourglass', 'the drawn female is an X: the waist marked'],
      skinny: ['hourglass', 'the drawn female is an X: the waist marked'],
      jacked: ['hourglass', 'the drawn female is an X: the waist marked'],
      heavyset: ['hourglass', 'the drawn female is an X even heavy: the waist marked, the skirt from the hip'],
    }),
  }),
});

const physiqueWord = (p) => (typeof p === 'string' ? p : p && typeof p === 'object' ? ((p.weight ?? 0) > 0.5 ? 'heavyset' : (p.bulk ?? 0) > 0.5 ? 'jacked' : (p.weight ?? 0) < -0.5 ? 'skinny' : p.from ?? 'athletic') : 'athletic');
const castWord = (c) => (c === 'female' || c?.pole === 'female' ? 'female' : 'male');

/** the outline a figure is dressed toward (see the head of this file) */
export function balanceOf(hero, canon = 'western') {
  const cast = castWord(hero.cast), phys = physiqueWord(hero.physique), row = BALANCE[canon]?.[cast];
  const [target, why] = row?.[phys] ?? row?.athletic ?? ['wedge', 'the canon\'s default'];
  return { target, why: `${cast}, ${phys}: ${why}` };
}

/** THE PROPORTION STAGE (see the head of this file): the language with its lengths moved, and a note for each move */
export function proportionMoves(language, own = {}, canon = 'western', body = 'realistic') {
  const LANDS = body === 'game' ? GAME_LANDINGS : LANDINGS, B = OUTLINE_BANDS[canon], L = Object.fromEntries(Object.entries(language).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : v])), notes = [];
  const halves = (f) => f >= B.halves[0] && f <= B.halves[1], within = ([a, c]) => (f) => f >= a && f <= c, onCalf = within(LEVELS.calf), onThigh = within(LEVELS.thigh);
  // (the trunk's hem: never at halves; over mid-thigh only with the leg line kept, the first division above mid-thigh
  // read from the ground)
  const trunkOk = (f) => !halves(f) && (f >= LEVELS.midThigh || 1 - f >= B.legLine);
  const move = (slot, key, table, ok, principle) => {
    const S = L[slot]; if (!S || typeof S !== 'object' || own[slot]?.[key] !== undefined || S[key] === undefined) return;
    const words = Object.keys(LANDS[table]), w = S[key], i = words.indexOf(w); if (i < 0) return;
    const f = LANDS[table][w]; if (ok(f)) return;
    const best = words.map((x, j) => ({ x, j, f: LANDS[table][x] })).filter((c) => ok(c.f)).sort((a, b) => Math.abs(a.j - i) - Math.abs(b.j - i) || Math.abs(a.f - f) - Math.abs(b.f - f))[0];
    if (!best) return;
    S[key] = best.x;
    notes.push({ stage: 'proportion', technique: `${slot}.${key} ${w} → ${best.x}`, where: `the ${slot}'s hem`, principle, why: `${w} lands at ${f} of the height down; ${best.x} at ${best.f}` });
  };
  const outer = L.outer && L.outer !== false;
  if (outer) move('outer', 'hem', 'coat', (f) => trunkOk(f) && !onCalf(f), 'the dominant division on thirds, never at halves; a hem off the calf\'s widest');
  else if (L.top && L.top !== false && L.tuck !== true) move('top', 'hem', 'hem', trunkOk, 'the dominant division on thirds, never at halves; the leg line kept');
  if (L.bottom && L.bottom !== false) move('bottom', 'leg', L.bottom.kind === 'skirt' ? 'skirt' : 'leg', (f) => !onCalf(f) && !onThigh(f) && !(L.bottom.kind === 'skirt' && halves(f)), 'a hem never on the limb\'s widest (the thigh\'s top, the calf\'s belly)');
  return { language: L, notes };
}

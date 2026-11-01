/**
 * THE FEATURE TUNE: the operator's hand on a feature-style animal (docs/feature-style.md, Tuning). The grammar reads a
 * species' card and makes its build; the tune moves that build the way an art director moves a model sheet, by the
 * principle's own two halves, and sets how much detail the model is made at.
 *
 *   STRUCTURE    the masses' sizes, each a multiplier on the species' designed size (1 as designed): `head`, `girth`
 *                (the body's breadth and depth), `legs`, `arms`, `hands`, `feet`, `tail`, `ears`, `muzzle`, `eyes`,
 *                `neck`. The trunk's and the limbs' sizes move the silhouette BEFORE the function fits it
 *                (feature-function.js), so a tuned quadruped still drops onto all fours with its paws on the floor (a
 *                short arm asked of one is lengthened back as far as reaching the floor needs; the build says so)
 *   DECORATION   the decoration dials (feature-grammar.js FEATURE_DECOR: `tufts`, `crown`, `markings`, `horns`,
 *                `spines`, `mane`, `fins`): 1 the designed amount, 0 none, more bolder. A dial never moves a mass
 *   TUFT         the head's tuft (feature-tufts.js): a look from the library (a mohawk, a cowlick, a crest, a topknot,
 *                spikes, a fringe, a mop, a pompadour, the designed swept fan, or none), its colour and its size; any animal
 *                of the style wears one, in place of its designed crown
 *   DETAIL       the model's tier (FEATURE_DETAIL): `game`, the default game model; `gen7`, a hero model of the
 *                seventh console generation's HD era: a denser skin, the fur's secondary clumps (a fuller cheek fan,
 *                tufts at the shoulders, the elbows, the chest and the haunches), a feathered wing's coverts or a
 *                scaled back's second row, and its light baked into the corners (occlusion, a sky light, warm fur and
 *                glossy eyes and nose: surface-bake.js, inline finishes), carried by every lit export
 *
 *   FEATURE_TUNE        each structure dial's range; FEATURE_DETAIL the tiers; DETAIL_WORDS
 *   validateTune(tune)  → error strings ({ structure?, decoration?, detail? })
 *   resolveTune(tune)   → { structure (every dial, 1 where unasked), decor (the asked decoration dials), detail (a
 *                         FEATURE_DETAIL tier, its name in `.id`) }
 *   readTuneBrief(brief) → { tune, facets, read, rest }: the brief's tuning words (`big ears`, `long legs`, `chunky`,
 *                         `7th gen`, `ps3`): `rest` the brief without them, for the mascot's own lexicon
 *   tunedSilhouette(S, structure) → the silhouette with its trunk's girth and its limbs' lengths moved
 *   detailBake(plan)    → the gen7 tier's bake (surface-bake.js): the plan's skin's finish over every group, the eyes' and
 *                         the nose's gloss, the horns' and the hooves' polish
 *
 * Absent, nothing here runs: an untuned sheet compiles byte for byte as before. Pure: data and arithmetic.
 */
import { FEATURE_DECOR, FEATURE_PROPORTION } from './feature-grammar.js';
import { refit } from './feature-function.js';
import { validateTuft, resolveTuft } from './feature-tufts.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const isPlain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** THE STRUCTURE DIALS: each a multiplier on the designed size, its range */
export const FEATURE_TUNE = Object.freeze({
  head: [0.6, 1.8], girth: [0.6, 1.8], legs: [0.6, 2], arms: [0.6, 1.8], hands: [0.6, 2], feet: [0.6, 2],
  tail: [0.4, 2.5], ears: [0.5, 2.5], muzzle: [0.5, 2], eyes: [0.6, 1.8], neck: [0.6, 2.5],
});
/** THE FAMILIES' DESIGNED SIZES: where a family's animals read off on the style's shared silhouettes (the eyes gate's
 *  sheets: a bear's head lost on its barrel, a canine's face too short for its name, a cat's too long, a deer's and a
 *  horse's legs and necks too short to stand as theirs), its structure dials set as designed, under the operator's
 *  (the two multiply). A family absent here is drawn as its silhouette is */
export const FAMILY_SIZES = Object.freeze({
  ursine: Object.freeze({ head: 1.15, ears: 1.15 }),
  canine: Object.freeze({ muzzle: 1.25, ears: 1.1 }),
  feline: Object.freeze({ head: 1.06, muzzle: 0.85, ears: 1.1 }),
  cervid: Object.freeze({ legs: 1.12, neck: 1.25, muzzle: 1.1 }),
  equine: Object.freeze({ legs: 1.1, neck: 1.3, muzzle: 1.15 }),
});

/** a family's designed sizes and the operator's, multiplied: null where neither moves a dial */
export function sizesOf(family, structure) {
  const F = FAMILY_SIZES[family];
  if (!F && !structure) return null;
  return Object.fromEntries(Object.keys(FEATURE_TUNE).map((k) => [k, r4((F?.[k] ?? 1) * (structure?.[k] ?? 1))]));
}

/** the decoration dials' range */
export const DECOR_RANGE = Object.freeze([0, 3]);

/** THE DETAIL TIERS: the skin's net (its cell, its faces after simplifying), the figure's triangle budget, the face's
 *  globes' rings, the decoration's secondary clumps and the baked light */
export const FEATURE_DETAIL = Object.freeze({
  game: Object.freeze({ cell: 0.0075, faces: 8500, triangles: 18000, clumps: false, bake: false }),
  gen7: Object.freeze({ cell: 0.0058, faces: 16000, triangles: 34000, clumps: true, bake: true }),
});

/** the gen7 tier's finishes, inline (surface-bake.js: a ramp over the facing, the occlusion's darkening, the edge's lift,
 *  the darkening toward the feet, a part's own gradient, the lifts' lean): fur soft and warm in its shadows, feathers a
 *  little brighter at their edges, scales as the bake's own, a smooth hide as skin; the eyes and the nose wet, the horns,
 *  the hooves, the claws and the beak polished */
export const DETAIL_FINISH = Object.freeze({
  fur: Object.freeze({ sky: [[-1, 0.62], [-0.3, 0.82], [0.2, 1.0], [0.7, 1.14], [1, 1.12]], occlusion: 0.86, edge: 0.14, height: 0.14, rise: 0.1, tint: [1, 0.92, 0.82] }),
  feather: Object.freeze({ sky: [[-1, 0.66], [0, 0.92], [0.6, 1.14], [1, 1.12]], occlusion: 0.84, edge: 0.24, height: 0.1, rise: 0.16, tint: [1, 0.96, 0.9] }),
  scale: 'scale',
  smooth: Object.freeze({ sky: [[-1, 0.78], [0, 0.96], [0.7, 1.12], [1, 1.14]], occlusion: 0.6, edge: 0.1, height: 0.08, tint: [0.9, 1, 1] }),
  wet: Object.freeze({ sky: [[-1, 0.7], [0, 0.95], [0.55, 1.3], [1, 1.2]], occlusion: 0.4, edge: 0.5, height: 0, tint: [1, 1, 1] }),
  polish: Object.freeze({ sky: [[-1, 0.66], [0, 0.94], [0.6, 1.22], [1, 1.12]], occlusion: 0.6, edge: 0.45, height: 0.05, rise: 0.3, tint: [1, 0.97, 0.9] }),
});

/** the words a brief says the tier with; and the facet they imply (the tiers are the feature style's) */
export const DETAIL_WORDS = Object.freeze(['7th gen', '7th-gen', 'seventh gen', 'seventh generation', '7th generation', 'gen7', 'gen 7',
  'ps3', 'ps3-era', 'xbox 360', 'x360', '360-era', 'hd era', 'hd-era', 'high detail', 'high-detail', 'hero model']);

/** THE TUNING WORDS: a phrase → its dials (structure and decoration); later phrases win */
export const TUNE_LEXICON = Object.freeze({
  'big head': { head: 1.25 }, 'big-headed': { head: 1.25 }, 'small head': { head: 0.82 }, 'small-headed': { head: 0.82 }, 'huge head': { head: 1.5 },
  'chubby': { girth: 1.2 }, 'plump': { girth: 1.2 }, 'stout': { girth: 1.25 }, 'portly': { girth: 1.3 }, 'rotund': { girth: 1.4 },
  'slender': { girth: 0.82 }, 'slim': { girth: 0.85 }, 'skinny': { girth: 0.75 }, 'lean': { girth: 0.88 },
  'long legs': { legs: 1.35 }, 'long-legged': { legs: 1.35 }, 'leggy': { legs: 1.35 }, 'short legs': { legs: 0.8 }, 'short-legged': { legs: 0.8 }, 'stumpy': { legs: 0.75 },
  'long arms': { arms: 1.3 }, 'long-armed': { arms: 1.3 }, 'short arms': { arms: 0.8 }, 'lanky': { legs: 1.25, arms: 1.25, girth: 0.85 },
  'big hands': { hands: 1.4 }, 'big paws': { hands: 1.4, feet: 1.3 }, 'small hands': { hands: 0.8 }, 'big feet': { feet: 1.45 }, 'small feet': { feet: 0.8 },
  'big tail': { tail: 1.4 }, 'bushy tail': { tail: 1.4, tufts: 1.4 }, 'long tail': { tail: 1.35 }, 'small tail': { tail: 0.7 }, 'short tail': { tail: 0.7 },
  'big ears': { ears: 1.45 }, 'huge ears': { ears: 1.9 }, 'small ears': { ears: 0.75 },
  'long snout': { muzzle: 1.35 }, 'long muzzle': { muzzle: 1.35 }, 'long nose': { muzzle: 1.3 }, 'short snout': { muzzle: 0.75 }, 'short muzzle': { muzzle: 0.75 }, 'flat face': { muzzle: 0.6 },
  'big eyes': { eyes: 1.3 }, 'small eyes': { eyes: 0.8 }, 'long neck': { neck: 1.6 }, 'long-necked': { neck: 1.6 }, 'short neck': { neck: 0.7 },
  'fluffy': { tufts: 1.5, crown: 1.3 }, 'shaggy': { tufts: 1.8, crown: 1.6 }, 'sleek': { tufts: 0.4, crown: 0.3 }, 'smooth-coated': { tufts: 0, crown: 0 },
  'bold markings': { markings: 1.5 }, 'plain coat': { markings: 0 }, 'unmarked': { markings: 0 },
  // (the head's tuft: feature-tufts.js)
  'mohawk': { tuft: 'mohawk' }, 'mohican': { tuft: 'mohawk' }, 'cowlick': { tuft: 'cowlick' }, 'crested': { tuft: 'crest' }, 'head crest': { tuft: 'crest' },
  'topknot': { tuft: 'plume' }, 'plumed': { tuft: 'plume' }, 'bangs': { tuft: 'fringe' }, 'fringe': { tuft: 'fringe' }, 'pompadour': { tuft: 'pompadour' },
  'quiff': { tuft: 'pompadour' }, 'spiky hair': { tuft: 'spikes' }, 'spiky crown': { tuft: 'spikes' }, 'mop top': { tuft: 'mop' }, 'mop-top': { tuft: 'mop' },
  'messy hair': { tuft: 'mop' }, 'bare head': { tuft: 'none' },
  'big horns': { horns: 1.5 }, 'big antlers': { horns: 1.5 }, 'hornless': { horns: 0 }, 'big spines': { spines: 1.6 }, 'spinier': { spines: 1.6 }, 'big mane': { mane: 1.5 },
});
// (the decoration's keys read when asked: the grammar imports this module, and this one its dials)
const STRUCTURE_KEYS = Object.keys(FEATURE_TUNE), decorKeys = () => Object.keys(FEATURE_DECOR);

export function validateTune(tune) {
  if (tune === undefined) return [];
  if (!isPlain(tune)) return ['tune: { structure?: { <dial>: a multiplier }, decoration?: { <dial>: 0–3 }, tuft?: a style or { style, colour?, size? }, detail?: \'game\' | \'gen7\' }'];
  const errs = [...validateTuft(tune.tuft)];
  for (const k of Object.keys(tune)) if (!['structure', 'decoration', 'tuft', 'detail'].includes(k)) errs.push(`tune.${k}: not a tune word (structure, decoration, tuft, detail)`);
  const dials = (o, name, keys, range) => {
    if (o === undefined) return;
    if (!isPlain(o)) { errs.push(`tune.${name}: { ${keys.join(' | ')}: a number }`); return; }
    for (const [k, v] of Object.entries(o)) {
      const R = Array.isArray(range) && range.length === 2 && isNum(range[0]) ? range : range[k];
      if (!keys.includes(k)) errs.push(`tune.${name}.${k}: not a ${name} dial (${keys.join(', ')})`);
      else if (!isNum(v) || v < R[0] || v > R[1]) errs.push(`tune.${name}.${k}: a number ${R[0]}–${R[1]} (1 as designed)`);
    }
  };
  dials(tune.structure, 'structure', STRUCTURE_KEYS, FEATURE_TUNE);
  dials(tune.decoration, 'decoration', decorKeys(), DECOR_RANGE);
  if (tune.detail !== undefined && !FEATURE_DETAIL[tune.detail]) errs.push(`tune.detail: one of ${Object.keys(FEATURE_DETAIL).join(', ')}`);
  return errs;
}

export function resolveTune(tune) {
  const errs = validateTune(tune);
  if (errs.length) throw new Error(`mascot: the tune refused:\n - ${errs.join('\n - ')}`);
  const T = tune ?? {}, id = T.detail ?? 'game';
  return { structure: { ...Object.fromEntries(STRUCTURE_KEYS.map((k) => [k, 1])), ...(T.structure ?? {}) }, decor: { ...(T.decoration ?? {}) }, tuft: resolveTuft(T.tuft), detail: { ...FEATURE_DETAIL[id], id } };
}

/** the longest tuning phrase, in words */
const PHRASES = [...Object.keys(TUNE_LEXICON), ...DETAIL_WORDS];
const PHRASE_MAX = Math.max(...PHRASES.map((k) => k.split(' ').length));

export function readTuneBrief(brief = '') {
  const tokens = String(brief).split(/\s+/).filter(Boolean), norm = tokens.map((t) => t.toLowerCase().replace(/[^a-z0-9'-]/g, ''));
  const structure = {}, decoration = {}, read = [], kept = [];
  let detail, tuft;
  for (let i = 0; i < tokens.length;) {
    let hit = null;
    for (let n = Math.min(PHRASE_MAX, tokens.length - i); n >= 1 && !hit; n--) {
      const phrase = norm.slice(i, i + n).join(' ');
      if (TUNE_LEXICON[phrase] || DETAIL_WORDS.includes(phrase)) hit = { phrase, n };
    }
    if (!hit) { kept.push(tokens[i]); i += 1; continue; }
    if (DETAIL_WORDS.includes(hit.phrase)) detail = 'gen7';
    else for (const [k, v] of Object.entries(TUNE_LEXICON[hit.phrase])) if (k === 'tuft') tuft = v; else (STRUCTURE_KEYS.includes(k) ? structure : decoration)[k] = v;
    read.push(hit.phrase); i += hit.n;
  }
  if (!read.length) return { tune: null, facets: {}, read, rest: brief };
  const tune = { ...(Object.keys(structure).length ? { structure } : {}), ...(Object.keys(decoration).length ? { decoration } : {}), ...(tuft ? { tuft } : {}), ...(detail ? { detail } : {}) };
  // (the tiers are the feature style's: a brief that asks for one asks for the style)
  return { tune, facets: detail ? { style: 'feature' } : {}, read, rest: kept.join(' ') };
}

/** a tune over another: its dials laid over (an explicit tune over the brief's words) */
export function mergeTune(a, b) {
  if (!a) return b ?? undefined;
  if (!b) return a;
  const structure = { ...(a.structure ?? {}), ...(b.structure ?? {}) }, decoration = { ...(a.decoration ?? {}), ...(b.decoration ?? {}) }, detail = b.detail ?? a.detail, tuft = b.tuft ?? a.tuft;
  return { ...(Object.keys(structure).length ? { structure } : {}), ...(Object.keys(decoration).length ? { decoration } : {}), ...(tuft ? { tuft } : {}), ...(detail ? { detail } : {}) };
}

/** an egg's lowest point (its extent down the z axis, its frame as feature-body.js egg() makes it) */
function lowOf(e) {
  const l = Math.hypot(...e.u) || 1, U = e.u.map((x) => x / l), h = e.hint ?? [1, 0, 0], d0 = h[0] * U[0] + h[1] * U[1] + h[2] * U[2];
  const h0 = Math.abs(d0) > 0.95 ? [0, 1, 0] : h, d = h0[0] * U[0] + h0[1] * U[1] + h0[2] * U[2], V0 = [h0[0] - U[0] * d, h0[1] - U[1] * d, h0[2] - U[2] * d], lv = Math.hypot(...V0) || 1, V = V0.map((x) => x / lv);
  const W = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
  return e.c[2] - Math.hypot(e.r[0] * U[2] * (1 + (e.e ?? 0) / 2), e.r[1] * V[2], e.r[2] * W[2]);
}

/** THE SILHOUETTE TUNED: its trunk's girth (the central masses' breadth and depth about the body's axis, the haunches,
 *  the shoulders, the hips and the limbs' radii by its root), its legs' length (everything over the hips raised or
 *  lowered; never so low the trunk meets the floor) and its arms' links. A quadruped's legs and arms are the function's
 *  to fit (`quad`: feature-function.js functional takes them as asks); the function fits what this returns */
export function tunedSilhouette(S, Z, { quad = false } = {}) {
  let T = S;
  const g = Z.girth ?? 1;
  if (g !== 1) {
    const yc = S.body.find((e) => e.name === 'belly').c[1], P = (p) => [p[0] * g, yc + (p[1] - yc) * g, p[2]], hs = Math.sqrt(g);
    T = { ...T,
      body: T.body.map((e) => (/R$/.test(e.name) ? { ...e, c: [e.c[0] * g, e.c[1], e.c[2]], r: e.r.map((x) => x * hs) } : { ...e, c: P(e.c), r: [e.r[0], e.r[1] * g, e.r[2] * g] })),
      belly: Object.fromEntries(Object.entries(T.belly).map(([k, e]) => [k, { ...e, c: P(e.c), r: [e.r[0], e.r[1] * g, e.r[2] * g] }])),
      arm: { ...T.arm, sh: P(T.arm.sh), r: T.arm.r.map((x) => x * hs) }, hip: [T.hip[0] * g, T.hip[1], T.hip[2]],
      ...(T.knee ? { knee: [T.knee[0] * g, T.knee[1], T.knee[2]] } : {}), foot: [T.foot[0] * g, T.foot[1]], tail: P(T.tail),
      back: T.back.map(([z, y]) => [z, yc + (y - yc) * g]), legGirth: (T.legGirth ?? 1) * hs };
  }
  const L = quad ? 1 : Z.legs ?? 1;
  if (L !== 1) {
    const low = Math.min(...T.body.filter((e) => !/R$/.test(e.name)).map(lowOf));
    const rise = Math.max((L - 1) * T.hip[2], -0.45 * T.hip[2], 0.06 - low);
    T = refit(T, { rise });
  }
  const A = quad ? 1 : Z.arms ?? 1;
  if (A !== 1) T = { ...T, arm: { ...T.arm, len: T.arm.len.map((x) => x * A) } };
  return T;
}

/** the gen7 tier's bake: every group in the plan's skin's finish, the eyes and the nose wet, the hard parts polished */
export function detailBake(plan) {
  const skin = { stander: 'fur', hoofed: 'fur', bird: 'feather', reptile: 'scale', orb: 'smooth' }[plan] ?? 'fur', F = DETAIL_FINISH;
  return { finish: { '*': F[skin], Sclera: 'eye', Iris: 'eye', Pupil: 'eye', Nose: F.wet, Mouth: F.wet, Horn: F.polish, Hoof: F.polish, Claw: F.polish, Beak: F.polish, Shell: F.polish } };
}

/** the gen7 tier's secondary clumps (head units, the right side's; mirrored by name): pointy details in the same
 *  falling rhythm as the designed ones, smaller, where a hero model of the era breaks its silhouette: a fur's fuller cheek
 *  fan, a crown's two more locks, a tuft at each shoulder and elbow, a fan under the chin, a tuft off each haunch and two
 *  more at a brush tail's tip; a wing's coverts; a scaled back's second, smaller row between its spines */
export function detailClumps({ plan, skin, B, S, K, D, headTuft, tail, ruffs, tuft = null }) {
  const out = [], T = D.tufts ?? 1, dl = (t, k) => (k > 0 ? { ...t, len: r4(t.len * k), r: r4(t.r * (0.6 + 0.4 * k)) } : null);
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  if (skin === 'fur' && T > 0) {
    if (ruffs) for (const t of [
      { name: 'cheekDR', root: [0.6, 0.0, 2.32], aim: [0.6, -0.4, -0.7], len: 0.26, r: 0.11, curl: 16, bend: [0, -1, -0.2], bone: 'head', join: 0.06 },
      { name: 'cheekER', root: [0.62, 0.1, 2.72], aim: [0.95, -0.1, 0.3], len: 0.24, r: 0.1, curl: 24, bend: [0, -0.4, -1], bone: 'head', join: 0.06 },
    ]) out.push(headTuft(dl(t, T)));
    if (D.crown > 0 && !K.horns && K.mane !== 'crest' && !tuft) for (const t of [
      { name: 'crownD', root: [0.22, -0.12, 3.26], aim: [0.75, 0.0, 0.8], len: 0.2, r: 0.08, curl: 18, bend: [1, 0.1, -0.4], bone: 'head', join: 0.05 },
      { name: 'crownE', root: [-0.24, 0.2, 3.24], aim: [0.2, 0.4, 1], len: 0.22, r: 0.08, curl: 22, bend: [1, 0.1, -0.4], bone: 'head', join: 0.05 },
    ]) out.push(headTuft(dl(t, D.crown)));
    const { sh, el, ARM } = B;
    // (a tuft at the shoulder's top, swept back and out; one off the elbow's point, swept back)
    out.push(dl({ name: 'shoulderTuftR', root: add3(sh, [0.02, -0.1, 0.12]), aim: [0.75, -0.45, 0.35], len: 0.3, r: 0.1, tip: 0.12, curl: 26, bend: [0, -0.6, -1], bone: 'upperArmR', join: 0.03 }, T));
    out.push(dl({ name: 'elbowTuftR', root: add3(el, mul(ARM, -0.03)), aim: [0.25, -0.95, -0.2], len: 0.26, r: 0.085, tip: 0.12, curl: 22, bend: [0, -0.2, -1], bone: 'upperArmR', join: 0.03 }, T));
    // (a fan under the chin where the head stands off the body, the front of the chest)
    if (S.neck === 'visible' || S.neck === 'long') {
      const chest = B.eggs.find((e) => e.name === 'chest'), y = chest.c[1] + chest.r[2] * 0.85, z = Math.min(S.neckZ - 0.05, chest.c[2] + chest.r[0] * 0.55);
      [[0, 0.32], [0.13, 0.26]].forEach(([x, len], i) => out.push(dl({ name: i ? 'bibR' : 'bib', root: [x, y, z], aim: [x * 2.5, 0.35, -1], len, r: 0.11, tip: 0.12, curl: 24, bend: [0, -1, 0], bone: 'torso', join: 0.04 }, T)));
    }
    // (a tuft off the haunch's back)
    const haunch = B.eggs.find((e) => e.name === 'haunchR');
    if (haunch) out.push(dl({ name: 'haunchTuftR', root: [haunch.c[0] + haunch.r[1] * 0.4, haunch.c[1] - haunch.r[2] * 0.75, haunch.c[2] + 0.05], aim: [0.45, -0.8, -0.35], len: 0.26, r: 0.09, tip: 0.12, curl: 20, bend: [0, 0, -1], bone: 'thighR', join: 0.03 }, T));
    // (two more at a brush tail's tip, the tip's fan)
    if (tail?.tip && tail.eggs.length) for (const [i, side] of [[0, 1], [1, -1]]) {
      const t = tail.tip;
      out.push(dl({ ...t, name: `tailTip${i ? 'B' : 'A'}`, root: add3(t.root, [0.1 * side, 0.04, -0.08]), aim: [0.35 * side, t.aim[1], t.aim[2]], len: t.len * 0.75, r: t.r * 0.75 }, T));
    }
  }
  // (a wing's coverts: three short rounded feathers over the arm's panel)
  const wing = B.eggs.find((e) => e.name === 'wingR');
  if (skin === 'feather' && wing && T > 0) {
    const { sh, el, ARM, FLAT } = B, L1 = Math.hypot(...el.map((x, k) => x - sh[k]));
    // (on the wing's outward face, where the panel stands proud of the flank: feature-grammar.js FEATURE_PROPORTION)
    const c = [ARM[1] * FLAT[2] - ARM[2] * FLAT[1], ARM[2] * FLAT[0] - ARM[0] * FLAT[2], ARM[0] * FLAT[1] - ARM[1] * FLAT[0]], l = Math.hypot(...c) || 1;
    const N = mul(c, (c[0] < 0 ? -1 : 1) / l), lift = FEATURE_PROPORTION.wingProud + FEATURE_PROPORTION.wingThick * 0.6;
    [0.2, 0.5, 0.8].forEach((t, i) => out.push(dl({ name: `covert${i}R`, root: add3(add3(add3(sh, mul(ARM, t * L1)), mul(FLAT, 0.12)), mul(N, lift)), aim: add3(mul(ARM, 0.7), mul(FLAT, -0.7)), len: 0.22, r: 0.09, tip: 0.35, curl: 8, bend: FLAT, bone: 'upperArmR', group: 'Wing', join: 0.04 }, T)));
  }
  // (a scaled back's second row: a smaller spine between each pair of the first)
  if (skin === 'scale' && (D.spines ?? 1) > 0 && !S.limbless && !K.shell) {
    const row = S.back;
    for (let i = 0; i + 1 < row.length; i++) {
      const [z0, y0] = row[i], [z1, y1] = row[i + 1];
      out.push(dl({ name: `spineB${i}`, root: [0, (y0 + y1) / 2, (z0 + z1) / 2], aim: [0, -0.4, 1], len: 0.13, r: 0.055, tip: 0.15, curl: 10, bend: [0, -1, 0], bone: i < 2 ? 'head' : i < 4 ? 'torso' : 'pelvis', group: plan === 'reptile' ? 'Patch' : 'Body', join: 0.04 }, D.spines ?? 1));
    }
  }
  return out.filter(Boolean);
}

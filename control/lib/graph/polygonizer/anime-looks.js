/** anime-looks.js — LOOKS: presets for the anime head as words that compose, the conversational surface for a character.
 *
 * One list, `look`, takes words from six tables, each found in its own (the names are disjoint across them, checked at
 * load):
 *   - ARCHETYPES (`ANIME_LOOKS`): a whole starting character over the channels — face, sculpt, hair, expression, and the
 *     body `tune` where a character needs it (head size, stature) — never the palette, cast, register or head, which stay
 *     the operator's (a look is shape, not character);
 *   - face TRAITS (`ANIME_FACE_MOVES`), graphic-face TRAITS (`ANIME_SCULPT_MOVES`, on the sculpt), hair TRAITS
 *     (`ANIME_HAIR_MOVES`, which may direct clumps), hair FAMILIES, POSES.
 * Resolved left to right: faces, sculpts and tunes by their resolvers (ratios by product, offsets by sum), hair by its
 * (the family last-wins, controls composed, clump edits summed), the pose last-wins. The operator's own face / sculpt /
 * hair / expression / tune compose ON TOP (`composeAnime`), so `/hero/face/eyeHeight 1.1` is ten percent over whatever
 * the look made; the operator's `sculpt: false` (the studio's face) sets the look's sculpt aside.
 * A look is stored as its words beside a RESOLVED stamp (`lookResolved`): a later re-tuning of a word here never changes a
 * stored row until its list is edited. Pure data and resolvers; no dice.
 */
import { ANIME_FACE, ANIME_FACE_MOVES, ANIME_HAIR_MOVES, ANIME_POSES, resolveAnimeFace, resolveAnimeHair, resolveAnimeExpression, animeDefaultStyle, ANIME_HAIR_BASE } from './anime-head.js';
import { ANIME_HAIR_STYLES } from './anime-head.js';
import { HEAD_PRESETS } from './humanoid-head.js';
import { resolveTune, castPole, castOf, lawCast } from './hero-form.js';
import { ANIME_SCULPT_MOVES, resolveAnimeSculpt } from './anime-sculpt.js';
import { genkiLayers, genkiExpression } from './anime-genki.js';

/** ARCHETYPES: starting characters (tuned for the anime head; numbers are starting points for the eyes gate). A `tune`
 * is relative to the anime proportions the anime head already wears (about 6.5 / 7 heads tall): only a character whose
 * build departs from them carries one (the kid's bigger head and shorter stature, the mentor's smaller head). Every one
 * stays inside the studio's slider ranges on both bases (tested): where two eye traits would stack past them, the
 * archetype says the ratios it means instead. */
export const ANIME_LOOKS = Object.freeze({
  heroine: { note: 'a bright lead: a round, soft face, large eyes with a slight droop, long hair with swept bangs, smiling', face: ['soft', 'large-eyes', { tilt: -0.02 }], hair: ['long', 'swept-bangs'], expression: 'smile' },
  lead: { note: 'the young lead: a short face and a set chin, spiky short hair, determined', face: ['youthful', 'strong-chin'], hair: ['short', 'spiky'], expression: 'determined' },
  rival: { note: 'the cool rival: an angular face, upturned narrow eyes, a sleek bob with one bang over the eye', face: ['sharp', 'tsurime', 'narrow-eyes'], hair: ['bob', 'sleek', 'peekaboo'], expression: 'neutral' },
  princess: { note: 'a soft, young face with large eyes, the hime cut (a blunt fringe, sidelocks at the jaw, long straight back), smiling', face: ['soft', 'large-eyes', { lower: 0.94, nose: 0.9, chinProjection: 0.96 }], hair: ['hime'], expression: 'smile' },
  mentor: { note: 'an older, calmer face with narrow eyes, sleek short hair; a smaller head', face: ['mature', { eyeHeight: 0.96, iris: 0.94 }], hair: ['short', 'sleek'], expression: 'neutral', tune: { head: 0.96 } },
  kid: { note: 'a child: a short face, a button nose, large eyes, messy short hair with an ahoge, beaming; a big head on a short body', face: ['youthful', 'button-nose', { eyeWidth: 1.04, iris: 1.04 }], hair: ['short', 'messy', 'ahoge'], expression: 'happy', tune: { head: 1.15, stature: 0.85 } },
  stoic: { note: 'an angular, narrow-eyed face with a strong chin, sleek short hair, deadpan', face: ['sharp', 'narrow-eyes', 'strong-chin'], hair: ['short', 'sleek'], expression: 'deadpan' },
});

/** every look word by table (the order a word is looked up in) */
export const LOOK_TABLES = Object.freeze({
  archetype: Object.keys(ANIME_LOOKS), face: Object.keys(ANIME_FACE_MOVES), sculpt: Object.keys(ANIME_SCULPT_MOVES), hair: [...Object.keys(ANIME_HAIR_MOVES), ...ANIME_HAIR_STYLES], pose: Object.keys(ANIME_POSES),
});
export const LOOK_WORDS = Object.freeze(Object.values(LOOK_TABLES).flat());
{ // the tables must not share a word: a word means one thing wherever the conversation says it
  const seen = new Map();
  for (const [table, words] of Object.entries(LOOK_TABLES)) for (const w of words) { if (seen.has(w)) throw new Error(`anime-looks: '${w}' is both a ${seen.get(w)} and a ${table} word`); seen.set(w, table); }
}
const tableOf = (w) => Object.entries(LOOK_TABLES).find(([, words]) => words.includes(w))?.[0];

/** Error strings (empty = valid): a look is a word or a list of words from the tables. */
export function validateLook(spec, label = 'look') {
  if (spec === undefined || spec === null) return [];
  const list = Array.isArray(spec) ? spec : [spec], errs = [];
  list.forEach((w, i) => {
    const at = Array.isArray(spec) ? `${label}[${i}]` : label;
    if (typeof w !== 'string') errs.push(`${at}: a look is a word or a list of words`);
    else if (!tableOf(w)) errs.push(`${at}: unknown look word '${w}' (archetypes ${LOOK_TABLES.archetype.join(', ')}; face ${LOOK_TABLES.face.join(', ')}; sculpt ${LOOK_TABLES.sculpt.join(', ')}; hair ${LOOK_TABLES.hair.join(', ')}; poses ${LOOK_TABLES.pose.join(', ')})`);
  });
  return errs;
}
/** a look's words → each channel's entries, in order */
export function lookEntries(spec) {
  const out = { face: [], sculpt: [], hair: [], expression: [], tune: [] };
  for (const w of (Array.isArray(spec) ? spec : [spec])) {
    const table = tableOf(w);
    if (table === 'archetype') { const L = ANIME_LOOKS[w]; for (const k of ['face', 'sculpt', 'hair', 'expression', 'tune']) if (L[k] !== undefined) out[k].push(...(Array.isArray(L[k]) ? L[k] : [L[k]])); }
    else if (table === 'face') out.face.push(w);
    else if (table === 'sculpt') out.sculpt.push(w);
    else if (table === 'hair') out.hair.push(w);
    else if (table === 'pose') out.expression.push(w);
    else throw new Error(`look: unknown word '${w}'`);
  }
  return out;
}
/** The stamp: a look's words resolved per channel. `hair.style` is null and `expression` null when the look names none;
 * `sculpt` is there only when the look names a graphic-face word. */
export function resolveLook(spec) {
  const errs = validateLook(spec); if (errs.length) throw new Error(errs.join('; '));
  const words = Array.isArray(spec) ? [...spec] : [spec], E = lookEntries(words);
  const { from: _ff, ...face } = resolveAnimeFace(E.face);
  const { from: _tf, ...tune } = resolveTune(E.tune.length ? E.tune : undefined);
  return { words, face, ...(E.sculpt.length ? { sculpt: resolveAnimeSculpt(E.sculpt) } : {}), hair: resolveAnimeHair(E.hair), expression: E.expression.length ? resolveAnimeExpression(E.expression) : null, tune };
}

/**
 * The effective head and tune: the look's stamp, then the operator's own layer on top. `sculpt` is the graphic face's
 * words (every word at its value; the head's graphic base when neither layer names one) or `false` (the studio's face).
 * `hairBase` (anime-head ANIME_HAIR_BASE[pole], the hero door's default hair): its FORM goes under every family, and its
 * CUT (a hair word) under the look and the own layer only when neither names a family — so a look or an operator that
 * names a family gets that family as designed (with the form), and one that names none keeps the base's cut. The result
 * also carries `hairWords` (the hair the WORDS made — the base's layers and the look's — which the hair advice reads past;
 * null when bald) and `hairCut` (the base's cut worn, or null).
 * @param {{ lookResolved?, face?, sculpt?, hair?, expression?, tune? }} hero  (own layers stored resolved, the sculpt
 *   sparse; `hair.style` may be null)
 * @param {string} defaultStyle  the family when none names one
 * @param {{ hairBase?: { form: object, cut: string } | null }} [options]
 */
/** THE CHILD'S FACE (hero laws 13, the child build's anime head; hero-form.js CHILD_FORM is its body): the anime child as
 * it reads, not a small adult's face. The face's words (a short lower face, round full cheeks, a small set-back chin, a
 * button nose, the head broader, the eyes and irises larger, all inside the studio's ranges; on the male base its jaw
 * and chin brought toward the female base's, `male`) and the sculpt's past them (the eyes set lower on the face and
 * opened taller, the irises larger, the mouth narrower, the nose's tip less projected, the brow thinner). Under every other layer: a look, the hero's own words and genki compose over it. */
export const CHILD_FACE = Object.freeze({
  face: Object.freeze(['youthful', 'soft', 'button-nose', Object.freeze({ eyeWidth: 1.06, eyeHeight: 1.05, iris: 1.06, width: 1.06, lower: 0.94 })]),
  sculpt: Object.freeze({ eyeLevel: -0.02, fissureHeight: 1.2, irisSize: 1.2, mouthWidth: 0.8, tipProjection: 0.8, browThick: 0.75 }),
  // the boy: the male base's long lower face, forward chin, low jaw corner and narrow opening brought toward the female
  // base's (an anime child's face is soft whichever it is), inside the male base's ranges
  male: Object.freeze({ lower: 0.92, chin: 0.8, chinProjection: 0.75, jawAngle: 1.15, eyeHeight: 1.12 }),
});
/** does this hero wear the child's face (CHILD_FACE): the child build, its word or its pole-and-build, under laws 13 */
export const childFaced = (hero) => (hero.laws ?? 1) >= 13 && castOf(lawCast(hero.cast, hero.laws).cast)?.build === 'child';

export function composeAnime(hero, defaultStyle, { hairBase = null } = {}) {
  const L = hero.lookResolved ?? null, C = childFaced(hero) ? CHILD_FACE : null;
  // GENKI (anime-genki.js): one more layer over the look and the own layer, on every channel; none when absent or 0
  const G = genkiLayers(hero);
  // (the child's face its words in order, then the boy's own: a nested list would be read as one ratio object)
  const { from: _f, ...face } = resolveAnimeFace([...(C ? C.face : []), C && heroHeadPole(hero) === 'male' ? C.male : null, L?.face, hero.face, G?.face].filter(Boolean));
  const own = hero.hair === 'none' ? 'none' : hero.hair;
  // a layer may itself be a list (a family word and its controls): its entries join the layers in order, so its family is
  // read as named and its controls and lock edits compose like any other entry's
  const layers = own === 'none' ? [] : [L?.hair, own, G?.hair].flatMap((x) => (Array.isArray(x) ? x : [x])).filter((x) => x !== undefined && x !== null);
  const named = !!hairBase && own !== 'none' && resolveAnimeHair(layers).style !== null;
  const base = hairBase && own !== 'none' ? [hairBase.form, ...(named ? [] : [hairBase.cut])] : [];
  const hair = own === 'none' ? 'none' : resolveAnimeHair([...base, ...layers]);
  if (hair !== 'none' && hair.style === null) hair.style = defaultStyle;
  const hairWords = own === 'none' ? null : resolveAnimeHair([...base, ...(Array.isArray(L?.hair) ? L.hair : [L?.hair])].filter((x) => x !== undefined && x !== null)), hairCut = hairBase && own !== 'none' && !named ? hairBase.cut : null;
  const expression = genkiExpression(hero.expression !== undefined && hero.expression !== null ? resolveAnimeExpression(hero.expression) : L?.expression ?? resolveAnimeExpression('neutral'), hero);
  const { from: _t, ...tune } = resolveTune([L?.tune, hero.tune, G?.tune].filter(Boolean));
  const sculpt = hero.sculpt === false ? false : resolveAnimeSculpt([C?.sculpt, L?.sculpt, hero.sculpt, G?.sculpt].filter((x) => x !== undefined && x !== null));
  return { face, sculpt, hair, expression, tune, hairWords, hairCut };
}
/** the hero's head pole: its `headPreset`, else the cast when that is a hero cast, else the male */
export const heroHeadPole = (hero) => { const pole = castPole(hero.cast); return hero.headPreset ?? (typeof pole === 'string' && HEAD_PRESETS[pole] ? pole : 'male'); };
/** the anime hero's effective head: the look's stamp, the own layer on top, and the hair base of its design base (its
 * form under every family, its cut when nothing names a family) — read here, never stored (the hero door and the face
 * rig read it the same way) */
export const animeHeroEffective = (hero) => { const pole = heroHeadPole(hero); return composeAnime(hero, animeDefaultStyle(pole), { hairBase: ANIME_HAIR_BASE[pole] }); };
export { ANIME_FACE };

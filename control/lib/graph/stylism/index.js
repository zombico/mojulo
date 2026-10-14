/**
 * THE STYLISM TUNER: a hero dressed the way a character designer works — the silhouette first, then value, then detail —
 * each stage a solver over principles that spends a budget, lowers to the build fields the garment kernels already
 * compile, and writes down what it chose and why. The recipe stays the source: `hero.stylism` holds WORDS, resolved on
 * every read into an ordinary outfit build (styledHero), and the notes are regenerated beside it (stylismLedger).
 *
 *   hero.stylism: { genre?, register?, detail?, silhouette?, laws? }
 *     genre       a vocabulary card (genres.js): fantasy | modern | scifi | alien — what each big shape and each detail is
 *                 made of; every genre but a DETACHED one (alien: its plates hover off the body) keeps the outline one shape
 *     register    HEIGHTENING, genre-free: grounded 0 · storybook 0.35 · heroic 0.7 · mythic 1, or 0 … 1 (Frieren's cast
 *                 to Warcraft; The Expanse to Warhammer 40,000): element scale, flare, the outfit's `stylize`, an armour
 *                 build's mass, together
 *     detail      the BUDGET: plain 0 · considered 0.35 · rich 0.7 · ornate 1, or 0 … 1 (how many techniques, never how
 *                 big: that is the register)
 *     silhouette  the target: an outline letter (silhouette.js OUTLINES) or a named silhouette (silhouettes.js: operative,
 *                 ribbon, sailor, princess, …: an outline and its signature); absent, the body's own
 *
 * PRECEDENCE: what the hero says itself wins. A solver fills only what the outfit left open: its own `language` slots,
 * dials and pieces stand over the solver's (a piece kind it already wears is not added again).
 *
 *   validateStylism(s)        → [errors]
 *   styledHero(hero)          the hero with its stylism resolved into `outfit` (and an armour build's dials); none ⇒ itself
 *   stylismLedger(hero)       the notes: { genre, register, detail, silhouette: { target, moves }, notes: [{ stage,
 *                             technique, where, principle, why }] } — what the read regenerates for the readout
 * The update law: STYLISM_LAWS_VERSION is stamped at mint; what a version resolves to is pinned
 * (stylism-laws.char.test.js). Pure and deterministic.
 */
import { GENRES, GENRE_NAMES } from './genres.js';
import { OUTLINES, silhouetteMoves, outlineOf } from './silhouette.js';
import { NAMED, NAMED_SILHOUETTES } from './silhouettes.js';

export const STYLISM_LAWS_VERSION = 1;
export const REGISTER_WORDS = Object.freeze({ grounded: 0, storybook: 0.35, heroic: 0.7, mythic: 1 });
export const DETAIL_BUDGET_WORDS = Object.freeze({ plain: 0, considered: 0.35, rich: 0.7, ornate: 1 });
const FIELDS = ['genre', 'register', 'detail', 'silhouette', 'laws'];
const r3 = (x) => Math.round(x * 1000) / 1000;
const lerp = (a, b, t) => a + (b - a) * t;
const level = (v, words) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : words[v]);

export function validateStylism(s) {
  if (s === undefined || s === null) return [];
  if (typeof s !== 'object' || Array.isArray(s)) return [`stylism: { genre?: ${GENRE_NAMES.join(' | ')}, register?: ${Object.keys(REGISTER_WORDS).join(' | ')} | 0 … 1, detail?: ${Object.keys(DETAIL_BUDGET_WORDS).join(' | ')} | 0 … 1, silhouette?: ${OUTLINES.join(' | ')} }`];
  const errs = [];
  if (s.genre !== undefined && !GENRES[s.genre]) errs.push(`stylism.genre: one of ${GENRE_NAMES.join(', ')}`);
  for (const [k, W] of [['register', REGISTER_WORDS], ['detail', DETAIL_BUDGET_WORDS]]) if (s[k] !== undefined && !(W[s[k]] !== undefined || (Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1))) errs.push(`stylism.${k}: ${Object.keys(W).join(' | ')}, or a number 0 … 1`);
  if (s.silhouette !== undefined && !OUTLINES.includes(s.silhouette) && !NAMED[s.silhouette]) errs.push(`stylism.silhouette: an outline (${OUTLINES.join(', ')}) or a named silhouette (${NAMED_SILHOUETTES.join(', ')})`);
  if (s.laws !== undefined && s.laws !== STYLISM_LAWS_VERSION) errs.push(`stylism.laws: ${s.laws} is unknown — this kernel carries stylism laws ${STYLISM_LAWS_VERSION}`);
  for (const k of Object.keys(s)) if (!FIELDS.includes(k)) errs.push(`stylism.${k}: not a stylism word (${FIELDS.filter((f) => f !== 'laws').join(', ')})`);
  return errs;
}

/** the words resolved: genre (fantasy by default), r and d in 0 … 1 */
export function resolveStylism(s) {
  return { genre: s.genre ?? 'fantasy', r: level(s.register ?? 'storybook', REGISTER_WORDS), d: level(s.detail ?? 'considered', DETAIL_BUDGET_WORDS), silhouette: s.silhouette ?? null };
}

const isOutfit = (o) => o && typeof o === 'object' && !Array.isArray(o) && o.type === 'outfit';
const isArmor = (o) => o && typeof o === 'object' && !Array.isArray(o) && o.type === 'armor';
/** a slot merged under what the hero says: the solver's fields, then the hero's own over them (a slot of another kind,
 * the hero's skirt for the solver's trousers, replaces it whole) */
const under = (solver, own) => (own === false ? false : own === undefined ? solver : solver && own.kind !== undefined && (solver.kind ?? 'trousers') !== own.kind ? { ...own } : { ...(solver || {}), ...own });

/** the stages resolved: the silhouette's moves and the register's settings, and the outfit they lower to */
function solve(hero) {
  const S = resolveStylism(hero.stylism), G = GENRES[S.genre];
  const own = isOutfit(hero.outfit) ? hero.outfit : null;
  const moves = S.silhouette ? silhouetteMoves(S.genre, S.silhouette, S.r, S.d) : [];
  // the language: the genre's base under the moves under the hero's own (slot by slot); panels are a list: the hero's
  // own stand, else the moves'
  const named = NAMED[S.silhouette], base = own || named ? {} : (G.base.language ?? {});
  const lang = {};
  for (const L of [base, ...moves.map((m) => m.language || {})]) for (const [k, v] of Object.entries(L)) lang[k] = Array.isArray(v) || typeof v !== 'object' ? v : under(lang[k], v);
  const ownLang = own?.language ?? {};
  const language = { ...lang };
  for (const [k, v] of Object.entries(ownLang)) language[k] = Array.isArray(v) || typeof v !== 'object' || v === false ? v : under(lang[k], v);
  const have = new Set((own?.pieces || []).map((p) => p.kind));
  // a DETACHED genre stands its plates off the body (a piece's own `float` stands)
  const pieces = [...(own?.pieces || []), ...moves.flatMap((m) => m.pieces || []).filter((p) => !have.has(p.kind))]
    .map((p) => (G.detached && p.kind === 'pauldron' && p.float === undefined ? { ...p, float: true } : p));
  // the register: the outfit's stylize (bigger trims, fuller flare, fewer and bigger buttons), the hero's own over it
  const stylize = r3(lerp(0.1, 0.9, S.r));
  const outfit = { type: 'outfit', style: own?.style ?? named?.base ?? G.base.style, ...(own?.laws !== undefined ? { laws: own.laws } : {}),
    dials: { ...(own?.dials || {}), stylize: own?.dials?.stylize ?? stylize },
    ...(Object.keys(language).length ? { language } : {}), ...(pieces.length ? { pieces } : {}),
    ...(own?.intent ? { intent: own.intent } : {}), ...(own?.detail ? { detail: own.detail } : {}) };
  // an armour build takes the register as its mass and stylize, its own dials over them
  const armor = isArmor(hero.adorn) ? { ...hero.adorn, dials: { stylize, mass: r3(lerp(0.8, 1.8, S.r)), ...(hero.adorn.dials || {}) } } : null;
  return { S, G, moves, outfit, armor, stylize };
}

export function styledHero(hero) {
  if (!hero?.stylism) return hero;
  if (hero.outfit !== undefined && !isOutfit(hero.outfit)) return hero;   // a word or a garment list: the hero dressed itself
  const { outfit, armor } = solve(hero);
  return { ...hero, outfit, ...(armor ? { adorn: armor } : {}) };
}

export function stylismLedger(hero) {
  if (!hero?.stylism) return null;
  const { S, G, moves, stylize } = solve(hero);
  const regWord = Object.entries(REGISTER_WORDS).reduce((b, [w, v]) => (Math.abs(v - S.r) < Math.abs(REGISTER_WORDS[b] - S.r) ? w : b), 'grounded');
  const notes = [{ stage: 'register', technique: `stylize ${stylize}`, where: 'the whole outfit', principle: 'one heightening for every element',
    why: `${regWord} (${S.r}) between ${G.register.grounded} and ${G.register.mythic}: trims, flare and fittings scale together` }];
  if (!S.silhouette) notes.push({ stage: 'silhouette', technique: 'none', where: 'the outline', principle: 'the big shapes first', why: 'no target outline: the body\'s own stands' });
  const named = NAMED[S.silhouette];
  if (named) notes.push({ stage: 'silhouette', technique: S.silhouette, where: `a ${outlineOf(S.silhouette)}`, principle: 'a type reads by its signature', why: named.reads });
  for (const m of moves) notes.push({ stage: 'silhouette', technique: m.technique, where: S.silhouette, principle: named ? 'the signature makes the type' : 'a few big masses make the outline', why: m.note });
  if (G.detached && moves.some((m) => (m.pieces || []).some((p) => p.kind === 'pauldron'))) notes.push({ stage: 'silhouette', technique: 'detached', where: 'the shoulders', principle: 'a mass apart from the body reads as other', why: `${S.genre}: the plates hover off the shoulders, the gap between them and the body the genre's own` });
  if (hero.outfit !== undefined && !isOutfit(hero.outfit)) notes.push({ stage: 'silhouette', technique: 'none', where: 'the outfit', principle: 'what the hero says wins', why: 'the outfit is a word or a garment list: the stylism leaves it as it is' });
  const approx = moves.filter((m) => m.approx).map((m) => m.approx);
  return { genre: S.genre, register: S.r, detail: S.d, silhouette: { target: S.silhouette, ...(G.detached ? { detached: true } : {}), outline: S.silhouette ? outlineOf(S.silhouette) : null, moves: moves.map((m) => m.technique), ...(approx.length ? { approximated: approx } : {}) }, notes };
}

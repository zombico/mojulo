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
import { standInPalette } from './value.js';
import { detailMoves, DETAIL_ZONES, zoneOfPiece } from './detail.js';
import { languageOf, MOTIF_NAMES } from '../outfit/expand.js';
import { CANONS, proportionMoves, balanceOf } from './proportion.js';
import { SEEDED_OUTFITS } from '../outfit/styles.js';
import { COLOUR_GROUPS } from '../polygonizer/outfit-plan.js';

export const STYLISM_LAWS_VERSION = 1;
export const REGISTER_WORDS = Object.freeze({ grounded: 0, storybook: 0.35, heroic: 0.7, mythic: 1 });
export const DETAIL_BUDGET_WORDS = Object.freeze({ plain: 0, considered: 0.35, rich: 0.7, ornate: 1 });
const FIELDS = ['genre', 'register', 'detail', 'silhouette', 'canon', 'focal', 'motif', 'laws'];
const r3 = (x) => Math.round(x * 1000) / 1000;
const lerp = (a, b, t) => a + (b - a) * t;
const level = (v, words) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : words[v]);

export function validateStylism(s) {
  if (s === undefined || s === null) return [];
  if (typeof s !== 'object' || Array.isArray(s)) return [`stylism: { genre?: ${GENRE_NAMES.join(' | ')}, register?: ${Object.keys(REGISTER_WORDS).join(' | ')} | 0 … 1, detail?: ${Object.keys(DETAIL_BUDGET_WORDS).join(' | ')} | 0 … 1, silhouette?: ${OUTLINES.join(' | ')} }`];
  const errs = [];
  if (s.genre !== undefined && !GENRES[s.genre]) errs.push(`stylism.genre: one of ${GENRE_NAMES.join(', ')}`);
  for (const [k, W] of [['register', REGISTER_WORDS], ['detail', DETAIL_BUDGET_WORDS]]) if (s[k] !== undefined && !(W[s[k]] !== undefined || (Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1))) errs.push(`stylism.${k}: ${Object.keys(W).join(' | ')}, or a number 0 … 1`);
  if (s.silhouette !== undefined && s.silhouette !== 'balance' && !OUTLINES.includes(s.silhouette) && !NAMED[s.silhouette]) errs.push(`stylism.silhouette: an outline (${OUTLINES.join(', ')}), a named silhouette (${NAMED_SILHOUETTES.join(', ')}) or 'balance' (the outline the figure is dressed toward)`);
  if (s.canon !== undefined && !CANONS.includes(s.canon)) errs.push(`stylism.canon: ${CANONS.join(' or ')} (the principles the outfit is designed to: docs/garment-principles.md)`);
  if (s.focal !== undefined && !DETAIL_ZONES.includes(s.focal)) errs.push(`stylism.focal: one of ${DETAIL_ZONES.join(', ')} (where the detail gathers)`);
  if (s.motif !== undefined && !MOTIF_NAMES.includes(s.motif)) errs.push(`stylism.motif: one of ${MOTIF_NAMES.join(', ')}`);
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

/** THE WARP: how far past the baseline the register heightens (0 at storybook and below, 1 at mythic), and the
 * outfit-plan.js distortion that carries it (`lean: false`: no side leads) */
export function warpOf(r, G) {
  const amount = r3(Math.max(0, Math.min(1, (r - REGISTER_WORDS.storybook) / (1 - REGISTER_WORDS.storybook))));
  const W = G.warp || { chunk: 1.5, flare: 1.3 };
  return { amount, distort: { amount, chunk: W.chunk, flare: W.flare, lean: false }, flare: 1 + (W.flare - 1) * amount, focal: 1 + 0.4 * amount };
}
// a piece warped: its cloth flare and its streamers by the genre's flare, the focal piece scaled (the distortion
// thickens what is rigid when the outfit compiles)
const FLARED = new Set(['robe', 'wizardRobe', 'gown', 'tunic', 'cloak']);
function warped(p, w) {
  const out = { ...p };
  if (FLARED.has(p.kind) && Number.isFinite(p.flare)) out.flare = r3(p.flare * w.flare);
  if (p.kind === 'bow' && Number.isFinite(p.tails)) out.tails = r3(p.tails * w.flare);
  if (p.role === 'focal' && p.scale === undefined) out.scale = r3(w.focal);
  return out;
}

/** the stages resolved: the silhouette's moves and the register's settings, and the outfit they lower to */
function solve(hero) {
  // (the BALANCE: 'balance' names the outline the figure is dressed toward, by the canon's rules: proportion.js)
  const S0 = resolveStylism(hero.stylism), canon = hero.stylism.canon, balance = S0.silhouette === 'balance' ? balanceOf(hero, canon ?? 'western') : null;
  const S = balance ? { ...S0, silhouette: balance.target } : S0, G = GENRES[S.genre];
  const own = isOutfit(hero.outfit) ? hero.outfit : null;
  const moves = S.silhouette ? silhouetteMoves(S.genre, S.silhouette, S.r, S.d) : [];
  // the language: the genre's base under the moves under the hero's own (slot by slot); panels are a list: the hero's
  // own stand, else the moves'
  const named = NAMED[S.silhouette], base = own || named ? {} : (G.base.language ?? {});
  const lang = {};
  for (const L of [base, ...moves.map((m) => m.language || {})]) for (const [k, v] of Object.entries(L)) lang[k] = Array.isArray(v) || typeof v !== 'object' ? v : under(lang[k], v);
  const ownLang = own?.language ?? {};
  let language = { ...lang };
  for (const [k, v] of Object.entries(ownLang)) language[k] = Array.isArray(v) || typeof v !== 'object' || v === false ? v : under(lang[k], v);
  // the PROPORTION stage (proportion.js), with a canon named: the lengths it chose moved off bad landings, the hero's
  // own standing; with the card's language under it, so a length the card sets is judged too
  const cardLang = (() => { const st = own?.style ?? named?.base ?? G.base.style, C = typeof st === 'string' ? SEEDED_OUTFITS[st] : st; return C?.language ?? {}; })();
  // (a card the hero named is the hero's words: its lengths stand as the hero's own do)
  const heroLang = own?.style !== undefined ? languageOf({ language: cardLang }, ownLang) : ownLang;
  const P = canon ? proportionMoves(languageOf({ language: cardLang }, language), heroLang, canon) : null;
  if (P?.notes.length) for (const n of P.notes) { const [slot, key] = n.technique.split(' ')[0].split('.'); language = { ...language, [slot]: { ...(language[slot] || {}), [key]: P.language[slot][key] } }; }
  const have = new Set((own?.pieces || []).map((p) => p.kind));
  // a DETACHED genre stands its plates off the body (a piece's own `float` stands)
  const shaped = [...(own?.pieces || []), ...moves.flatMap((m) => m.pieces || []).filter((p) => !have.has(p.kind))]
    .map((p) => (G.detached && p.kind === 'pauldron' && p.float === undefined ? { ...p, float: true } : p));
  // the DETAIL stage (detail.js): the budget spent from the focal out, on what the outfit shows; its fittings within the
  // restraint law (six pieces at most, the cloth counted once and its outer layer once more)
  const style = own?.style ?? named?.base ?? G.base.style, cardObj = typeof style === 'string' ? SEEDED_OUTFITS[style] : style;
  const full = languageOf(cardObj || {}, language), room = Math.max(0, 6 - shaped.length - 1 - (full.outer ? 1 : 0));
  const D = detailMoves({ G, r: S.r, d: S.d, outline: S.silhouette ? outlineOf(S.silhouette) : null, focal: hero.stylism.focal ?? named?.focal, motif: hero.stylism.motif, language: full, pieces: shaped, room, drawn: hero.head === 'anime' ? 'anime' : null, own: own?.pieces?.length ?? 0 });
  // a designed piece's own trim from the budget (its own `trim` stands over it)
  // (the hero's own pieces are left as written: the solver trims and ranks only its own)
  const ownN = own?.pieces?.length ?? 0;
  const all = [...shaped.map((p, i) => (i >= ownN && D.trims[i] ? { ...p, trim: { ...D.trims[i], ...(p.trim || {}) } } : p)), ...D.pieces.filter((p) => !have.has(p.kind))];
  // ONE FOCAL: the piece the detail gathers on leads, every other piece supports (a piece's own `role` stands)
  // (the accent is the focal's: an accent piece at the focal leads before any other there)
  const atFocal = (p) => zoneOfPiece(p) === D.focal || (['medallion', 'chain'].includes(p.kind) && ['neck', 'chest'].includes(D.focal)), accent = (p) => ['medallion', 'chain', 'bow'].includes(p.kind) && (p.colour ?? 'accent') === 'accent';
  const lead = all.some((p) => p.role === 'focal') ? -1 : [all.findIndex((p) => atFocal(p) && accent(p)), all.findIndex(atFocal)].find((i) => i >= 0) ?? -1;
  const ranked = all.map((p, i) => (i < ownN || p.role !== undefined ? p : { ...p, role: i === lead ? 'focal' : 'support' }));
  // the WARP stage: the register's heightening, applied once the design is laid out, within caps. From storybook up,
  // the cloth flares and the streamers lengthen by the genre's `flare`, the rigid pieces thicken by its `chunk`
  // (intent.distort, a pair kept a pair), and the focal piece grows; grounded and storybook are the baseline itself
  const w = warpOf(S.r, G), pieces = w.amount ? ranked.map((p, i) => (i < ownN ? p : warped(p, w))) : ranked;
  // the register: the outfit's stylize (bigger trims, fuller flare, fewer and bigger buttons), the hero's own over it
  const stylize = r3(lerp(0.1, 0.9, S.r));
  // the VALUE stage's stand-in (value.js): the roles the designed pieces wear, off the card's own cloth, until a style
  // guide's palette supplies them; the outfit's own roles and the hero's own palette groups stand over it
  const card = cardObj?.tones;
  const value = standInPalette(G, S.r, { ...(card || {}), ...(hero.palette || {}) }, S.genre);
  const ownPal = own?.intent?.palette || {}, said = (role) => ownPal[role] !== undefined || hero.palette?.[COLOUR_GROUPS[role]] !== undefined;
  const roles = Object.fromEntries(Object.entries(value.roles).filter(([role]) => !said(role)));
  const intent = pieces.length ? { ...(own?.intent || {}), palette: { ...roles, ...ownPal }, ...(w.amount && !own?.intent?.distort ? { distort: w.distort } : {}) } : own?.intent;
  const outfit = { type: 'outfit', style, ...(own?.laws !== undefined ? { laws: own.laws } : {}),
    dials: { ...(own?.dials || {}), stylize: own?.dials?.stylize ?? stylize, ornament: own?.dials?.ornament ?? D.ornament },
    ...(Object.keys(language).length ? { language } : {}), ...(pieces.length ? { pieces } : {}),
    ...(intent ? { intent } : {}), detail: own?.detail ?? D.detail };
  // an armour build takes the register as its mass and stylize, its own dials over them
  const armor = isArmor(hero.adorn) ? { ...hero.adorn, dials: { stylize, mass: r3(lerp(0.8, 1.8, S.r)), ...(hero.adorn.dials || {}) } } : null;
  return { S, G, moves, outfit, armor, stylize, D, warp: w, ownDetail: own?.detail !== undefined, value: pieces.length ? { ...value, said: Object.keys(value.roles).filter(said) } : null, P, balance, canon };
}

export function styledHero(hero) {
  if (!hero?.stylism) return hero;
  if (hero.outfit !== undefined && !isOutfit(hero.outfit)) return hero;   // a word or a garment list: the hero dressed itself
  const { outfit, armor } = solve(hero);
  return { ...hero, outfit, ...(armor ? { adorn: armor } : {}) };
}

export function stylismLedger(hero) {
  if (!hero?.stylism) return null;
  const { S, G, moves, stylize, value, D, ownDetail, warp, P, balance, canon } = solve(hero);
  const regWord = Object.entries(REGISTER_WORDS).reduce((b, [w, v]) => (Math.abs(v - S.r) < Math.abs(REGISTER_WORDS[b] - S.r) ? w : b), 'grounded');
  const notes = [{ stage: 'register', technique: `stylize ${stylize}`, where: 'the whole outfit', principle: 'one heightening for every element',
    why: `${regWord} (${S.r}) between ${G.register.grounded} and ${G.register.mythic}: the outfit's trims and fittings scale together; the pieces' sizes are warped after the design` }];
  if (!S.silhouette) notes.push({ stage: 'silhouette', technique: 'none', where: 'the outline', principle: 'the big shapes first', why: 'no target outline: the body\'s own stands' });
  if (balance) notes.push({ stage: 'silhouette', technique: `balance → ${balance.target}`, where: 'the figure', principle: `dress the figure (${canon ?? 'western'})`, why: balance.why });
  if (P) notes.push(...P.notes);
  const named = NAMED[S.silhouette];
  if (named) notes.push({ stage: 'silhouette', technique: S.silhouette, where: `a ${outlineOf(S.silhouette)}`, principle: 'a type reads by its signature', why: named.reads });
  for (const m of moves) notes.push({ stage: 'silhouette', technique: m.technique, where: S.silhouette, principle: named ? 'the signature makes the type' : 'a few big masses make the outline', why: m.note });
  if (G.detached && moves.some((m) => (m.pieces || []).some((p) => p.kind === 'pauldron'))) notes.push({ stage: 'silhouette', technique: 'detached', where: 'the shoulders', principle: 'a mass apart from the body reads as other', why: `${S.genre}: the plates hover off the shoulders, the gap between them and the body the genre's own` });
  if (hero.outfit !== undefined && !isOutfit(hero.outfit)) notes.push({ stage: 'silhouette', technique: 'none', where: 'the outfit', principle: 'what the hero says wins', why: 'the outfit is a word or a garment list: the stylism leaves it as it is' });
  // the warp: what the register heightened, after the design
  notes.push({ stage: 'warp', technique: warp.amount ? `warp ${warp.amount}` : 'none', where: 'the whole design', principle: 'exaggerate after the design, never into it',
    why: warp.amount ? `${regWord}: cloth flares and streamers × ${r3(warp.flare)}, rigid pieces thicker toward × ${G.warp?.chunk ?? 1.5}, the focal piece × ${r3(warp.focal)}; the silhouette's sizes stay its baseline` : `${regWord}: the baseline sizes, nothing heightened` });
  // the value stage: a stand-in until the style guide's palette, each role with what it answers locally
  if (value) { notes.push({ stage: 'value', technique: 'stand-in palette', where: 'the designed pieces', principle: 'value before hue', why: 'a stand-in until a style guide supplies the palette: it answers only local contrast, the complement and the materials' });
    for (const [role, why] of Object.entries(value.why)) notes.push({ stage: 'value', technique: `${role} ${value.said.includes(role) ? '(the hero\'s own)' : value.roles[role]}`, where: role, principle: role === 'accent' ? 'the complement spends the chroma' : ['trim', 'metal', 'leather'].includes(role) ? 'a material keeps its own colour' : 'local contrast', why: value.said.includes(role) ? 'named by the hero: it stands' : why }); }
  // the detail stage: the budget, each spend in order with its principle, what was left as rest
  const PRINCIPLE = { emblem: 'hierarchy: the focal richest', border: 'hierarchy: the focal richest', echo: 'repetition with variation', binding: 'rest: the quiet edges' };
  if (ownDetail) notes.push({ stage: 'detail', technique: 'none', where: 'the outfit', principle: 'what the hero says wins', why: 'the outfit names its own detail list: the budget stands down' });
  else { notes.push({ stage: 'detail', technique: `budget ${D.budget}`, where: `the ${D.focal}`, principle: 'how many, never how big', why: `${D.budget} units from the ${D.focal} out, one motif family (${D.motif}); ${D.spent.reduce((t, x) => t + x.cost, 0)} spent, ${D.left} left as rest; the construction's edges at ornament ${D.ornament}` });
    if (D.stalled) notes.push({ stage: 'detail', technique: 'rest', where: `the ${D.focal}`, principle: 'hierarchy: the focal richest', why: `the ${D.focal} is covered (${D.stalled}) and holds only what can be worn over it, so every other zone stays under it: ${D.left} units left as rest (a \`focal\` where the cloth shows spends them)` });
    for (const x of D.spent) notes.push({ stage: 'detail', technique: x.technique, where: `${x.zone}${x.role ? ` (${x.role})` : ''}`, principle: PRINCIPLE[x.technique] ?? (x.technique.startsWith('worn') ? 'the signature spends first' : x.technique.startsWith('metal') ? 'material contrast near the focal' : x.zone === D.focal ? 'hierarchy: the focal richest' : 'a fitting where the cloth is covered'), why: `${x.cost} unit${x.cost === 1 ? '' : 's'}${x.zone === D.focal ? ', at the focal' : ''}` }); }
  const approx = moves.filter((m) => m.approx).map((m) => m.approx);
  return { genre: S.genre, register: S.r, detail: S.d, silhouette: { target: S.silhouette, ...(G.detached ? { detached: true } : {}), outline: S.silhouette ? outlineOf(S.silhouette) : null, moves: moves.map((m) => m.technique), ...(approx.length ? { approximated: approx } : {}) }, notes };
}

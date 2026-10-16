/**
 * THE HERO'S LOOKS — the first half of the hero's page, visual only (no stats): each element designed on its own page,
 * then composed top down through the hero door into a base version.
 *
 *   heroLooks(G)     the four elements (body, head, hair, colour), each its own hero-door spec FRAGMENT and its own
 *                    review part (`hero:body` …), so each can be designed and approved in parallel. Every fragment reads
 *                    the same direction (the tradition, the motif, the primary and secondary elements) and none reads
 *                    another
 *   composeHero(G)   the fragments merged, top down, into ONE `via: 'hero'` spec with no adornment, paint or gear: it
 *                    wears only the UNDERLAYER, an outfit build at ornament 0 fitted to the world's setting. The base
 *                    version; adornment (a later page) layers over it and never replaces it
 *   heroOrders(G)    the tool calls that realize the page: `mint_solid` with the composed spec, then the motion's
 *                    (hero-vibe.js), so a gameworld can drive the tools in place of a creator prompting each one; and
 *                    one `update_sketch` patch per element, to re-apply that page alone once it changes
 *
 * Pure. `G` is a read world (readGameworld's) whose `characters` is present. The tradition decides the head and the
 * proportions (resolveDirection); the character light (`toon`) is a top-level `mint_solid` argument, not a spec field,
 * so it rides on the orders. A word the page cannot place is returned in `unread`, never dropped silently.
 */
import { resolveDirection, LOOKS_ELEMENTS } from './characters.js';
import { resolveMotion, motionOrders } from './hero-vibe.js';
import { ELEMENT_TINT } from './element-words.js';

export { ELEMENT_TINT };

/** The palette group each tint lands on: the leading element is the Trim, the supporting one the hair's highlight. */
const TINT_GROUP = Object.freeze({ primary: 'Trim', secondary: 'HairHighlight' });

/**
 * The underlayer rails: what a world's setting makes a person wear beneath everything else, by its kit. A small table,
 * not code per world: a new setting is a row. Each row is an outfit style (SEEDED_OUTFITS) and the language words it
 * changes (family, sleeve, hem, leg, feet); the tones come off the kit's ramps. A kit with no row wears `casual`.
 */
export const UNDERLAYERS = Object.freeze({
  'isekai-meadow':   { style: 'adventurer', language: { top: { family: 'woven', sleeve: 'threeQuarter', hem: 'tunic' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' }, read: 'a woven tunic to the thigh, long legs and boots: a village road' },
  'isekai-sakura':   { style: 'adventurer', language: { top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'shoes' }, read: 'a woven wrap top and long legs: a temple town' },
  'isekai-bamboo':   { style: 'adventurer', language: { top: { family: 'woven', sleeve: 'short', hem: 'hip' }, bottom: { family: 'woven', leg: 'capri' }, feet: 'shoes' }, read: 'light woven cloth, capri legs: a grove' },
  'isekai-garden':   { style: 'adventurer', language: { top: { family: 'woven', sleeve: 'elbow', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'shoes' }, read: 'a woven shirt and long legs: a cultivated place' },
  'gothic-nave':     { style: 'adventurer', language: { top: { family: 'woven', sleeve: 'long', hem: 'tunic' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' }, read: 'a long woven tunic, long legs, boots: stone and cold' },
  'jungle-trail':    { style: 'casual',     language: { top: { family: 'knit', sleeve: 'short', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' }, read: 'a knit short-sleeve top, long woven legs, boots: heat and brush' },
  'trail-valley':    { style: 'casual',     language: { top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' }, read: 'a knit long-sleeve top, long legs, boots: a trail' },
  'island-plaza':    { style: 'casual',     language: { top: { family: 'knit', sleeve: 'short', hem: 'hip' }, bottom: { family: 'woven', leg: 'knee' }, feet: 'shoes' }, read: 'a knit short-sleeve top, knee-length legs, shoes: a sunny resort' },
  'research-lab':    { style: 'office',     language: { top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'shoes' }, read: 'a plain knit top, long legs, shoes: indoors, clean' },
  'alien-night':     { style: 'athleisure', language: { top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'knit', leg: 'long' }, feet: 'boots' }, read: 'a close knit suit and boots: somewhere that is not home' },
});
const FALLBACK = Object.freeze({ style: 'casual', language: {}, read: 'plain casual clothes: the world\'s kit names no setting of its own' });

/** The tones an underlayer takes off a kit's ramps when the direction's elements leave them: the first ramp's middle
 * stop for the top, the second's for the bottom. */
function rampTones(ramps = []) {
  const mid = (r) => r?.stops?.[Math.floor(r.stops.length / 2)];
  const out = {};
  if (mid(ramps[0])) out.Top = mid(ramps[0]);
  if (mid(ramps[1] ?? ramps[0])) out.Bottom = mid(ramps[1] ?? ramps[0]);
  return out;
}

/**
 * What the base wears: the outfit build the world's setting chooses, at ornament 0, plus the ledger of where it came
 * from. `looks.underlayer` as an outfit build overrides the rail (and is ledgered); `null` or absent takes the rail.
 * Its tones, the creator's cut or the rail's, are the direction's elements, then the kit's ramps (`toneFrom` says which
 * each came from). → { build, read, ledger, tones, toneFrom }
 */
export function underlayerFor(G, D = resolveDirection(G)) {
  const own = G.characters?.hero?.looks?.underlayer ?? null;
  const rail = (D?.from === 'world' ? UNDERLAYERS[D.kit] : null) ?? FALLBACK, ledger = [];
  // an inline card is ledgered by its id (an Egocube's designed cut is `designed`), never as the whole card
  const styleName = (st) => (st && typeof st === 'object' ? st.id ?? 'an inline card' : st ?? 'casual');
  if (own) ledger.push({ scope: 'looks', at: 'hero.looks.underlayer', key: 'underlayer', world: rail.style, local: styleName(own.style) });
  // the base wears its underlayer plain (ornament 0): a creator's own that asked for more is told, not quietly changed
  if (own?.dials?.ornament) ledger.push({ scope: 'looks', at: 'hero.looks.underlayer.dials.ornament', key: 'underlayer ornament', world: 0, local: own.dials.ornament, note: 'the base wears its underlayer at ornament 0; adornment is its own page' });
  const build = own ? { ...own, dials: { ...(own.dials || {}), ornament: 0 } }
    : { type: 'outfit', style: rail.style, dials: { ornament: 0 }, ...(Object.keys(rail.language).length ? { language: { ...rail.language } } : {}) };
  // the clothes wear the direction: the leading element's tint on the top, the supporting one's on the bottom; the
  // kit's ramps dress whatever the elements leave (a word with no tint, or no element named)
  const tones = { ...(D?.from === 'world' ? rampTones(D.ramps) : {}) }, toneFrom = Object.fromEntries(Object.keys(tones).map((g) => [g, 'the kit\'s ramps']));
  for (const [group, k] of [['Top', 'primary'], ['Bottom', 'secondary']]) {
    const hex = D?.[k] ? ELEMENT_TINT[D[k].toLowerCase()] : undefined;
    if (hex) { tones[group] = hex; toneFrom[group] = `the ${k === 'primary' ? 'leading' : 'supporting'} element, ${D[k]}`; }
  }
  // a creator's underlayer that names its own tones (an inline card's `tones`: an Egocube's designed cut) keeps them
  const ownTones = own?.style && typeof own.style === 'object' && own.style.tones && typeof own.style.tones === 'object' ? own.style.tones : null;
  if (ownTones) for (const g of Object.keys(tones)) if (ownTones[g]) { delete tones[g]; toneFrom[g] = 'the creator\'s underlayer, its own'; }
  return { build, read: own ? 'the creator\'s own underlayer' : rail.read, ledger, tones, toneFrom };
}

/** The leading and supporting elements as palette tints; a word with no tint is returned unread. */
function tints(D) {
  const palette = {}, unread = [];
  for (const k of ['primary', 'secondary']) {
    if (!D[k]) continue;
    const hex = ELEMENT_TINT[D[k].toLowerCase()];
    if (hex) palette[TINT_GROUP[k]] = hex; else unread.push({ key: k, word: D[k], why: `no tint for '${D[k]}' (${Object.keys(ELEMENT_TINT).join(', ')}); it is carried as words` });
  }
  return { palette, unread };
}

/**
 * The four elements, each its own page: `{ body, head, hair, colour }`, each `{ part, read, spec, reads }`. `part` is
 * the review key (`hero:body` …); `spec` the hero-door fragment the page decides; `reads` what of the shared direction
 * it took (so the binder can show it). → { elements, unread, direction }; null when the world has no characters.
 */
export function heroLooks(G) {
  const D = resolveDirection(G);
  if (!D) return null;
  const L = G.characters.hero?.looks ?? {}, T = D.hero;
  const { palette: tint, unread } = tints(D);
  const motif = D.motif ? D.motif.words : undefined;
  const page = (key, spec, reads) => ({ part: `hero:${key}`, read: LOOKS_ELEMENTS[key].read, spec, reads });
  const own = (key) => ({ ...(L[key] || {}) });
  const colour = own('colour');
  const palette = { ...(D.palette ? paletteOfDirection(D.palette) : {}), ...tint, ...(colour.palette || {}) };
  const elements = {
    body: page('body', { ...own('body'), proportions: T.proportions }, { tradition: D.tradition, proportions: T.proportions }),
    head: page('head', { head: T.head, ...own('head') }, { tradition: D.tradition, head: T.head }),
    hair: page('hair', own('hair'), { ...(motif ? { motif } : {}), ...(D.primary ? { primary: D.primary } : {}) }),
    colour: page('colour', Object.keys(palette).length ? { palette } : {}, { ...(D.palette ? { palette: D.palette } : {}), ...(Object.keys(tint).length ? { tints: tint } : {}) }),
  };
  return { elements, unread, direction: D };
}

/** A direction's palette (a list of colours) as hero palette groups: the first is the Hair, the next the Top and Bottom. */
function paletteOfDirection(list) {
  const groups = ['Hair', 'Top', 'Bottom', 'Shoes'];
  return Object.fromEntries(list.slice(0, groups.length).map((h, i) => [groups[i], h]));
}

/**
 * The fragments merged, top down, into one hero-door spec. Order is the loop's: body, head, hair, colour, then the
 * underlayer. No `adorn`, `paint`, `gear` or `detail`: the base is bare but for what the setting wears.
 * `looks` is heroLooks', if at hand. → { spec, toon, underlayer, elements, unread, ledger }; null without characters.
 */
export function composeHero(G, looks = heroLooks(G)) {
  if (!looks) return null;
  const { elements, direction: D } = looks;
  const U = underlayerFor(G, D);
  const spec = {};
  for (const key of Object.keys(LOOKS_ELEMENTS)) Object.assign(spec, elements[key].spec);
  // the underlayer's tones sit beneath the creator's palette: the kit's ramps first, the colour page over them
  spec.palette = { ...(U.tones || {}), ...(spec.palette || {}) };
  if (!Object.keys(spec.palette).length) delete spec.palette;
  spec.outfit = U.build;
  return { spec, toon: D.hero.toon, underlayer: U, elements, unread: looks.unread, ledger: [...D.ledger, ...U.ledger] };
}

/**
 * The tool calls that realize the page: `mint_solid` with the composed spec (and the character light when the tradition
 * has one), then `motion`, the feel patched over the minted base. `patches` are NOT run after the mint (it already
 * carries every page, and each patch would only write a revision): each re-applies one element's page against `ref`
 * once that page changes. The colour page sets its palette group by group, so re-applying it keeps the underlayer's
 * tones. A creator, or later a gameworld runner, runs them; nothing here runs a tool.
 */
/**
 * A cast member's calls (characters.js cast): the hero's composer over the member's own looks and motion, under the
 * same direction, so the hero's own calls never change. → heroOrders' { mint, patches, motion?, unread }, or null.
 */
export function castOrders(G, id) {
  const m = G.characters?.cast?.[id];
  if (!m) return null;
  const shim = { ...G, characters: { ...G.characters, hero: { ...(m.looks ? { looks: m.looks } : {}), ...(m.motion ? { motion: m.motion } : {}) } } };
  return heroOrders(shim, { title: `${G.name ?? G.id} · ${m.name ?? id}` });
}

export function heroOrders(G, { title, composed } = {}) {
  const C = composed ?? composeHero(G);
  if (!C) return null;
  const mint = { tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title: title ?? `${G.name} hero`, spec: C.spec, ...(C.toon ? { toon: { light: true } } : {}) } };
  const patches = Object.entries(C.elements).map(([key, E]) => ({
    tool: 'update_sketch', part: E.part,
    args: { ref: '<ref of the mint>', patch: Object.entries(E.spec).flatMap(([field, value]) => (field === 'palette'
      ? Object.entries(value).map(([group, hex]) => ({ op: 'set', path: `/hero/palette/${group}`, value: hex }))
      : [{ op: 'set', path: `/hero/${field}`, value }])) },
  })).filter((o) => o.args.patch.length);
  // the feel, once the hero stands: its gaits and stand, then any custom clips, as patches of the same sketch
  const hero = G.characters.hero ?? {}, motion = hero.motion ? motionOrders(resolveMotion(hero.motion)) : null;
  return { mint, patches, ...(motion ? { motion } : {}), unread: C.unread };
}

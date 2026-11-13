/**
 * A KIN DRESSED AND SIZED: one body, many foes. A non-human people on the game's own rig (a kin: beast/cards.js) is one
 * body; what tells one of its foes from another is what it WEARS and how big it stands, never another body. Two ways:
 *
 *   WILD    bare, each its own size (`body.size`, WILD_SIZES): a runt, a lean one, a squat one, a big one. Nothing worn,
 *           so a crowd of them is a rabble, no two alike
 *   PACK    dressed alike (`pack`): a PACK STYLE's garments on every member, in one COLOURWAY, under one MARK (its
 *           motif), so a crowd of them reads as one band at a glance; its leaders wear more of the same, by rank
 *
 *   skin: { people: <a kin>, pack?: { style, colourway?, motif? }, body?: { coat?, size? } }
 *     pack.style      a pack style (PACK_STYLE_IDS)
 *     pack.colourway  the pack's colours (one of its colourways); absent, its first. A bestiary dressed alike shares them
 *     pack.motif      the pack's mark (one of the style's motifs: the outfit kernel's, outfit/expand.js); absent, its first
 *     body.coat       the body's own colour: one of its lineage's swatches by word (egocube/ancestry.js `cover`) or a
 *                     #rrggbb; absent, a pack's members share the lineage's first, a wild one keeps its sheet's roll
 *     body.size       how big it stands (WILD_SIZES); absent, the card's own
 *
 * A style is cut for the peoples it names (`peoples`), a people's own cut of it leaving off what its body does not take
 * (`cuts`: the orc wears the raiders bare-chested).
 * A pack style names no geometry. Its garments are an outfit build in the outfit kernel's own grammar (outfit/styles.js:
 * a cut), its pieces and their detail the stylism solver's (stylism/index.js: a genre, a silhouette, a register and a
 * budget by rank, the pack's motif), its leaders' helmets a kin's own (creature-heads/headgear.js: the skull's surface
 * set out, so one fits any kin), its colours a palette over the kin's one coat (beast/tiered.js beastWords: a hero's
 * own palette words stand over it). So a new pack is a row, and what it looks like on a body is solved, not modelled.
 *
 *   PACK_STYLES, PACK_STYLE_IDS, packStylesOf(people), WILD_SIZES, WILD_SIZE_IDS
 *   readPack(p, people, at) / readKinBody(b, people, at)   → the words read (throw teaching the words)
 *   kinWords(skin, { rank })   → the hero-door words a kin's figure takes over its sheet's person: `outfit`, `stylism`,
 *                                `palette`, `tune`, and a leader's `headgear`; null when the skin names neither a pack
 *                                nor a body
 *   packSays(skin) / bodySays(skin)   → the words in a line, for a book
 *
 * Pure and deterministic.
 */
import { BEAST_KINS, kinCoat } from '../beast/cards.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { HEIGHT, BUILD_TUNE } from '../egocube/plan.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** How a rank wears its pack: the stylism solver's register (how heightened) and budget (how many pieces), rising with
 * the rank (mind/vocab.js RANKS). The rank and file plain, its leaders considered and rich. */
export const PACK_RANKS = Object.freeze({
  minion: Object.freeze({ register: 'grounded', detail: 'plain' }),
  elite: Object.freeze({ register: 'grounded', detail: 'considered' }),
  miniboss: Object.freeze({ register: 'storybook', detail: 'considered' }),
  boss: Object.freeze({ register: 'storybook', detail: 'rich' }),
});

/** The pack styles: each a cut every member wears, the solver's words over it, its marks and its colourways. A
 * colourway's `tones` are the outfit's groups (Bottom, Outer, Panel, Trim, Leather, Buckle) and the solver's own
 * (OutfitBase … OutfitShade: its pieces' and its ornaments'), so no piece falls back to a colour derived off the coat. */
export const PACK_STYLES = Object.freeze({
  raiders: Object.freeze({
    name: 'Raiders',
    reads: 'a raiding band: a hide vest open over the bare chest, short breeches, a cloth in the pack\'s colour hung front and back from a belt, bare feet; shoulder plates and wrist wraps, and on its leaders the pack\'s mark and beads',
    peoples: Object.freeze(['goblin', 'orc']),
    // (a people's own cut of it: the parts of the cut its body leaves off. The orc's chest takes no vest: bare under its plates)
    cuts: Object.freeze({ orc: Object.freeze({ without: Object.freeze(['outer']), reads: 'bare-chested' }) }),
    outfit: Object.freeze({ type: 'outfit', style: Object.freeze({ id: 'designed', dials: Object.freeze({ stylize: 0.4, fit: 0.5, coverage: 1, ornament: 1 }),
      language: Object.freeze({ bottom: Object.freeze({ family: 'woven', leg: 'short' }), outer: Object.freeze({ family: 'woven', sleeve: 'none', hem: 'waist', open: true, fit: 'fitted' }),
        panels: Object.freeze([Object.freeze({ at: 'front', length: 'knee', width: 0.3, rigidity: 'soft' }), Object.freeze({ at: 'back', length: 'knee', width: 0.36, rigidity: 'soft' })]), feet: 'none', focal: 'belt' }) }) }),
    stylism: Object.freeze({ genre: 'fantasy', silhouette: 'brawler' }),
    // (what its leaders wear on the head, by rank: a kin's helmets, cut from its own skull, creature-heads/headgear.js; its
    // rank and file bare-headed)
    head: Object.freeze({ elite: 'kin-cap', miniboss: 'kin-nasal-helm', boss: 'kin-horned-helm' }),
    motifs: Object.freeze(['knot', 'key', 'wave', 'vine']),
    colourways: Object.freeze({
      rust: Object.freeze({ reads: 'rust hide and a red cloth, bone fittings',
        tones: Object.freeze({ Bottom: '#5a4632', Outer: '#6b3a26', Panel: '#8a2f24', Trim: '#d8c9a0', Leather: '#3d2a1d', Buckle: '#cdbb8a', OutfitBase: '#8a7a5c', OutfitSecond: '#5a4632', OutfitTrim: '#cdbb8a', OutfitAccent: '#8a2f24', OutfitMetal: '#5d5a55', OutfitShade: '#2e2620' }) }),
      bone: Object.freeze({ reads: 'blackened hide and a bone-pale cloth, bone fittings',
        tones: Object.freeze({ Bottom: '#3b3a36', Outer: '#2e2c2a', Panel: '#d9d2bd', Trim: '#d9d2bd', Leather: '#2a2522', Buckle: '#d9d2bd', OutfitBase: '#d9d2bd', OutfitSecond: '#3b3a36', OutfitTrim: '#d9d2bd', OutfitAccent: '#d9d2bd', OutfitMetal: '#6a6a66', OutfitShade: '#1f1e1c' }) }),
      moss: Object.freeze({ reads: 'green-brown hide and an ochre cloth, brass fittings',
        tones: Object.freeze({ Bottom: '#4a4a30', Outer: '#3f4a2c', Panel: '#b08a2e', Trim: '#c9a55a', Leather: '#33301f', Buckle: '#c9a55a', OutfitBase: '#7a7a4e', OutfitSecond: '#4a4a30', OutfitTrim: '#c9a55a', OutfitAccent: '#b08a2e', OutfitMetal: '#6b6046', OutfitShade: '#26281a' }) }),
    }),
  }),
});
export const PACK_STYLE_IDS = Object.freeze(Object.keys(PACK_STYLES));
/** The pack styles cut for a people (none: it wears its own roll). */
export const packStylesOf = (people) => PACK_STYLE_IDS.filter((id) => PACK_STYLES[id].peoples.includes(people));

/** How big a kin stands, over its card: its stature against the size its build gives it, and its frame's words
 * multiplied (the hero's tune words; a word its card names is its card's times this). A wild one's are its own. */
export const WILD_SIZES = Object.freeze({
  runt: Object.freeze({ reads: 'a runt: small under a head too big for it', stature: 0.83, frame: Object.freeze({ head: 1.12 }) }),
  lean: Object.freeze({ reads: 'a lean one: taller, narrow through the belly and the hips', stature: 1.07, frame: Object.freeze({ waist: 0.82, hips: 0.91, thigh: 0.82, legs: 1.14 }) }),
  squat: Object.freeze({ reads: 'a squat one: the card\'s own', stature: 1, frame: Object.freeze({}) }),
  big: Object.freeze({ reads: 'a big one: taller and broad, heavy in the arms and the neck', stature: 1.17, frame: Object.freeze({ shoulders: 1.22, depth: 1.17, upperArm: 1.3, forearm: 1.25, neckGirth: 1.2 }) }),
});
export const WILD_SIZE_IDS = Object.freeze(Object.keys(WILD_SIZES));

/** The peoples a pack or a body's words are read for: the kins (a people on the tiered body by its card). */
export const isKin = (people) => !!BEAST_KINS[people];

export function readPack(p, people, at = 'foe: .skin.pack') {
  if (!isObj(p)) throw new Error(`${at} is { style, colourway?, motif? } (the pack styles: ${PACK_STYLE_IDS.join(', ')})`);
  for (const k of Object.keys(p)) if (!['style', 'colourway', 'motif'].includes(k)) throw new Error(`${at} has no key '${k}' (style, colourway, motif)`);
  const S = PACK_STYLES[p.style];
  if (!S) throw new Error(`${at}.style: no pack style '${p.style}' (${PACK_STYLE_IDS.join(', ')})`);
  if (!S.peoples.includes(people)) throw new Error(`${at}: the ${S.name.toLowerCase()} are cut for ${S.peoples.join(', ')} (not ${people}); a people of another body wears its own roll`);
  if (p.colourway !== undefined && !S.colourways[p.colourway]) throw new Error(`${at}.colourway: the ${S.name.toLowerCase()}' colours are ${Object.keys(S.colourways).join(', ')}`);
  if (p.motif !== undefined && !S.motifs.includes(p.motif)) throw new Error(`${at}.motif: the ${S.name.toLowerCase()}' marks are ${S.motifs.join(', ')}`);
  return { style: p.style, colourway: p.colourway ?? Object.keys(S.colourways)[0], motif: p.motif ?? S.motifs[0] };
}

export function readKinBody(b, people, at = 'foe: .skin.body') {
  if (!isObj(b)) throw new Error(`${at} is { coat?, size? }`);
  if (!isKin(people)) throw new Error(`${at}: a body's words are a kin's (${Object.keys(BEAST_KINS).join(', ')}); a ${people} stands as its sheet rolls it`);
  for (const k of Object.keys(b)) if (!['coat', 'size'].includes(k)) throw new Error(`${at} has no key '${k}' (coat, size)`);
  const swatches = LINEAGES[people]?.cover ?? {};
  if (b.coat !== undefined && !(typeof b.coat === 'string' && (swatches[b.coat] || HEX.test(b.coat)))) throw new Error(`${at}.coat: one of the ${people}'s colours (${Object.keys(swatches).join(', ')}) or a #rrggbb`);
  if (b.size !== undefined && !WILD_SIZES[b.size]) throw new Error(`${at}.size: one of ${WILD_SIZE_IDS.join(', ')}`);
  return { ...(b.coat !== undefined ? { coat: b.coat } : {}), ...(b.size !== undefined ? { size: b.size } : {}) };
}

/** a body's coat as a colour: its swatch's, or the colour given */
const coatOf = (people, coat) => LINEAGES[people]?.cover?.[coat] ?? coat;
/** the stature a kin's sheet gives a build (egocube/plan.js beastOf: its height over a person's 1.8 m, held to 0.85 … 1.15) */
const sheetStature = (people, build) => { const only = LINEAGES[people]?.builds?.length === 1 ? LINEAGES[people].builds[0] : null, b = build ?? only ?? 'canonical'; return Math.min(1.15, Math.max(0.85, (BUILD_TUNE[b]?.stature ?? 1) * HEIGHT[b] / 1.8)); };

/**
 * The hero-door words a kin's figure takes over its sheet's person (gameworld/runner.js lays them, as it lays its gear):
 * a pack's garments and the solver's words at its rank, its colours over the body's one coat, the body's size as its
 * tune. A wild one with no words of its own takes none: null.
 */
export function kinWords(skin, { rank = 'minion' } = {}) {
  if (!skin || !isKin(skin.people) || (skin.pack === undefined && skin.body === undefined)) return null;
  const people = skin.people, P = skin.pack !== undefined ? readPack(skin.pack, people) : null, B = skin.body !== undefined ? readKinBody(skin.body, people) : {};
  const out = {};
  // (a pack's members share one coat, the lineage's first where the body names none; a wild one keeps its sheet's roll)
  const coat = B.coat !== undefined ? coatOf(people, B.coat) : P ? kinCoat(people) : null;
  if (P) {
    const S = PACK_STYLES[P.style], R = PACK_RANKS[rank] ?? PACK_RANKS.minion;
    out.outfit = structuredClone(S.outfit);
    for (const part of S.cuts?.[people]?.without ?? []) delete out.outfit.style.language[part];
    out.stylism = { ...S.stylism, register: R.register, detail: R.detail, motif: P.motif };
    out.palette = { Skin: coat, ...S.colourways[P.colourway].tones };
    if (S.head?.[rank]) out.headgear = S.head[rank];
  } else if (coat) out.palette = { Skin: coat };
  if (B.size !== undefined) {
    const Z = WILD_SIZES[B.size], frame = BEAST_KINS[people].frame ?? {};
    out.tune = { stature: r3(sheetStature(people, skin.facets?.build) * Z.stature), ...Object.fromEntries(Object.entries(Z.frame).map(([k, m]) => [k, r3((frame[k] ?? 1) * m)])) };
  }
  return Object.keys(out).length ? out : null;
}

/** A pack in a line: its style, its colours, its mark. */
export function packSays(skin) {
  if (skin?.pack === undefined) return null;
  const P = readPack(skin.pack, skin.people), S = PACK_STYLES[P.style];
  const cut = S.cuts?.[skin.people]?.reads;
  return `dressed as the ${S.name.toLowerCase()}${cut ? ` (${cut})` : ''}, ${S.colourways[P.colourway].reads}, its mark a ${P.motif}`;
}
/** A body's own words in a line: its size, its coat. */
export function bodySays(skin) {
  if (skin?.body === undefined) return null;
  const B = readKinBody(skin.body, skin.people);
  return [B.size ? WILD_SIZES[B.size].reads.replace(/:.*$/, '') : null, B.coat ? `${B.coat} in colour` : null].filter(Boolean).join(', ') || null;
}

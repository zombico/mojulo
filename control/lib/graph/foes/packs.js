/**
 * A KIN DRESSED AND SIZED: one body, many foes. A non-human people on the game's own rig (a kin: beast/cards.js) is one
 * body; what tells one of its foes from another is what it WEARS and how big it stands, never another body. Its gear is
 * never designed by hand either: it is what THE FRAME-ADORNED PRINCIPLES give it (egocube/outfit.js adornFromSheet: a
 * beast is not clothed, its body is the costume, and what it wears accents the frame: its role's gear, metal by its
 * station, one focal by its archetype, what its anatomy offers, what its concept makes, five pieces at most). Three ways:
 *
 *   WILD      bare, each its own size (`body.size`, WILD_SIZES): a runt, a lean one, a squat one, a big one. A rabble
 *   ADORNED   `adorned: true`: each geared by its own sheet, its own role and standing; no two alike but by their work
 *   PACK      `pack`: THE SAME PRINCIPLES WITH WHAT A BAND SHARES PINNED. A pack style pins the character every member
 *             is read as (its archetype, so its one focal and its concept's found things; its order, so its symmetry),
 *             its cloth, its colours and its mark; a member's CLASS still gives its role's gear and its RANK its station
 *             and how many pieces it keeps. So a crowd reads as one band at a glance, its fighters told from its
 *             casters by their gear, its leaders by wearing more of the same
 *
 *   skin: { people: <a kin>, adorned?: true, pack?: { style, colourway?, motif? }, body?: { coat?, size? } }
 *     pack.style      a pack style (PACK_STYLE_IDS)
 *     pack.colourway  the pack's colours (one of its colourways); absent, its first. A bestiary dressed alike shares them
 *     pack.motif      the pack's mark, embossed on its plates (one of the style's motifs); absent, its first
 *     body.coat       the body's own colour: one of its lineage's swatches by word (egocube/ancestry.js `cover`) or a
 *                     #rrggbb; absent, a pack's members share the lineage's first, any other keeps its sheet's roll
 *     body.size       how big it stands (WILD_SIZES); absent, the card's own
 *
 * A pack style names no geometry and no piece. A new pack is a row: a character, a cloth, colours, marks.
 *
 *   PACK_STYLES, PACK_STYLE_IDS, PACK_RANKS, packStylesOf(people), WILD_SIZES, WILD_SIZE_IDS
 *   readPack(p, people, at) / readKinBody(b, people, at)   → the words read (throw teaching the words)
 *   packSheet(skin, sheet)    → the member's sheet as its pack reads it (the pack's character over its own role and body)
 *   packAdornment(skin, { rank, sheet })   → { outfit, laws, concept }: the principles' answer for this member of its
 *                                pack (the pieces with their reasons, in the pack's colours and mark)
 *   kinWords(skin, { rank, sheet })   → the hero-door words a kin's figure takes over its sheet's person: a pack's
 *                                `outfit` and `palette` and a leader's `headgear`, a body's `tune` and coat; null when
 *                                the skin names neither a pack nor a body. `sheet` its rolled sheet (a pack is dressed
 *                                from it)
 *   kinBare(skin, sheet)      → the kin stands BARE: its sheet's people is adorned by the cube (below the clothed line,
 *                                on the tiered body) and its skin names neither `adorned` nor a pack (the wild)
 *   packSays(skin) / bodySays(skin)   → the words in a line, for a book
 *
 * Pure and deterministic.
 */
import { BEAST_KINS, kinCoat } from '../beast/cards.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { HEIGHT, BUILD_TUNE, CLOTHED_H, beastOnTiered } from '../egocube/plan.js';
import { adornFromSheet, heroAdornOf } from '../egocube/outfit.js';
import { outfitLaws } from '../polygonizer/outfit-plan.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** How a rank stands in its pack, as the principles read it: its STATION (the metal it has come to: arm rings from the
 * middle, the throat's at the top) and its ROOM (how many pieces it keeps of what the principles offer; five the most a
 * frame takes). The rank and file a few, its leaders all of it (mind/vocab.js RANKS). */
export const PACK_RANKS = Object.freeze({
  minion: Object.freeze({ station: 0.3, room: 3 }),
  elite: Object.freeze({ station: 0.55, room: 4 }),
  miniboss: Object.freeze({ station: 0.7, room: 5 }),
  boss: Object.freeze({ station: 0.9, room: 5 }),
});

/** The pack styles: what a band SHARES. `archetype` the character every member is read as (its focal, BEAST_FOCAL, and
 * its concept's found things, egocube/concept.js); `order` its symmetry (free at a half and over: one-sided, a raider's
 * one great shoulder; bound: paired); `cut` its cloth, an outfit's language with no garment on the chest, the frame
 * left bare for the pieces; `head` its leaders' helmets by rank (creature-heads/headgear.js); a colourway the outfit's
 * palette roles (base, secondary, trim, accent, leather, metal: the cloth in the secondary and the accent, the plates
 * in the metal, the found things in the base), each role a clear step of value from the others, as the outfit's laws
 * ask of any palette (polygonizer/outfit-plan.js outfitLaws: the pack's adornment is read by them again in its colours). */
export const PACK_STYLES = Object.freeze({
  raiders: Object.freeze({
    name: 'Raiders',
    reads: 'a raiding band: short breeches and a cloth in the pack\'s colour hung front and back from a belt, bare feet, the chest bare; over it a fighter\'s gear, one great shoulder plate its mark, trophies and paint; its leaders helmed',
    peoples: Object.freeze(['goblin', 'orc']),
    archetype: 'hero', order: 0.7,
    cut: Object.freeze({ dials: Object.freeze({ stylize: 0.4, fit: 0.5, coverage: 1, ornament: 1 }),
      language: Object.freeze({ bottom: Object.freeze({ family: 'woven', leg: 'short' }),
        panels: Object.freeze([Object.freeze({ at: 'front', length: 'knee', width: 0.3, rigidity: 'soft' }), Object.freeze({ at: 'back', length: 'knee', width: 0.36, rigidity: 'soft' })]), feet: 'none', focal: 'belt' }) }),
    head: Object.freeze({ elite: 'kin-cap', miniboss: 'kin-nasal-helm', boss: 'kin-horned-helm' }),
    motifs: Object.freeze(['knot', 'key', 'wave', 'vine']),
    colourways: Object.freeze({
      rust: Object.freeze({ reads: 'rust hide and a red cloth, bone fittings', roles: Object.freeze({ base: '#8f7f60', secondary: '#3a2c20', trim: '#cdbb8a', accent: '#9c3528', leather: '#3d2a1d', metal: '#5d5a55' }) }),
      bone: Object.freeze({ reads: 'blackened hide and a bone-pale cloth, bone fittings', roles: Object.freeze({ base: '#7d786c', secondary: '#2e2c2a', trim: '#d9d2bd', accent: '#d9d2bd', leather: '#2a2522', metal: '#6a6a66' }) }),
      moss: Object.freeze({ reads: 'green-brown hide and an ochre cloth, brass fittings', roles: Object.freeze({ base: '#5d5e3a', secondary: '#33301f', trim: '#d6b56a', accent: '#c29a36', leather: '#2a2819', metal: '#6b6046' }) }),
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
/** the pieces a pack's mark is embossed on (polygonizer/outfit-plan.js: a plate's motif) */
const MARKED = Object.freeze(['pauldron', 'chestPlate']);

/** The member's sheet as its pack reads it: its own role, body and anatomy; the pack's character (its archetype, its
 * order) in place of its own, an adult's standing (its rank says the rest). */
export function packSheet(skin, sheet) {
  const S = PACK_STYLES[readPack(skin.pack, skin.people).style];
  return { ...sheet, facets: { ...sheet.facets, archetype: S.archetype, order: S.order, age: 'adult' } };
}

export function packAdornment(skin, { rank = 'minion', sheet } = {}) {
  if (!sheet) throw new Error('foes/packs: a pack is dressed from its member\'s sheet (its role and its anatomy)');
  const P = readPack(skin.pack, skin.people), S = PACK_STYLES[P.style], R = PACK_RANKS[rank] ?? PACK_RANKS.minion;
  const coat = skin.body?.coat !== undefined ? coatOf(skin.people, skin.body.coat) : kinCoat(skin.people);
  const A = adornFromSheet(packSheet(skin, sheet), { coat, station: R.station, room: R.room });
  // (the pack's colours in place of the sheet's own roll; its mark on its plates)
  A.outfit.intent = { ...A.outfit.intent, palette: { ...S.colourways[P.colourway].roles } };
  for (const p of A.outfit.pieces) if (MARKED.includes(p.kind)) p.motif = P.motif;
  // (the laws read again on what is worn: the pack's colours, not the sheet's roll)
  return { ...A, laws: outfitLaws(A.outfit, { order: S.order, archetype: S.archetype, mustSee: [], frame: true }) };
}

/**
 * The hero-door words a kin's figure takes over its sheet's person (gameworld/runner.js lays them, as it lays its gear):
 * a pack's adornment over its cloth in its colours, its leaders' helmet, the body's one coat; the body's size as its
 * tune. A kin that names neither takes none: null.
 */
export function kinWords(skin, { rank = 'minion', sheet } = {}) {
  if (!skin || !isKin(skin.people) || (skin.pack === undefined && skin.body === undefined)) return null;
  const people = skin.people, P = skin.pack !== undefined ? readPack(skin.pack, people) : null, B = skin.body !== undefined ? readKinBody(skin.body, people) : {};
  const out = {};
  // (a pack's members share one coat, the lineage's first where the body names none; any other keeps its sheet's roll)
  const coat = B.coat !== undefined ? coatOf(people, B.coat) : P ? kinCoat(people) : null;
  if (P) {
    const S = PACK_STYLES[P.style], C = S.colourways[P.colourway].roles;
    // (its cloth in the pack's colours: the breeches the secondary, the hung cloth the accent, its fittings the trim)
    const tones = { Bottom: C.secondary, Panel: C.accent, Trim: C.trim, Buckle: C.trim, Leather: C.leather };
    out.outfit = heroAdornOf(packAdornment(skin, { rank, sheet }).outfit, { cut: { ...structuredClone(S.cut), tones } });
    out.palette = { Skin: coat, ...tones };
    if (S.head?.[rank]) out.headgear = S.head[rank];
  } else if (coat) out.palette = { Skin: coat };
  if (B.size !== undefined) {
    const Z = WILD_SIZES[B.size], frame = BEAST_KINS[people].frame ?? {};
    out.tune = { stature: r3(sheetStature(people, skin.facets?.build) * Z.stature), ...Object.fromEntries(Object.entries(Z.frame).map(([k, m]) => [k, r3((frame[k] ?? 1) * m)])) };
  }
  return Object.keys(out).length ? out : null;
}

export const kinBare = (skin, sheet) => !!skin && isKin(skin.people) && !skin.adorned && skin.pack === undefined && !!sheet && beastOnTiered(sheet) && sheet.facets.humanity < CLOTHED_H;

/** A pack in a line: its style, its colours, its mark. */
export function packSays(skin) {
  if (skin?.pack === undefined) return null;
  const P = readPack(skin.pack, skin.people), S = PACK_STYLES[P.style];
  return `of the ${S.name.toLowerCase()}, ${S.colourways[P.colourway].reads}, its mark a ${P.motif}`;
}
/** A body's own words in a line: its size, its coat. */
export function bodySays(skin) {
  if (skin?.body === undefined) return null;
  const B = readKinBody(skin.body, skin.people);
  return [B.size ? WILD_SIZES[B.size].reads.replace(/:.*$/, '') : null, B.coat ? `${B.coat} in colour` : null].filter(Boolean).join(', ') || null;
}
